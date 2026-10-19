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
