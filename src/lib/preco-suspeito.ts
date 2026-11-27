/* PREÇO MUITO ABAIXO DAS OUTRAS LOJAS (02/10 no site; 09/10 no canal).
   Com 3 ou mais preços do MESMO produto, o que fica abaixo de 70% da mediana
   pede cuidado: no site vira o aviso "Preço muito abaixo das outras lojas:
   confira o vendedor antes de comprar"; no canal nem sai, salvo loja oficial
   (09/10: Malbec R$ 200 x R$ 361 e R$ 379, aspirador R$ 50 x R$ 120 e
   R$ 227, os dois de contas novas sem selo, foram publicados). */

export const FRACAO_DA_MEDIANA = 0.7;

/** Mediana dos preços (com 3 ou mais; senão null). Mesma conta da tabela. */
export function medianaDosPrecos(precos: number[]): number | null {
  const v = precos.filter((p) => Number.isFinite(p) && p > 0).sort((x, y) => x - y);
  return v.length >= 3 ? v[Math.floor(v.length / 2)]! : null;
}

export function precoMuitoAbaixo(preco: number | null | undefined, precos: number[]) {
  const mediana = medianaDosPrecos(precos);
  return mediana != null && preco != null && preco < mediana * FRACAO_DA_MEDIANA;
}

type Bruto = Record<string, unknown>;
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Preços do mesmo produto numa análise guardada: o anúncio comparado e as
    lojas conferidas (as mesmas linhas da tabela do site). */
export function precosDoMesmoProduto(a: Bruto | null | undefined): number[] {
  if (!a) return [];
  const lojas = [
    ...((Array.isArray(a["outrasLojas"]) ? a["outrasLojas"] : []) as Bruto[]),
    ...((Array.isArray(a["referencias"]) ? a["referencias"] : []) as Bruto[]),
  ];
  return [
    num(a["preco"]),
    ...lojas.map((o) => (o ? (num(o["final"]) ?? num(o["preco"])) : null)),
  ].filter((p): p is number => p != null);
}

/** Custo de cada oferta do mesmo produto para o cliente: produto + frete
    quando o frete pago tem valor conhecido (18/10: pó facial R$ 8 com frete
    de R$ 9,99 contra R$ 20 com frete grátis não é "preço muito abaixo").
    Base da régua de recomendação segura (src/lib/recomendacao-segura.ts). */
export function custosDoMesmoProduto(a: Bruto | null | undefined): number[] {
  if (!a) return [];
  const custo = (o: Bruto, preco: number | null) => {
    if (preco == null) return null;
    const frete = num(o["custoFrete"]);
    return o["freteGratis"] === false && frete != null
      ? Math.round((preco + frete) * 100) / 100
      : preco;
  };
  const lojas = [
    ...((Array.isArray(a["outrasLojas"]) ? a["outrasLojas"] : []) as Bruto[]),
    ...((Array.isArray(a["referencias"]) ? a["referencias"] : []) as Bruto[]),
  ];
  return [
    custo(a, num(a["preco"])),
    ...lojas.map((o) => (o ? custo(o, num(o["final"]) ?? num(o["preco"])) : null)),
  ].filter((p): p is number => p != null);
}

/* PREÇO IMPOSSÍVEL (27/11, Weslei: "Erro gravíssimo"; "No meu site nada deve
   ser falso, enganoso"): o PS5 Slim de R$ 4.850 mostrou R$ 20,34 e o botão
   abriu um mini game. Outra oferta do MESMO produto pela metade do preço do
   próprio produto (ou menos) nunca é o mesmo produto: some a oferta, o preço e
   o selo de economia; o cartão fica com a oferta dele mesmo. */
export const PISO_MESMO_PRODUTO = 0.5;

export function precoImpossivel(
  outro: number | string | null | undefined,
  base: number | string | null | undefined,
): boolean {
  const o = num(outro);
  const b = num(base);
  return o != null && b != null && o < b * PISO_MESMO_PRODUTO;
}

type ComLojas = {
  preco?: number | null;
  outraLoja?: { final?: number | null; preco?: number | null } | null;
  outrasLojas?: Array<{ final?: number | null; preco?: number | null }> | null;
};

/** A análise sem as "outras lojas" de preço impossível (mesma régua). */
export function semOfertasImpossiveis<T extends ComLojas>(a: T): T {
  const base = a.preco;
  const ruim = (o: { final?: number | null; preco?: number | null } | null | undefined) =>
    !!o && precoImpossivel(o.final ?? o.preco, base);
  const lojas = a.outrasLojas?.filter((o) => !ruim(o));
  const tirou = (a.outrasLojas?.length ?? 0) !== (lojas?.length ?? 0) || ruim(a.outraLoja);
  if (!tirou) return a;
  return {
    ...a,
    outrasLojas: lojas ?? a.outrasLojas,
    outraLoja: ruim(a.outraLoja) ? (lojas?.[0] ?? null) : a.outraLoja,
  } as T;
}

type LinhaVitrine = {
  preco: number | null;
  melhor_preco: number | null;
  alt_preco?: number | null;
};

/** Linha da vitrine (rpc vitrine) sem "melhor loja"/alternativa de preço
    impossível: o cartão fica com o preço e o link do próprio anúncio. */
export function vitrineSemImpossivel<T extends LinhaVitrine>(i: T): T {
  const melhorRuim = precoImpossivel(i.melhor_preco, i.preco);
  const altRuim = precoImpossivel(i.alt_preco, i.preco);
  if (!melhorRuim && !altRuim) return i;
  return {
    ...i,
    ...(melhorRuim
      ? { melhor_loja: null, melhor_preco: null, melhor_link: null, economia: null }
      : {}),
    ...(altRuim
      ? {
          alt_preco: null,
          alt_economia: null,
          alt_titulo: null,
          alt_link: null,
          alt_loja: null,
          alt_oficial: null,
          alt_vantagem: null,
          alt_frete_gratis: null,
          alt_muda: null,
        }
      : {}),
  };
}
