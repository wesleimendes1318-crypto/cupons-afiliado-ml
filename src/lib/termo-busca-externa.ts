/* Termo de busca nos outros marketplaces a partir do título do anúncio
   colado. Puro (vale no servidor, na tela e igual ao da extensão,
   extensao/multiloja.js).
   Weslei, 11/10 (prompt mestre do redesign): sai o ruído de venda
   ("silencioso", "econômico", "promoção", "oferta", "envio rápido"...),
   FICAM as especificações (formato "retangular", material "inox", medidas
   "2L"/"3 litros" e voltagem "220v"/"bivolt"), que separam um produto do
   outro. Até 8 palavras; especificação que ficou depois delas entra no fim
   (até 3, medida primeiro). Código de rastreio e SKU continuam saindo. */
const RUIDO =
  /\b(original|originais|lacrad[oa]s?|novo|nova|lan[cç]amentos?|promo[cç][aã]o|promo[cç][oõ]es|ofertas?|frete gr[aá]tis|envio (imediato|r[aá]pido|full)|pronta entrega|nota fiscal|com nf|nf|garantia|12x|sem juros|super|top|premium|melhor pre[cç]o|barat[oa]s?|silencios[oa]s?|econ[oô]mic[oa]s?|imperd[ií]vel|queima de estoque)\b/gi;

const RUIDO_TECNICO = /\b((c[oó]d(igo)?|sku)\.?\s*:?\s*[a-z0-9-]{4,}|[A-Z]{2}\d{9}[A-Z]{2})\b/gi;

const UNIDADE = "(?:l|litros?|ml|kg|g|w|v|cm|mm|gb|tb)";
/* "2 litros" vira um termo só ("2~litros") até o fim. */
const RE_NUMERO_UNIDADE = new RegExp(`(\\d)\\s+(${UNIDADE})\\b`, "gi");
const RE_ESPECIFICACAO = new RegExp(
  `^(retangular(es)?|quadrad[oa]s?|redond[oa]s?|ova(l|is)|inox|alum[ií]nio|pl[aá]stico|vidro|cer[aâ]mica|madeira|bambu|silicone|bivolt|\\d+(?:[.,]\\d+)?~?${UNIDADE})$`,
  "i",
);

/* Medida primeiro (o que mais separa um produto do outro), depois
   formato, material e voltagem. */
const prioridade = (t: string) =>
  /^\d/.test(t) && !/v$/i.test(t)
    ? 0
    : /^(retangular|quadrad|redond|ova)/i.test(t)
      ? 1
      : /^(bivolt|\d)/i.test(t)
        ? 3
        : 2;

export function termoDeBuscaExterna(titulo: string) {
  const termos = String(titulo || "")
    .replace(RUIDO_TECNICO, " ")
    .replace(RUIDO, " ")
    .replace(/[^\p{L}\p{N}\s.,/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(RE_NUMERO_UNIDADE, "$1~$2")
    .split(" ")
    .filter((t) => t && !/^[-.,/]+$/.test(t));
  const base = termos.slice(0, 8);
  const vistos = new Set(base.map((t) => t.toLowerCase()));
  const extras = termos
    .slice(8)
    .filter((t) => RE_ESPECIFICACAO.test(t) && !vistos.has(t.toLowerCase()))
    .map((t, i) => ({ t, i, p: prioridade(t) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.t);
  return [...base, ...extras].join(" ").replace(/~/g, " ");
}
