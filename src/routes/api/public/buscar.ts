import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buscaGuiada, normalizarBusca, type RespostaBusca } from "@/lib/busca-guiada";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Busca guiada do site (05/10). A mesma pergunta (normalizada) volta do
   cache por 6 h. "A cada busca, se fizer sentido, deixar na vitrine": o 1º
   produto de cada busca que ninguém comparou nos últimos 7 dias entra na
   fila de comparação, no máximo 2 por busca e 8 por hora no site todo
   (a extensão compara um por vez, com o freio de sempre). */

const entradaSchema = z.object({
  q: z.string().trim().min(2).max(160),
  contexto: z.enum(["home", "natal", "criancas"]).optional(),
});

const CONTEXTOS = {
  home: null,
  natal: "presentes de Natal",
  criancas: "presentes de Dia das Criancas, brinquedos e itens infantis",
} as const;

const CACHE_MS = 6 * 3600_000;
const FILA_POR_BUSCA = 2;
const FILA_POR_HORA = 8;

export const Route = createFileRoute("/api/public/buscar")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request))
          return json(request, { erro: "Muitas buscas seguidas. Aguarde um minuto." }, 429);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Escreva o que você procura." }, 400);
        }
        const contexto = entrada.contexto ?? "home";
        const chave = `${contexto}|${normalizarBusca(entrada.q)}`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Tabela nova (fora dos tipos gerados): acesso sem tipo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const guardada: { data: { resposta: RespostaBusca } | null } = await db
          .from("busca_guiada")
          .select("resposta")
          .eq("chave", chave)
          .gte("criado_em", new Date(Date.now() - CACHE_MS).toISOString())
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (guardada.data?.resposta) return json(request, guardada.data.resposta);

        let achado: Awaited<ReturnType<typeof buscaGuiada>>;
        try {
          achado = await buscaGuiada(entrada.q, CONTEXTOS[contexto]);
        } catch {
          return json(request, { erro: "A busca não respondeu agora. Tente de novo." }, 502);
        }

        /* Fila da vitrine: só produto com anúncio ativo, ainda não comparado
           na semana, dentro do teto por hora. */
        let enfileirados = 0;
        if (achado.resultados.length) {
          const hora = new Date(Date.now() - 3600_000).toISOString();
          const { data: ultimas } = await db
            .from("busca_guiada")
            .select("enfileirados")
            .gte("criado_em", hora);
          let livres =
            FILA_POR_HORA -
            ((ultimas ?? []) as Array<{ enfileirados: number }>).reduce(
              (s, r) => s + (r.enfileirados || 0),
              0,
            );
          const semana = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
          for (const r of achado.resultados) {
            if (livres <= 0 || enfileirados >= FILA_POR_BUSCA) break;
            const { count } = await db
              .from("pedidos_link")
              .select("id", { count: "exact", head: true })
              .gte("criado_em", semana)
              .ilike("url_alvo", `%${r.produto}%`);
            if ((count ?? 0) > 0) continue;
            const { data: novo, error } = await db.rpc("pedir_link_agente", {
              p_url: r.url,
              p_fonte: "busca",
            });
            if (!error && novo != null) {
              enfileirados += 1;
              livres -= 1;
            }
          }
        }

        const resposta: RespostaBusca = {
          resumo: achado.intencao.resumo,
          buscas: achado.intencao.buscas,
          resultados: achado.resultados,
          enfileirados,
        };
        /* Busca sem resultado não fica guardada (pode ter sido falha). */
        if (achado.resultados.length || enfileirados)
          await db.from("busca_guiada").insert({ chave, contexto, resposta, enfileirados });
        return json(request, resposta);
      },
    },
  },
});
