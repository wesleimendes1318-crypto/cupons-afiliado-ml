/* RANKING DAS VITRINES DA HOME (Weslei, 27/10: "hierarquia comercial").
   Pontuação pura e determinística, só com o que o banco tem: nota e total
   lidos na página do anúncio, economia do mesmo produto contra outra loja
   (com frete grátis confirmado), frete grátis, origem na lista oficial e
   loja oficial. Campo ausente não pontua (nada é presumido). Máximo 1,0:
   confiança 0,35 + procura 0,30 + economia 0,20 + loja oficial 0,15. */

export type ItemPontuavel = {
  nota?: number | null | undefined;
  totalAvaliacoes?: number | null | undefined;
  economiaReais?: number | null | undefined;
  freteGratis?: boolean | null | undefined;
  origemEmAlta?: string | null | undefined;
  lojaOficial?: boolean | null | undefined;
};

export function pontuarItemVitrine(item: ItemPontuavel): number {
  let score = 0;
  if (item.nota != null && item.nota >= 4.5) {
    score += (item.nota / 5) * 0.25;
    if ((item.totalAvaliacoes ?? 0) >= 50) score += 0.1;
  }
  if (item.origemEmAlta === "vendidos") score += 0.3;
  else if (item.origemEmAlta === "tendencia") score += 0.25;
  else score += 0.15;
  if ((item.economiaReais ?? 0) >= 20) score += 0.15;
  if (item.freteGratis === true) score += 0.05;
  if (item.lojaOficial === true) score += 0.15;
  return score;
}

/** Ordena do maior para o menor; empate mantém a ordem de entrada. */
export function ordenarPorPontuacao<T>(lista: T[], pontos: (x: T) => ItemPontuavel): T[] {
  return lista
    .map((x, k) => ({ x, k, s: pontuarItemVitrine(pontos(x)) }))
    .sort((a, b) => b.s - a.s || a.k - b.k)
    .map((e) => e.x);
}
