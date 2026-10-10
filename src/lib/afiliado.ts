/* LINK DE AFILIADO SEMPRE (Weslei, 26/09 e 05/10: "garanta que seja
   devolvido sempre o link que me gere comissão"). Só o encurtado do
   programa de afiliados (meli.la) é link de compra; qualquer outro endereço
   é descartado e o botão passa a gerar o link de afiliado no clique (o
   endereço do anúncio continua em `url`). */

export const ehLinkDeAfiliado = (u: unknown): u is string =>
  typeof u === "string" && /^https:\/\/meli\.la\/[A-Za-z0-9]+\/?$/.test(u.trim());

/** O link, se for de afiliado; senão null. */
export const soAfiliado = (u: unknown): string | null => (ehLinkDeAfiliado(u) ? u.trim() : null);

type ComLink = { link?: string | null | undefined; vendedor?: string | null; loja?: string | null };

/* APELIDO DA CONTA NUNCA É LOJA (05/10, pedido 716: "Vendido por
   WESLEI.MENDES" num parecido pausado; a leitura logada pegou o apelido de
   quem estava logado). Trava do site, além da correção da extensão 1.149. */
const RE_APELIDO_DA_CONTA = /^\s*weslei[\s._-]*mendes\s*$/i;
export const nomeDeLojaValido = (n: unknown): string | null =>
  typeof n === "string" && n.trim() && !RE_APELIDO_DA_CONTA.test(n) ? n : null;

function limparItem<T extends ComLink>(x: T): T {
  const saida = { ...x, link: soAfiliado(x.link) };
  if ("vendedor" in x) saida.vendedor = nomeDeLojaValido(x.vendedor);
  if ("loja" in x) saida.loja = nomeDeLojaValido(x.loja);
  return saida;
}

function limparLista<T extends ComLink>(l: T[] | null | undefined): T[] | null | undefined {
  return Array.isArray(l) ? l.map((x) => (x && typeof x === "object" ? limparItem(x) : x)) : l;
}

/** Tira da análise todo link que não é de afiliado (colado, lojas, parecidos, referências). */
export function analiseSoComAfiliado<
  A extends {
    vendedor?: string | null;
    outraLoja?: ComLink | null;
    outrasLojas?: ComLink[] | null;
    parecidos?: ComLink[] | null;
    referencias?: ComLink[] | null;
  },
>(a: A | null): A | null {
  if (!a || typeof a !== "object") return a;
  return {
    ...a,
    ...("vendedor" in a ? { vendedor: nomeDeLojaValido(a.vendedor) } : {}),
    outraLoja: a.outraLoja ? limparItem(a.outraLoja) : a.outraLoja,
    outrasLojas: limparLista(a.outrasLojas),
    parecidos: limparLista(a.parecidos),
    referencias: limparLista(a.referencias),
  };
}

/* MULTI-MARKETPLACE (Weslei, 09/10: Amazon + Shopee). A trava acima
   continua só meli.la para tudo que é do Mercado Livre (anúncio de outra
   loja num campo do Mercado Livre é descartado). Para as ofertas de outro
   marketplace, cada uma só passa com o link de afiliado DELE:
   - Amazon: amazon.com.br com tag=melhoresc0fff-20 (Associates) ou o
     encurtado amzn.to;
   - Shopee: encurtado do programa de afiliados (s.shopee.com.br, shope.ee). */
export const TAG_AMAZON = "melhoresc0fff-20";

export type Marketplace = "mercadolivre" | "amazon" | "shopee";

const RE_AMAZON_CURTO = /^https:\/\/amzn\.to\/[A-Za-z0-9]+\/?$/;
const RE_SHOPEE_CURTO = /^https:\/\/(?:s\.shopee\.com\.br|shope\.ee)\/[A-Za-z0-9]+\/?$/;

function urlSegura(u: unknown): URL | null {
  if (typeof u !== "string") return null;
  try {
    const x = new URL(u.trim());
    return x.protocol === "https:" ? x : null;
  } catch {
    return null;
  }
}

export function ehLinkDeAfiliadoAmazon(u: unknown, tag = TAG_AMAZON): u is string {
  if (typeof u !== "string") return false;
  if (RE_AMAZON_CURTO.test(u.trim())) return true;
  const x = urlSegura(u);
  return (
    !!x &&
    /^(www\.)?amazon\.com\.br$/i.test(x.hostname) &&
    x.searchParams.getAll("tag").length === 1 &&
    x.searchParams.get("tag") === tag
  );
}

export const ehLinkDeAfiliadoShopee = (u: unknown): u is string =>
  typeof u === "string" && RE_SHOPEE_CURTO.test(u.trim());

/** Link de compra válido do marketplace indicado (ou de qualquer um). */
export function ehLinkDeCompra(u: unknown, de?: Marketplace): u is string {
  if (de === "mercadolivre") return ehLinkDeAfiliado(u);
  if (de === "amazon") return ehLinkDeAfiliadoAmazon(u);
  if (de === "shopee") return ehLinkDeAfiliadoShopee(u);
  return ehLinkDeAfiliado(u) || ehLinkDeAfiliadoAmazon(u) || ehLinkDeAfiliadoShopee(u);
}

export function marketplaceDoLink(u: unknown): Marketplace | null {
  if (ehLinkDeAfiliado(u)) return "mercadolivre";
  if (ehLinkDeAfiliadoAmazon(u)) return "amazon";
  if (ehLinkDeAfiliadoShopee(u)) return "shopee";
  return null;
}

/* ASIN (B0 + 8) ou ISBN-10 dos livros: o código do produto na Amazon. */
const RE_ASIN = /^(?:B0[A-Z0-9]{8}|\d{9}[\dX])$/i;

/** Link de afiliado da Amazon (Weslei, 09/10: tag melhoresc0fff-20):
    - ASIN puro ("B0ABCDEFGH") -> /dp/<ASIN>?tag=...;
    - endereço amazon.com.br com ASIN (/dp/, /gp/product/) -> o mesmo /dp/,
      limpo (sem rastreio de terceiros);
    - termo de busca (texto que não é endereço) -> /s?k=<termo>&tag=...
      (o "Conferir na Amazon" quando não há preço capturado);
    - endereço sem ASIN ou de outro domínio: null. */
export function gerarUrlAfiliadoAmazon(urlOuAsin: unknown, tag = TAG_AMAZON): string | null {
  if (typeof urlOuAsin !== "string") return null;
  const bruto = urlOuAsin.trim();
  if (!bruto) return null;
  const dp = (asin: string) =>
    `https://www.amazon.com.br/dp/${asin.toUpperCase()}?tag=${encodeURIComponent(tag)}`;
  if (RE_ASIN.test(bruto)) return dp(bruto);
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(bruto) && !/^(www\.)?amazon\./i.test(bruto))
    return urlBuscaAmazon(bruto, tag);
  const x = urlSegura(bruto);
  if (!x || !/^(www\.)?amazon\.com\.br$/i.test(x.hostname)) return null;
  const asin = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i.exec(
    x.pathname + "/",
  )?.[1];
  return asin ? dp(asin) : null;
}

/** Busca da Amazon com a tag (até 120 caracteres de termo). Sem termo: null. */
export function urlBuscaAmazon(termo: unknown, tag = TAG_AMAZON): string | null {
  if (typeof termo !== "string") return null;
  const t = termo.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!t) return null;
  return `https://www.amazon.com.br/s?k=${encodeURIComponent(t)}&tag=${encodeURIComponent(tag)}`;
}
