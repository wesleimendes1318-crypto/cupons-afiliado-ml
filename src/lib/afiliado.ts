/* LINK DE AFILIADO SEMPRE (Weslei, 26/09 e 05/10: "garanta que seja
   devolvido sempre o link que me gere comissão"). Só o encurtado do
   programa de afiliados (meli.la) é link de compra; qualquer outro endereço
   é descartado e o botão passa a gerar o link de afiliado no clique (o
   endereço do anúncio continua em `url`). */

export const ehLinkDeAfiliado = (u: unknown): u is string =>
  typeof u === "string" && /^https:\/\/meli\.la\/[A-Za-z0-9]+\/?$/.test(u.trim());

/** O link, se for de afiliado; senão null. */
export const soAfiliado = (u: unknown): string | null => (ehLinkDeAfiliado(u) ? u.trim() : null);

type ComLink = { link?: string | null | undefined };

function limparLista<T extends ComLink>(l: T[] | null | undefined): T[] | null | undefined {
  return Array.isArray(l)
    ? l.map((x) => (x && typeof x === "object" ? { ...x, link: soAfiliado(x.link) } : x))
    : l;
}

/** Tira da análise todo link que não é de afiliado (colado, lojas, parecidos, referências). */
export function analiseSoComAfiliado<
  A extends {
    outraLoja?: ComLink | null;
    outrasLojas?: ComLink[] | null;
    parecidos?: ComLink[] | null;
    referencias?: ComLink[] | null;
  },
>(a: A | null): A | null {
  if (!a || typeof a !== "object") return a;
  return {
    ...a,
    outraLoja: a.outraLoja ? { ...a.outraLoja, link: soAfiliado(a.outraLoja.link) } : a.outraLoja,
    outrasLojas: limparLista(a.outrasLojas),
    parecidos: limparLista(a.parecidos),
    referencias: limparLista(a.referencias),
  };
}
