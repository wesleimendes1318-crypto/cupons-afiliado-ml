import { createFileRoute } from "@tanstack/react-router";

import { cabeNaFaixa } from "@/lib/amigo-secreto-busca";
import { guardarNoAcervo } from "@/lib/acervo";
import { buscaGuiada } from "@/lib/busca-guiada";
import { chamadaAutorizada, operacaoPausada } from "@/lib/segredo-cron";

/* GARIMPO DO ACERVO (Weslei, 05/11): every 3 min (pg_cron acervo-garimpo)
   reads the NEXT page of ONE term a showcase asked for and keeps what fits the
   budget in acervo_ofertas. One read at a time, no bursts. A term stops after
   15 pages or when the catalog runs out.
   DAILY FEED (Weslei, 06/11: "diariamente deve ir alimentando anuncios em
   todas as vitrines, até mesmo nas personalizadas"): terms stay in the queue
   for DIAS_NA_FILA days after the last visit, and pg_cron acervo-reabrir
   re-opens finished ones once a day from page 0, so every showcase (the
   personalized ones included) gets its top listings re-read and new ones
   found each day. Listings not re-read age out (ACERVO_HORAS). */
const MAX_PAGINAS = 15;
const DIAS_NA_FILA = 30;

type Fila = {
  chave: string;
  termo: string;
  preco_min: number | null;
  preco_max: number | null;
  frete_a_calcular: boolean;
  pagina: number;
  cursor: number;
  variantes: string[];
};

export const Route = createFileRoute("/api/public/jobs/garimpar-acervo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const negado = await chamadaAutorizada(request, supabaseAdmin);
        if (negado) return negado;
        if (await operacaoPausada(supabaseAdmin)) return Response.json({ ok: true, pausada: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const { data } = (await db
          .from("acervo_garimpo")
          .select("chave,termo,preco_min,preco_max,frete_a_calcular,pagina,cursor,variantes")
          .eq("fim", false)
          .gte("pedido_em", new Date(Date.now() - DIAS_NA_FILA * 24 * 3600_000).toISOString())
          .order("lido_em", { ascending: true, nullsFirst: true })
          .limit(1)
          .maybeSingle()) as { data: Fila | null };
        if (!data) return Response.json({ ok: true, nada: true });
        const min = data.preco_min == null ? null : Number(data.preco_min);
        const max = data.preco_max == null ? null : Number(data.preco_max);
        let guardados = 0;
        let proximo: number | null = null;
        let variantes = data.variantes ?? [];
        try {
          const r = await buscaGuiada(
            data.termo,
            null,
            data.pagina,
            {
              buscas: [data.termo],
              precoMin: min,
              precoMax: max,
              resumo: "",
              tipoProduto: null,
              contextoUso: null,
              termosNegativos: [],
              dominiosPermitidos: [],
              marca: null,
              modelo: null,
            },
            { variantes: data.variantes ?? [], excluir: [], cursor: data.cursor },
          );
          const bons = r.resultados.filter((x) => cabeNaFaixa(x, min, max, data.frete_a_calcular));
          await guardarNoAcervo(db, data.termo, bons);
          guardados = bons.length;
          proximo = r.proximo ?? null;
          /* Page 0 (daily re-open) finds today's brands: they feed the next pages. */
          if (data.pagina === 0 && r.variantes?.length) variantes = r.variantes.slice(0, 8);
        } catch {
          proximo = data.cursor; // try the same page next time
        }
        await db
          .from("acervo_garimpo")
          .update({
            pagina: data.pagina + 1,
            cursor: proximo ?? data.cursor,
            variantes,
            fim: proximo == null || data.pagina + 1 > MAX_PAGINAS,
            lido_em: new Date().toISOString(),
          })
          .eq("chave", data.chave);
        return Response.json({ ok: true, termo: data.termo, pagina: data.pagina, guardados });
      },
    },
  },
});
