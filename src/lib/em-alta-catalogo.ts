/* EM ALTA NO CATÁLOGO, POR CATEGORIA (Weslei, 09/10: "preciso que puxe um
   bom volume de produtos em alta para cada categoria, tenho poucas opções no
   meu site hoje"; "no caso, catálogos do mercado livre"). Só servidor.
   1. Lista oficial de MAIS VENDIDOS da categoria (/highlights/MLB/category)
      de cada categoria do site, uma categoria por execução (a mais
      desatualizada primeiro).
   2. Para cada produto do catálogo: nome, foto e a oferta que o próprio
      catálogo destaca (buy_box_winner); sem ela, a oferta NOVA mais barata
      da lista oficial (/products/{id}/items). Usado, peça no lugar do
      aparelho e categoria proibida ficam de fora.
   3. Guarda em em_alta_catalogo (o site mostra com o preço de referência e
      a data, "Comparar preço" e "Comprar com segurança", que gera o link de
      afiliado no clique) e põe os primeiros na fila de comparação
      (pedir_link_agente: teto diário dos agentes e cota da conferência).
      Comparados, entram na vitrine pelas regras de sempre.
   Meta: pelo menos 24 por categoria (Weslei, 09/10: "pelo menos 20 em
   cada"); a categoria com menos produtos vem primeiro e, acabando a lista
   principal, as subcategorias oficiais (as maiores). Tetos por execução:
   32 chamadas à API, 16 produtos, 4 na fila; cada produto volta à fila no
   máximo a cada 48 h. */
import { categoriaDoMaisVendido } from "@/lib/categoria-em-alta";
import { RE_PECA_PARTE } from "@/lib/conferir-produto";
import { ErroApiMl, mlGet } from "@/lib/ml-api";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* Categorias do site -> categorias oficiais (códigos MLB). */
export const CATEGORIAS_EM_ALTA: Record<string, string[]> = {
  eletronicos: ["MLB1000", "MLB1144"],
  celulares: ["MLB1051"],
  informatica: ["MLB1648"],
  casa: ["MLB1574"],
  /* 09/10: categorias próprias (em alta nos sinais da semana). */
  eletrodomesticos: ["MLB5726"],
  ferramentas: ["MLB263532", "MLB270252"],
  moda: ["MLB1430"],
  beleza: ["MLB1246"],
  automotivo: ["MLB5672"],
  brinquedos: ["MLB1132"],
};

const TETO_API = 32;
/* Weslei, 09/10: "pelo menos 20 anúncios em cada" categoria. */
/* 09/10, noite: "aumentar todos os dias o número de anúncios": 48. */
/* 09/10, noite: "Avalie 100 anúncios por categoria. Precisa ser incluído e
   removido sem depender de créditos": 100, com o pg_cron a cada 30 min. */
const META_POR_CATEGORIA = 100;
/* Produto lido há menos de 20 h fica para a próxima: a execução seguinte
   avança para outros produtos e subcategorias. */
const FRESCO_MS = 20 * 3600_000;
/* 2 por execução (48 execuções/dia): o teto diário dos agentes é dividido
   com sazonal, brinquedos, campanhas e hub. */
const FILA_POR_VEZ = 2;
const VOLTA_MS = 48 * 3600_000;
const PRODUTOS_POR_EXECUCAO = 16;
/* MAIS DESEJADOS (Weslei, 09/10, noite: "adicione os itens mais
   desejados"; "os produtos de informática devem ser os mais pesquisados,
   também os bonitinhos"): os termos mais buscados da categoria na lista
   oficial (/trends/MLB/{categoria}, guardada 20 h) viram buscas no
   catálogo; até 3 buscas e 2 produtos por busca a cada execução. O cartão
   diz "Em alta nas buscas" (dado da lista oficial). Em Informática, além
   disso, buscas fixas de periféricos bonitos e coloridos. */
const BUSCAS_POR_EXECUCAO = 3;
const BUSCAS_CURADORIA: Record<string, string[]> = {
  informatica: [
    "teclado rosa",
    "mouse sem fio fofo",
    "mousepad fofo",
    "kit teclado e mouse colorido",
    "teclado mecanico branco",
    "suporte notebook ajustavel",
  ],
};
/* Árvore oficial: filhos por nível (as maiores primeiro), até os netos da
   categoria (Moda -> Calçados -> Tênis). Chamadas para listas e filhos
   param aqui; o resto do teto fica para as fichas dos produtos. */
const FILHOS_POR_NIVEL = [8, 6];
const TETO_ARVORE = TETO_API - 12;
/* Memória (em_alta_vistos): produto descartado fica 7 dias fora; lista
   sem produto novo, 20 h; filhos de uma categoria, 7 dias. */
const DESCARTE_MS = 7 * 24 * 3600_000;
const FILHOS_MS = 7 * 24 * 3600_000;

type Oferta = {
  item_id?: string;
  price?: number;
  condition?: string;
  shipping?: { free_shipping?: boolean };
  official_store_id?: number | null;
};

type Linha = {
  produto: string;
  categoria_site: string;
  categoria_ml: string;
  posicao: number;
  nome: string;
  imagem: string | null;
  imagem2: string | null;
  item: string;
  preco: number;
  ofertas: number | null;
  frete_gratis: boolean | null;
  loja_oficial: boolean;
  url: string;
  origem: string;
  busca: string | null;
};

const fotoGrande = (u: string | null | undefined) =>
  u ? u.replace(/^http:/, "https:").replace(/-[A-Z](\.(?:webp|jpg|jpeg|png))$/i, "-O$1") : null;

export async function atualizarEmAlta(db: Db, opcoes: { categoria?: string | null } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  let chamadas = 0;
  const erros: string[] = [];

  const { data: estado } = await t
    .from("em_alta_catalogo")
    .select("produto,categoria_site,atualizado_em,enfileirado_em");
  const linhas = (estado ?? []) as Array<{
    produto: string;
    categoria_site: string;
    atualizado_em: string;
    enfileirado_em: string | null;
  }>;
  const agoraMs = Date.now();
  const ultimo = (c: string) =>
    Math.max(
      0,
      ...linhas.filter((l) => l.categoria_site === c).map((l) => Date.parse(l.atualizado_em)),
    );
  /* Produtos à mostra (até 3 dias, como a leitura pública). */
  const visiveis = (c: string) =>
    linhas.filter(
      (l) => l.categoria_site === c && agoraMs - Date.parse(l.atualizado_em) < 72 * 3600_000,
    ).length;
  /* Última TENTATIVA de cada categoria (execuções anteriores): uma
     categoria que não cresce mais não prende o rodízio das outras. */
  const { data: execs } = await t
    .from("operacao_execucoes")
    .select("inicio,resumo")
    .eq("tarefa", "em_alta")
    .order("inicio", { ascending: false })
    .limit(60);
  const tentativa = (c: string) =>
    Math.max(
      ultimo(c),
      ...((execs ?? []) as Array<{ inicio: string; resumo: { categoria?: string } | null }>)
        .filter((e) => e.resumo?.categoria === c)
        .map((e) => Date.parse(e.inicio)),
    );
  const prioridade = (c: string) =>
    visiveis(c) < META_POR_CATEGORIA && agoraMs - tentativa(c) > 2 * 3600_000 ? 0 : 1;
  const nomes = Object.keys(CATEGORIAS_EM_ALTA);
  /* Abaixo da meta (e sem tentativa nas últimas 2 h) primeiro, com menos
     produtos na frente; depois o rodízio pela tentativa mais antiga. */
  const categoria =
    opcoes.categoria && CATEGORIAS_EM_ALTA[opcoes.categoria]
      ? opcoes.categoria
      : nomes.sort(
          (a, b) =>
            prioridade(a) - prioridade(b) ||
            (prioridade(a) === 0 ? visiveis(a) - visiveis(b) : 0) ||
            tentativa(a) - tentativa(b),
        )[0]!;
  const recentes = new Set(
    linhas.filter((l) => agoraMs - Date.parse(l.atualizado_em) < FRESCO_MS).map((l) => l.produto),
  );

  /* Memória do agente: descartes, listas esgotadas e filhos. */
  const { data: memoria } = await t
    .from("em_alta_vistos")
    .select("chave,motivo,visto_em")
    .gte("visto_em", new Date(agoraMs - DESCARTE_MS).toISOString());
  const vistos = new Map(
    ((memoria ?? []) as Array<{ chave: string; motivo: string | null; visto_em: string }>).map(
      (m) => [m.chave, m],
    ),
  );
  const lembrar: Array<{ chave: string; motivo: string; visto_em: string }> = [];
  const anotar = (chave: string, motivo: string) =>
    lembrar.push({ chave, motivo, visto_em: new Date().toISOString() });
  const descartado = (produto: string) => vistos.has(`produto:${produto}`);
  const esgotada = (cat: string) => {
    const m = vistos.get(`fonte:${cat}`);
    return !!m && agoraMs - Date.parse(m.visto_em) < FRESCO_MS;
  };

  /* 1. Fontes: a lista oficial da categoria e, enquanto faltar produto,
        as das subcategorias e das sub-subcategorias (as maiores primeiro). */
  const bases = CATEGORIAS_EM_ALTA[categoria]!;
  const expandir = visiveis(categoria) < META_POR_CATEGORIA * 2;
  const fila: Array<{ cat: string; peso: number; nivel: number }> = bases.map((cat) => ({
    cat,
    peso: 0,
    nivel: 0,
  }));
  const candidatos: Array<{
    produto: string;
    posicao: number;
    cat: string;
    origem?: "tendencia" | "curadoria";
    busca?: string;
  }> = [];

  /* 0. Mais desejados: termos mais buscados (e a curadoria de Informática). */
  const buscas: Array<{
    termo: string;
    origem: "tendencia" | "curadoria";
    peso: number;
    cat: string;
  }> = [];
  for (const base of bases) {
    if (chamadas >= TETO_ARVORE) break;
    const mem = vistos.get(`tendencias:${base}`);
    let termos: string[] = [];
    if (mem && agoraMs - Date.parse(mem.visto_em) < FRESCO_MS) {
      termos = (mem.motivo ?? "").split("|").filter(Boolean);
    } else {
      try {
        chamadas += 1;
        const tr = await mlGet<Array<{ keyword?: string }>>(`/trends/MLB/${base}`);
        termos = (Array.isArray(tr) ? tr : [])
          .map((x) => String(x.keyword ?? "").trim())
          .filter((x) => x.length >= 3)
          .slice(0, 20);
        anotar(`tendencias:${base}`, termos.join("|"));
      } catch (e) {
        erros.push(`tendencias ${base}: ${String((e as Error).message).slice(0, 80)}`);
      }
    }
    termos.forEach((termo, n) =>
      buscas.push({ termo, origem: "tendencia", peso: 60 + n, cat: base }),
    );
  }
  (BUSCAS_CURADORIA[categoria] ?? []).forEach((termo, n) =>
    buscas.push({ termo, origem: "curadoria", peso: 80 + n, cat: bases[0]! }),
  );
  let feitas = 0;
  for (const b of buscas) {
    if (feitas >= BUSCAS_POR_EXECUCAO || candidatos.length >= PRODUTOS_POR_EXECUCAO) break;
    if (chamadas >= TETO_ARVORE) break;
    const mem = vistos.get(`busca:${b.termo}`);
    if (mem && agoraMs - Date.parse(mem.visto_em) < FRESCO_MS) continue;
    try {
      chamadas += 1;
      feitas += 1;
      const r = await mlGet<{ results?: Array<{ id?: string }> }>(
        `/products/search?status=active&site_id=MLB&q=${encodeURIComponent(b.termo)}&limit=6`,
      );
      let n = 0;
      for (const p of r.results ?? []) {
        if (!p.id || recentes.has(p.id) || descartado(p.id)) continue;
        if (candidatos.some((x) => x.produto === p.id)) continue;
        candidatos.push({
          produto: p.id,
          posicao: b.peso,
          cat: b.cat,
          origem: b.origem,
          busca: b.termo,
        });
        if (++n >= 2 || candidatos.length >= PRODUTOS_POR_EXECUCAO) break;
      }
      anotar(`busca:${b.termo}`, String(n));
    } catch (e) {
      erros.push(`busca ${b.termo}: ${String((e as Error).message).slice(0, 80)}`);
    }
  }

  let ordem = 0;
  while (fila.length && candidatos.length < PRODUTOS_POR_EXECUCAO && chamadas < TETO_ARVORE) {
    const f = fila.shift()!;
    if (!esgotada(f.cat)) {
      try {
        chamadas += 1;
        const h = await mlGet<{
          content?: Array<{ id?: string; position?: number; type?: string }>;
        }>(`/highlights/MLB/category/${f.cat}`);
        let novos = 0;
        for (const c of (h.content ?? []).filter((x) => x.type === "PRODUCT" && x.id)) {
          if (recentes.has(c.id!) || descartado(c.id!)) continue;
          if (candidatos.some((x) => x.produto === c.id)) continue;
          novos += 1;
          if (candidatos.length < PRODUTOS_POR_EXECUCAO)
            candidatos.push({ produto: c.id!, posicao: f.peso + (c.position ?? 50), cat: f.cat });
        }
        if (!novos) anotar(`fonte:${f.cat}`, "sem produto novo");
      } catch (e) {
        erros.push(`highlights ${f.cat}: ${String((e as Error).message).slice(0, 80)}`);
      }
    }
    if (!expandir || f.nivel >= FILHOS_POR_NIVEL.length) continue;
    /* Filhos da categoria: da memória (7 dias) ou da API. */
    let filhos: string[] | null = null;
    const m = vistos.get(`filhos:${f.cat}`);
    if (m && agoraMs - Date.parse(m.visto_em) < FILHOS_MS) {
      filhos = (m.motivo ?? "").split(",").filter(Boolean);
    } else if (chamadas < TETO_ARVORE) {
      try {
        chamadas += 1;
        const c = await mlGet<{
          children_categories?: Array<{ id?: string; total_items_in_this_category?: number }>;
        }>(`/categories/${f.cat}`);
        filhos = (c.children_categories ?? [])
          .filter((x) => x.id)
          .sort(
            (a, b) => (b.total_items_in_this_category ?? 0) - (a.total_items_in_this_category ?? 0),
          )
          .map((x) => x.id!)
          .slice(0, 12);
        anotar(`filhos:${f.cat}`, filhos.join(","));
      } catch (e) {
        erros.push(`categoria ${f.cat}: ${String((e as Error).message).slice(0, 80)}`);
      }
    }
    for (const cat of (filhos ?? []).slice(0, FILHOS_POR_NIVEL[f.nivel])) {
      ordem += 1;
      fila.push({ cat, peso: 100 * ordem, nivel: f.nivel + 1 });
    }
  }
  candidatos.sort((a, b) => a.posicao - b.posicao);

  /* 2. Ficha e oferta de cada produto. */
  const prontas: Linha[] = [];
  for (const c of candidatos) {
    if (chamadas >= TETO_API) break;
    try {
      chamadas += 1;
      const p = await mlGet<{
        name?: string;
        status?: string;
        pictures?: Array<{ url?: string; secure_url?: string }>;
        buy_box_winner?: Oferta | null;
      }>(`/products/${c.produto}`);
      const nome = String(p.name ?? "")
        .trim()
        .slice(0, 160);
      if (!nome || RE_PECA_PARTE.test(nome)) {
        anotar(`produto:${c.produto}`, "peça ou sem nome");
        continue;
      }
      /* Categoria pelo nome (src/lib/categoria-em-alta.ts): a lista de uma
         categoria traz produtos de outras; o que não serve fica de fora. */
      const destino = categoriaDoMaisVendido(nome, categoria);
      if (!destino) {
        anotar(`produto:${c.produto}`, `fora: ${nome.slice(0, 60)}`);
        continue;
      }
      let oferta: Oferta | null = p.buy_box_winner ?? null;
      let ofertas: number | null = null;
      if (!oferta?.item_id || !(Number(oferta.price) > 0) || oferta.condition === "used") {
        if (chamadas >= TETO_API) break;
        chamadas += 1;
        const o = await mlGet<{ results?: Oferta[] }>(`/products/${c.produto}/items?limit=30`);
        const novas = (o.results ?? []).filter(
          (x) =>
            x.item_id &&
            /^MLB\d+$/.test(x.item_id) &&
            Number(x.price) > 0 &&
            x.condition !== "used",
        );
        /* Qualidade primeiro (Weslei, 09/10): loja oficial antes da mais
           barata; depois preço e frete grátis. */
        novas.sort(
          (a, b) =>
            Number(!!b.official_store_id) - Number(!!a.official_store_id) ||
            Number(a.price) - Number(b.price) ||
            Number(!!b.shipping?.free_shipping) - Number(!!a.shipping?.free_shipping),
        );
        oferta = novas[0] ?? null;
        ofertas = novas.length;
      }
      if (!oferta?.item_id || !(Number(oferta.price) > 0)) {
        anotar(`produto:${c.produto}`, "sem oferta nova");
        continue;
      }
      const foto = p.pictures?.[0]?.secure_url ?? p.pictures?.[0]?.url ?? null;
      /* Segunda foto real do catálogo (o cartão alterna no mouse/toque). */
      const foto2 = p.pictures?.[1]?.secure_url ?? p.pictures?.[1]?.url ?? null;
      prontas.push({
        produto: c.produto,
        categoria_site: destino,
        categoria_ml: c.cat,
        posicao: c.posicao,
        origem: c.origem ?? "vendidos",
        busca: c.busca ?? null,
        nome,
        imagem: fotoGrande(foto),
        imagem2: fotoGrande(foto2),
        item: oferta.item_id,
        preco: Number(oferta.price),
        ofertas,
        /* free_shipping true = o comprador não paga; false não é "pago". */
        frete_gratis: oferta.shipping?.free_shipping === true ? true : null,
        loja_oficial: Boolean(oferta.official_store_id),
        url: `https://www.mercadolivre.com.br/p/${c.produto}?pdp_filters=item_id%3A${oferta.item_id}`,
      });
    } catch (e) {
      /* Sem ficha ou sem oferta ativa (404): fora por 7 dias; outro erro
         (rede, limite) tenta de novo na próxima. */
      if (e instanceof ErroApiMl && e.status === 404)
        anotar(`produto:${c.produto}`, "sem ficha ou oferta (404)");
    }
  }

  /* 3. Fila de comparação: os primeiros, novos ou comparados há mais de 48 h. */
  const porProduto = new Map(linhas.map((l) => [l.produto, l]));
  const agora = new Date().toISOString();
  let enfileirados = 0;
  const gravar = [];
  for (const l of prontas) {
    const antes = porProduto.get(l.produto);
    let enfileirado = antes?.enfileirado_em ?? null;
    const velho = !enfileirado || Date.now() - Date.parse(enfileirado) > VOLTA_MS;
    let pedido: number | null = null;
    if (velho && enfileirados < FILA_POR_VEZ) {
      const { data, error } = await t.rpc("pedir_link_agente", {
        p_url: l.url,
        p_fonte: "em_alta",
      });
      if (!error && typeof data === "number") {
        pedido = data;
        enfileirado = agora;
        enfileirados += 1;
      }
    }
    gravar.push({
      ...l,
      atualizado_em: agora,
      enfileirado_em: enfileirado,
      ...(pedido != null ? { pedido_id: pedido } : {}),
    });
  }
  if (gravar.length) {
    const { error } = await t.from("em_alta_catalogo").upsert(gravar, { onConflict: "produto" });
    if (error) erros.push(`gravar: ${String(error.message).slice(0, 80)}`);
  }
  /* REMOÇÃO AUTOMÁTICA: produto que já estava à mostra e, relido agora,
     saiu (peça, falso, fora de categoria, sem oferta nova ou 404) deixa a
     vitrine na hora; o que não é relido some sozinho depois de 3 dias. */
  const sairam = lembrar
    .filter((l) => l.chave.startsWith("produto:"))
    .map((l) => l.chave.slice(8))
    .filter((id) => porProduto.has(id));
  if (sairam.length) {
    const { error } = await t.from("em_alta_catalogo").delete().in("produto", sairam);
    if (error) erros.push(`remover: ${String(error.message).slice(0, 80)}`);
  }
  if (lembrar.length) {
    const unicos = [...new Map(lembrar.map((l) => [l.chave, l])).values()];
    const { error } = await t.from("em_alta_vistos").upsert(unicos, { onConflict: "chave" });
    if (error) erros.push(`memoria: ${String(error.message).slice(0, 80)}`);
  }
  return {
    ok: true,
    categoria,
    candidatos: candidatos.length,
    gravados: gravar.length,
    removidos: sairam.length,
    descartados: lembrar.filter((l) => l.chave.startsWith("produto:")).length,
    enfileirados,
    chamadas,
    erros,
  };
}
