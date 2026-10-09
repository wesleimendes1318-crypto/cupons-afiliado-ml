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
import { mlGet } from "@/lib/ml-api";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* Categorias do site -> categorias oficiais (códigos MLB). */
export const CATEGORIAS_EM_ALTA: Record<string, string[]> = {
  eletronicos: ["MLB1000", "MLB1144"],
  celulares: ["MLB1051"],
  informatica: ["MLB1648"],
  casa: ["MLB1574", "MLB5726"],
  moda: ["MLB1430"],
  beleza: ["MLB1246"],
  automotivo: ["MLB5672"],
  brinquedos: ["MLB1132"],
};

const TETO_API = 32;
/* Weslei, 09/10: "pelo menos 20 anúncios em cada" categoria. */
const META_POR_CATEGORIA = 24;
/* Produto lido há menos de 20 h fica para a próxima: a execução seguinte
   avança para outros produtos e subcategorias. */
const FRESCO_MS = 20 * 3600_000;
const FILA_POR_VEZ = 4;
const VOLTA_MS = 48 * 3600_000;
const SUBCATEGORIAS_POR_BASE = 8;
const PRODUTOS_POR_EXECUCAO = 16;

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

  /* 1. Fontes: as categorias oficiais e, enquanto faltar produto, as
        subcategorias delas (lidas da API, as maiores primeiro). */
  const bases = CATEGORIAS_EM_ALTA[categoria]!;
  const fontes: Array<{ cat: string; peso: number }> = bases.map((cat) => ({ cat, peso: 0 }));
  if (visiveis(categoria) < META_POR_CATEGORIA * 2) {
    for (const [k, base] of bases.entries()) {
      if (chamadas >= TETO_API) break;
      try {
        chamadas += 1;
        const c = await mlGet<{
          children_categories?: Array<{ id?: string; total_items_in_this_category?: number }>;
        }>(`/categories/${base}`);
        (c.children_categories ?? [])
          .filter((x) => x.id)
          .sort(
            (a, b) => (b.total_items_in_this_category ?? 0) - (a.total_items_in_this_category ?? 0),
          )
          .slice(0, SUBCATEGORIAS_POR_BASE)
          .forEach((x, n) => fontes.push({ cat: x.id!, peso: 100 * (1 + n * bases.length + k) }));
      } catch (e) {
        erros.push(`categoria ${base}: ${String((e as Error).message).slice(0, 80)}`);
      }
    }
  }

  /* Mais vendidos de cada fonte, até juntar o que cabe nesta execução. */
  const candidatos: Array<{ produto: string; posicao: number; cat: string }> = [];
  for (const f of fontes) {
    if (candidatos.length >= PRODUTOS_POR_EXECUCAO || chamadas >= TETO_API - 6) break;
    try {
      chamadas += 1;
      const h = await mlGet<{ content?: Array<{ id?: string; position?: number; type?: string }> }>(
        `/highlights/MLB/category/${f.cat}`,
      );
      for (const c of (h.content ?? []).filter((x) => x.type === "PRODUCT" && x.id)) {
        if (recentes.has(c.id!) || candidatos.some((x) => x.produto === c.id)) continue;
        candidatos.push({ produto: c.id!, posicao: f.peso + (c.position ?? 50), cat: f.cat });
        if (candidatos.length >= PRODUTOS_POR_EXECUCAO) break;
      }
    } catch (e) {
      erros.push(`highlights ${f.cat}: ${String((e as Error).message).slice(0, 80)}`);
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
      if (!nome || RE_PECA_PARTE.test(nome)) continue;
      /* Categoria pelo nome (src/lib/categoria-em-alta.ts): a lista de uma
         categoria traz produtos de outras; o que não serve fica de fora. */
      const destino = categoriaDoMaisVendido(nome, categoria);
      if (!destino) continue;
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
        novas.sort(
          (a, b) =>
            Number(a.price) - Number(b.price) ||
            Number(!!b.shipping?.free_shipping) - Number(!!a.shipping?.free_shipping),
        );
        oferta = novas[0] ?? null;
        ofertas = novas.length;
      }
      if (!oferta?.item_id || !(Number(oferta.price) > 0)) continue;
      const foto = p.pictures?.[0]?.secure_url ?? p.pictures?.[0]?.url ?? null;
      /* Segunda foto real do catálogo (o cartão alterna no mouse/toque). */
      const foto2 = p.pictures?.[1]?.secure_url ?? p.pictures?.[1]?.url ?? null;
      prontas.push({
        produto: c.produto,
        categoria_site: destino,
        categoria_ml: c.cat,
        posicao: c.posicao,
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
    } catch {
      /* sem ficha ou sem oferta ativa (404): fica de fora */
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
  return {
    ok: true,
    categoria,
    candidatos: candidatos.length,
    gravados: gravar.length,
    enfileirados,
    chamadas,
    erros,
  };
}
