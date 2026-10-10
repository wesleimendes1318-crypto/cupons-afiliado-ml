/* Termo de busca nos outros marketplaces a partir do título do anúncio
   colado: sem ruído de venda, até 8 palavras. Puro (vale no servidor, na
   tela e igual ao da extensão, extensao/multiloja.js). */
const RUIDO =
  /\b(original|originais|lacrad[oa]s?|novo|nova|lan[cç]amento|promo[cç][aã]o|oferta|frete gr[aá]tis|envio (imediato|r[aá]pido)|pronta entrega|nota fiscal|com nf|nf|garantia|12x|sem juros|super|top|premium|melhor pre[cç]o|barato)\b/gi;

export function termoDeBuscaExterna(titulo: string) {
  return titulo
    .replace(RUIDO, " ")
    .replace(/[^\p{L}\p{N}\s.,/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");
}
