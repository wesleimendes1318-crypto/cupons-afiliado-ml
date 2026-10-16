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
  /* Prompt mestre do redesign (11/10): adjetivos de venda que não
     identificam o produto. */
  /\bsilencios[oa]s?\b/gi,
  /\becon[oô]mic[oa]s?\b/gi,
  /\bpremium\b/gi,
];

/* "USB" e "automática" só saem DEPOIS do nome ("Ventilador USB" e
   "Cafeteira Automática" continuam; "Bebedouro ... Automática ... USB" não). */
const RUIDO_DEPOIS_DO_NOME = /^(usb|autom[aá]tic[oa]s?)$/i;

const UNIDADE = "(?:l|litros?|ml|kg|g|w|cm|mm|gb|tb)";
const RE_NUMERO_UNIDADE = new RegExp(`(\\d)\\s+(${UNIDADE})\\b`, "gi");
/** Formato, material e capacidade: identificam o modelo e ficam no termo
    mesmo depois do limite de palavras (até 2). */
const RE_ESPECIFICACAO = new RegExp(
  `^(retangular(es)?|quadrad[oa]s?|redond[oa]s?|ova(l|is)|inox|alum[ií]nio|pl[aá]stico|vidro|cer[aâ]mica|madeira|bambu|silicone|\\d+(?:[.,]\\d+)?~?${UNIDADE})$`,
  "i",
);

/** Título do anúncio em termo de busca: até `max` palavras-chave (preposição
    não conta) e, depois delas, até 2 especificações (medida primeiro). */
export function termoDoProduto(titulo: string | null | undefined, max = 8): string {
  let t = String(titulo ?? "");
  for (const re of RUIDO) t = t.replace(re, " ");
  const termos = t
    .replace(/[^\p{L}\p{N}\s.,/+&-]/gu, " ")
    .replace(/\s[-–—,./]+\s/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(RE_NUMERO_UNIDADE, "$1~$2")
    .split(" ")
    .filter(Boolean)
    .filter((p, i) => i < 3 || !RUIDO_DEPOIS_DO_NOME.test(p));
  const base: string[] = [];
  let chaves = 0;
  let i = 0;
  for (; i < termos.length && chaves < max; i++) {
    const p = termos[i]!;
    base.push(p);
    if (!PALAVRAS_VAZIAS.has(semAcento(p))) chaves += 1;
  }
  while (base.length && PALAVRAS_VAZIAS.has(semAcento(base[base.length - 1]!))) base.pop();
  const vistos = new Set(base.map((p) => p.toLowerCase()));
  const extras = termos
    .slice(i)
    .filter((p) => RE_ESPECIFICACAO.test(p) && !vistos.has(p.toLowerCase()))
    .map((p, k) => ({ p, k, ordem: /^\d/.test(p) ? 0 : 1 }))
    .sort((a, b) => a.ordem - b.ordem || a.k - b.k)
    .slice(0, 2)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);
  return [...base, ...extras].join(" ").replace(/~/g, " ");
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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
