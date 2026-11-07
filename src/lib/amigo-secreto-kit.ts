/* AMIGO SECRETO: automatic gift kit (Weslei, 07/11). Picks 1 to 4 products
   from the person's showcases so the kit fits the ceiling, plus an "even
   better" kit up to 20% above it. Only real cards already shown (same
   catalog, budget and gender rules); cost is custoTotalDaOferta, so a card
   with unknown shipping never enters a kit. Quality first: best-seller rank
   and official store (tierDeQualidade); no rating data exists on the cards,
   so ratings are not used. */
import type { Resultado } from "@/lib/busca-guiada-cliente";
import { arquetipoDoTitulo, tierDeQualidade } from "@/lib/curadoria";
import { custoTotalDaOferta } from "@/lib/internacional";

export type EstiloKit = "custo" | "luxo";
export type Candidato = { r: Resultado; grupo: string };
export type Kit = { itens: Resultado[]; total: number };

export const FOLGA_MELHOR = 0.2;
/* Value kit (Weslei, 07/11: "reunir variedades e custo menor"): no single
   item may take more than half of the budget, and a kit has 2+ items. */
export const PARTE_MAX_ITEM = 0.5;

/** What the buyer pays for one card; null when unknown (never in a kit). */
export function custoDoCartao(r: Resultado): number | null {
  return custoTotalDaOferta({
    final: r.preco,
    freteGratis: r.freteGratis === true,
    custoFrete: null,
    internacional: r.internacional === true,
    tributosEstimados: null,
  });
}

/* Small seeded PRNG: "Sortear outro kit" changes the seed, same seed = same kit. */
function aleatorio(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

/** Builds one kit whose total is <= limite. Diversity: one item per group
    (showcase) when mixing, never two of the same kind (first title word). */
export function montarKit(
  candidatos: Candidato[],
  limite: number,
  opcoes: { estilo: EstiloKit; seed: number; misturar: boolean },
): Kit | null {
  const rnd = aleatorio(opcoes.seed);
  const luxo = opcoes.estilo === "luxo";
  const tetoItem = luxo ? limite : limite * PARTE_MAX_ITEM;
  const lista = candidatos
    .map((c) => ({ ...c, custo: custoDoCartao(c.r), tier: tierDeQualidade(c.r), sorte: rnd() }))
    .filter((c): c is typeof c & { custo: number } => c.custo != null && c.custo > 0 && c.custo <= tetoItem)
    /* Quality tier decides; the draw only reorders inside a tier. Luxury
       also prefers the pricier piece of the same tier (fewer, better items). */
    .sort((a, b) =>
      b.tier - a.tier ||
      (opcoes.estilo === "luxo" ? b.custo - a.custo : 0) ||
      a.sorte - b.sorte,
    );
  if (!lista.length) return null;
  const maxItens = luxo ? 2 : 5;
  const ancora = lista[0]!;
  const escolhidos = [ancora];
  let total = ancora.custo;
  const grupos = new Set([ancora.grupo]);
  const tipos = new Set([arquetipoDoTitulo(ancora.r.nome)]);
  for (const c of lista) {
    if (escolhidos.length >= maxItens) break;
    if (escolhidos.includes(c) || total + c.custo > limite) continue;
    if (opcoes.misturar && grupos.has(c.grupo)) continue;
    const tipo = arquetipoDoTitulo(c.r.nome);
    if (tipos.has(tipo)) continue;
    escolhidos.push(c);
    total += c.custo;
    grupos.add(c.grupo);
    tipos.add(tipo);
  }
  if (!luxo && escolhidos.length < 2) return null;
  return { itens: escolhidos.map((c) => c.r), total: Math.round(total * 100) / 100 };
}

/** The kit inside the ceiling and the "even better" one (up to +20%, only
    when it really costs more and is not the same set). */
export function kitsDoPresente(
  candidatos: Candidato[],
  tetoValor: number,
  opcoes: { estilo: EstiloKit; seed: number; misturar: boolean },
): { dentro: Kit | null; melhor: Kit | null } {
  const dentro = montarKit(candidatos, tetoValor, opcoes);
  const melhor = montarKit(candidatos, tetoValor * (1 + FOLGA_MELHOR), { ...opcoes, seed: opcoes.seed + 7919 });
  const igual =
    melhor && dentro && melhor.itens.length === dentro.itens.length && melhor.itens.every((x) => dentro.itens.includes(x));
  return { dentro, melhor: melhor && melhor.total > tetoValor && !igual ? melhor : null };
}
