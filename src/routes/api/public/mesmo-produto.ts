import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { compararMesmoProduto, idsDoLink } from "@/lib/mesmo-produto";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Mesmo produto em outras lojas, pela API oficial do Mercado Livre.

   Quem chama: a extensão (com o token de sincronia no cabeçalho
   x-sinc-token) ou o próprio site. Resultado guardado 6 horas por produto:
   o mesmo link colado de novo não gera nenhuma consulta nova. */

const entradaSchema = z.object({ url: z.string().trim().min(10).max(2000) });
const VALIDADE_MS = 6 * 60 * 60 * 1000;

async function tokenValido(request: Request) {
  const enviado = request.headers.get("x-sinc-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("sinc_config").select("valor").eq("chave", "token").maybeSingle();
  return Boolean(data?.valor) && data?.valor === enviado;
}

export const Route = createFileRoute("/api/public/mesmo-produto")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        const daExtensao = await tokenValido(request);
        if (!daExtensao) {
          if (!origemPermitida(request)) return json(request, { erro: "Origem da solicitação não permitida." }, 403);
          if (excedeuLimite(request)) return json(request, { erro: "Muitas solicitações. Aguarde um minuto." }, 429);
        }

        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Informe o link do produto." }, 400);
        }
        if (!/^https?:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com)\//i.test(entrada.url)) {
          return json(request, { erro: "Só funciona com link do Mercado Livre." }, 400);
        }

        const ids = idsDoLink(entrada.url);
        const chave = ids.item ?? ids.catalogo;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const tabela = supabaseAdmin.from("comparacoes" as never);

        if (chave) {
          const { data } = await supabaseAdmin
            .from("comparacoes" as never)
            .select("resposta,criado_em")
            .eq("chave" as never, chave as never)
            .maybeSingle();
          const linha = data as { resposta: unknown; criado_em: string } | null;
          if (linha && Date.now() - Date.parse(linha.criado_em) < VALIDADE_MS) {
            return json(request, { ...(linha.resposta as object), cache: true });
          }
        }

        const resultado = await compararMesmoProduto(entrada.url);
        if (chave && resultado.procurou) {
          await tabela.upsert({ chave, resposta: resultado, criado_em: new Date().toISOString() } as never);
        }
        return json(request, resultado);
      },
    },
  },
});
