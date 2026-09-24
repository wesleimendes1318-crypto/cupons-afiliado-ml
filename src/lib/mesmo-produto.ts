/* Mesmo produto em outras lojas, pela API oficial do Mercado Livre.

   Cenários que o cliente vê (regra do Weslei):
     1A  a loja do anúncio tem cupom
     1B  a loja do anúncio não tem cupom e outra loja com o mesmo produto tem
     1C  nenhuma tem cupom, mas outra loja vende mais barato
     1D  nenhuma opção melhor: fica o link do produto original
   Este arquivo só decide as OPÇÕES. O link de afiliado de cada opção é gerado
   depois pela extensão, na conta do Weslei, só para as opções escolhidas.

   Regras de "mesmo produto" e de escolha são as mesmas de
   extensao/comparador.js (testadas lá com node --test). */

import { ErroApiMl, mlGet } from "@/lib/ml-api";

/* ------------------------------------------------------------- textos */

const normPalavra = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const norm = (s: string | null | undefined) => normPalavra(s).replace(/ /g, "");

const VAZIAS = new Set(["com", "para", "sem", "por", "the", "and", "dos", "das", "que", "kit", "novo", "nova",
  "original", "promocao", "oferta", "frete", "gratis", "envio", "imediato", "pronta", "entrega"]);

function palavras(t: string) {
  return normPalavra(t)
    .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2")
    .split(" ")
    .filter((w) => (w.length >= 3 || /^\d+$/.test(w)) && !VAZIAS.has(w));
}

/** 60% das palavras do original no candidato, e todos os números do original. */
export function pareceMesmoProduto(original: string, candidato: string) {
  const a = [...new Set(palavras(original))];
  const b = new Set(palavras(candidato));
  if (a.length < 3) return false;
  if (a.filter((w) => b.has(w)).length / a.length < 0.6) return false;
  return a.filter((w) => /^\d+$/.test(w)).every((n) => b.has(n));
}

/* --------------------------------------------------------------- links */

export function idsDoLink(url: string) {
  let s = url;
  try { s = decodeURIComponent(url); } catch { /* fica como veio */ }
  const item = /item_id[:=](MLB\d{6,})/i.exec(s)?.[1] ?? /[?&#]wid=(MLB\d{6,})/i.exec(s)?.[1]
    ?? (/\/MLB-(\d{6,})/i.exec(s)?.[1] ? `MLB${/\/MLB-(\d{6,})/i.exec(s)![1]}` : null);
  const catalogo = /\/p\/(MLB\d{5,})/i.exec(s)?.[1] ?? null;
  return { item: item?.toUpperCase() ?? null, catalogo: catalogo?.toUpperCase() ?? null };
}

const urlDaOferta = (catalogo: string, item: string) =>
  `https://www.mercadolivre.com.br/p/${catalogo}?pdp_filters=item_id%3A${item}`;

/* -------------------------------------------------------------- cupons */

export type CupomLoja = {
  id: number; vendedor: string; desconto: string | null; tipo: string | null; valor: number | null;
  teto: number | null; sem_teto: boolean | null; compra_min: number | null; vence: string | null;
  codigo_cupom: string | null;
};

/** Desconto real do cupom neste preço (teto e compra mínima). null = não vale. */
export function economiaDoCupom(c: CupomLoja | null, preco: number | null) {
  if (!c || preco == null) return null;
  if (c.compra_min != null && preco < Number(c.compra_min)) return null;
  const valor = Number(c.valor) || 0;
  let e = c.tipo === "%" ? (preco * valor) / 100 : valor;
  if (!c.sem_teto && c.teto != null) e = Math.min(e, Number(c.teto));
  e = Math.min(e, preco);
  return e >= 5 ? Math.round(e * 100) / 100 : null;
}

async function cuponsPorNome(nomes: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("melhores_cupons_por_nome" as never, { p_nomes: nomes } as never);
  const mapa = new Map<string, CupomLoja>();
  for (const l of (data ?? []) as (CupomLoja & { nome: string })[]) mapa.set(l.nome, l);
  return mapa;
}

/* ------------------------------------------------------------ API do ML */

type ItemApi = {
  id: string; title: string; price: number | null; seller_id: number;
  catalog_product_id?: string | null; permalink?: string;
};
type OfertaCatalogo = { item_id: string; price: number | null; seller_id: number };
type ResultadoBusca = {
  id: string; title: string; price: number | null; seller?: { id: number };
  catalog_product_id?: string | null; permalink?: string;
};

const cacheVendedor = new Map<number, string | null>();

async function apelido(sellerId: number) {
  if (cacheVendedor.has(sellerId)) return cacheVendedor.get(sellerId) ?? null;
  let nome: string | null = null;
  try { nome = (await mlGet<{ nickname?: string }>(`/users/${sellerId}`)).nickname ?? null; }
  catch { nome = null; }
  cacheVendedor.set(sellerId, nome);
  return nome;
}

/* ------------------------------------------------------------- decisão */

export type Opcao = {
  item: string; url: string; vendedor: string | null; preco: number; economia: number; final: number;
  cupom: { id: number; titulo: string | null; teto: number | null; minimo: number | null; vence: string | null } | null;
  ganho: number; finalAtual: number; motivo: "mais_barata" | "tem_cupom"; achadoNaBusca: boolean;
};

export type Comparacao = {
  procurou: boolean;
  motivo: string | null;
  produto: { item: string | null; titulo: string | null; preco: number | null; vendedor: string | null } | null;
  opcoes: Opcao[];
  fonte: "api-oficial";
};

type Candidato = { item: string; url: string; preco: number; sellerId: number; achadoNaBusca: boolean };

export async function compararMesmoProduto(url: string): Promise<Comparacao> {
  const ids = idsDoLink(url);
  if (!ids.item && !ids.catalogo) {
    return { procurou: false, motivo: "o link não traz o número do anúncio", produto: null, opcoes: [], fonte: "api-oficial" };
  }

  try {
    /* 1. O anúncio que o cliente colou. */
    let item: ItemApi | null = null;
    if (ids.item) item = await mlGet<ItemApi>(`/items/${ids.item}?attributes=id,title,price,seller_id,catalog_product_id,permalink`);
    const catalogo = item?.catalog_product_id ?? ids.catalogo;
    const titulo = item?.title ?? null;
    const preco = item?.price ?? null;

    /* 2. Candidatos: primeiro o catálogo (é o mesmo produto por definição),
          depois a busca pelo título (palpite forte, o site avisa). */
    const candidatos: Candidato[] = [];
    if (catalogo) {
      try {
        const r = await mlGet<{ results?: OfertaCatalogo[] }>(`/products/${catalogo}/items?limit=20`);
        for (const o of r.results ?? []) {
          if (o.price == null) continue;
          candidatos.push({ item: o.item_id, url: urlDaOferta(catalogo, o.item_id), preco: o.price, sellerId: o.seller_id, achadoNaBusca: false });
        }
      } catch (e) { if (!(e instanceof ErroApiMl) || e.status >= 500) throw e; }
    }
    if (candidatos.length < 2 && titulo) {
      const termo = normPalavra(titulo).split(" ").slice(0, 12).join(" ");
      const r = await mlGet<{ results?: ResultadoBusca[] }>(`/sites/MLB/search?q=${encodeURIComponent(termo)}&limit=15`);
      for (const x of r.results ?? []) {
        if (x.price == null || !x.seller?.id || !pareceMesmoProduto(titulo, x.title)) continue;
        if (preco != null && (x.price < preco * 0.4 || x.price > preco * 1.6)) continue;
        const url2 = x.catalog_product_id ? urlDaOferta(x.catalog_product_id, x.id) : (x.permalink ?? "");
        if (!url2) continue;
        candidatos.push({ item: x.id, url: url2, preco: x.price, sellerId: x.seller.id, achadoNaBusca: true });
      }
    }

    /* 3. Nome de cada loja e o cupom dela no banco. */
    const sellers = [...new Set([item?.seller_id, ...candidatos.map((c) => c.sellerId)].filter(Boolean) as number[])].slice(0, 12);
    const nomes = new Map<number, string | null>();
    for (const s of sellers) nomes.set(s, await apelido(s));
    const cupons = await cuponsPorNome([...nomes.values()].filter(Boolean) as string[]);
    const cupomDe = (sellerId: number) => {
      const n = nomes.get(sellerId);
      return n ? cupons.get(norm(n)) ?? null : null;
    };

    const vendedorAqui = item ? nomes.get(item.seller_id) ?? null : null;
    const cupomAqui = item ? cupomDe(item.seller_id) : null;
    const economiaAqui = economiaDoCupom(cupomAqui, preco) ?? 0;
    const finalAtual = preco != null ? preco - economiaAqui : null;
    const produto = { item: item?.id ?? null, titulo, preco, vendedor: vendedorAqui };

    if (finalAtual == null) {
      return { procurou: false, motivo: "não consegui o preço do anúncio", produto, opcoes: [], fonte: "api-oficial" };
    }

    /* 4. Escolha: mais barata por pelo menos R$ 2, ou com cupom quando a loja
          do cliente não tem (sem sair mais cara). Nunca a própria loja. */
    const porLoja = new Map<number, Opcao>();
    for (const c of candidatos) {
      if (c.item === item?.id || (item && c.sellerId === item.seller_id)) continue;
      const cupom = cupomDe(c.sellerId);
      const economia = economiaDoCupom(cupom, c.preco) ?? 0;
      const final = Math.round((c.preco - economia) * 100) / 100;
      const ganho = Math.round((finalAtual - final) * 100) / 100;
      const temCupom = economia > 0;
      let motivo: Opcao["motivo"] | null = null;
      if (ganho >= 2) motivo = "mais_barata";
      else if (!economiaAqui && temCupom && final <= finalAtual) motivo = "tem_cupom";
      if (!motivo) continue;
      const opcao: Opcao = {
        item: c.item, url: c.url, vendedor: nomes.get(c.sellerId) ?? null, preco: c.preco, economia, final,
        cupom: temCupom && cupom ? {
          id: cupom.id, titulo: cupom.desconto, teto: cupom.sem_teto ? null : cupom.teto,
          minimo: cupom.compra_min, vence: cupom.vence,
        } : null,
        ganho: Math.max(ganho, 0), finalAtual, motivo, achadoNaBusca: c.achadoNaBusca,
      };
      const atual = porLoja.get(c.sellerId);
      if (!atual || opcao.final < atual.final) porLoja.set(c.sellerId, opcao);
    }
    const opcoes = [...porLoja.values()]
      .sort((a, b) => a.final - b.final || (b.cupom ? 1 : 0) - (a.cupom ? 1 : 0))
      .slice(0, 3);

    return { procurou: true, motivo: null, produto, opcoes, fonte: "api-oficial" };
  } catch (e) {
    const status = e instanceof ErroApiMl ? e.status : 0;
    const motivo = status === 401 || status === 403
      ? "a API oficial do Mercado Livre pediu autorização (configurar o aplicativo)"
      : status === 429 ? "limite de consultas da API oficial atingido" : "a API oficial do Mercado Livre não respondeu";
    return { procurou: false, motivo, produto: null, opcoes: [], fonte: "api-oficial" };
  }
}
