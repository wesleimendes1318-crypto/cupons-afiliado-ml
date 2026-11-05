import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { cabeNaFaixa } from "@/lib/amigo-secreto-busca";
import { buscaGuiada, normalizarBusca, type ResultadoBusca } from "@/lib/busca-guiada";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* AMIGO SECRETO (05/11): one page of ONE search term of a showcase, from the
   same official catalog search as /api/public/buscar, without the model
   interpretation (the terms are already chosen) and with the budget applied
   with the real cost (cabeNaFaixa). Page 0 is cached 6 h per term + budget. */

const entradaSchema = z.object({
  termo: z.string().trim().min(2).max(60),
  min: z.number().min(0).max(100_000).nullable().optional(),
  max: z.number().min(1).max(100_000).nullable().optional(),
  pagina: z.number().int().min(0).max(12),
  freteACalcular: z.boolean().optional(),
  cursor: z.number().int().min(0).max(400).optional(),
  variantes: z.array(z.string().trim().min(2).max(80)).max(8).optional(),
  vistos: z.array(z.string().regex(/^MLB\d{4,14}$/)).max(400).optional(),
});

const CACHE_MS = 6 * 3600_000;

type Guardada = { resultados: ResultadoBusca[]; proximo: number | null; variantes: string[] };

export const Route = createFileRoute("/api/public/amigo-secreto-vitrine")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        let e: z.infer<typeof entradaSchema>;
        try {
          e = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Pedido inválido." }, 400);
        }
        if (e.min != null && e.max != null && e.min > e.max)
          return json(request, { erro: "Faixa de preço inválida." }, 400);
        /* Own counter: a page with 6 showcases makes many short calls. */
        if (excedeuLimite(request, 90, "amigo-v:"))
          return json(request, { erro: "Muitas buscas seguidas. Aguarde um minuto." }, 429);

        const faixa = `${e.min ?? ""}-${e.max ?? ""}${e.freteACalcular ? "|f" : ""}`;
        const chave1 = `amigo3|${faixa}|${normalizarBusca(e.termo)}`;
        const chave = e.pagina
          ? `${chave1}|p${e.pagina}|c${e.cursor ?? ""}|n${(e.vistos ?? []).length}`
          : chave1;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const { data: cache } = (await db
          .from("busca_guiada")
          .select("resposta")
          .eq("chave", chave)
          .gte("criado_em", new Date(Date.now() - CACHE_MS).toISOString())
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle()) as { data: { resposta: Guardada } | null };
        if (cache?.resposta) return json(request, cache.resposta);

        let achado: Awaited<ReturnType<typeof buscaGuiada>>;
        try {
          achado = await buscaGuiada(
            e.termo,
            null,
            e.pagina,
            {
              buscas: [e.termo],
              precoMin: e.min ?? null,
              precoMax: e.max ?? null,
              resumo: "",
              tipoProduto: null,
              contextoUso: null,
              termosNegativos: [],
              dominiosPermitidos: [],
              marca: null,
              modelo: null,
            },
            e.pagina
              ? { variantes: e.variantes ?? [], excluir: e.vistos ?? [], cursor: e.cursor }
              : {},
          );
        } catch {
          return json(request, { erro: "A busca não respondeu agora. Tente de novo." }, 502);
        }
        const resposta: Guardada = {
          resultados: achado.resultados.filter((r) => cabeNaFaixa(r, e.min, e.max, e.freteACalcular === true)),
          proximo: achado.proximo ?? null,
          variantes: achado.variantes ?? [],
        };
        if (resposta.resultados.length)
          await db.from("busca_guiada").insert({ chave, contexto: "amigo", resposta, enfileirados: 0 });
        return json(request, resposta);
      },
    },
  },
});
