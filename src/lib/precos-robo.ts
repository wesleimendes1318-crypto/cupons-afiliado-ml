import type { RespostaBusca, ResultadoBusca } from "@/lib/busca-guiada";

/* PRICE ROBOT (Weslei, 27/11: "pode adicionar os valores! sempre deve ter!").
   The extension reads catalog pages without the account cookie and stores the
   buy box price in precos_robo; a search card without a price takes it while
   it is at most 12 h old. International offers never get a price here, and a
   price outside the requested range drops the card (same 5% margin as the
   catalog). Shipping stays unknown (null), so it never ranks as cheapest. */
export const PRECO_ROBO_HORAS = 12;

export type LinhaPrecoRobo = {
  produto: string;
  item: string | null;
  preco: number | string | null;
  loja_oficial: boolean | null;
  internacional: boolean | null;
};

export function aplicarPrecosDoRobo(
  resultados: ResultadoBusca[],
  linhas: LinhaPrecoRobo[],
  faixa: { precoMin?: number | null; precoMax?: number | null } = {},
): ResultadoBusca[] {
  const porProduto = new Map(linhas.map((l) => [l.produto, l]));
  return resultados.flatMap((r) => {
    if (r.preco != null) return [r];
    const l = porProduto.get(r.produto);
    const preco = l?.preco == null ? NaN : Number(l.preco);
    if (!l || l.internacional || !l.item || !/^MLB\d+$/.test(l.item) || !(preco > 0)) return [r];
    if (faixa.precoMax && preco > faixa.precoMax * 1.05) return [];
    if (faixa.precoMin && preco < faixa.precoMin * 0.95) return [];
    return [
      {
        ...r,
        item: l.item,
        preco,
        url: `https://www.mercadolivre.com.br/p/${r.produto}?pdp_filters=item_id%3A${l.item}`,
        freteGratis: null,
        lojaOficial: l.loja_oficial === true,
      },
    ];
  });
}

type Db = {
  from: (t: string) => {
    select: (c: string) => {
      in: (
        c: string,
        v: string[],
      ) => { gte: (c: string, v: string) => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/* Weslei, 27/11: "nunca deixe sem valor". A card without a real, recent price
   is not shown at all (it stays in the cached raw answer, so the robot still
   reads it and it comes back with its price). */
export const soComPreco = <T extends { preco: number | null }>(itens: T[]) =>
  itens.filter((r) => r.preco != null && r.preco > 0);

/** The answer with the robot's fresh prices, without the cards still unpriced. */
export async function comPrecosDoRobo(db: Db, resposta: RespostaBusca): Promise<RespostaBusca> {
  const r = await preencherPrecos(db, resposta);
  return { ...r, resultados: soComPreco(r.resultados ?? []) };
}

async function preencherPrecos(db: Db, resposta: RespostaBusca): Promise<RespostaBusca> {
  const ids = [
    ...new Set((resposta.resultados ?? []).filter((r) => r.preco == null).map((r) => r.produto)),
  ]
    .filter((id) => /^MLB\d+$/.test(id))
    .slice(0, 200);
  if (!ids.length) return resposta;
  try {
    const { data, error } = await db
      .from("precos_robo")
      .select("produto,item,preco,loja_oficial,internacional")
      .in("produto", ids)
      .gte("lido_em", new Date(Date.now() - PRECO_ROBO_HORAS * 3600_000).toISOString());
    if (error || !Array.isArray(data) || !data.length) return resposta;
    return {
      ...resposta,
      resultados: aplicarPrecosDoRobo(resposta.resultados, data as LinhaPrecoRobo[], resposta),
    };
  } catch {
    return resposta;
  }
}
