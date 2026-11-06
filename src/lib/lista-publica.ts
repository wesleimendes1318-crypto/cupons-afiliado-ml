/* PUBLIC SHARED WISHLIST (Weslei, 05/11/2026): /favoritos -> /lista/<id>.
   Items are re-checked with lerLista on the server, so a shared list can only
   carry Weslei's affiliate links or a Mercado Livre address (rule no. 1:
   the page buys through ComprarComSeguranca / VerNaLoja). */
import { lerLista, type ItemDesejo } from "@/lib/lista-desejos";

export const SITE = "https://melhorescolha.io";
export const OCASIOES = ["Lista de Desejos", "Amigo Secreto", "Aniversário", "Casa Nova", "Natal"];

export type Presente = { nome: string; em: string };
export type ListaPublica = {
  id: string;
  titulo: string;
  ocasiao: string;
  itens: ItemDesejo[];
  presentes: Record<string, Presente>;
  atualizada_em: string;
};

/** Raw lista_publica() row -> checked list (same rules as the wishlist). */
export function lerListaPublica(bruto: unknown): ListaPublica | null {
  const o = (bruto && typeof bruto === "object" ? bruto : null) as Record<string, unknown> | null;
  if (!o || typeof o["id"] !== "string") return null;
  const presentes: Record<string, Presente> = {};
  const p = o["presentes"];
  if (p && typeof p === "object")
    for (const [k, v] of Object.entries(p as Record<string, Record<string, unknown>>))
      if (v && typeof v["em"] === "string")
        presentes[k] = {
          nome: typeof v["nome"] === "string" ? v["nome"].slice(0, 40) : "",
          em: v["em"],
        };
  return {
    id: o["id"],
    titulo: typeof o["titulo"] === "string" ? o["titulo"] : "",
    ocasiao: typeof o["ocasiao"] === "string" ? o["ocasiao"] : "",
    itens: lerLista({ itens: o["itens"] }).itens,
    presentes,
    atualizada_em: typeof o["atualizada_em"] === "string" ? o["atualizada_em"] : "",
  };
}

/* Budget pills (Weslei's ranges). */
export const FAIXAS = [
  { rotulo: "Todos", min: 0, max: Infinity },
  { rotulo: "Até R$ 50", min: 0, max: 50 },
  { rotulo: "R$ 50 - R$ 100", min: 50, max: 100 },
  { rotulo: "R$ 100 - R$ 200", min: 100, max: 200 },
  { rotulo: "Acima de R$ 200", min: 200, max: Infinity },
] as const;

/** Items in a range; "Todos" keeps the ones without a known price. */
export function naFaixa(itens: ItemDesejo[], k: number): ItemDesejo[] {
  const f = FAIXAS[k] ?? FAIXAS[0];
  if (k === 0) return itens;
  return itens.filter((i) => i.preco != null && i.preco > f.min && i.preco <= f.max);
}

const reais = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

/** "14 presentes selecionados • Opções de R$ 35 a R$ 250" */
export function resumoDaLista(itens: ItemDesejo[]): string {
  const n = itens.length;
  const base = `${n} ${n === 1 ? "presente selecionado" : "presentes selecionados"}`;
  const precos = itens.flatMap((i) => (i.preco != null ? [i.preco] : []));
  if (!precos.length) return base;
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  return `${base} • ${min === max ? `Opção de ${reais(min)}` : `Opções de ${reais(min)} a ${reais(max)}`}`;
}

export const tituloDaLista = (l: Pick<ListaPublica, "titulo" | "ocasiao">) =>
  l.titulo || l.ocasiao || "Lista de desejos";

export function textoConvite(l: Pick<ListaPublica, "titulo" | "ocasiao">, url: string) {
  return `🎁 *${tituloDaLista(l).replace(/[*_~`]/g, "")}*\n\nFiz minha lista de presentes. Quando comprar um, marque como comprado para ninguém repetir:\n👉 ${url}`;
}

/* ---------- device keys ---------- */

const CHAVE_DONO = "melhorescolha_lista_publica_v1";
const CHAVE_PRESENTEADOR = "melhorescolha_presenteador_v1";

/* slot: one owner key per list kind on this device (planners keep their own
   list, so sharing a planner never overwrites the /favoritos list). */
const chaveDono = (slot?: string) => (slot ? `${CHAVE_DONO}_${slot}` : CHAVE_DONO);

export function minhaListaPublica(slot?: string): { id: string; chave: string } | null {
  try {
    const o = JSON.parse(localStorage.getItem(chaveDono(slot)) ?? "null") as {
      id?: unknown;
      chave?: unknown;
    } | null;
    return o && typeof o.id === "string" && typeof o.chave === "string"
      ? { id: o.id, chave: o.chave }
      : null;
  } catch {
    return null;
  }
}

/** Random device token for gift marks (only this device can undo its mark). */
export function tokenPresenteador(): string {
  try {
    let t = localStorage.getItem(CHAVE_PRESENTEADOR);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(CHAVE_PRESENTEADOR, t);
    }
    return t;
  } catch {
    return crypto.randomUUID();
  }
}

const marcadosAqui = () => `${CHAVE_PRESENTEADOR}_itens`;
export function presentesDesteAparelho(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(marcadosAqui()) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function lembrarPresente(chave: string, marcado: boolean) {
  const s = presentesDesteAparelho();
  if (marcado) s.add(chave);
  else s.delete(chave);
  try {
    localStorage.setItem(marcadosAqui(), JSON.stringify([...s].slice(-200)));
  } catch {
    /* ignore */
  }
}

/* ---------- server calls ---------- */

async function chamar(corpo: object): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch("/api/public/lista-compartilhada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Creates the list, or updates the one this device already shared (same URL). */
export async function salvarListaPublica(
  dados: { titulo: string; ocasiao: string; itens: ItemDesejo[] },
  slot?: string,
) {
  const minha = minhaListaPublica(slot);
  const r = await chamar({ acao: "salvar", ...(minha ?? {}), ...dados });
  if (!r || typeof r["id"] !== "string" || typeof r["chave"] !== "string") return null;
  try {
    localStorage.setItem(chaveDono(slot), JSON.stringify({ id: r["id"], chave: r["chave"] }));
  } catch {
    /* the link still works; next share makes a new one */
  }
  return { id: r["id"], url: `${SITE}/lista/${r["id"]}` };
}

export async function marcarPresente(id: string, item: string, marcar: boolean, nome: string) {
  const r = await chamar({ acao: "presente", id, item, marcar, nome, quem: tokenPresenteador() });
  if (!r) return null;
  lembrarPresente(`${id}:${item}`, marcar);
  return lerListaPublica({ id, presentes: r["presentes"] })?.presentes ?? null;
}
