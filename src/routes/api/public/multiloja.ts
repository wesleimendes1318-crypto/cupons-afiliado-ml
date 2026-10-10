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

/* OUTROS MARKETPLACES (09/10): o mesmo produto na Amazon e na Shopee.
   SOB DEMANDA (Weslei, 10/10: "para não gastar muitas requisições... Deixe
   Amazon e Shopee disponíveis, mas com valores borrados. Caso o cliente
   queira saber nessas outras páginas, ele precisa clicar num botão"): sem
   o pedido do cliente (pedir_multiloja -> multiloja_solicitacoes), a rota
   responde sobDemanda e o site mostra os valores borrados com o botão. Com
   o pedido: resultado guardado 6 h por pedido (multiloja_resultados); sem
   as credenciais nos Secrets, quem busca é a EXTENSÃO pela sessão logada,
   e o site espera até 6 min. Freio das APIs: no máximo 40 comparações
   novas a cada 5 minutos no site todo. Só pedidos do próprio site. */
const entradaSchema = z.object({ pedido: z.number().int().positive() });
const CACHE_MS = 6 * 3600_000;
/* A extensão leva de ~1 min a alguns minutos: a conferência da Amazon/Shopee
   espera a do Mercado Livre e a segunda volta do pedido (10/10, cliente
   primeiro na cota do modelo). */
const ESPERA_EXTENSAO_MS = 6 * 60_000;

type Resposta = {
  ativo: boolean;
  lojas: LojaExterna[];
  resumo?: Record<string, ResumoMarketplace>;
  aguardar?: boolean;
  adiado?: boolean;
  /* O cliente ainda não pediu (ou o pedido venceu sem resposta). */
  sobDemanda?: boolean;
  semResposta?: boolean;
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

        const { data: ped } = await db
          .from("pedidos_link")
          .select("origem")
          .eq("id", entrada.pedido)
          .maybeSingle();
        if (!ped || (ped.origem ?? "") === "teste")
          return Response.json({ ativo: false, lojas: [] } satisfies Resposta, {
            headers: { "Cache-Control": "no-store" },
          });
        /* Só busca quando o cliente pediu (botão no site). */
        const { data: sol } = await db
          .from("multiloja_solicitacoes")
          .select("solicitado_em,concluido_em")
          .eq("pedido_id", entrada.pedido)
          .maybeSingle();
        const pedidoAberto =
          sol &&
          sol.concluido_em == null &&
          Date.now() - Date.parse(sol.solicitado_em) < ESPERA_EXTENSAO_MS;
        if (!pedidoAberto)
          return Response.json(
            {
              ativo: true,
              lojas: [],
              sobDemanda: true,
              ...(sol && sol.concluido_em == null ? { semResposta: true } : {}),
            } satisfies Resposta,
            { headers: { "Cache-Control": "no-store" } },
          );

        /* Sem as APIs (09/10): quem compara é a extensão, pela sessão logada,
           e grava em multiloja_resultados (gravar_multiloja). */
        if (!cfg.amazon && !cfg.shopee)
          return Response.json({ ativo: true, lojas: [], aguardar: true } satisfies Resposta, {
            headers: { "Cache-Control": "no-store" },
          });

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
        await db
          .from("multiloja_solicitacoes")
          .update({ concluido_em: new Date().toISOString() })
          .eq("pedido_id", entrada.pedido)
          .is("concluido_em", null);
        return Response.json(limparResultado(resposta), {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
