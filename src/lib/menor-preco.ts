/* JÁ É O MENOR PREÇO (Weslei, 05/10: "pode aproveitar os anúncios que já
   são a melhor escolha/menor valor mesma qualidade... alimentar minhas
   vitrines com múltiplas estratégias"). O anúncio comparado é o mais
   barato do MESMO produto: nenhuma loja conferida mais barata e pelo menos
   2 mais caras (prova). A economia é contra a 2ª loja mais barata e segue
   a régua de desconto real. Mesma conta de marcar_menor_preco (banco). */
import { descontoReal } from "@/lib/regra-economia";

export const MIN_LOJAS_MAIS_CARAS = 2;

type Bruto = Record<string, unknown>;
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function menorPrecoDoColado(a: Bruto | null | undefined) {
  if (!a) return null;
  const preco = num(a["preco"]);
  if (preco == null) return null;
  const lojas = [
    ...((Array.isArray(a["outrasLojas"]) ? a["outrasLojas"] : []) as Bruto[]),
    ...((Array.isArray(a["referencias"]) ? a["referencias"] : []) as Bruto[]),
  ]
    .filter((o) => o && o["mesmaLoja"] !== true)
    .map((o) => ({
      preco: num(o["final"]) ?? num(o["preco"]),
      loja: (o["vendedor"] as string | null | undefined) ?? null,
    }))
    .filter((o): o is { preco: number; loja: string | null } => o.preco != null);
  if (lojas.some((o) => o.preco < preco - 0.5)) return null;
  const mais = lojas.filter((o) => o.preco > preco + 0.5).sort((x, y) => x.preco - y.preco);
  if (mais.length < MIN_LOJAS_MAIS_CARAS) return null;
  const segunda = mais[0]!;
  const economia = Math.round((segunda.preco - preco) * 100) / 100;
  if (!descontoReal(economia, segunda.preco)) return null;
  return { preco, segunda: segunda.preco, segundaLoja: segunda.loja, lojas: mais.length, economia };
}

/** Vitrine (Weslei, 05/10: "pode ser produtos já no menor preço"): basta
    ser o mais barato contra pelo menos 2 lojas conferidas; a diferença para
    a 2ª loja aparece como ela é. O canal continua com descontoReal. */
export function menorPrecoVale(i: {
  preco: number | null;
  segunda_preco: number | null;
  lojas_mais_caras: number | null;
}) {
  if (i.preco == null || i.segunda_preco == null) return false;
  if ((i.lojas_mais_caras ?? 0) < MIN_LOJAS_MAIS_CARAS) return false;
  return i.segunda_preco - i.preco >= 0.5;
}
