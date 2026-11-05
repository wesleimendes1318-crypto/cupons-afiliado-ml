import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { prazosDosItens } from "@/lib/prazo-servidor";
import { resumoDoPrazo, type ResumoEntrega } from "@/lib/prazo-entrega";

/* DATA DE ENTREGA NOS CARTÕES (05/11). Lote de até 20 anúncios + CEP; o
   servidor lê o cache de 30 min e só consulta a API oficial do que falta
   (com o freio de prazo-servidor). null = sem data confirmada: a tela diz
   "Frete e prazo no anúncio", nunca inventa. Nada é gravado sobre quem
   consulta. */

const entradaSchema = z.object({
  itens: z
    .array(z.string().regex(/^MLB\d{6,}$/))
    .min(1)
    .max(20),
  cep: z.string().regex(/^\d{5}-?\d{3}$/),
});

export const Route = createFileRoute("/api/public/prazo-itens")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return Response.json({ erro: "pedido inválido" }, { status: 400 });
        }
        const porItem = await prazosDosItens(entrada.itens, entrada.cep);
        const prazos: Record<string, ResumoEntrega | null> = {};
        /* Item sem resposta (freio ligado ou API fora) fica de fora: o
           cliente não marca como "sem prazo" e pode perguntar de novo. */
        for (const it of entrada.itens)
          if (it in porItem) prazos[it] = resumoDoPrazo(porItem[it] ?? null);
        return Response.json(
          { cep: entrada.cep.replace(/\D/g, ""), prazos },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
