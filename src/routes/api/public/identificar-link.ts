import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { analisarLink } from "@/lib/analisar-link";
import { identificarLink } from "@/lib/identificar-link";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Reconhecimento universal de links (10/10): devolve a loja e o nome do
   produto de qualquer link colado (resolve encurtados e, em loja conhecida
   sem nome no endereço, lê só o título da página). Nada é guardado. */

const entradaSchema = z.object({ texto: z.string().trim().min(3).max(2000) });

export const Route = createFileRoute("/api/public/identificar-link")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Cole o link do produto." }, 400);
        }
        /* No limite por minuto, devolve só a leitura do texto (sem rede). */
        if (excedeuLimite(request)) return json(request, analisarLink(entrada.texto));
        try {
          return json(request, await identificarLink(entrada.texto));
        } catch {
          return json(request, analisarLink(entrada.texto));
        }
      },
    },
  },
});
