import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { responderAssistente } from "@/lib/assistente-busca";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Assistente de compra depois da busca (02/11). Só escolhe e explica entre
   os produtos que a tela mandou; nada é gravado. */
const itemSchema = z.object({
  id: z.string().min(1).max(80),
  nome: z.string().max(160),
  preco: z.number().min(0).max(10_000_000).nullable(),
  freteGratis: z.boolean().nullable().optional(),
  lojaOficial: z.boolean().optional(),
  nota: z.number().min(0).max(5).nullable().optional(),
  avaliacoes: z.number().int().min(0).max(10_000_000).nullable().optional(),
  maisVendido: z.number().int().min(1).max(1000).nullable().optional(),
});

const entradaSchema = z.object({
  consulta: z.string().trim().min(2).max(160),
  pedido: z.string().trim().min(2).max(300),
  itens: z.array(itemSchema).min(1).max(80),
});

export const Route = createFileRoute("/api/public/assistente-busca")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request))
          return json(request, { erro: "Muitos pedidos seguidos. Aguarde um minuto." }, 429);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Escreva o que é importante para você." }, 400);
        }
        const r = await responderAssistente(entrada.consulta, entrada.pedido, entrada.itens);
        return json(request, r);
      },
    },
  },
});
