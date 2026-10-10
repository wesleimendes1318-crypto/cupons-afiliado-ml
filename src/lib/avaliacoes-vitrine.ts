/* AVALIAÇÕES NAS VITRINES (Weslei, 10/10: "precisa ter as avaliações em
   TODOS"). Cada cartão mostra a nota do anúncio que está atrás do botão
   (chave do produto + link de afiliado, avaliacoes_da_vitrine_v2): a leitura
   da página do anúncio (extensão, de 7 em 7 dias) vale mais que a nota da
   comparação. Página lida sem nenhuma avaliação: "Sem avaliações ainda".
   Sem leitura: o cartão espera, sem inventar. */
import { createContext, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { resumoDaLinha, type ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";

export type MapaAvaliacoes = Map<string, ResumoAvaliacoes>;

const chaveDaOferta = (chave: string, link: string) => `${chave}|${link}`;

export async function lerAvaliacoesDaVitrine(chaves: string[]): Promise<MapaAvaliacoes> {
  const mapa: MapaAvaliacoes = new Map();
  const unicas = [...new Set(chaves.filter(Boolean))].slice(0, 300);
  if (!unicas.length) return mapa;
  try {
    const { data } = await supabase.rpc(
      "avaliacoes_da_vitrine_v2" as never,
      { p_chaves: unicas } as never,
    );
    if (Array.isArray(data))
      for (const r of data as Array<
        Parameters<typeof resumoDaLinha>[0] & { chave: string; link: string }
      >) {
        if (r.chave && r.link) mapa.set(chaveDaOferta(r.chave, r.link), resumoDaLinha(r));
      }
  } catch {
    /* sem a leitura: os cartões seguem sem estrela */
  }
  return mapa;
}

export function avaliacaoDaOferta(
  mapa: MapaAvaliacoes,
  chave: string | null | undefined,
  link: string | null | undefined,
): ResumoAvaliacoes | null {
  if (!chave || !link) return null;
  return mapa.get(chaveDaOferta(chave, link)) ?? null;
}

/** Lê as notas dos produtos da lista (uma vez por conjunto de produtos). */
export function useAvaliacoesDaVitrine(chaves: string[]): MapaAvaliacoes {
  const [mapa, setMapa] = useState<MapaAvaliacoes>(() => new Map());
  const assinatura = [...new Set(chaves)].sort().join(",");
  useEffect(() => {
    if (!assinatura) return;
    let vivo = true;
    void lerAvaliacoesDaVitrine(assinatura.split(",")).then((m) => {
      if (vivo) setMapa(m);
    });
    return () => {
      vivo = false;
    };
  }, [assinatura]);
  return mapa;
}

/** As notas da lista em volta (Vitrine e GradeOfertas fornecem). */
export const ContextoAvaliacoes = createContext<MapaAvaliacoes>(new Map());
