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
  if (
    freteACalcular &&
    r.freteGratis !== true &&
    r.internacional !== true &&
    r.preco != null &&
    Number.isFinite(r.preco)
  ) {
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

export { assinaturaDoModelo, idDaFoto } from "@/lib/curadoria";
import { repetido } from "@/lib/curadoria";

/* Titles already shown per person (near-duplicate check), keyed by that person's `vistos`. */
const TITULOS = new WeakMap<Set<string>, string[][]>();

/** Listing ids of a result (item and catalog product). */
export const idsDoResultado = (r: Pick<Resultado, "item" | "produto">) =>
  [r.item, r.produto].filter((x) => /^MLB\d+$/.test(x));

export type PassoTermo = {
  termo: string;
  pagina: number;
  cursor: number | null;
  variantes: string[];
  fim: boolean;
  /** Pages in a row with nothing inside the budget. */
  vazias?: number;
};

export const passosIniciais = (termos: string[]): PassoTermo[] =>
  termos.map((termo) => ({ termo, pagina: 0, cursor: null, variantes: [], fim: false }));

/** Reserve terms not read yet (keeps "+20 opções" open). */
export const restamReservas = (passos: PassoTermo[], reserva: string[]) => {
  const usados = new Set(passos.map((p) => p.termo.toLowerCase()));
  return reserva.some((t) => !usados.has(t.toLowerCase()));
};

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
  /** Stored listings only, at once (planners). */
  rapido = false,
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
        ...(rapido ? { rapido: true } : {}),
      }),
    });
    const j = (await r.json().catch(() => ({}))) as RespostaVitrine;
    if (!r.ok || j.erro)
      return { resposta: null, erro: j.erro ?? "A busca não respondeu agora.", status: r.status };
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
  /** Sibling terms added 4 at a time when every term ran out (06/11: "+20" never dies). */
  termosReserva?: string[];
}): Promise<{ novos: Resultado[]; passos: PassoTermo[]; erro: string | null }> {
  const passos = opcoes.passos.map((p) => ({ ...p }));
  const novos: Resultado[] = [];
  const titulos = TITULOS.get(opcoes.vistos) ?? [];
  TITULOS.set(opcoes.vistos, titulos);
  let erro: string | null = null;
  let falhas = 0;
  let chamadas = 0;
  const maximo = opcoes.maxChamadas ?? 30;
  /* Speed (Weslei, 05/11): up to 3 terms read at the same time. */
  while (chamadas < maximo && novos.length < opcoes.alvo) {
    if (opcoes.cancelado?.()) break;
    const lote: number[] = [];
    for (let i = 0; i < Math.min(3, maximo - chamadas); i++) {
      const k = proximoPasso(passos.map((p, j) => (lote.includes(j) ? { ...p, fim: true } : p)));
      if (k < 0) break;
      lote.push(k);
    }
    if (!lote.length) {
      const usados = new Set(passos.map((p) => p.termo.toLowerCase()));
      const mais = (opcoes.termosReserva ?? [])
        .filter((t) => !usados.has(t.toLowerCase()))
        .slice(0, 4);
      if (!mais.length) break;
      passos.push(...passosIniciais(mais));
      continue;
    }
    chamadas += lote.length;
    const vistosAgora = [...opcoes.vistos].filter((id) => id.startsWith("MLB"));
    const respostas = await Promise.all(
      lote.map((k) => lerPaginaDoTermo(passos[k]!, opcoes.faixa, vistosAgora)),
    );
    if (opcoes.cancelado?.()) break;
    let parar = false;
    respostas.forEach((r, i) => {
      const passo = passos[lote[i]!]!;
      if (!r.resposta) {
        erro = r.erro;
        /* Too many requests: stop and let "+20 opções" try again later. */
        if (r.status === 429 || ++falhas >= 3) parar = true;
        passo.fim = true;
        return;
      }
      const naFaixa = (r.resposta.resultados ?? []).filter((x) =>
        cabeNaFaixa(x, opcoes.faixa.min, opcoes.faixa.max, opcoes.faixa.freteACalcular === true),
      );
      /* Checked one by one: same listing, same photo, same model or a
         near-identical title already in this person's showcases stays out. */
      const novosDoTermo = naFaixa.filter((x) => {
        const ids = idsDoResultado(x);
        if (!ids.length || ids.some((id) => opcoes.vistos.has(id))) return false;
        if (opcoes.aprovar && !opcoes.aprovar(x)) return false;
        if (repetido(opcoes.vistos, titulos, x.nome, x.imagem)) return false;
        ids.forEach((id) => opcoes.vistos.add(id));
        return true;
      });
      novos.push(...novosDoTermo);
      if (novosDoTermo.length) opcoes.aoChegar?.(novosDoTermo);
      if (passo.pagina === 0) passo.variantes = r.resposta.variantes ?? [];
      passo.cursor = r.resposta.proximo ?? null;
      passo.pagina += 1;
      /* Two pages in a row with nothing inside the budget end that term
         (one empty page is common in narrow budgets: the next one has items). */
      passo.vazias = naFaixa.length ? 0 : (passo.vazias ?? 0) + 1;
      passo.fim = r.resposta.proximo == null || passo.vazias >= 2;
    });
    if (parar) break;
  }
  return { novos, passos, erro: novos.length ? null : erro };
}
