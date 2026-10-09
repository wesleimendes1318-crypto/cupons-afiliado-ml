import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buscarPelaFoto } from "@/lib/busca-foto";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Busca por foto (09/10): recebe a foto já reduzida no navegador (JPEG,
   máx. 1024 px) em base64, identifica o produto e devolve os produtos do
   catálogo com anúncio ativo (src/lib/busca-foto.ts). A foto não é
   guardada. Freio: o limite geral por minuto e no máximo 6 fotos a cada
   10 minutos por endereço. */

const entradaSchema = z.object({
  imagem: z
    .string()
    .min(1_000)
    .max(1_600_000)
    .regex(/^[A-Za-z0-9+/=]+$/),
});

const JANELA_FOTOS_MS = 10 * 60_000;
const FOTOS_POR_JANELA = 6;
const fotosPorIp = new Map<string, number[]>();

function muitasFotos(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido";
  const agora = Date.now();
  const recentes = (fotosPorIp.get(ip) ?? []).filter((t) => agora - t < JANELA_FOTOS_MS);
  if (recentes.length >= FOTOS_POR_JANELA) return true;
  recentes.push(agora);
  fotosPorIp.set(ip, recentes);
  if (fotosPorIp.size > 2_000)
    for (const [k, v] of fotosPorIp)
      if (!v.some((t) => agora - t < JANELA_FOTOS_MS)) fotosPorIp.delete(k);
  return false;
}

export const Route = createFileRoute("/api/public/buscar-foto")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request) || muitasFotos(request))
          return json(request, { erro: "Muitas fotos seguidas. Aguarde alguns minutos." }, 429);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Foto inválida. Tente outra foto." }, 400);
        }
        try {
          const r = await buscarPelaFoto(entrada.imagem);
          return json(request, r);
        } catch {
          return json(request, { identificado: null, candidatos: [], confiante: false });
        }
      },
    },
  },
});
