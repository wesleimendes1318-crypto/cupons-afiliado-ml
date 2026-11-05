import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { termosDosFavoritos } from "@/lib/amigo-secreto-perfil";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* AMIGO SECRETO (05/11): favorites + wish text -> search terms for a
   "Combina com os favoritos" showcase. The model only writes searches; the
   products always come from the catalog. Slow or invalid: local terms. */

const entradaSchema = z.object({
  texto: z.string().trim().max(600).default(""),
  favoritos: z.array(z.string().trim().min(2).max(160)).min(1).max(10),
});

const PRAZO_MS = 6_000;

const PROMPT = `Voce e curador de presentes de amigo secreto no Brasil (Mercado Livre).
Quem presenteia salvou estes produtos como favoritos para UMA pessoa. Entenda o gosto por tras
deles (estilo, uso, faixa de valor percebido) e o que a pessoa pediu, e sugira buscas de produtos
PARECIDOS ou que COMBINEM com eles (mesma vibe, complementos, versoes melhores), sem repetir os
mesmos itens. Responda SO JSON minificado: {"titulo":"Combina com os favoritos","termos":["..."]}
com 6 a 10 termos curtos (2 a 5 palavras, sem preco, sem tamanho, sem marca inventada).
Nunca invente produto ou preco. Nunca fale de inteligencia artificial.`;

function lerTermos(bruto: unknown): string[] {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const termos = Array.isArray(o["termos"]) ? o["termos"] : [];
  return [
    ...new Set(
      termos
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 2 && t.length <= 60 && !/r\$|\d{2,}\s*reais/.test(t)),
    ),
  ].slice(0, 10);
}

export const Route = createFileRoute("/api/public/amigo-secreto-sugerir")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        let e: z.infer<typeof entradaSchema>;
        try {
          e = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Favorite pelo menos um produto." }, 400);
        }
        const local = termosDosFavoritos(e.favoritos);
        if (excedeuLimite(request, 20, "amigo-s:")) return json(request, { termos: local, fonte: "local" });
        let termos: string[] = [];
        try {
          const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
          const prompt = `${PROMPT}\nPedido: ${JSON.stringify(e.texto)}\nFavoritos: ${JSON.stringify(e.favoritos)}`;
          const { lerJson } = await import("@/lib/conferir-produto");
          const r = await perguntarAoLlm(prompt, PRAZO_MS);
          if (r.ok) termos = lerTermos(lerJson<unknown>(r.texto));
          if (termos.length < 3) {
            /* Same AI path as the rest of the site (own key, then the platform). */
            const { chamarIa } = await import("@/lib/public-ai-api");
            const g = await chamarIa(prompt, { esforco: "low", escopo: "Voce e curador de presentes do site Melhor Escolha, em portugues do Brasil. Responda so com o JSON pedido. Nunca invente produto ou preco." });
            if (g.ok) termos = lerTermos(lerJson<unknown>(g.texto));
          }
        } catch {
          /* local below */
        }
        if (termos.length < 3) return json(request, { termos: local, fonte: "local" });
        return json(request, { termos: [...new Set([...termos, ...local])].slice(0, 12), fonte: "modelo" });
      },
    },
  },
});
