/* Artes realistas salvas por tema (artes_campanhas, geradas uma vez no
   servidor). Lidas uma vez por visita e guardadas na memória da página. */
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { TemaVisualId } from "@/lib/campanha-visual";

let cache: Promise<Map<string, string>> | null = null;

function carregar() {
  if (!cache)
    cache = (async () => {
      const mapa = new Map<string, string>();
      try {
        const { data } = await supabase.rpc("artes_campanhas" as never);
        if (Array.isArray(data))
          for (const r of data as Array<{ tema: string; url: string }>)
            if (/^https:\/\//.test(r.url)) mapa.set(r.tema, r.url);
      } catch {
        /* sem arte salva: fica a cena vetorial */
      }
      return mapa;
    })();
  return cache;
}

export function useArteSalva(tema: TemaVisualId): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregar().then((m) => {
      if (vivo) setUrl(m.get(tema) ?? null);
    });
    return () => {
      vivo = false;
    };
  }, [tema]);
  return url;
}
