/* Product sheet helpers for the details drawer (Weslei, 08/11: PDP with
   "O que você precisa saber", bento sheet and spec pills). Only what was read
   from the listing or the official catalog; nothing is invented. */
export type Caracteristica = { nome: string; valor: string };

export function caracteristicasValidas(
  c: (Caracteristica | null | undefined)[] | null | undefined,
): Caracteristica[] {
  return (c ?? []).filter(
    (x): x is Caracteristica =>
      !!x &&
      typeof x.nome === "string" &&
      typeof x.valor === "string" &&
      !!x.nome.trim() &&
      !!x.valor.trim() &&
      /* Internal flags the reader stores as rows (e.g. "best_seller"). */
      !/^[a-z]+(_[a-z]+)+$/.test(x.nome.trim()),
  );
}

/* Specs a buyer decides on, in priority order; the first 3 found become pills. */
const CHAVES = [
  /^marca$/i,
  /^modelo$/i,
  /capacidade|armazenamento|mem[oó]ria interna/i,
  /voltagem|tens[aã]o/i,
  /pot[eê]ncia/i,
  /tamanho da tela|polegadas/i,
  /^tamanho$|dimens/i,
  /^cor$|^cor principal$/i,
  /material/i,
];

export function pilulasDaFicha(c: Caracteristica[], max = 3): Caracteristica[] {
  const out: Caracteristica[] = [];
  for (const re of CHAVES) {
    const achou = c.find((x) => re.test(x.nome.trim()) && !out.includes(x));
    /* Long values (whole sentences) don't fit a pill. */
    if (achou && achou.valor.trim().length <= 24) out.push(achou);
    if (out.length >= max) break;
  }
  return out;
}
