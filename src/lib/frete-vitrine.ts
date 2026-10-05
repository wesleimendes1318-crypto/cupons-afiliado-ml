/* FRETE NA VITRINE (Weslei, 05/10, "Grave!!! O frete é pago!": Deo Malbec
   R$ 59,85 aparecia "R$ 26,14 a menos" com frete desconhecido, e o
   comprador pagou R$ 11,90). A economia do mesmo produto em outra loja só
   aparece quando a comparação confirmou frete grátis nessa loja; o "menor
   preço" só com frete grátis confirmado no próprio anúncio. Fonte:
   vitrine_frete (produtos_vistos.melhor_frete_gratis / frete_gratis,
   gravados pelo gatilho da vitrine). */
import { supabase } from "@/integrations/supabase/client";

export type FreteDaVitrine = { frete_gratis: boolean | null; melhor_frete_gratis: boolean | null };

export async function lerFretesDaVitrine(limite = 500): Promise<Map<string, FreteDaVitrine>> {
  const mapa = new Map<string, FreteDaVitrine>();
  try {
    const { data } = await supabase.rpc("vitrine_frete" as never, { p_limite: limite } as never);
    if (Array.isArray(data))
      for (const r of data as Array<FreteDaVitrine & { chave: string }>) mapa.set(r.chave, r);
  } catch {
    /* sem a leitura: nenhuma economia de loja é mostrada (mapa vazio) */
  }
  return mapa;
}

/** Tira a economia do mesmo produto quando o frete da melhor loja não é
    grátis confirmado (a alternativa já exige alt_frete_gratis). */
export function semEconomiaSemFrete<T extends { chave: string; economia: number | null }>(
  itens: T[],
  fretes: Map<string, FreteDaVitrine>,
): T[] {
  return itens.map((i) =>
    (i.economia ?? 0) > 0 && fretes.get(i.chave)?.melhor_frete_gratis !== true
      ? { ...i, economia: null }
      : i,
  );
}
