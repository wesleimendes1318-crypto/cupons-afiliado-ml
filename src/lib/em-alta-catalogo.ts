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
   Tetos por execução: 30 chamadas à API, 8 na fila; cada produto volta à
   fila no máximo a cada 48 h. */
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

const TETO_API = 30;
const POR_CATEGORIA_ML = 14;
const FILA_POR_VEZ = 8;
const VOLTA_MS = 48 * 3600_000;

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
  const ultimo = (c: string) =>
    Math.max(
      0,
      ...linhas.filter((l) => l.categoria_site === c).map((l) => Date.parse(l.atualizado_em)),
    );
  const nomes = Object.keys(CATEGORIAS_EM_ALTA);
  const categoria =
    opcoes.categoria && CATEGORIAS_EM_ALTA[opcoes.categoria]
      ? opcoes.categoria
      : nomes.sort((a, b) => ultimo(a) - ultimo(b))[0]!;

  /* 1. Mais vendidos das categorias oficiais. */
  const candidatos: Array<{ produto: string; posicao: number; cat: string }> = [];
  for (const cat of CATEGORIAS_EM_ALTA[categoria]!) {
    if (chamadas >= TETO_API) break;
    try {
      chamadas += 1;
      const h = await mlGet<{ content?: Array<{ id?: string; position?: number; type?: string }> }>(
        `/highlights/MLB/category/${cat}`,
      );
      for (const c of (h.content ?? [])
        .filter((x) => x.type === "PRODUCT" && x.id)
        .slice(0, POR_CATEGORIA_ML)) {
        if (candidatos.some((x) => x.produto === c.id)) continue;
        candidatos.push({ produto: c.id!, posicao: c.position ?? candidatos.length + 1, cat });
      }
    } catch (e) {
      erros.push(`highlights ${cat}: ${String((e as Error).message).slice(0, 80)}`);
    }
  }
  /* Intercala as categorias oficiais (as duas aparecem no topo). */
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
      prontas.push({
        produto: c.produto,
        categoria_site: categoria,
        categoria_ml: c.cat,
        posicao: c.posicao,
        nome,
        imagem: fotoGrande(foto),
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
