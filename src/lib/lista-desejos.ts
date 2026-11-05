/* WISHLIST (Weslei, 05/11/2026): heart on product cards site-wide, page
   /favoritos, selective WhatsApp share. Works without login (localStorage
   melhorescolha_desejos_v1); signed in, it syncs both ways with the account
   (table lista_desejos_conta, RLS per user). Removals are kept as dated
   tombstones so a delete on one device is not undone by another.
   RULE NO. 1: the shared text only carries Weslei's affiliate links
   (ehLinkDeCompra); an item without one is left out of the text. */
import { useEffect, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  ehLinkDeAfiliado,
  ehLinkDeCompra,
  marketplaceDoLink,
  type Marketplace,
} from "@/lib/afiliado";
import { itemDoEndereco } from "@/lib/avaliacoes-detalhe";

export const CHAVE_DESEJOS = "melhorescolha_desejos_v1";
export const EVENTO_DESEJOS = "lista-desejos";
export const MAX_DESEJOS = 100;
const MAX_REMOVIDOS = 200;

export type ItemDesejo = {
  id: string;
  titulo: string;
  preco: number | null;
  foto: string | null;
  /* Mercado Livre listing/catalog address: feeds VerNaLoja / link_de_reserva,
     never shown or shared as a link. */
  url: string | null;
  /* Weslei's affiliate link for `loja`, when known. */
  linkAfiliado: string | null;
  loja: Marketplace;
  adicionadoEm: string;
};

export type ListaDesejos = { itens: ItemDesejo[]; removidos: Record<string, string> };

export type ProdutoDesejo = {
  chave: string;
  titulo: string;
  preco?: number | null | undefined;
  foto?: string | null | undefined;
  url?: string | null | undefined;
  link?: string | null | undefined;
};

const vazia = (): ListaDesejos => ({ itens: [], removidos: {} });
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const RE_ML = /^https:\/\/(www|produto)\.mercadolivre\.com\.br\//;

/** ML address the server accepts (link_de_reserva), or null. */
export function urlML(u: unknown): string | null {
  let s = str(u, 600).split("#")[0] ?? "";
  if (/^\/p\/MLB\d+/i.test(s)) s = `https://www.mercadolivre.com.br${s}`;
  return RE_ML.test(s) ? s : null;
}

/** Card data -> wishlist item; null when there is no way to buy through
    Weslei's link (no affiliate link and no ML address). */
export function itemDoProduto(p: ProdutoDesejo, agora = new Date()): ItemDesejo | null {
  const link = ehLinkDeCompra(p.link) ? p.link!.trim() : null;
  const url = urlML(p.url);
  const loja: Marketplace | null = link ? marketplaceDoLink(link) : url ? "mercadolivre" : null;
  const titulo = str(p.titulo, 160);
  if (!loja || !titulo) return null;
  /* Same product from any card -> same id (catalog/listing id from the address). */
  const id = (url && itemDoEndereco(url)) || str(p.chave, 80);
  if (!id) return null;
  const foto = str(p.foto, 400);
  const preco =
    typeof p.preco === "number" && Number.isFinite(p.preco) && p.preco > 0 ? p.preco : null;
  return {
    id,
    titulo,
    preco,
    foto: /^https:\/\//.test(foto) ? foto : null,
    url,
    linkAfiliado: link,
    loja,
    adicionadoEm: agora.toISOString(),
  };
}

/** Back from storage (device or account), every field checked. */
export function lerLista(bruto: unknown): ListaDesejos {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const vistos = new Set<string>();
  const itens = (Array.isArray(o["itens"]) ? o["itens"] : []).flatMap(
    (x: Record<string, unknown>) => {
      if (!x || typeof x !== "object") return [];
      const id = str(x["id"], 80);
      const titulo = str(x["titulo"], 160);
      const loja = x["loja"];
      if (
        !id ||
        !titulo ||
        vistos.has(id) ||
        (loja !== "mercadolivre" && loja !== "amazon" && loja !== "shopee")
      )
        return [];
      const link = ehLinkDeCompra(x["linkAfiliado"], loja) ? str(x["linkAfiliado"], 400) : null;
      const url = urlML(x["url"]);
      if (!link && !url) return [];
      vistos.add(id);
      const foto = str(x["foto"], 400);
      const preco =
        typeof x["preco"] === "number" &&
        Number.isFinite(x["preco"]) &&
        x["preco"] > 0 &&
        x["preco"] < 1e6
          ? x["preco"]
          : null;
      const em = str(x["adicionadoEm"], 30);
      return [
        {
          id,
          titulo,
          preco,
          foto: /^https:\/\//.test(foto) ? foto : null,
          url,
          linkAfiliado: link,
          loja,
          adicionadoEm: Number.isFinite(Date.parse(em)) ? em : new Date(0).toISOString(),
        } satisfies ItemDesejo,
      ];
    },
  );
  const removidos: Record<string, string> = {};
  const r = o["removidos"];
  if (r && typeof r === "object")
    for (const [k, v] of Object.entries(r as Record<string, unknown>).slice(-MAX_REMOVIDOS))
      if (typeof v === "string" && Number.isFinite(Date.parse(v))) removidos[k.slice(0, 80)] = v;
  return { itens: itens.slice(0, MAX_DESEJOS), removidos };
}

/** Heart toggle: adds on top, removes (with tombstone) when already there. */
export function alternar(l: ListaDesejos, item: ItemDesejo, agora = new Date()): ListaDesejos {
  if (l.itens.some((i) => i.id === item.id)) return remover(l, [item.id], agora);
  const removidos = { ...l.removidos };
  delete removidos[item.id];
  return {
    itens: [{ ...item, adicionadoEm: agora.toISOString() }, ...l.itens].slice(0, MAX_DESEJOS),
    removidos,
  };
}

export function remover(l: ListaDesejos, ids: string[], agora = new Date()): ListaDesejos {
  const fora = new Set(ids);
  const removidos = { ...l.removidos };
  for (const id of ids) removidos[id] = agora.toISOString();
  const chaves = Object.keys(removidos);
  for (const k of chaves.slice(0, Math.max(0, chaves.length - MAX_REMOVIDOS))) delete removidos[k];
  return { itens: l.itens.filter((i) => !fora.has(i.id)), removidos };
}

/** Device + account: per id the latest event (added vs removed) wins; a link
    found on either side is kept. */
export function juntar(a: ListaDesejos, b: ListaDesejos): ListaDesejos {
  const removidos: Record<string, string> = { ...a.removidos };
  for (const [k, v] of Object.entries(b.removidos))
    if (!removidos[k] || v > removidos[k]!) removidos[k] = v;
  const porId = new Map<string, ItemDesejo>();
  for (const i of [...a.itens, ...b.itens]) {
    const atual = porId.get(i.id);
    if (!atual) porId.set(i.id, i);
    else {
      const novo = i.adicionadoEm > atual.adicionadoEm ? i : atual;
      porId.set(i.id, {
        ...novo,
        linkAfiliado: novo.linkAfiliado ?? atual.linkAfiliado ?? i.linkAfiliado,
      });
    }
  }
  const itens = [...porId.values()]
    .filter((i) => !removidos[i.id] || removidos[i.id]! < i.adicionadoEm)
    .sort((x, y) =>
      y.adicionadoEm > x.adicionadoEm ? 1 : y.adicionadoEm < x.adicionadoEm ? -1 : 0,
    );
  for (const i of itens) delete removidos[i.id];
  return lerLista({ itens, removidos });
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) && d.getTime() > 0
    ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    : null;
};

/** WhatsApp text: only items with Weslei's affiliate link (rule no. 1). The
    price is the one seen when hearted, dated, so it never reads as live. */
export function textoWhatsApp(itens: ItemDesejo[]): string {
  const comLink = itens.filter((i) => ehLinkDeCompra(i.linkAfiliado, i.loja));
  const linhas = comLink.map((i, k) => {
    const quando = dia(i.adicionadoEm);
    const preco =
      i.preco != null ? `\n💰 ${brl(i.preco)}${quando ? ` (preço visto em ${quando})` : ""}` : "";
    return `${k + 1}. *${i.titulo.replace(/[*_~`]/g, "")}*${preco}\n👉 ${i.linkAfiliado}`;
  });
  return `❤️ *Minha lista de desejos*\n\n${linhas.join("\n\n")}`;
}

export const linkWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/** Weslei's link for an ML item without one: link_de_reserva (known link of
    the listing or the product page's affiliate link). Null = none now. */
export async function buscarLinkAfiliado(item: ItemDesejo): Promise<string | null> {
  if (ehLinkDeCompra(item.linkAfiliado, item.loja)) return item.linkAfiliado;
  if (item.loja !== "mercadolivre" || !item.url) return null;
  try {
    const { data } = await supabase.rpc("link_de_reserva" as never, { p_url: item.url } as never);
    const r = data as { link?: string | null } | null;
    return ehLinkDeAfiliado(r?.link) ? r.link.trim() : null;
  } catch {
    return null;
  }
}

/* ---------- device store (one source for every heart on the page) ---------- */

let cache: ListaDesejos | null = null;
const VAZIA_SSR = vazia();

function ler(): ListaDesejos {
  if (cache) return cache;
  try {
    const s = localStorage.getItem(CHAVE_DESEJOS);
    cache = s ? lerLista(JSON.parse(s)) : vazia();
  } catch {
    cache = vazia();
  }
  return cache;
}

export function obterLista(): ListaDesejos {
  return typeof window === "undefined" ? VAZIA_SSR : ler();
}

export function gravarLista(l: ListaDesejos) {
  cache = l;
  try {
    localStorage.setItem(CHAVE_DESEJOS, JSON.stringify(l));
  } catch {
    /* private window / full storage: keeps working in memory */
  }
  window.dispatchEvent(new Event(EVENTO_DESEJOS));
}

export const mudarLista = (f: (l: ListaDesejos) => ListaDesejos) => gravarLista(f(obterLista()));

function assinar(f: () => void) {
  const outraAba = (e: StorageEvent) => {
    if (e.key === CHAVE_DESEJOS) {
      cache = null;
      f();
    }
  };
  window.addEventListener(EVENTO_DESEJOS, f);
  window.addEventListener("storage", outraAba);
  return () => {
    window.removeEventListener(EVENTO_DESEJOS, f);
    window.removeEventListener("storage", outraAba);
  };
}

export const useListaDesejos = (): ListaDesejos =>
  useSyncExternalStore(assinar, obterLista, () => VAZIA_SSR);

/* ---------- account ---------- */

/* The table is outside the generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from("lista_desejos_conta");

export async function lerDaConta(userId: string): Promise<ListaDesejos | null> {
  try {
    const { data, error } = await tabela().select("dados").eq("user_id", userId).maybeSingle();
    if (error) return null;
    return data ? lerLista(data.dados) : vazia();
  } catch {
    return null;
  }
}

export async function salvarNaConta(userId: string, l: ListaDesejos): Promise<boolean> {
  try {
    const { error } = await tabela().upsert({
      user_id: userId,
      dados: l,
      atualizado_em: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

/** Mounted once (header account button). Signed in: account and device are
    merged on sign-in and when the tab comes back; each change is saved 1.5 s
    after the last one. Without the table the list just stays on the device. */
export function useSincroniaDesejos(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ultimo = "";
    const enviar = () => {
      const l = obterLista();
      const texto = JSON.stringify(l);
      if (texto === ultimo) return;
      void salvarNaConta(userId, l).then((ok) => {
        if (ok) ultimo = texto;
      });
    };
    const puxar = async () => {
      const conta = await lerDaConta(userId);
      if (!ativo || !conta) return;
      const junta = juntar(conta, obterLista());
      if (JSON.stringify(junta) !== JSON.stringify(obterLista())) gravarLista(junta);
      enviar();
    };
    void puxar();
    const aoMudar = () => {
      clearTimeout(timer);
      timer = setTimeout(enviar, 1_500);
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void puxar();
    };
    window.addEventListener(EVENTO_DESEJOS, aoMudar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      clearTimeout(timer);
      window.removeEventListener(EVENTO_DESEJOS, aoMudar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [userId]);
}
