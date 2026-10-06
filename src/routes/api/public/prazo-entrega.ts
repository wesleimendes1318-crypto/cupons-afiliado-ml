import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { itensDaAnalise, prazosDosItens } from "@/lib/prazo-servidor";
import type { PrazoDoItem } from "@/lib/prazo-entrega";

/* PRAZO DE ENTREGA ("Receber até", 06/10). O site manda o número do pedido
   e o CEP que está na tela; o servidor pega os anúncios da comparação e
   devolve a estimativa oficial de cada um para esse CEP (API do Mercado
   Livre, só leitura, guardada 30 min). A comparação já é pública (vitrine,
   consultar_pedido); nada é gravado sobre quem consulta. */

const entradaSchema = z.object({
  pedido: z.number().int().positive(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/),
});

export const Route = createFileRoute("/api/public/prazo-entrega")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return Response.json({ erro: "pedido inválido" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const { data } = (await db
          .from("pedidos_link")
          .select("analise, url_alvo, status")
          .eq("id", entrada.pedido)
          .maybeSingle()) as {
          data: { analise: Record<string, unknown> | null; url_alvo: string | null } | null;
        };
        if (!data?.analise) return Response.json({ erro: "sem comparação" }, { status: 404 });
        const mapa = itensDaAnalise(data.analise, data.url_alvo);
        const porItem = await prazosDosItens(Object.values(mapa), entrada.cep);
        const prazos: Record<string, PrazoDoItem> = {};
        for (const [chave, item] of Object.entries(mapa)) prazos[chave] = porItem[item] ?? null;
        return Response.json(
          { cep: entrada.cep.replace(/\D/g, ""), prazos },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
