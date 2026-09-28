/* Parecido mais barato porque vem MENOS (28/09: "Kit 10 cabides" x 30, "1un"
   x 3 pipetas) ou para outro uso/condição não é alternativa nem "melhor
   escolha". Mesma lista da função muda_nao_e_alternativa do banco. */
export const MUDA_NAO_E_ALTERNATIVA =
  /(quantidade|\bkits?\b|unidade|\bpe[cç]as?\b|\bmenor\b|\bmenos\b|\bsem\b|apenas|somente|tamanho|volume|capacidade|compat|voltagem|\bml\b|gramas|\bkg\b|pipeta|condi[cç][aã]o|usad[oa]|recondicion|vitrine|r[eé]plica|mililitr|litros?\b)/i;

/* "Mesma marca e volume, mas o nome..." não conta: o trecho "mesmo(a)..." sai antes. */
export function naoEAlternativa(muda: string | null | undefined): boolean {
  const texto = (muda ?? "").replace(/(^|[^\p{L}])mesm[oa]s?(?![\p{L}])[^,.;]*/giu, "$1");
  return MUDA_NAO_E_ALTERNATIVA.test(texto);
}

/* Palavras do título, normalizadas: sem acento, "3s" = "3 listras" = "três
   listras" = "3 stripes", masculina = masculino. Mesma regra da função
   tokens_do_titulo do banco. */
const PALAVRAS_VAZIAS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "para",
  "em",
  "e",
  "o",
  "a",
  "os",
  "as",
  "cor",
  "tamanho",
  "original",
]);
export function tokensDoTitulo(t: string | null | undefined): string[] {
  const s = (t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(tres|three|3)[\s-]*(listras|stripes|s)\b/g, "3s")
    .replace(/\bmasculin[oa]s?\b/g, "masculino")
    .replace(/\bfeminin[oa]s?\b/g, "feminino");
  return [
    ...new Set(s.split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !PALAVRAS_VAZIAS.has(w))),
  ];
}

/** Quanto do título colado (0 a 1) aparece no título do parecido. */
export function coberturaDoTitulo(
  colado: string | null | undefined,
  outro: string | null | undefined,
) {
  const a = tokensDoTitulo(colado);
  if (!a.length) return 0;
  const b = new Set(tokensDoTitulo(outro));
  return a.filter((w) => b.has(w)).length / a.length;
}

/* Nota para escolher a Melhor alternativa (Weslei, 28/09: o Linear de outra
   loja, R$ 3,70 mais barato, tomou o lugar do Woven, que é o modelo mais
   próximo): semelhança da conferência + até 10 pontos pelo título. Em
   empate, o mais barato. Mesma conta da função alternativa_da_analise. */
export function notaDeAlternativa(
  p: { semelhanca?: number | null; mesmaFoto?: boolean | null; titulo?: string | null },
  tituloColado: string | null | undefined,
) {
  return (p.semelhanca ?? (p.mesmaFoto ? 90 : 0)) + 10 * coberturaDoTitulo(tituloColado, p.titulo);
}

/* ------------------------------------------------ custo-benefício
   Weslei, 28/09: "tente sempre manter o mais próximo do produto indicado,
   pode haver variação em quantidade, mas precisa analisar a semelhança e
   custo-benefício". Quantidade diferente só vale como alternativa quando os
   dois títulos trazem a medida (kit, unidades, ml, g) e o preço por unidade
   (ou por litro/kg) sai menor. Sem medida nos dois, continua fora. */
export type Medida = { qtd: number; tipo: "un" | "ml" | "g" };

function decodificar(t: string) {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

export function medidaDoTitulo(titulo: string | null | undefined): Medida | null {
  const t = decodificar(titulo ?? "").toLowerCase();
  if (!t) return null;
  const num = (x: string) => Number(x.replace(",", "."));
  const kit =
    /\b(?:kit|c\/|com)\s*(\d{1,4})\b/.exec(t) ??
    /\b(\d{1,4})\s*(?:unidades|unid\.?|un\.?|pe[cç]as|p[cç]s|pares|pipetas?|c[aá]psulas?|sach[eê]s?|rolos?|pacotes?|latas?|frascos?|comprimidos?|refis|refil)\b/.exec(
      t,
    );
  const vezes = kit ? num(kit[1] ?? "1") : 1;
  const vol = /\b(\d+(?:[.,]\d+)?)\s*(ml|l|litros?)\b/.exec(t);
  if (vol) {
    const v = num(vol[1] ?? "0") * (vol[2] === "ml" ? 1 : 1000);
    return v > 0 ? { qtd: v * vezes, tipo: "ml" } : null;
  }
  const peso = /\b(\d+(?:[.,]\d+)?)\s*(g|kg|gramas?)\b/.exec(t);
  if (peso) {
    const g = num(peso[1] ?? "0") * (peso[2] === "kg" ? 1000 : 1);
    return g > 0 ? { qtd: g * vezes, tipo: "g" } : null;
  }
  return kit && vezes >= 1 ? { qtd: vezes, tipo: "un" } : null;
}

export type CustoBeneficio = {
  tipo: Medida["tipo"];
  /* Preço por unidade, por litro ou por kg. */
  unitColado: number;
  unitOutro: number;
  /* true = o outro sai pelo menos 2% mais barato por unidade. */
  melhor: boolean;
};

/** Só quando a quantidade muda e os dois títulos trazem a medida. */
export function custoBeneficio(
  colado: { preco: number | null | undefined; titulo: string | null | undefined },
  outro: { preco: number | null | undefined; titulo: string | null | undefined },
): CustoBeneficio | null {
  if (colado.preco == null || outro.preco == null) return null;
  const a = medidaDoTitulo(colado.titulo);
  const b = medidaDoTitulo(outro.titulo);
  if (!a || !b || a.tipo !== b.tipo || a.qtd === b.qtd) return null;
  const f = a.tipo === "un" ? 1 : 1000;
  const unitColado = (colado.preco / a.qtd) * f;
  const unitOutro = (outro.preco / b.qtd) * f;
  return { tipo: a.tipo, unitColado, unitOutro, melhor: unitOutro <= unitColado * 0.98 };
}

export function rotuloDaUnidade(tipo: Medida["tipo"]) {
  return tipo === "ml" ? "por litro" : tipo === "g" ? "por kg" : "por unidade";
}

/* Diferenças que nunca viram alternativa, mesmo com custo-benefício melhor:
   condição, compatibilidade, voltagem, réplica, "sem" (acessório/caixa). */
const MUDA_OUTRO_MOTIVO =
  /(compat|voltagem|condi[cç][aã]o|usad[oa]|recondicion|vitrine|r[eé]plica|\bsem\b)/i;

/** Pode ser a Melhor alternativa? Quantidade diferente vale pelo custo por
 *  unidade; sem medida nos dois títulos, "vem menos" continua fora. */
export function podeSerAlternativa(
  p: { preco: number | null | undefined; titulo?: string | null; muda?: string | null },
  base: { preco: number | null | undefined; titulo: string | null | undefined },
): { ok: boolean; cb: CustoBeneficio | null } {
  if (p.preco == null || base.preco == null) return { ok: false, cb: null };
  const cb = custoBeneficio(base, { preco: p.preco, titulo: p.titulo });
  if (cb) {
    const texto = (p.muda ?? "").replace(/(^|[^\p{L}])mesm[oa]s?(?![\p{L}])[^,.;]*/giu, "$1");
    return { ok: cb.melhor && !MUDA_OUTRO_MOTIVO.test(texto), cb };
  }
  return { ok: p.preco <= base.preco - 2 && !naoEAlternativa(p.muda), cb: null };
}
