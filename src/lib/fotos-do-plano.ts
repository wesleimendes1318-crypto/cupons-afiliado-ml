/* Planner item art (Weslei, 06/11: "precisa de artes nas categorias sempre"):
   real product photos from the item's first search term (same cached catalog
   search as the offers), read one item at a time and only when the card is on
   screen; kept for the visit in sessionStorage. */
import { useEffect, useRef, useState } from "react";

import { lerPaginaDoTermo, passosIniciais } from "@/lib/amigo-secreto-busca";

const CHAVE = "melhorescolha_fotos_plano_v1";
let fila: Promise<unknown> = Promise.resolve();

function lerCache(): Record<string, string[]> {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

/** Up to 3 photos for a search term; [] when the search has none. */
export function useFotosDoTermo(termo: string) {
  const [fotos, setFotos] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const guardadas = lerCache()[termo];
    if (guardadas) return setFotos(guardadas);
    const el = ref.current;
    if (!el) return;
    let vivo = true;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        /* One request at a time for the whole page (no read bursts). */
        fila = fila.then(async () => {
          if (!vivo) return;
          /* A slow answer never holds the rest of the queue (8 s). */
          const r = await Promise.race([
            lerPaginaDoTermo(
              passosIniciais([termo])[0]!,
              { min: null, max: null, freteACalcular: true },
              [],
            ),
            new Promise<{ resposta: null }>((ok) =>
              setTimeout(() => ok({ resposta: null }), 8_000),
            ),
          ]);
          const lista = (r.resposta?.resultados ?? [])
            .flatMap((x) => (x.imagem && /^https:\/\//.test(x.imagem) ? [x.imagem] : []))
            .slice(0, 3);
          if (r.resposta) {
            try {
              sessionStorage.setItem(CHAVE, JSON.stringify({ ...lerCache(), [termo]: lista }));
            } catch {
              /* private mode: photos still show for this card */
            }
          }
          if (vivo) setFotos(lista);
        });
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => {
      vivo = false;
      obs.disconnect();
    };
  }, [termo]);
  return { ref, fotos };
}
