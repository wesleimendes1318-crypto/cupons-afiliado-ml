import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { envioDaAnalise } from "@/lib/internacional-servidor";

/* ENVIO INTERNACIONAL (01/11, Switch 2). O site manda o número do pedido; o
   servidor lê na lista OFICIAL de ofertas de cada ficha da comparação
   (/products/{id}/items, só leitura) quais anúncios vêm do exterior (tags
   "cbt_item" / "cbt_fulfillment_us") e devolve por chave da tela (colado,
   alt-i, ref-i, par-i). Nada é gravado; cache de 6 h na memória. Anúncio que
   não está na lista fica sem resposta (não afirma nada). */

const entradaSchema = z.object({ pedido: z.number().int().positive() });

export const Route = createFileRoute("/api/public/envio-internacional")({
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
          .select("analise, url_alvo")
          .eq("id", entrada.pedido)
          .maybeSingle()) as {
          data: { analise: Record<string, unknown> | null; url_alvo: string | null } | null;
        };
        if (!data?.analise) return Response.json({ envio: {} });
        const envio = await envioDaAnalise(data.analise, data.url_alvo);
        return Response.json({ envio }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
