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
