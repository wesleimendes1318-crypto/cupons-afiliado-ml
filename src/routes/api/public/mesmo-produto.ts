import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { compararMesmoProduto, idsDoLink } from "@/lib/mesmo-produto";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Mesmo produto em outras lojas, pela API oficial do Mercado Livre.

   Quem chama: a extensão (com o token de sincronia no cabeçalho
   x-sinc-token) ou o próprio site. Resultado guardado 6 horas por produto:
   o mesmo link colado de novo não gera nenhuma consulta nova. */

/* Campos do anuncio sao opcionais e tolerantes: um valor estranho vira null
   em vez de derrubar a comparacao inteira. */
const entradaSchema = z.object({
  url: z.string().trim().min(10).max(2000),
  catalogo: z.string().regex(/^MLB\d{5,}$/i).nullish().catch(null),
  item: z.string().regex(/^MLB\d{6,}$/i).nullish().catch(null),
  preco: z.number().positive().max(1e7).nullish().catch(null),
  vendedor: z.string().max(160).nullish().catch(null),
  titulo: z.string().max(300).nullish().catch(null),
  gtin: z.string().regex(/^\d{8,14}$/).nullish().catch(null),
  marca: z.string().max(80).nullish().catch(null),
  modelo: z.string().max(80).nullish().catch(null),
  catalogoPagina: z.string().regex(/^MLB\d{5,}$/i).nullish().catch(null),
});
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
      /* Abrir no navegador mostra qual versão da comparação está no ar. */
      GET: async ({ request }) => json(request, { versao: "2026-09-24 11h40 (8 fichas, sem Light/Men, nomes guardados)" }),
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
        /* Link /up/MLBU... sem código de anúncio também ganha chave: sem ela
           a comparação não ficava gravada e não dava para ver o que a API
           respondeu (caso do Wella da Fragranciaria, 24/09). */
        const up = /\/up\/(MLBU\d{5,})/i.exec(entrada.url)?.[1] ?? null;
        const chave = (ids.item ?? entrada.item ?? ids.catalogo ?? entrada.catalogo ?? up ?? null)?.toUpperCase() ?? null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const tabela = supabaseAdmin.from("comparacoes" as never);

        if (chave) {
          const { data } = await supabaseAdmin
            .from("comparacoes" as never)
            .select("resposta,criado_em")
            .eq("chave" as never, chave as never)
            .maybeSingle();
          const linha = data as { resposta: { procurou?: boolean }; criado_em: string } | null;
          /* So reaproveita comparacao que deu certo; a que falhou fica gravada
             so para diagnostico e e refeita na proxima vez. */
          if (linha?.resposta?.procurou && Date.now() - Date.parse(linha.criado_em) < VALIDADE_MS) {
            return json(request, { ...(linha.resposta as object), cache: true });
          }
        }

        const resultado = await compararMesmoProduto(entrada.url, {
          catalogo: entrada.catalogo ?? null, item: entrada.item ?? null,
          preco: entrada.preco ?? null, vendedor: entrada.vendedor ?? null,
          titulo: entrada.titulo ?? null,
          gtin: entrada.gtin ?? null, marca: entrada.marca ?? null,
          modelo: entrada.modelo ?? null, catalogoPagina: entrada.catalogoPagina ?? null,
        });
        if (chave) {
          await tabela.upsert({ chave, resposta: resultado, criado_em: new Date().toISOString() } as never);
        }
        return json(request, resultado);
      },
    },
  },
});
