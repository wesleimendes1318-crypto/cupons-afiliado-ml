import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ehLinkDeCompra } from "@/lib/afiliado";
import {
  compararMultiloja,
  multilojaConfigurada,
  type LojaExterna,
  type ResumoMarketplace,
} from "@/lib/coletor-multiloja";
import { limparResultado } from "@/lib/multiloja-resultado";
import { origemPermitida } from "@/lib/public-ai-api";

/* OUTROS MARKETPLACES (09/10): com a comparação do Mercado Livre pronta, o
   site pede aqui o mesmo produto na Amazon e na Shopee. Resultado guardado
   6 h por pedido (multiloja_resultados). Sem as credenciais nos Secrets,
   lê o que a EXTENSÃO gravou (busca pela sessão logada, 09/10). Freio: no
   máximo 40 comparações novas a cada 5 minutos no site todo (sem limite por
   endereço: o resultado guardado é barato e a mesma rede de celular é
   dividida por muita gente). Só pedidos do próprio site. */

const entradaSchema = z.object({ pedido: z.number().int().positive() });
const CACHE_MS = 6 * 3600_000;
/* A extensão leva até ~1 min (busca, conferência pela foto e links). */
const ESPERA_EXTENSAO_MS = 4 * 60_000;

type Resposta = {
  ativo: boolean;
  lojas: LojaExterna[];
  resumo?: Record<string, ResumoMarketplace>;
  aguardar?: boolean;
  adiado?: boolean;
};

/* Chave do anúncio colado para os vereditos guardados (código MLB). */
function chaveDoOriginal(url: string | null, pedido: number) {
  const s = String(url ?? "");
  const m =
    s.match(/item_id(?:%3A|:)(MLB\d{6,})/i)?.[1] ??
    s.match(/\/p\/(MLB\d+)/i)?.[1] ??
    s.match(/MLB-?\d{6,}/i)?.[0]?.replace("-", "");
  return m ? m.toUpperCase() : `pedido:${pedido}`;
}

export const Route = createFileRoute("/api/public/multiloja")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return Response.json({ erro: "origem não permitida" }, { status: 403 });
        const cfg = multilojaConfigurada();
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return Response.json({ erro: "pedido inválido" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Tabela nova (fora dos tipos gerados): acesso sem tipo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const { data: guardado } = await db
          .from("multiloja_resultados")
          .select("resultado,criado_em")
          .eq("pedido_id", entrada.pedido)
          .maybeSingle();
        if (guardado && Date.now() - Date.parse(guardado.criado_em) < CACHE_MS)
          return Response.json(limparResultado(guardado.resultado), {
            headers: { "Cache-Control": "no-store" },
          });

        /* Sem as APIs (09/10): quem compara é a extensão, pela sessão logada,
           e grava em multiloja_resultados (gravar_multiloja). Enquanto o
           pedido de cliente é recente, o site espera; depois, desiste. */
        if (!cfg.amazon && !cfg.shopee) {
          const { data: ped } = await db
            .from("pedidos_link")
            .select("origem,criado_em")
            .eq("id", entrada.pedido)
            .maybeSingle();
          const recente =
            ped &&
            (ped.origem ?? "") !== "teste" &&
            Date.now() - Date.parse(ped.criado_em) < ESPERA_EXTENSAO_MS;
          return Response.json(
            (recente
              ? { ativo: true, lojas: [], aguardar: true }
              : { ativo: false, lojas: [] }) satisfies Resposta,
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        const { count } = await db
          .from("multiloja_resultados")
          .select("pedido_id", { count: "exact", head: true })
          .gte("criado_em", new Date(Date.now() - 5 * 60_000).toISOString());
        if ((count ?? 0) >= 40)
          return Response.json({ ativo: true, lojas: [], adiado: true } satisfies Resposta);

        const { data: p } = await db
          .from("pedidos_link")
          .select("status,url_alvo,analise")
          .eq("id", entrada.pedido)
          .maybeSingle();
        const a = (p?.analise ?? null) as {
          titulo?: string;
          imagem?: string;
          preco?: number;
          categoria?: string;
        } | null;
        if (!p || p.status !== "pronto" || !a?.titulo)
          return Response.json({ ativo: true, lojas: [], aguardar: true } satisfies Resposta);

        let lojas: LojaExterna[] = [];
        let resumo: Record<string, ResumoMarketplace> | undefined;
        try {
          const r = await compararMultiloja({
            titulo: a.titulo,
            imagem: a.imagem ?? null,
            preco: typeof a.preco === "number" ? a.preco : null,
            categoria: a.categoria ?? null,
            chave: chaveDoOriginal(p.url_alvo, entrada.pedido),
          });
          /* Trava final: só link de afiliado do próprio marketplace. */
          lojas = r.lojas.filter((l) => ehLinkDeCompra(l.link, l.marketplace));
          resumo = r.resumo;
        } catch {
          lojas = [];
        }
        const resposta: Resposta = { ativo: true, lojas, ...(resumo ? { resumo } : {}) };
        await db.from("multiloja_resultados").upsert({
          pedido_id: entrada.pedido,
          resultado: resposta,
          criado_em: new Date().toISOString(),
        });
        return Response.json(limparResultado(resposta), {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
