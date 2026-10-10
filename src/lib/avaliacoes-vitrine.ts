/* AVALIAÇÕES NAS VITRINES (Weslei, 10/10: "não encontrei no meu site"). A
   nota de cada oferta vem da última comparação do produto, pelo link de
   afiliado (avaliacoes_da_vitrine): o cartão mostra a nota do anúncio que
   está atrás do botão. Sem leitura ou sem nota, o cartão fica como sempre. */
import { createContext, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { avaliacoesValidas, type Avaliacoes } from "@/lib/avaliacoes";

export type MapaAvaliacoes = Map<string, Avaliacoes>;

const chaveDaOferta = (chave: string, link: string) => `${chave}|${link}`;

export async function lerAvaliacoesDaVitrine(chaves: string[]): Promise<MapaAvaliacoes> {
  const mapa: MapaAvaliacoes = new Map();
  const unicas = [...new Set(chaves.filter(Boolean))].slice(0, 300);
  if (!unicas.length) return mapa;
  try {
    const { data } = await supabase.rpc(
      "avaliacoes_da_vitrine" as never,
      { p_chaves: unicas } as never,
    );
    if (Array.isArray(data))
      for (const r of data as Array<{ chave: string; link: string; nota: number; total: number }>) {
        const v = avaliacoesValidas({ nota: Number(r.nota), total: Number(r.total) });
        if (v && r.chave && r.link) mapa.set(chaveDaOferta(r.chave, r.link), v);
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
): Avaliacoes | null {
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
