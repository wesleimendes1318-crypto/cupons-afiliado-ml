/* RECONHECIMENTO UNIVERSAL DE LINKS (Weslei, 10/10: "preciso que ele aceite
   qualquer link e identifique o produto, que ele faça a busca
   preferencialmente no player do link colado e que sou afiliado. caso seja
   um link de um player que não estou afiliado, identifique o produto e
   busque no mercado livre").

   Só lê o texto colado: nada de rede aqui (o servidor resolve encurtados e
   lê o título da página em /api/public/identificar-link). O nome sai do
   endereço do jeito que a loja escreveu (sem trocar maiúsculas), sem código,
   SKU nem rastreio. Sem nome no endereço, vale o texto em volta do link (o
   app da Amazon e o da Shopee mandam o título junto ao compartilhar). */

export type OrigemLink = "mercadolivre" | "amazon" | "shopee" | "outro_player" | "invalido";

export interface AnaliseLink {
  origem: OrigemLink;
  /* Endereço sem rastreio ("" quando não há endereço). */
  urlLimpa: string;
  /* MLB, ASIN, "loja.item" da Shopee ou o código do produto na outra loja. */
  identificador?: string;
  /* Nome do produto lido do endereço ou do texto em volta. */
  termoIdentificado?: string;
  /* Nome da loja para o texto da tela (nunca em botão de compra). */
  nomeLoja?: string;
  /* Encurtado (meli.la, amzn.to, a.co, shope.ee...): o servidor resolve. */
  encurtado?: boolean;
}

export const MENSAGEM_SEM_LINK =
  "Não encontrei um link aqui. Cole o endereço do anúncio (de qualquer loja) ou escreva o nome do produto.";

const RE_URL = /(?:https?:\/\/|www\.)[^\s"'<>]+/gi;

const RE_ML =
  /(^|\.)(mercadolivre\.com\.br|mercadolivre\.com|mercadolibre\.com(\.[a-z]{2})?|meli\.la)$/i;
const RE_AMAZON_BR = /(^|\.)amazon\.com\.br$/i;
const RE_AMAZON_CURTO = /^(amzn\.to|a\.co|amzn\.com\.br)$/i;
const RE_SHOPEE = /(^|\.)shopee\.com\.br$/i;
const RE_SHOPEE_CURTO = /^(shope\.ee|s\.shopee\.com\.br)$/i;

/* Lojas conhecidas: nome para a tela. Qualquer outro endereço público
   também vale (nome = domínio). */
const LOJAS: Array<[RegExp, string]> = [
  [/(^|\.)(magazineluiza\.com\.br|magalu\.com(\.br)?)$/i, "Magalu"],
  [/(^|\.)kabum\.com\.br$/i, "KaBuM!"],
  [/(^|\.)casasbahia\.com\.br$/i, "Casas Bahia"],
  [/(^|\.)pontofrio\.com\.br$/i, "Ponto"],
  [/(^|\.)extra\.com\.br$/i, "Extra"],
  [/(^|\.)americanas\.com(\.br)?$/i, "Americanas"],
  [/(^|\.)submarino\.com\.br$/i, "Submarino"],
  [/(^|\.)shoptime\.com\.br$/i, "Shoptime"],
  [/(^|\.)shein\.com(\.br)?$/i, "Shein"],
  [/(^|\.)aliexpress\.(com|us)$/i, "AliExpress"],
  [/(^|\.)temu\.com$/i, "Temu"],
  [/(^|\.)carrefour\.com\.br$/i, "Carrefour"],
  [/(^|\.)netshoes\.com\.br$/i, "Netshoes"],
  [/(^|\.)centauro\.com\.br$/i, "Centauro"],
  [/(^|\.)dafiti\.com\.br$/i, "Dafiti"],
  [/(^|\.)fastshop\.com\.br$/i, "Fast Shop"],
  [/(^|\.)leroymerlin\.com\.br$/i, "Leroy Merlin"],
  [/(^|\.)madeiramadeira\.com\.br$/i, "MadeiraMadeira"],
  [/(^|\.)amazon\.(com|ca|co\.uk|de|es|fr|it|com\.mx)$/i, "Amazon (fora do Brasil)"],
];

/* Encurtados de outras lojas que o servidor também resolve. */
const RE_OUTRO_CURTO =
  /^(a\.aliexpress\.com|s\.click\.aliexpress\.com|magalu\.lu|tinyurl\.com|bit\.ly)$/i;

/* Partes do caminho que nunca são o nome do produto. */
const PALAVRAS_DE_CAMINHO = new Set([
  "p",
  "dp",
  "gp",
  "product",
  "produto",
  "produtos",
  "item",
  "items",
  "ep",
  "b",
  "d",
  "s",
  "br",
  "pt",
  "pdp",
  "loja",
  "store",
  "share",
  "ref",
]);

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s.replace(/\+/g, " ");
  }
}

/* Nome do produto a partir de um pedaço do endereço: decodifica, tira
   código/SKU e troca hífen por espaço. Mantém as maiúsculas da loja. */
export function limparSlug(slug: string): string {
  let s = decodificar(String(slug || ""));
  s = s
    .replace(/\.(html?|aspx?|php)$/i, "")
    .replace(/^MLB-?\d+-/i, "") // produto.mercadolivre.com.br/MLB-123-nome
    .replace(/[-_]JM$/i, "")
    .replace(/-i\.\d+\.\d+$/i, "") // Shopee: nome-i.loja.item
    .replace(/-p-\d+(-cat-\d+)?$/i, "") // Shein
    .replace(/-g-\d+$/i, "") // Temu
    .replace(/[-_]\d{6,}$/i, ""); // SKU longo no fim
  s = s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

/* Pedaço que parece nome: duas palavras ou mais, com letras. */
function pareceNome(parte: string): boolean {
  const limpo = limparSlug(parte);
  if (limpo.length < 5) return false;
  const palavras = limpo.split(" ").filter((p) => /\p{L}/u.test(p));
  return palavras.length >= 2;
}

function melhorSlug(segmentos: string[]): string | undefined {
  let melhor: string | undefined;
  let tamanho = 0;
  for (const seg of segmentos) {
    if (!seg || PALAVRAS_DE_CAMINHO.has(seg.toLowerCase())) continue;
    if (!pareceNome(seg)) continue;
    const n = limparSlug(seg).split(" ").length;
    if (n > tamanho) {
      melhor = limparSlug(seg);
      tamanho = n;
    }
  }
  return melhor;
}

/* Texto em volta do link (título que o app manda ao compartilhar), sem
   frases de compartilhamento nem preço. */
export function textoEmVolta(texto: string): string | undefined {
  let t = String(texto || "")
    .replace(RE_URL, " ")
    .replace(/R\$\s*[\d.]+(,\d{2})?/gi, " ");
  for (const re of FRASES_DE_COMPARTILHAR) t = t.replace(re, " ");
  t = t
    .replace(/[|•\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s(por|de|a partir de)\s*$/i, "")
    .replace(/^[\s:,.!?-]+|[\s:,.!?-]+$/g, "")
    .trim();
  if (t.length < 3 || t.length > 160) return undefined;
  if (!/\p{L}{3}/u.test(t)) return undefined;
  return t;
}

/* Frases que os apps colocam ao compartilhar (não são o nome do produto). */
const FRASES_DE_COMPARTILHAR: RegExp[] = [
  /\b(confira|veja|olha|olhe|d[áa] uma olhada|encontrei|achei|compartilhad[oa])\b[^:]{0,40}:/gi,
  /\b(confira|veja|olha|olhe|d[áa] uma olhada)\b( n?(isso|isto|este|esse|neste|nesse|o|a|que|q|essa|esta))*( (produto|item|oferta|achado|promo[çc][ãa]o))?( (que|q))?( (eu )?(encontrei|achei|vi))?( (na|no|da|do) (amazon|shopee)( brasil)?)?\s*[!.,-]*/gi,
  /\b(encontrei|achei|vi)( (este|esse|isso|isto|um|uma|o|a|essa|esta))?( (produto|item|oferta))?( (na|no) (amazon|shopee)( brasil)?)?\s*[!.,-]*/gi,
  /\bcompartilhad[oa] (via|pelo|pela|do|da)\b[^.!]*[.!]?/gi,
  /\b(na|no|da|do) (amazon|shopee)( brasil)?\b/gi,
];

function primeiraUrl(texto: string): URL | null {
  for (const bruto of String(texto || "").match(RE_URL) || []) {
    // Duas URLs coladas sem espaço: corta na segunda.
    const corte = bruto.slice(8).search(/https?:\/\//i);
    const candidato = corte >= 0 ? bruto.slice(0, corte + 8) : bruto;
    try {
      const u = new URL(/^https?:\/\//i.test(candidato) ? candidato : `https://${candidato}`);
      if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".")) return u;
    } catch {
      /* próximo */
    }
  }
  return null;
}

/* Endereço do Mercado Livre: só pdp_filters (a oferta escolhida) fica. */
function analisarMl(u: URL): AnaliseLink {
  const limpo = new URL(u.toString());
  limpo.hash = "";
  for (const k of [...limpo.searchParams.keys()])
    if (k !== "pdp_filters") limpo.searchParams.delete(k);
  const host = limpo.hostname.toLowerCase();
  const caminho = limpo.pathname;
  const mlb = /\/(MLB)-?(\d{6,})/i.exec(caminho);
  const segs = caminho.split("/").filter(Boolean);
  /* /nome-do-produto/p/MLB123 ou produto.mercadolivre.com.br/MLB-123-nome */
  const indiceP = segs.findIndex((s) => s.toLowerCase() === "p");
  const slug =
    indiceP > 0 ? segs[indiceP - 1] : (segs.find((s) => /^MLB-?\d+-/i.test(s)) ?? undefined);
  const termo = slug && pareceNome(slug) ? limparSlug(slug) : undefined;
  return {
    origem: "mercadolivre",
    urlLimpa: limpo.toString(),
    ...(mlb ? { identificador: `MLB${mlb[2]}` } : {}),
    ...(termo ? { termoIdentificado: termo } : {}),
    nomeLoja: "Mercado Livre",
    ...(host === "meli.la" ? { encurtado: true } : {}),
  };
}

const RE_ASIN =
  /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN|o\/ASIN)\/([A-Z0-9]{10})(?=[/?#]|$)/i;

function analisarAmazon(u: URL): AnaliseLink {
  const host = u.hostname.toLowerCase();
  if (RE_AMAZON_CURTO.test(host)) {
    return {
      origem: "amazon",
      urlLimpa: `https://${host}${u.pathname}`,
      nomeLoja: "Amazon",
      encurtado: true,
    };
  }
  const asin = RE_ASIN.exec(u.pathname)?.[1]?.toUpperCase();
  const segs = u.pathname.split("/").filter(Boolean);
  /* /Nome-do-Produto/dp/ASIN: o nome vem antes do dp. */
  const indiceDp = segs.findIndex((s) => /^(dp|gp)$/i.test(s));
  const slug = indiceDp > 0 ? segs[indiceDp - 1] : undefined;
  const termo = slug && pareceNome(slug) ? limparSlug(slug) : undefined;
  return {
    origem: "amazon",
    urlLimpa: asin ? `https://www.amazon.com.br/dp/${asin}` : `https://${host}${u.pathname}`,
    ...(asin ? { identificador: asin } : {}),
    ...(termo ? { termoIdentificado: termo } : {}),
    nomeLoja: "Amazon",
  };
}

function analisarShopee(u: URL): AnaliseLink {
  const host = u.hostname.toLowerCase();
  if (RE_SHOPEE_CURTO.test(host)) {
    return {
      origem: "shopee",
      urlLimpa: `https://${host}${u.pathname}`,
      nomeLoja: "Shopee",
      encurtado: true,
    };
  }
  const segs = u.pathname.split("/").filter(Boolean);
  /* /Nome-do-Produto-i.LOJA.ITEM ou /product/LOJA/ITEM */
  const comNome = segs.find((s) => /-i\.\d+\.\d+$/i.test(s));
  const ids = comNome
    ? /-i\.(\d+)\.(\d+)$/i.exec(comNome)
    : /^\/product\/(\d+)\/(\d+)/i.exec(u.pathname);
  const termo = comNome && pareceNome(comNome) ? limparSlug(comNome) : undefined;
  return {
    origem: "shopee",
    urlLimpa: `https://shopee.com.br${comNome ? `/${comNome}` : u.pathname}`,
    ...(ids ? { identificador: `${ids[1]}.${ids[2]}` } : {}),
    ...(termo ? { termoIdentificado: termo } : {}),
    nomeLoja: "Shopee",
  };
}

/* Código do produto em lojas conhecidas (só para referência). */
function codigoDoCaminho(caminho: string): string | undefined {
  return (
    /\/p\/(\d{4,})/i.exec(caminho)?.[1] ?? // Magalu, Casas Bahia
    /\/produto\/(\d{4,})/i.exec(caminho)?.[1] ?? // KaBuM!, Americanas
    /\/item\/(\d{6,})/i.exec(caminho)?.[1] ?? // AliExpress
    /-p-(\d{4,})/i.exec(caminho)?.[1] ?? // Shein
    /-g-(\d{6,})/i.exec(caminho)?.[1] ?? // Temu
    undefined
  );
}

function analisarOutro(u: URL): AnaliseLink {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const nomeLoja = LOJAS.find(([re]) => re.test(host))?.[1] ?? host;
  const segs = u.pathname.split("/").filter(Boolean);
  const termo = melhorSlug(segs);
  const codigo = codigoDoCaminho(u.pathname);
  return {
    origem: "outro_player",
    urlLimpa: `https://${u.hostname.toLowerCase()}${u.pathname}`,
    ...(codigo ? { identificador: codigo } : {}),
    ...(termo ? { termoIdentificado: termo } : {}),
    nomeLoja,
    ...(RE_OUTRO_CURTO.test(host) ? { encurtado: true } : {}),
  };
}

/* Identifica a loja e o produto de um texto colado. */
export function analisarLink(texto: string): AnaliseLink {
  const u = primeiraUrl(texto);
  if (!u) {
    const nome = textoEmVolta(texto);
    return {
      origem: "invalido",
      urlLimpa: "",
      /* Texto solto com cara de produto: a tela oferece buscar pelo nome. */
      ...(nome && !/\b(www|https?)\b|\.com\b/i.test(nome) ? { termoIdentificado: nome } : {}),
    };
  }
  const host = u.hostname.toLowerCase();
  let a: AnaliseLink;
  if (RE_ML.test(host)) a = analisarMl(u);
  else if (RE_AMAZON_BR.test(host) || RE_AMAZON_CURTO.test(host)) a = analisarAmazon(u);
  else if (RE_SHOPEE.test(host) || RE_SHOPEE_CURTO.test(host)) a = analisarShopee(u);
  else a = analisarOutro(u);
  if (!a.termoIdentificado) {
    const emVolta = textoEmVolta(texto);
    if (emVolta) a.termoIdentificado = emVolta;
  }
  return a;
}

/* Primeira letra maiúscula só para a tela ("fritadeira..." -> "Fritadeira..."). */
export function nomeParaTela(termo: string): string {
  const t = termo.trim();
  return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : t;
}
