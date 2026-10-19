import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { compararAgora } from "@/lib/comparar-agora";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Comparação pelo servidor quando a extensão está parada (19/10): a lista
   oficial de ofertas do mesmo produto, só leitura. Nada é gravado. */

const entradaSchema = z.object({ url: z.string().trim().min(10).max(2000) });

export const Route = createFileRoute("/api/public/comparar-agora")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request))
          return json(request, { erro: "Muitas solicitações. Aguarde um minuto." }, 429);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Cole o link do produto." }, 400);
        }
        try {
          return json(request, await compararAgora(entrada.url));
        } catch {
          return json(request, { ok: false, termo: null, perfil: false });
        }
      },
    },
  },
});
