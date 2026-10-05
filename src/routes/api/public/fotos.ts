import { createFileRoute } from "@tanstack/react-router";

import { mlGet } from "@/lib/ml-api";
import { excedeuLimite } from "@/lib/public-ai-api";

/* FOTOS DO PRODUTO (Weslei, 05/10: "precisa dar opção de ver as fotos").
   Galeria do produto de CATÁLOGO pela API oficial (/products/{id}), só
   leitura: o site guarda uma foto por anúncio. Só o endereço das fotos
   (mlstatic, https) sai daqui. Cache por instância (6 h) e no navegador/CDN
   (1 dia) para não repetir chamada à API. */

const cache = new Map<string, { fotos: string[]; em: number }>();
const VALIDADE = 6 * 3600_000;

const resposta = (corpo: unknown, status = 200, cacheavel = true) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheavel ? "public, max-age=86400" : "no-store",
    },
  });

export const Route = createFileRoute("/api/public/fotos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const produto = (new URL(request.url).searchParams.get("produto") ?? "").toUpperCase();
        if (!/^MLB\d{5,12}$/.test(produto)) return resposta({ fotos: [] }, 400, false);
        const guardado = cache.get(produto);
        if (guardado && Date.now() - guardado.em < VALIDADE)
          return resposta({ fotos: guardado.fotos });
        if (excedeuLimite(request)) return resposta({ fotos: [] }, 429, false);
        try {
          const p = await mlGet<{ pictures?: Array<{ url?: string; secure_url?: string }> }>(
            `/products/${produto}`,
          );
          const fotos = [
            ...new Set(
              (p.pictures ?? [])
                .map((f) => (f.secure_url ?? f.url ?? "").replace(/^http:/, "https:"))
                .filter((u) => /^https:\/\/[a-z0-9.-]*mlstatic\.com\//i.test(u)),
            ),
          ].slice(0, 12);
          cache.set(produto, { fotos, em: Date.now() });
          if (cache.size > 500) cache.clear();
          return resposta({ fotos });
        } catch {
          return resposta({ fotos: [] }, 200, false);
        }
      },
    },
  },
});
