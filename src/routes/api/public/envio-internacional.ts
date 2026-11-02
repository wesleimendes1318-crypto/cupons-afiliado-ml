import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { envioDasTags, type EnvioInternacional } from "@/lib/internacional";
import { mlGet } from "@/lib/ml-api";
import { itensDaAnalise } from "@/lib/prazo-servidor";

/* ENVIO INTERNACIONAL (01/11, Switch 2). O site manda o número do pedido; o
   servidor lê na lista OFICIAL de ofertas de cada ficha da comparação
   (/products/{id}/items, só leitura) quais anúncios vêm do exterior (tags
   "cbt_item" / "cbt_fulfillment_us") e devolve por chave da tela (colado,
   alt-i, ref-i, par-i). Nada é gravado; cache de 6 h na memória. Anúncio que
   não está na lista fica sem resposta (não afirma nada). */

const entradaSchema = z.object({ pedido: z.number().int().positive() });

const cache = new Map<string, { em: number; itens: Record<string, EnvioInternacional> }>();
const SEIS_HORAS = 6 * 3600_000;
let consultasRecentes: number[] = [];

async function ofertasDaFicha(produto: string): Promise<Record<string, EnvioInternacional>> {
  const g = cache.get(produto);
  if (g && Date.now() - g.em < SEIS_HORAS) return g.itens;
  consultasRecentes = consultasRecentes.filter((t) => Date.now() - t < 5 * 60_000);
  if (consultasRecentes.length > 200) return g?.itens ?? {};
  const itens: Record<string, EnvioInternacional> = {};
  for (let offset = 0; offset < 100; offset += 50) {
    consultasRecentes.push(Date.now());
    let j: { results?: { item_id?: string; tags?: unknown; shipping?: { tags?: unknown } }[] };
    try {
      j = await mlGet(`/products/${produto}/items?limit=50&offset=${offset}`);
    } catch {
      break;
    }
    const lista = j.results ?? [];
    for (const r of lista) {
      if (!r.item_id) continue;
      const tags = [
        ...(Array.isArray(r.tags) ? r.tags : []),
        ...(Array.isArray(r.shipping?.tags) ? r.shipping.tags : []),
      ];
      itens[r.item_id.toUpperCase()] = envioDasTags(tags);
    }
    if (lista.length < 50) break;
  }
  cache.set(produto, { em: Date.now(), itens });
  return itens;
}

function fichasDoTexto(texto: string): string[] {
  let s = texto;
  try {
    s = decodeURIComponent(texto);
  } catch {
    /* como veio */
  }
  const out = new Set<string>();
  for (const m of s.matchAll(/\/p\/(MLB\d{6,})/gi)) out.add(m[1].toUpperCase());
  return [...out].slice(0, 4);
}

export const Route = createFileRoute("/api/public/envio-internacional")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return Response.json({ erro: "pedido inválido" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const { data } = (await db
          .from("pedidos_link")
          .select("analise, url_alvo")
          .eq("id", entrada.pedido)
          .maybeSingle()) as {
          data: { analise: Record<string, unknown> | null; url_alvo: string | null } | null;
        };
        if (!data?.analise) return Response.json({ envio: {} });
        const mapa = itensDaAnalise(data.analise, data.url_alvo);
        const fichas = fichasDoTexto(`${data.url_alvo ?? ""} ${JSON.stringify(data.analise)}`);
        const porItem: Record<string, EnvioInternacional> = {};
        const lidas = await Promise.allSettled(fichas.map((f) => ofertasDaFicha(f)));
        for (const l of lidas) if (l.status === "fulfilled") Object.assign(porItem, l.value);
        const envio: Record<string, EnvioInternacional> = {};
        for (const [chave, item] of Object.entries(mapa)) {
          const e = porItem[item];
          if (e) envio[chave] = e;
        }
        return Response.json({ envio }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
