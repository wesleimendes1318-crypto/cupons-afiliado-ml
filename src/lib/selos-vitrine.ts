/* SELOS DA VITRINE (Weslei, 26/11, Black Friday): "Loja oficial",
   "MercadoLíder Platinum", "Frete grátis confirmado" and "Menor preço dos
   últimos 30 dias" on showcase/campaign cards, only when real data backs
   them (selos_da_vitrine: seller seals of the last comparison + 30-day range
   in precos_vistos). Unknown data = no badge. */
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export {
  DIAS_MINIMOS,
  LEITURAS_MINIMAS,
  menorDos30Dias,
  selosDoCartao,
  type LinhaSelos,
  type MapaSelos,
  type SelosDoCartao,
} from "@/lib/selos-cartao";
import type { LinhaSelos, MapaSelos } from "@/lib/selos-cartao";

export async function lerSelosDaVitrine(chaves: string[]): Promise<MapaSelos> {
  const mapa: MapaSelos = new Map();
  const unicas = [...new Set(chaves.filter(Boolean))].slice(0, 300);
  if (!unicas.length) return mapa;
  try {
    const { data } = await supabase.rpc(
      "selos_da_vitrine" as never,
      { p_chaves: unicas } as never,
    );
    if (Array.isArray(data)) for (const r of data as LinhaSelos[]) mapa.set(r.chave, r);
  } catch {
    /* no reading: cards go without these badges */
  }
  return mapa;
}

export function useSelosDaVitrine(chaves: string[]): MapaSelos {
  const [mapa, setMapa] = useState<MapaSelos>(() => new Map());
  const assinatura = [...new Set(chaves)].sort().join(",");
  useEffect(() => {
    if (!assinatura) return;
    let vivo = true;
    void lerSelosDaVitrine(assinatura.split(",")).then((m) => {
      if (vivo) setMapa(m);
    });
    return () => {
      vivo = false;
    };
  }, [assinatura]);
  return mapa;
}
