import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { conferirMesmoProduto, termoDeBusca } from "@/lib/conferir-produto";
import { json, respostaOptions } from "@/lib/public-ai-api";

/* Gemini do servidor para a extensao: confere pela FOTO se cada candidato e o
   mesmo produto, ou escreve a busca para acha-lo. So atende quem manda o token
   de sincronia (a extensao do Weslei): e a chave paga dele. */

const anuncio = z.object({
  titulo: z.string().max(400).nullish(),
  imagem: z.string().max(600).nullish(),
  preco: z.number().nullish().catch(null),
  chave: z.string().max(120).nullish(),
});
const entradaSchema = z.object({
  tipo: z.enum(["conferir", "busca"]),
  original: anuncio,
  candidatos: z.array(anuncio).max(12).optional(),
});

async function tokenValido(request: Request) {
  const enviado = request.headers.get("x-sinc-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sinc_config")
    .select("valor")
    .eq("chave", "token")
    .maybeSingle();
  return Boolean(data?.valor) && data?.valor === enviado;
}

export const Route = createFileRoute("/api/public/conferir-produto")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      GET: async ({ request }) =>
        json(request, {
          versao: "2026-09-25 conferencia por foto",
          chave: Boolean(process.env["GEMINI_API_KEY"]),
        }),
      POST: async ({ request }) => {
        if (!(await tokenValido(request)))
          return json(request, { ok: false, erro: "token invalido" }, 403);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { ok: false, erro: "pedido invalido" }, 400);
        }
        if (entrada.tipo === "busca") return json(request, await termoDeBusca(entrada.original));
        return json(
          request,
          await conferirMesmoProduto(entrada.original, entrada.candidatos ?? []),
        );
      },
    },
  },
});
