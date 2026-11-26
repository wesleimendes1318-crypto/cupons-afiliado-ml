/* Pure badge rules for showcase/campaign cards (26/11); IO lives in
   selos-vitrine.ts. Unknown data = no badge. */
import type { Oferta } from "@/lib/ofertas-vitrine";

export type LinhaSelos = {
  chave: string;
  melhor_oficial: boolean | null;
  melhor_lider: string | null;
  alt_oficial: boolean | null;
  alt_lider: string | null;
  colado_oficial: boolean | null;
  colado_lider: string | null;
  minimo_30d: number | string | null;
  maximo_30d: number | string | null;
  leituras_30d: number | null;
  desde_30d: string | null;
};

export type MapaSelos = Map<string, LinhaSelos>;

export type SelosDoCartao = {
  vendedor: "Loja oficial" | "MercadoLíder Platinum" | null;
  freteGratis: boolean;
  menor30d: boolean;
};

/* History needs at least 3 readings spread over 20+ days, the price must be
   the lowest of the window, and an earlier reading at least 5% and R$ 10
   higher (a real drop, not a flat price). */
export const LEITURAS_MINIMAS = 3;
export const DIAS_MINIMOS = 20;

export function menorDos30Dias(preco: number, s: LinhaSelos | undefined, agora = Date.now()) {
  if (!s || !(preco > 0)) return false;
  const mn = Number(s.minimo_30d);
  const mx = Number(s.maximo_30d);
  const desde = Date.parse(s.desde_30d ?? "");
  if (![mn, mx, desde].every(Number.isFinite)) return false;
  if ((s.leituras_30d ?? 0) < LEITURAS_MINIMAS) return false;
  if (agora - desde < DIAS_MINIMOS * 86_400_000) return false;
  return preco <= mn + 0.005 && mx >= preco * 1.05 && mx - preco >= 10;
}

export function selosDoCartao(o: Oferta, s: LinhaSelos | undefined, agora = Date.now()) {
  /* Seller of the offer the card shows (same pick as the campaign curation). */
  const doBanco =
    o.tipo === "mesmo"
      ? s?.melhor_oficial
      : o.tipo === "parecido"
        ? s?.alt_oficial
        : s?.colado_oficial;
  const oficial = o.lojaOficial ?? doBanco === true;
  const lider =
    o.mercadoLider !== undefined
      ? o.mercadoLider
      : o.tipo === "mesmo"
        ? s?.melhor_lider
        : o.tipo === "parecido"
          ? s?.alt_lider
          : s?.colado_lider;
  return {
    vendedor: oficial
      ? "Loja oficial"
      : (lider ?? "").toLowerCase() === "platinum"
        ? "MercadoLíder Platinum"
        : null,
    freteGratis: o.freteGratis === true,
    menor30d: menorDos30Dias(o.preco, s, agora),
  } satisfies SelosDoCartao;
}
