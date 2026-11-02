/* Oferta de outro marketplace (Amazon, Shopee) no formato do comparador.
   Só entra com o link de afiliado DAQUELE marketplace (src/lib/afiliado.ts).
   Frete: só afirma o que a fonte confirma; sem isso, "confira no anúncio". */
export type MarketplaceExterno = "amazon" | "shopee";

export type OfertaExterna = {
  marketplace: MarketplaceExterno;
  id: string;
  titulo: string;
  preco: number;
  link: string;
  imagem: string | null;
  loja: string | null;
  freteGratis: boolean | null;
  custoFrete: number | null;
  /* Texto do frete quando não há valor confirmado (ex.: Prime). */
  notaFrete: string | null;
  /* "Prime", "Loja oficial"... só com o dado da própria API. */
  selos: string[];
  /* Nota e total lidos no cartão do marketplace (sem o dado, null). */
  avaliacoes?: { nota: number; total: number } | null;
};

export const NOME_DO_MARKETPLACE: Record<MarketplaceExterno, string> = {
  amazon: "Amazon",
  shopee: "Shopee",
};
