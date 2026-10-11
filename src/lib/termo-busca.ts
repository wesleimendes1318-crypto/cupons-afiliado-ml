/* TERMO DE BUSCA DO MESMO PRODUTO (Weslei, 11/10: um bebedouro pet colado
   da Amazon virou "fonte de agua pet bivolt" na busca e voltou uma fonte
   decorativa de Buda). O título do anúncio vira um termo limpo, com o que
   identifica o produto (tipo, marca, modelo e medidas), sem o ruído de
   venda ("Frete Grátis", "Promoção", "Bivolt", "Envio Imediato"...) nem
   código de rastreio/SKU. A categoria é conferida depois (domínio previsto
   pela API oficial do Mercado Livre, src/lib/busca-guiada.ts). */

const RUIDO: RegExp[] = [
  /\bfrete\s+gr[aá]tis\b/gi,
  /\b(super\s+)?promo[cç](?:[aã]o|[oõ]es)\b/gi,
  /\b(super\s+|mega\s+)?ofertas?\b/gi,
  /\bbivolt\b/gi,
  /\b(110|127|220)\s?v\b/gi,
  /\benvio\s+(imediato|r[aá]pido|full|24\s?h(oras)?|no\s+mesmo\s+dia)\b/gi,
  /\bpronta\s+entrega\b/gi,
  /\b(com\s+)?(nf|nfe|nota\s+fiscal)\b/gi,
  /\blan[cç]amentos?\b/gi,
  /\boriginal(is)?\b/gi,
  /\blacrad[oa]s?\b/gi,
  /\bmelhor\s+pre[cç]o\b/gi,
  /\b(black\s+friday|queima\s+de\s+estoque|liquida[cç][aã]o)\b/gi,
  /\b(barato|barata|baratos|baratas|imperd[ií]vel)\b/gi,
  /\b(garantia(\s+de)?\s+\d+\s+(meses|anos?))\b/gi,
  /\b(\d{1,2}x\s+)?sem\s+juros\b/gi,
  /\b(c[oó]d(igo)?|sku|ref)\.?\s*:?\s*[a-z0-9-]{4,}\b/gi,
  /\b[A-Z]{2}\d{9}[A-Z]{2}\b/g, // código de rastreio dos Correios
];

/** Título do anúncio em termo de busca (até `max` palavras). */
export function termoDoProduto(titulo: string | null | undefined, max = 8): string {
  let t = String(titulo ?? "");
  for (const re of RUIDO) t = t.replace(re, " ");
  t = t
    .replace(/[^\p{L}\p{N}\s.,/+&-]/gu, " ")
    .replace(/\s[-–—,./]+\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.split(" ").filter(Boolean).slice(0, max).join(" ");
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PALAVRAS_VAZIAS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "para",
  "pra",
  "com",
  "sem",
  "e",
  "em",
  "a",
  "o",
  "as",
  "os",
  "kit",
  "novo",
  "nova",
  "un",
  "unidade",
]);

/** Tipo do produto: a primeira palavra com letras que não é preposição
    ("Bebedouro Fonte Para Gatos" -> "bebedouro"). Reserva do filtro de
    categoria quando a API não prevê o domínio. */
export function tipoDoProduto(titulo: string | null | undefined): string | null {
  for (const p of semAcento(termoDoProduto(titulo, 12)).split(/[^a-z0-9]+/)) {
    if (p.length >= 3 && /[a-z]/.test(p) && !PALAVRAS_VAZIAS.has(p)) return p;
  }
  return null;
}

/** O nome do resultado traz o tipo do produto (com plural simples). */
export function nomeTemOTipo(nome: string, tipo: string | null): boolean {
  if (!tipo) return true;
  const n = ` ${semAcento(nome)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  const raiz = tipo.replace(/(es|s)$/, "");
  return n.includes(` ${tipo} `) || n.includes(` ${raiz} `) || n.includes(` ${raiz}s `);
}
