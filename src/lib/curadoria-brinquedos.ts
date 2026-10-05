/* CURADORIA DE BRINQUEDOS (05/10), só servidor. O agente busca sozinho na
   API oficial do Mercado Livre, sem depender dos visitantes:
   1. MAPEIA as oportunidades: mais vendidos de Brinquedos e de uma
      subcategoria por vez (/highlights, "Em alta") ou as buscas de uma
      faixa de idade (src/lib/brinquedos.ts), a faixa mais desatualizada
      primeiro.
   2. Para cada produto do catálogo, lê a lista oficial de ofertas
      (/products/{id}/items) e escolhe a oferta NOVA mais barata (empate:
      frete grátis, depois loja oficial). Guarda quantas ofertas viu: é a
      prova do "menor preço entre N ofertas".
   3. Põe a oferta escolhida na fila de comparação (pedir_link_novo, com o
      anúncio no endereço: pdp_filters=item_id). A extensão compara com as
      outras lojas e gera o link de afiliado (meli.la); só então o produto
      aparece no site (curadoria_brinquedos exige comparação pronta com
      meli.la).
   Tetos por execução (limite de subrequisições e proteção da conta):
   até 24 chamadas à API e 6 produtos novos na fila; cada produto volta à
   fila no máximo a cada 48 h. */
import { mlGet } from "@/lib/ml-api";
import {
  FAIXAS,
  faixaDaIdade,
  idadeDosAtributos,
  pareceBrinquedo,
  type Faixa,
} from "@/lib/brinquedos";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* Brinquedos e Hobbies e subcategorias para o "Em alta" (rodízio). */
const CATEGORIA = "MLB1132";
const SUBCATEGORIAS = ["MLB3655", "MLB264337", "MLB455425", "MLB432871", "MLB1166", "MLB432988"];

type Attr = { id?: string; name?: string; value_name?: string | null };
type Candidato = {
  produto: string;
  nome: string;
  imagem: string | null;
  faixa: Faixa["id"] | null;
  em_alta: boolean;
  posicao: number | null;
  idade_texto: string | null;
  busca: string | null;
};
type Linha = Candidato & {
  item: string;
  preco_ref: number;
  ofertas: number;
  frete_gratis_ref: boolean | null;
  url: string;
};

const TETO_API = 24;
const FILA_POR_VEZ = 6;
const VOLTA_MS = 48 * 3600_000;

export async function curarBrinquedos(db: Db, opcoes: { alvo?: string | null } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  let chamadas = 0;
  const erros: string[] = [];

  /* Alvo: o pedido explícito ou o mais desatualizado (faixas + em alta). */
  const { data: estado } = await t
    .from("curadoria_brinquedos_itens")
    .select("produto,faixa,em_alta,item,atualizado_em,enfileirado_em,pedido_id");
  const linhas = (estado ?? []) as Array<{
    produto: string;
    faixa: string | null;
    em_alta: boolean;
    atualizado_em: string;
    enfileirado_em: string | null;
    pedido_id: number | null;
  }>;
  const ultimo = (alvo: string) =>
    Math.max(
      0,
      ...linhas
        .filter((l) => (alvo === "em_alta" ? l.em_alta : l.faixa === alvo))
        .map((l) => Date.parse(l.atualizado_em)),
    );
  const alvos = ["em_alta", ...FAIXAS.map((f) => f.id)];
  const alvo =
    opcoes.alvo && alvos.includes(opcoes.alvo)
      ? opcoes.alvo
      : alvos.sort((a, b) => ultimo(a) - ultimo(b))[0]!;

  const candidatos: Candidato[] = [];
  if (alvo === "em_alta") {
    const sub = SUBCATEGORIAS[Math.floor(Date.now() / 3600_000) % SUBCATEGORIAS.length]!;
    for (const cat of [CATEGORIA, sub]) {
      if (chamadas >= TETO_API) break;
      try {
        chamadas += 1;
        const h = await mlGet<{
          content?: Array<{ id?: string; position?: number; type?: string }>;
        }>(`/highlights/MLB/category/${cat}`);
        for (const c of (h.content ?? []).filter((x) => x.type === "PRODUCT").slice(0, 5)) {
          if (!c.id || candidatos.some((x) => x.produto === c.id)) continue;
          candidatos.push({
            produto: c.id,
            nome: "",
            imagem: null,
            faixa: null,
            em_alta: true,
            posicao: c.position ?? null,
            idade_texto: null,
            busca: null,
          });
        }
      } catch (e) {
        erros.push(`highlights ${cat}: ${String((e as Error).message).slice(0, 80)}`);
      }
    }
    /* Nome, foto e idade pelo catálogo. */
    for (const c of candidatos) {
      if (chamadas >= TETO_API - 6) break;
      try {
        chamadas += 1;
        const p = await mlGet<{
          name?: string;
          pictures?: Array<{ url?: string }>;
          attributes?: Attr[];
        }>(`/products/${c.produto}`);
        c.nome = String(p.name ?? "").slice(0, 160);
        c.imagem = p.pictures?.[0]?.url ?? null;
        const idade = idadeDosAtributos(p.attributes);
        c.idade_texto = idade.texto;
        c.faixa = faixaDaIdade(idade.min);
      } catch {
        /* sem ficha: fica de fora (nome vazio) */
      }
    }
  } else {
    const faixa = FAIXAS.find((f) => f.id === alvo)!;
    /* Rodízio das buscas: 3 por execução. */
    const ini = Math.floor(Date.now() / (6 * 3600_000)) % faixa.buscas.length;
    const buscas = [0, 1, 2].map((k) => faixa.buscas[(ini + k) % faixa.buscas.length]!);
    for (const b of buscas) {
      if (chamadas >= TETO_API) break;
      try {
        chamadas += 1;
        const r = await mlGet<{
          results?: Array<{
            id?: string;
            name?: string;
            pictures?: Array<{ url?: string }>;
            attributes?: Attr[];
          }>;
        }>(`/products/search?status=active&site_id=MLB&q=${encodeURIComponent(b)}&limit=6`);
        let desta = 0;
        for (const p of r.results ?? []) {
          if (desta >= 3) break;
          const id = String(p.id ?? "").toUpperCase();
          const nome = String(p.name ?? "");
          if (!/^MLB\d+$/.test(id) || !nome || !pareceBrinquedo(nome)) continue;
          if (candidatos.some((x) => x.produto === id)) continue;
          const idade = idadeDosAtributos(p.attributes);
          /* Idade informada que não cabe na faixa: vai para a faixa certa
             (doação aceita qualquer idade). */
          const certa = faixa.id === "doacao" ? "doacao" : (faixaDaIdade(idade.min) ?? faixa.id);
          candidatos.push({
            produto: id,
            nome: nome.slice(0, 160),
            imagem: p.pictures?.[0]?.url ?? null,
            faixa: certa,
            em_alta: false,
            posicao: null,
            idade_texto: idade.texto,
            busca: b,
          });
          desta += 1;
        }
      } catch (e) {
        erros.push(`busca ${b}: ${String((e as Error).message).slice(0, 80)}`);
      }
    }
  }

  /* Oferta nova mais barata da lista oficial de cada produto. */
  const prontas: Linha[] = [];
  for (const c of candidatos) {
    if (!c.nome || !pareceBrinquedo(c.nome)) continue;
    if (chamadas >= TETO_API) break;
    try {
      chamadas += 1;
      const o = await mlGet<{
        results?: Array<{
          item_id?: string;
          price?: number;
          condition?: string;
          official_store_id?: number | null;
          shipping?: { free_shipping?: boolean };
        }>;
      }>(`/products/${c.produto}/items?limit=50`);
      const novas = (o.results ?? []).filter(
        (x) =>
          x.item_id && /^MLB\d+$/.test(x.item_id) && Number(x.price) > 0 && x.condition !== "used",
      );
      if (!novas.length) continue;
      novas.sort(
        (a, b) =>
          Number(a.price) - Number(b.price) ||
          Number(!!b.shipping?.free_shipping) - Number(!!a.shipping?.free_shipping) ||
          Number(!!b.official_store_id) - Number(!!a.official_store_id),
      );
      const melhor = novas[0]!;
      const preco = Number(melhor.price);
      const faixa = FAIXAS.find((f) => f.id === c.faixa);
      if (faixa?.precoMax && preco > faixa.precoMax) continue;
      prontas.push({
        ...c,
        item: melhor.item_id!,
        preco_ref: preco,
        ofertas: novas.length,
        frete_gratis_ref: melhor.shipping?.free_shipping === true ? true : null,
        url: `https://www.mercadolivre.com.br/p/${c.produto}?pdp_filters=item_id%3A${melhor.item_id}`,
      });
    } catch {
      /* sem oferta ativa (404): fica de fora */
    }
  }

  /* Fila de comparação: novos ou com a última comparação há mais de 48 h. */
  const porProduto = new Map(linhas.map((l) => [l.produto, l]));
  const agora = new Date().toISOString();
  let enfileirados = 0;
  const gravar = [];
  for (const l of prontas) {
    const antes = porProduto.get(l.produto);
    const velho =
      !antes?.enfileirado_em || Date.now() - Date.parse(antes.enfileirado_em) > VOLTA_MS;
    let pedido = antes?.pedido_id ?? null;
    let enfileirado = antes?.enfileirado_em ?? null;
    if (velho && enfileirados < FILA_POR_VEZ) {
      const { data, error } = await t.rpc("pedir_link_novo", { p_url: l.url });
      if (!error && typeof data === "number") {
        pedido = data;
        enfileirado = agora;
        enfileirados += 1;
      }
    }
    gravar.push({
      produto: l.produto,
      item: l.item,
      nome: l.nome,
      imagem: l.imagem,
      /* "Em alta" não apaga a faixa que uma busca já deu. */
      faixa: l.faixa ?? antes?.faixa ?? null,
      em_alta: l.em_alta || antes?.em_alta || false,
      posicao: l.posicao,
      idade_texto: l.idade_texto,
      busca: l.busca,
      preco_ref: l.preco_ref,
      ofertas: l.ofertas,
      frete_gratis_ref: l.frete_gratis_ref,
      url: l.url,
      pedido_id: pedido,
      enfileirado_em: enfileirado,
      atualizado_em: agora,
    });
  }
  if (gravar.length) {
    const { error } = await t
      .from("curadoria_brinquedos_itens")
      .upsert(gravar, { onConflict: "produto" });
    if (error) erros.push(`gravar: ${String(error.message).slice(0, 120)}`);
  }
  return {
    ok: true,
    alvo,
    chamadas,
    candidatos: candidatos.length,
    comOferta: prontas.length,
    enfileirados,
    erros,
  };
}
