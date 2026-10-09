import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ajudarAEscolher, opcoesDaAnalise } from "@/lib/ajudar-escolher";
import { chaveCheaperInference } from "@/lib/cheaper-inference";
import { facebookConfigurado } from "@/lib/facebook";
import { chaveGpt } from "@/lib/gpt";
import { amazonConfigurada } from "@/lib/integracoes/amazon";
import { shopeeConfigurada } from "@/lib/integracoes/shopee";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* "Me ajude a escolher" do resultado (Weslei, 28/09). Lê a comparação do
   próprio banco (o cliente só manda o número do pedido; ver o que foi
   pesquisado já é público) e guarda a resposta por pedido: cada comparação
   gasta no máximo uma análise, e a mesma pergunta volta na hora. */

const entradaSchema = z.object({ pedido: z.number().int().positive() });

export const Route = createFileRoute("/api/public/ajudar-escolher")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      /* Só diz SE as chaves existem (nunca o valor). */
      /* Só diz SE cada integração está configurada (nunca o valor). */
      GET: async ({ request }) =>
        json(request, {
          gpt: Boolean(chaveGpt()),
          gemini: Boolean(process.env["GEMINI_API_KEY"]),
          cheaper: Boolean(chaveCheaperInference()),
          amazon: amazonConfigurada(),
          shopee: shopeeConfigurada(),
          facebook: facebookConfigurado(),
        }),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request))
          return json(request, { erro: "Muitas solicitações. Aguarde um minuto." }, 429);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Pedido inválido." }, 400);
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: p } = await supabaseAdmin
          .from("pedidos_link")
          .select("id,status,link,analise")
          .eq("id", entrada.pedido)
          .maybeSingle();
        if (!p || p.status !== "pronto" || !p.analise)
          return json(request, { erro: "Comparação ainda não terminou." }, 409);

        const analise = p.analise as Record<string, unknown>;
        /* Versão = tamanho da análise + versão da regra (02/10: a escolha passou
           a seguir a tela; respostas guardadas antes não valem). */
        const versao = JSON.stringify(analise).length * 10 + 2;
        /* Tabela nova (fora dos tipos gerados): acesso sem tipo. */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const guardada: { data: { versao: number; resposta: unknown } | null } = await db
          .from("ajuda_escolha")
          .select("versao,resposta")
          .eq("pedido_id", p.id)
          .maybeSingle();
        if (guardada.data && guardada.data.versao === versao)
          return json(request, guardada.data.resposta as Record<string, unknown>);

        const opcoes = opcoesDaAnalise(analise, p.link ?? null);
        const ajuda = await ajudarAEscolher(opcoes);
        if (!ajuda) return json(request, { erro: "Sem opções com link para comparar." }, 404);
        const resposta = {
          escolha: {
            tipo: ajuda.escolha.tipo,
            titulo: ajuda.escolha.titulo,
            loja: ajuda.escolha.loja,
            preco: ajuda.escolha.preco,
            freteGratis: ajuda.escolha.freteGratis,
            lojaOficial: ajuda.escolha.lojaOficial,
            muda: ajuda.escolha.muda,
            link: ajuda.escolha.link,
          },
          resumo: ajuda.resumo,
          pontos: ajuda.pontos,
          calculada: ajuda.calculada,
        };
        /* Resposta calculada (modelo sem cota) não fica guardada: a próxima
           pergunta tenta a análise completa de novo. */
        if (!ajuda.calculada)
          await db.from("ajuda_escolha").upsert({ pedido_id: p.id, versao, resposta });
        return json(request, resposta);
      },
    },
  },
});
