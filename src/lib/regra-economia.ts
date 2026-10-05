/* DESCONTO REAL (régua única do canal, da vitrine sazonal e do preparo):
   - R$ 30 ou mais no produto; ou
   - EXCEÇÃO PARA PRODUTO BARATO (Weslei, 05/10: "pelo menos 20% e pelo
     menos R$ 10 de economia"): R$ 10 ou mais E 20% ou mais do anúncio
     comparado (booster de R$ 19 por R$ 16 não passa; kit de R$ 85,99 por
     R$ 59,85 passa).
   Economia sempre no PRODUTO, contra o anúncio comparado (frete à parte). */
export const ECONOMIA_MINIMA = 30;
export const ECONOMIA_MINIMA_BARATO = 10;
export const PERCENTUAL_MINIMO_BARATO = 0.2;

export function descontoReal(
  economia: number | null | undefined,
  precoBase: number | null | undefined,
) {
  if (economia == null || !Number.isFinite(economia) || economia <= 0) return false;
  if (economia >= ECONOMIA_MINIMA) return true;
  return (
    economia >= ECONOMIA_MINIMA_BARATO &&
    precoBase != null &&
    precoBase > 0 &&
    economia / precoBase >= PERCENTUAL_MINIMO_BARATO
  );
}
