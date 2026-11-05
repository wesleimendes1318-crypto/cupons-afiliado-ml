/* AMIGO SECRETO: showcase loader (05/11). Each showcase walks its search
   terms round-robin through /api/public/amigo-secreto-vitrine (the same
   catalog search as the site, one term per call) until it has 50 products
   strictly inside the budget, then "+20 opções" continues from where it
   stopped. One Set per person: no listing repeats across that person's
   showcases. Nothing here invents a product: what is not in the catalog
   inside the budget simply does not show. */
import type { Resultado } from "@/lib/busca-guiada-cliente";
import { custoTotalDaOferta } from "@/lib/internacional";

/** Budget check with the real cost (price + shipping + read taxes): unknown
    shipping or international without read taxes never passes. */
export function cabeNaFaixa(
  r: Pick<Resultado, "preco" | "freteGratis"> & { internacional?: boolean },
  min: number | null | undefined,
  max: number | null | undefined,
  /** Weslei, 05/11: optional "frete a calcular" (price checked, shipping shown on the card). */
  freteACalcular = false,
): boolean {
  if (freteACalcular && r.freteGratis !== true && r.internacional !== true && r.preco != null && Number.isFinite(r.preco)) {
    if (min != null && r.preco < min) return false;
    if (max != null && r.preco > max) return false;
    return r.preco > 0;
  }
  const custo = custoTotalDaOferta({
    final: r.preco,
    /* Catalog cards have no shipping value: only confirmed free shipping. */
    freteGratis: r.freteGratis === true,
    custoFrete: null,
    internacional: r.internacional === true,
    tributosEstimados: null,
  });
  if (custo == null) return false;
  if (min != null && custo < min) return false;
  if (max != null && custo > max) return false;
  return true;
}

export { assinaturaDoModelo } from "@/lib/curadoria";
import { assinaturaDoModelo } from "@/lib/curadoria";

/** Listing ids of a result (item and catalog product). */
export const idsDoResultado = (r: Pick<Resultado, "item" | "produto">) =>
  [r.item, r.produto].filter((x) => /^MLB\d+$/.test(x));

export type PassoTermo = {
  termo: string;
  pagina: number;
  cursor: number | null;
  variantes: string[];
  fim: boolean;
};

export const passosIniciais = (termos: string[]): PassoTermo[] =>
  termos.map((termo) => ({ termo, pagina: 0, cursor: null, variantes: [], fim: false }));

/** Next term to read: the one with the lowest page that is not finished. */
export function proximoPasso(passos: PassoTermo[]): number {
  let k = -1;
  passos.forEach((p, i) => {
    if (!p.fim && (k < 0 || p.pagina < passos[k]!.pagina)) k = i;
  });
  return k;
}

type RespostaVitrine = {
  resultados?: Resultado[];
  proximo?: number | null;
  variantes?: string[];
  erro?: string;
};

export async function lerPaginaDoTermo(
  passo: PassoTermo,
  faixa: { min: number | null; max: number | null; freteACalcular?: boolean },
  vistos: string[],
): Promise<{ resposta: RespostaVitrine | null; erro: string | null; status: number }> {
  try {
    const r = await fetch("/api/public/amigo-secreto-vitrine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termo: passo.termo,
        min: faixa.min,
        max: faixa.max,
        ...(faixa.freteACalcular ? { freteACalcular: true } : {}),
        pagina: passo.pagina,
        ...(passo.cursor != null ? { cursor: passo.cursor } : {}),
        ...(passo.variantes.length ? { variantes: passo.variantes } : {}),
        ...(passo.pagina > 0 && vistos.length ? { vistos: vistos.slice(-400) } : {}),
      }),
    });
    const j = (await r.json().catch(() => ({}))) as RespostaVitrine;
    if (!r.ok || j.erro) return { resposta: null, erro: j.erro ?? "A busca não respondeu agora.", status: r.status };
    return { resposta: j, erro: null, status: r.status };
  } catch {
    return { resposta: null, erro: "Sem conexão agora. Tente de novo.", status: 0 };
  }
}

/** Reads until `alvo` NEW products came in (or every term ran out). */
export async function carregarAte(opcoes: {
  passos: PassoTermo[];
  faixa: { min: number | null; max: number | null; freteACalcular?: boolean };
  vistos: Set<string>;
  alvo: number;
  /** Partial results as they arrive (the showcase fills while it loads). */
  aoChegar?: (novos: Resultado[]) => void;
  cancelado?: () => boolean;
  /** Safety cap of calls for one load. */
  maxChamadas?: number;
  /** Editorial curation (amigo-secreto-curadoria): false drops the card. */
  aprovar?: (r: Resultado) => boolean;
}): Promise<{ novos: Resultado[]; passos: PassoTermo[]; erro: string | null }> {
  const passos = opcoes.passos.map((p) => ({ ...p }));
  const novos: Resultado[] = [];
  let erro: string | null = null;
  let falhas = 0;
  for (let n = 0; n < (opcoes.maxChamadas ?? 12) && novos.length < opcoes.alvo; n++) {
    if (opcoes.cancelado?.()) break;
    const k = proximoPasso(passos);
    if (k < 0) break;
    const passo = passos[k]!;
    const r = await lerPaginaDoTermo(passo, opcoes.faixa, [...opcoes.vistos].filter((id) => id.startsWith("MLB")));
    if (!r.resposta) {
      erro = r.erro;
      /* Too many requests: stop and let "+20 opções" try again later. */
      if (r.status === 429 || ++falhas >= 3) break;
      passo.fim = true;
      continue;
    }
    /* Marked one by one: the same listing twice in one page counts once. */
    const lote = (r.resposta.resultados ?? []).filter((x) => {
      const ids = idsDoResultado(x);
      if (!cabeNaFaixa(x, opcoes.faixa.min, opcoes.faixa.max, opcoes.faixa.freteACalcular === true) || !ids.length || ids.some((id) => opcoes.vistos.has(id)))
        return false;
      /* Same model in another color/seller shows once ("Comparar preço" opens the rest). */
      const sig = assinaturaDoModelo(x.nome);
      if (sig && opcoes.vistos.has(sig)) return false;
      if (opcoes.aprovar && !opcoes.aprovar(x)) return false;
      ids.forEach((id) => opcoes.vistos.add(id));
      if (sig) opcoes.vistos.add(sig);
      return true;
    });
    novos.push(...lote);
    if (lote.length) opcoes.aoChegar?.(lote);
    if (passo.pagina === 0) passo.variantes = r.resposta.variantes ?? [];
    passo.cursor = r.resposta.proximo ?? null;
    passo.pagina += 1;
    passo.fim = r.resposta.proximo == null;
  }
  return { novos, passos, erro: novos.length ? null : erro };
}
