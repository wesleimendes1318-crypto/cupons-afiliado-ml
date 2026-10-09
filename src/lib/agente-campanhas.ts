/* AGENTE DE CAMPANHAS (Weslei, 09/10: gestão autônoma de campanhas e
   vitrines). Roda em operacao?tarefa=campanhas (pg_cron 07:15 e 17:15 de
   Brasília):
   1. expira o que passou do prazo (expirar_campanhas; a mesma tarefa roda
      de hora em hora no banco);
   2. sincroniza as campanhas com a demanda, guardando a fonte, a hora e o
      tipo de demanda:
      - calendário (src/lib/sazonal.ts): Dia das Crianças, Natal, Black
        Friday, com as datas de verdade;
      - mais vendidos: produtos das listas oficiais de mais vendidos
        (mercado_sinais, /highlights) e marcados "Mais vendido" no hub de
        afiliados, já comparados. Campanha rolante: vale 3 dias e só
        continua se o agente renovar (sem renovação, expira sozinha);
      - mais vendidos por categoria (Casa, Tecnologia, Beleza) quando há
        pelo menos 6 aprovados na categoria;
   3. escolhe os produtos de cada uma com a curadoria
      (src/lib/curadoria-campanhas.ts) e grava em campanha_produtos;
   4. pede nova comparação (pedir_link_agente, com o teto diário dos
      agentes) dos produtos de campanha conferidos há mais de 48 h.
   Campanha pausada à mão (status 'pausada') não é reativada. */
import {
  janelaDaTemporada,
  ordenarDaCuradoria,
  SLUG_DA_TEMPORADA,
  vendedorDaOferta,
  vetoDaCuradoria,
  type Confiabilidade,
  type Vendedor,
  type Veto,
} from "@/lib/curadoria-campanhas";
import {
  ofertaDo,
  ofertaMenorPreco,
  type ItemMenorPreco,
  type ItemVitrine,
  type Oferta,
} from "@/lib/ofertas-vitrine";
import { combinaComTemporada, TEMPORADAS } from "@/lib/sazonal";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const MAX_POR_CAMPANHA = 24;
const REVALIDAR_MS = 48 * 3600_000;
const FILA_POR_VEZ = 4;
const VALIDADE_ROLANTE_MS = 3 * 86_400_000;
const REGRAS =
  "Só produtos já comparados, com vendedor confiável (loja oficial ou MercadoLíder), frete grátis confirmado e economia real. O preço é o da data da conferência.";

type ItemDaVitrine = ItemVitrine & { categoria_site: string | null };

type Definicao = {
  slug: string;
  nome: string;
  beneficio_texto: string;
  tema_visual: string | null;
  fonte: "calendario" | "tendencia" | "hub";
  demanda_tipo: "sazonal" | "mais_vendidos";
  temporada: string | null;
  categoria_site: string | null;
  inicia_em: string;
  termina_em: string;
  /* Produtos aprovados para virar ativa (0 = ativa pelo calendário). */
  minimo: number;
  seleciona: (o: Oferta) => boolean;
};

/* Chave da vitrine pelo endereço (mesma conta de chave_do_url no banco,
   só a parte com código MLB). */
function chaveDoUrl(u: string | null | undefined): string | null {
  const s = String(u ?? "");
  const m =
    s.match(/item_id(?:%3A|:)(MLB\d{6,})/i)?.[1] ??
    s.match(/\/p\/(MLB\d+)/i)?.[1] ??
    s.match(/\/up\/(MLBU\d+)/i)?.[1] ??
    s.match(/MLB-\d{6,}/i)?.[0]?.replace("-", "");
  return m ? m.toUpperCase() : null;
}

const CATEGORIAS_TOP: ReadonlyArray<{
  slug: string;
  nome: string;
  tema: string;
  sites: readonly string[];
}> = [
  { slug: "mais-vendidos-casa", nome: "Casa", tema: "casa", sites: ["casa"] },
  {
    slug: "mais-vendidos-tech",
    nome: "Tecnologia",
    tema: "tecnologia",
    sites: ["eletronicos", "celulares", "informatica"],
  },
  { slug: "mais-vendidos-beleza", nome: "Beleza", tema: "beleza", sites: ["beleza"] },
];

export async function gerirCampanhas(db: Db) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const agora = Date.now();
  const agoraIso = new Date(agora).toISOString();
  const erros: string[] = [];

  /* 1. Expiração (camada do agente; o banco faz de hora em hora). */
  const { data: expiradas } = await t.rpc("expirar_campanhas");

  /* Ofertas da vitrine com as mesmas regras da tela (frete grátis
     confirmado para a economia do mesmo produto e para o menor preço). */
  const [v, m] = await Promise.all([
    t.rpc("vitrine", { p_limite: 300 }),
    t.rpc("vitrine_menor_preco", { p_limite: 300 }),
  ]);
  const itens = (v.data ?? []) as ItemDaVitrine[];
  const menores = (m.data ?? []) as ItemMenorPreco[];
  const chaves = [...new Set([...itens.map((i) => i.chave), ...menores.map((i) => i.chave)])];
  const { data: fretes } = await t
    .from("produtos_vistos")
    .select("chave,frete_gratis,melhor_frete_gratis")
    .in("chave", chaves.length ? chaves : ["-"]);
  const frete = new Map<
    string,
    { frete_gratis: boolean | null; melhor_frete_gratis: boolean | null }
  >(
    (
      (fretes ?? []) as Array<{
        chave: string;
        frete_gratis: boolean | null;
        melhor_frete_gratis: boolean | null;
      }>
    ).map((f) => [f.chave, f]),
  );
  const categoriaDe = new Map(itens.map((i) => [i.chave, i.categoria_site]));
  const urlDe = new Map([...itens, ...menores].map((i) => [i.chave, i.url_produto] as const));

  const ofertas = new Map<string, Oferta>();
  for (const i of itens) {
    const semFrete = (i.economia ?? 0) > 0 && frete.get(i.chave)?.melhor_frete_gratis !== true;
    const o = ofertaDo(semFrete ? { ...i, economia: null } : i);
    if (o) ofertas.set(o.chave, o);
  }
  for (const i of menores) {
    if (ofertas.has(i.chave) || frete.get(i.chave)?.frete_gratis !== true) continue;
    const o = ofertaMenorPreco(i);
    if (o) ofertas.set(o.chave, o);
  }

  /* Vendedor de cada oferta (loja oficial / MercadoLíder) e frescor. */
  const { data: conf, error: erroConf } = await t.rpc("confiabilidade_da_vitrine", {
    p_chaves: [...ofertas.keys()],
  });
  if (erroConf) erros.push(`confiabilidade: ${String(erroConf.message).slice(0, 120)}`);
  const confDe = new Map(((conf ?? []) as Confiabilidade[]).map((c) => [c.chave, c]));

  /* Demanda: listas oficiais de mais vendidos (7 dias) e o hub. */
  const desde = new Date(agora - 7 * 86_400_000).toISOString();
  const { data: sinais } = await t
    .from("mercado_sinais")
    .select("produto_id,coletado_em")
    .eq("fonte", "ml_mais_vendidos")
    .gte("coletado_em", desde)
    .not("produto_id", "is", null)
    .limit(2000);
  const maisVendidos = new Set<string>();
  let coletaSinais: string | null = null;
  for (const s of (sinais ?? []) as Array<{ produto_id: string; coletado_em: string }>) {
    maisVendidos.add(String(s.produto_id).toUpperCase());
    if (!coletaSinais || s.coletado_em > coletaSinais) coletaSinais = s.coletado_em;
  }
  const { data: hub } = await t
    .from("hub_recomendados")
    .select("pedido_id,mais_vendido,avaliacao,lido_em")
    .gte("lido_em", desde)
    .not("pedido_id", "is", null);
  const hubLinhas = (hub ?? []) as Array<{
    pedido_id: number;
    mais_vendido: boolean | null;
    avaliacao: number | null;
    lido_em: string;
  }>;
  const notaDe = new Map<string, number>();
  if (hubLinhas.length) {
    const { data: peds } = await t
      .from("pedidos_link")
      .select("id,url_alvo")
      .in(
        "id",
        hubLinhas.map((h) => h.pedido_id),
      );
    const chaveDoPedido = new Map(
      ((peds ?? []) as Array<{ id: number; url_alvo: string }>).map((p) => [
        p.id,
        chaveDoUrl(p.url_alvo),
      ]),
    );
    for (const h of hubLinhas) {
      const c = chaveDoPedido.get(h.pedido_id);
      if (!c) continue;
      if (h.mais_vendido) maisVendidos.add(c);
      if (h.avaliacao != null) notaDe.set(c, Number(h.avaliacao));
    }
  }
  const ehMaisVendido = (o: Oferta) => {
    if (maisVendidos.has(o.chave)) return true;
    const p = String(o.urlProduto ?? "")
      .match(/\/p\/(MLB\d+)/i)?.[1]
      ?.toUpperCase();
    return !!p && maisVendidos.has(p);
  };

  /* 2. Campanhas desejadas agora. */
  const defs: Definicao[] = TEMPORADAS.map((tp) => ({
    slug: SLUG_DA_TEMPORADA[tp.id]!,
    nome: tp.nome,
    beneficio_texto:
      tp.descricao ??
      `${tp.rotulo}: produtos já comparados, com o mesmo produto mais barato em outra loja, alternativa de qualidade igual ou melhor, ou o menor preço confirmado.`,
    tema_visual: tp.temaVisual ?? null,
    fonte: "calendario",
    demanda_tipo: "sazonal",
    temporada: tp.id,
    categoria_site: null,
    ...janelaDaTemporada(tp),
    minimo: 0,
    seleciona: (o: Oferta) => combinaComTemporada(tp, o.titulo),
  }));
  const rolante = {
    inicia_em: agoraIso,
    termina_em: new Date(agora + VALIDADE_ROLANTE_MS).toISOString(),
  };
  defs.push({
    slug: "mais-vendidos",
    nome: "Mais vendidos com preço conferido",
    beneficio_texto:
      "Produtos que estão entre os mais vendidos da categoria, já comparados entre as lojas.",
    tema_visual: null,
    fonte: "tendencia",
    demanda_tipo: "mais_vendidos",
    temporada: null,
    categoria_site: null,
    ...rolante,
    minimo: 4,
    seleciona: ehMaisVendido,
  });
  for (const c of CATEGORIAS_TOP)
    defs.push({
      slug: c.slug,
      nome: `Mais vendidos em ${c.nome}`,
      beneficio_texto: `Os mais vendidos de ${c.nome}, já comparados entre as lojas.`,
      tema_visual: c.tema,
      fonte: "tendencia",
      demanda_tipo: "mais_vendidos",
      temporada: null,
      categoria_site: c.sites[0]!,
      ...rolante,
      minimo: 6,
      seleciona: (o: Oferta) =>
        ehMaisVendido(o) && c.sites.includes(categoriaDe.get(o.chave) ?? ""),
    });

  /* Estado atual (respeita pausa manual e mantém o início das rolantes). */
  const { data: atuais } = await t
    .from("campanhas")
    .select("id,slug,status,inicia_em,termina_em,fonte");
  const atualDe = new Map(
    (
      (atuais ?? []) as Array<{
        id: number;
        slug: string;
        status: string;
        inicia_em: string;
        termina_em: string;
      }>
    ).map((c) => [c.slug, c]),
  );

  const resumo: Array<Record<string, unknown>> = [];
  const paraRevalidar = new Map<string, string>();

  for (const d of defs) {
    const vetos: Partial<Record<Veto, number>> = {};
    const aprovados: Array<{ o: Oferta; v: Vendedor; conferido: number }> = [];
    let candidatos = 0;
    for (const o of ofertas.values()) {
      if (!d.seleciona(o)) continue;
      candidatos += 1;
      const c = confDe.get(o.chave);
      const veto = vetoDaCuradoria(o, c, notaDe.get(o.chave) ?? null, agora);
      if (veto) {
        vetos[veto] = (vetos[veto] ?? 0) + 1;
        continue;
      }
      aprovados.push({
        o,
        v: vendedorDaOferta(o, c),
        conferido: Date.parse(c?.conferido_em ?? o.vistoEm ?? agoraIso),
      });
    }
    const lista = ordenarDaCuradoria(aprovados, agora).slice(0, MAX_POR_CAMPANHA);
    const antes = atualDe.get(d.slug);
    const rolanteSemDemanda = d.fonte !== "calendario" && lista.length < d.minimo;
    /* Rolante sem produtos suficientes: não cria; se existia, deixa
       expirar no prazo que já tinha (sem renovar). */
    if (rolanteSemDemanda && !antes) {
      resumo.push({
        slug: d.slug,
        candidatos,
        aprovados: lista.length,
        vetos,
        status: "nao_criada",
      });
      continue;
    }
    const status =
      antes?.status === "pausada" || antes?.status === "arquivada"
        ? antes.status
        : Date.parse(d.termina_em) <= agora
          ? "expirada"
          : lista.length >= d.minimo
            ? "ativa"
            : "descoberta";
    const linha = {
      slug: d.slug,
      nome: d.nome,
      beneficio_texto: d.beneficio_texto,
      regras_resumo: REGRAS,
      tema_visual: d.tema_visual,
      fonte: d.fonte,
      demanda_tipo: d.demanda_tipo,
      temporada: d.temporada,
      categoria_site: d.categoria_site,
      inicia_em:
        d.fonte !== "calendario" && antes && antes.status === "ativa"
          ? antes.inicia_em
          : d.inicia_em,
      termina_em: rolanteSemDemanda && antes ? antes.termina_em : d.termina_em,
      revalidar_ate: new Date(agora + REVALIDAR_MS).toISOString(),
      status,
      coletado_em: d.fonte === "calendario" ? agoraIso : (coletaSinais ?? agoraIso),
      atualizado_em: agoraIso,
    };
    const { data: salva, error } = await t
      .from("campanhas")
      .upsert(linha, { onConflict: "slug" })
      .select("id")
      .maybeSingle();
    if (error || !salva?.id) {
      erros.push(`${d.slug}: ${String(error?.message ?? "sem id").slice(0, 120)}`);
      continue;
    }
    /* Produtos: troca a lista inteira (o que saiu da curadoria sai da tela). */
    await t.from("campanha_produtos").delete().eq("campanha_id", salva.id);
    if (lista.length) {
      const { error: e2 } = await t.from("campanha_produtos").insert(
        lista.map(({ o, v, conferido }, ordem) => ({
          campanha_id: salva.id,
          chave: o.chave,
          ordem,
          tipo: o.tipo,
          titulo: o.titulo.slice(0, 200),
          preco: o.preco,
          preco_antes: o.antes,
          economia: o.economia,
          loja: o.loja,
          link: o.link,
          lojas: o.lojas ?? null,
          loja_oficial: v.oficial,
          mercado_lider: v.lider,
          conferido_em: new Date(conferido).toISOString(),
        })),
      );
      if (e2) erros.push(`${d.slug} produtos: ${String(e2.message).slice(0, 120)}`);
    }
    if (status === "ativa")
      for (const { o, conferido } of lista)
        if (agora - conferido > REVALIDAR_MS && urlDe.get(o.chave))
          paraRevalidar.set(o.chave, urlDe.get(o.chave)!);
    resumo.push({ slug: d.slug, status, candidatos, aprovados: lista.length, vetos });
  }

  /* 4. Nova comparação dos produtos de campanha velhos (teto dos agentes). */
  let enfileirados = 0;
  for (const url of paraRevalidar.values()) {
    if (enfileirados >= FILA_POR_VEZ) break;
    const { data, error } = await t.rpc("pedir_link_agente", { p_url: url, p_fonte: "campanhas" });
    if (!error && typeof data === "number") enfileirados += 1;
  }

  return {
    ok: erros.length === 0,
    expiradas: expiradas ?? 0,
    ofertas: ofertas.size,
    campanhas: resumo,
    revalidar: paraRevalidar.size,
    enfileirados,
    erros,
  };
}
