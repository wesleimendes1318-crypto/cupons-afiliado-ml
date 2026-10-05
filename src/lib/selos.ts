/* SELOS DE PREÇO (Weslei, 05/10: "adicione essas tags de melhor preço,
   preço imbatível - cuidado com as políticas do Mercado Livre"). Selo só com
   dado que o sustenta, sempre com o qualificador do que foi comparado
   ("entre N lojas consultadas") e nunca como promessa absoluta; o preço é o
   da comparação, com a data no cartão. Nada de marca, cor ou selo do
   Mercado Livre, e nunca comissão ("Ganhos") em lugar nenhum.

   - Preço imbatível: o anúncio é o mais barato do MESMO produto contra pelo
     menos 3 lojas mais caras E a 2ª mais barata custa 10% ou mais acima.
   - Melhor preço: o mais barato do mesmo produto contra pelo menos 2 lojas
     mais caras (ou a oferta nova mais barata entre 2 ou mais do catálogo
     oficial, sem loja mais barata na comparação).
   - Entre os mais vendidos: está na lista oficial de mais vendidos da
     categoria (/highlights da API do Mercado Livre). */

export type Selo = { texto: string; nota: string };

export const PERCENTUAL_IMBATIVEL = 0.1;
export const LOJAS_IMBATIVEL = 3;
export const LOJAS_MELHOR_PRECO = 2;

/** Selo do anúncio que já é o mais barato do mesmo produto. */
export function seloDoMenorPreco(
  lojasMaisCaras: number | null | undefined,
  preco: number,
  segundaLoja: number | null | undefined,
): Selo | null {
  const n = lojasMaisCaras ?? 0;
  if (n < LOJAS_MELHOR_PRECO || !(preco > 0)) return null;
  const consultadas = `entre ${n + 1} lojas consultadas`;
  if (
    n >= LOJAS_IMBATIVEL &&
    segundaLoja != null &&
    segundaLoja > preco &&
    (segundaLoja - preco) / segundaLoja >= PERCENTUAL_IMBATIVEL
  )
    return { texto: "Preço imbatível", nota: consultadas };
  return { texto: "Melhor preço", nota: consultadas };
}

/** Oferta mais barata entre as ofertas novas do catálogo oficial, sem loja
    mais barata na comparação (curadoria de brinquedos). */
export function seloDoCatalogo(ofertas: number | null | undefined): Selo | null {
  const n = ofertas ?? 0;
  return n >= LOJAS_MELHOR_PRECO
    ? { texto: "Melhor preço", nota: `entre ${n} ofertas novas deste produto` }
    : null;
}

export const SELO_MAIS_VENDIDO: Selo = {
  texto: "Entre os mais vendidos",
  nota: "na lista oficial da categoria",
};
