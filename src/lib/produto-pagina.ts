/* PRODUCT PAGE DATA (/produto/$id, Weslei 13/11/2026). One read of the
   official ML API for a catalog product (/products) or, without one, the
   listing (/items). Only what the API returns is shown: no invented sales,
   rankings or seller badges. "Full" only when logistic_type says so. */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { itemDoEndereco, lerAvaliacoesPorItens } from "@/lib/avaliacoes-detalhe";
import { mlGet } from "@/lib/ml-api";
import { excedeuLimite } from "@/lib/public-ai-api";

export type FichaItem = { nome: string; valor: string };

/* Same columns the showcase cards (CartaoEmAlta) read. */
export type ItemMesmoTipo = {
  produto: string;
  categoria_site: string;
  posicao: number | null;
  nome: string;
  imagem: string | null;
  imagem2: string | null;
  preco: number;
  frete_gratis: boolean | null;
  loja_oficial: boolean;
  url: string;
  atualizado_em: string;
  origem: "vendidos" | "tendencia" | "curadoria" | null;
};

export type ProdutoPagina = {
  id: string;
  nome: string;
  fotos: string[];
  ficha: FichaItem[];
  /* Offer the product page opens (buy box) or the listing itself. */
  item: string | null;
  preco: number | null;
  precoOriginal: number | null;
  freteGratis: boolean | null;
  full: boolean;
  condicao: "novo" | "usado" | null;
  lojaOficial: boolean;
  dominio: string | null;
  descricao: string | null;
  url: string;
  voltagem: string | null;
  /* Price stored by the daily showcase read, when the API was not reached. */
  precoDeReferencia: string | null;
  /* Best sellers of the same ML domain (product type), best position first. */
  mesmoTipo: ItemMesmoTipo[];
  /* Rating read on the listing (avaliacoes_por_itens), for the rich snippet. */
  avaliacao: { nota: number; total: number } | null;
};

type Api = {
  name?: string;
  title?: string;
  domain_id?: string;
  pictures?: Array<{ url?: string; secure_url?: string }>;
  attributes?: Array<{ id?: string; name?: string; value_name?: string | null }>;
  short_description?: { content?: string } | null;
  permalink?: string;
  price?: number;
  original_price?: number | null;
  condition?: string;
  official_store_id?: number | null;
  shipping?: { free_shipping?: boolean; logistic_type?: string } | null;
  buy_box_winner?: {
    item_id?: string;
    price?: number;
    original_price?: number | null;
    condition?: string;
    official_store_id?: number | null;
    shipping?: { free_shipping?: boolean; logistic_type?: string } | null;
  } | null;
};

const cache = new Map<string, { em: number; p: ProdutoPagina | null }>();
const VALIDADE = 30 * 60_000;

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null);

/** Pure mapping, tested in produto-pagina.test.ts. */
export function produtoDaApi(id: string, a: Api, catalogo: boolean): ProdutoPagina | null {
  const nome = (a.name ?? a.title ?? "").trim();
  if (!nome) return null;
  const o = catalogo ? (a.buy_box_winner ?? null) : a;
  const preco = num(o?.price);
  const original = num(o?.original_price);
  const cond = o?.condition === "new" ? "novo" : o?.condition === "used" ? "usado" : null;
  const attrs = a.attributes ?? [];
  const texto = (a.short_description?.content ?? "").trim();
  return {
    id,
    nome,
    fotos: [
      ...new Set(
        (a.pictures ?? [])
          .map((f) => (f.secure_url ?? f.url ?? "").replace(/^http:/, "https:"))
          .filter((u) => /^https:\/\/[a-z0-9.-]*mlstatic\.com\//i.test(u)),
      ),
    ].slice(0, 12),
    ficha: attrs
      .map((x) => ({ nome: (x.name ?? "").trim(), valor: (x.value_name ?? "").trim() }))
      .filter((x) => x.nome && x.valor && x.valor.length <= 200)
      .slice(0, 60),
    item: catalogo ? (a.buy_box_winner?.item_id ?? null) : id,
    preco,
    /* A struck price only when it is really higher. */
    precoOriginal: preco != null && original != null && original > preco ? original : null,
    freteGratis: o?.shipping?.free_shipping ?? null,
    full: o?.shipping?.logistic_type === "fulfillment",
    condicao: cond,
    lojaOficial: o?.official_store_id != null,
    dominio: a.domain_id ?? null,
    descricao: texto ? texto.slice(0, 6000) : null,
    url: catalogo
      ? `https://www.mercadolivre.com.br/p/${id}`
      : `https://produto.mercadolivre.com.br/${id.replace(/^MLB/, "MLB-")}`,
    voltagem: attrs.find((x) => x.id === "VOLTAGE")?.value_name ?? null,
    precoDeReferencia: null,
    mesmoTipo: [],
    avaliacao: null,
  };
}

const COLUNAS =
  "produto, categoria_site, posicao, nome, imagem, imagem2, preco, frete_gratis, loja_oficial, url, atualizado_em, origem, item, dominio_ml";
type Linha = ItemMesmoTipo & { item: string | null; dominio_ml: string | null };

async function ler(id: string): Promise<ProdutoPagina | null> {
  const g = cache.get(id);
  if (g && Date.now() - g.em < VALIDADE) return g.p;
  /* Public endpoint: per-IP brake protects the account (no read bursts). */
  if (excedeuLimite(getRequest(), 20, "produto:")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  /* Generated types lag behind the table (dominio_ml, categoria_no). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const desde = new Date(Date.now() - 3 * 86400_000).toISOString();
  const [api, propria] = await Promise.all([
    mlGet<Api>(`/products/${id}`)
      .then((a) => produtoDaApi(id, a, true))
      .catch(() =>
        mlGet<Api>(`/items/${id}`)
          .then((a) => produtoDaApi(id, a, false))
          .catch(() => null),
      ),
    db
      .from("em_alta_catalogo")
      .select(COLUNAS)
      .eq("produto", id)
      .limit(1)
      .then(({ data }: { data: Linha[] | null }) => (data ?? [])[0] ?? null),
  ]);
  /* Without the API, the product's own showcase row (dated reference price). */
  const p: ProdutoPagina | null =
    api ??
    (propria
      ? {
          id,
          nome: propria.nome,
          fotos: [propria.imagem, propria.imagem2].filter((u): u is string => !!u),
          ficha: [],
          item: propria.item,
          preco: Number(propria.preco) || null,
          precoOriginal: null,
          freteGratis: propria.frete_gratis,
          full: false,
          condicao: null,
          lojaOficial: propria.loja_oficial,
          dominio: propria.dominio_ml,
          descricao: null,
          url: propria.url,
          voltagem: null,
          precoDeReferencia: propria.atualizado_em,
          mesmoTipo: [],
          avaliacao: null,
        }
      : null);
  const dominio = [p?.dominio, propria?.dominio_ml].find((d) => d && d !== "-");
  if (p && dominio) {
    const { data } = await db
      .from("em_alta_catalogo")
      .select(COLUNAS)
      .eq("dominio_ml", dominio)
      .neq("produto", id)
      .gt("preco", 0)
      .gt("atualizado_em", desde)
      .like("url", "https://www.mercadolivre.com.br/p/MLB%")
      .or("categoria_no.is.null,categoria_no.neq.fora")
      .order("posicao", { ascending: true, nullsFirst: false })
      .limit(40);
    const vistos = new Set<string>();
    p.mesmoTipo = ((data ?? []) as Linha[])
      .filter((l) => !vistos.has(l.produto) && vistos.add(l.produto))
      .slice(0, 24)
      .map(({ item: _i, dominio_ml: _d, ...l }) => ({ ...l, preco: Number(l.preco) }));
  }
  const aval = p ? itemDoEndereco(p.url) : null;
  if (p && aval) {
    const r = (await lerAvaliacoesPorItens([aval])).get(aval)?.avaliacoes;
    if (r?.nota != null && r.total != null) p.avaliacao = { nota: r.nota, total: r.total };
  }
  cache.set(id, { em: Date.now(), p });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return p;
}

export const lerProdutoPagina = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .string()
      .regex(/^MLB\d{5,12}$/)
      .parse(d),
  )
  .handler(({ data }) => ler(data));
