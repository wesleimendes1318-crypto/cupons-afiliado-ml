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
