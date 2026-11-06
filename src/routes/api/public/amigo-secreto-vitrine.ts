import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { cabeNaFaixa } from "@/lib/amigo-secreto-busca";
import { achadosDoGarimpo, guardarNoAcervo, lerDoAcervo, ordenarPorProcura, pedirGarimpo, sinaisDeProcura } from "@/lib/acervo";
import { buscaGuiada, normalizarBusca, type ResultadoBusca } from "@/lib/busca-guiada";
import { repetido } from "@/lib/curadoria";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* AMIGO SECRETO (05/11): one page of ONE search term of a showcase, from the
   same official catalog search as /api/public/buscar, without the model
   interpretation (the terms are already chosen) and with the budget applied
   with the real cost (cabeNaFaixa). Page 0 is cached 6 h per term + budget. */

const entradaSchema = z.object({
  termo: z.string().trim().min(2).max(60),
  min: z.number().min(0).max(100_000).nullable().optional(),
  max: z.number().min(1).max(100_000).nullable().optional(),
  pagina: z.number().int().min(0).max(40),
  freteACalcular: z.boolean().optional(),
  cursor: z.number().int().min(0).max(400).optional(),
  variantes: z.array(z.string().trim().min(2).max(80)).max(8).optional(),
  vistos: z.array(z.string().regex(/^MLB\d{4,14}$/)).max(400).optional(),
});

const CACHE_MS = 6 * 3600_000;

type Guardada = { resultados: ResultadoBusca[]; proximo: number | null; variantes: string[] };

/* Acervo first (Weslei, 05/11): enough fresh listings already read for this
   term and budget answer at once; the catalog only completes. */
const META_DO_ACERVO = { primeira: 20, seguintes: 10 };

/** Lists in priority order, one card per product/photo/model. */
function juntar(...listas: ResultadoBusca[][]): ResultadoBusca[] {
  const vistos = new Set<string>();
  const titulos: string[][] = [];
  const saida: ResultadoBusca[] = [];
  for (const r of listas.flat()) {
    if (vistos.has(r.produto) || vistos.has(r.item)) continue;
    if (repetido(vistos, titulos, r.nome, r.imagem)) continue;
    vistos.add(r.produto);
    vistos.add(r.item);
    saida.push(r);
  }
  return saida;
}

/* Memory cache per worker, same as /api/public/buscar (30 min, 300 keys): a
   repeated term + budget answers without the database or the catalog. */
const MEMORIA = new Map<string, { em: number; r: Guardada }>();
const MEMORIA_MS = 30 * 60_000;
function lerMemoria(c: string): Guardada | null {
  const m = MEMORIA.get(c);
  if (!m) return null;
  if (Date.now() - m.em > MEMORIA_MS) {
    MEMORIA.delete(c);
    return null;
  }
  return m.r;
}
function gravarMemoria(c: string, r: Guardada) {
  if (MEMORIA.size >= 300) MEMORIA.delete(MEMORIA.keys().next().value!);
  MEMORIA.set(c, { em: Date.now(), r });
}

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
        const chave1 = `amigo6|${faixa}|${normalizarBusca(e.termo)}`;
        const chave = e.pagina
          ? `${chave1}|p${e.pagina}|c${e.cursor ?? ""}|n${(e.vistos ?? []).length}`
          : chave1;
        const naMemoria = lerMemoria(chave);
        if (naMemoria) return json(request, naMemoria);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const faixaPedida = { min: e.min ?? null, max: e.max ?? null, freteACalcular: e.freteACalcular === true };
        const cabe = (r: ResultadoBusca) => cabeNaFaixa(r, e.min, e.max, e.freteACalcular === true);
        const vistos = e.vistos ?? [];
        const [doAcervo, achados] = await Promise.all([
          lerDoAcervo(db, e.termo, faixaPedida, vistos, e.pagina ? 30 : 40),
          e.pagina ? Promise.resolve([] as ResultadoBusca[]) : achadosDoGarimpo(db, e.termo, faixaPedida),
        ]);
        const juntos = juntar(achados, doAcervo).filter(cabe);
        const prontos = ordenarPorProcura(juntos, await sinaisDeProcura(db, juntos));
        if (prontos.length >= (e.pagina ? META_DO_ACERVO.seguintes : META_DO_ACERVO.primeira)) {
          /* The term continues from the same catalog position next time. */
          const resposta: Guardada = { resultados: prontos, proximo: e.cursor ?? 0, variantes: e.variantes ?? [] };
          gravarMemoria(chave, resposta);
          return json(request, resposta);
        }

        const { data: cache } = (await db
          .from("busca_guiada")
          .select("resposta")
          .eq("chave", chave)
          .gte("criado_em", new Date(Date.now() - CACHE_MS).toISOString())
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle()) as { data: { resposta: Guardada } | null };
        if (cache?.resposta) {
          gravarMemoria(chave, cache.resposta);
          return json(request, cache.resposta);
        }

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
              ? { variantes: e.variantes ?? [], excluir: vistos, cursor: e.cursor }
              : {},
          );
        } catch {
          if (prontos.length) return json(request, { resultados: prontos, proximo: e.cursor ?? 0, variantes: e.variantes ?? [] });
          return json(request, { erro: "A busca não respondeu agora. Tente de novo." }, 502);
        }
        const aoVivo = achado.resultados.filter(cabe);
        const todos = juntar(achados, aoVivo, doAcervo);
        const resposta: Guardada = {
          /* Most wanted first (best sellers, trending, most compared, official
             stores); ties keep garimpo finds, fresh read, then the acervo. */
          resultados: ordenarPorProcura(todos, await sinaisDeProcura(db, todos)),
          proximo: achado.proximo ?? null,
          variantes: achado.variantes ?? [],
        };
        gravarMemoria(chave, resposta);
        await Promise.all([
          guardarNoAcervo(db, e.termo, achado.resultados),
          pedirGarimpo(db, e.termo, faixaPedida, { cursor: resposta.proximo, variantes: resposta.variantes }),
          resposta.resultados.length
            ? db.from("busca_guiada").insert({ chave, contexto: "amigo", resposta, enfileirados: 0 })
            : null,
        ]);
        return json(request, resposta);
      },
    },
  },
});
