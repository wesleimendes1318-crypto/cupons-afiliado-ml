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
