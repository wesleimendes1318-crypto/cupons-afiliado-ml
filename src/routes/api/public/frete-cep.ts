import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { freteParaCep, gravarConfig } from "@/lib/ml-api";

/* FRETE PARA O CEP DO CLIENTE (Weslei, 02/10). A extensão manda o número do
   pedido e os anúncios da comparação; o servidor lê o CEP gravado no pedido
   (pedir_comparacao com p_cep) e simula o frete de cada anúncio pela API
   oficial (/items/{id}/shipping_options?zip_code=), só leitura. Nada passa
   pela conta de afiliado e nenhum endereço é alterado. Conferido em 02/10:
   capinha MLB4739054961 grátis para SP e R$ 74,99 para Manaus. */

const entradaSchema = z.object({
  pedido: z.number().int().positive(),
  itens: z
    .array(z.string().regex(/^MLB\d{6,}$/i))
    .max(24)
    .default([]),
});

async function tokenValido(request: Request) {
  const enviado = request.headers.get("x-sinc-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sinc_config")
    .select("valor")
    .eq("chave", "token")
    .maybeSingle();
  return Boolean(data?.valor) && data?.valor === enviado;
}

export const Route = createFileRoute("/api/public/frete-cep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await tokenValido(request)))
          return Response.json({ erro: "sem permissão" }, { status: 403 });
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
          .select("cep_destino")
          .eq("id", entrada.pedido)
          .maybeSingle()) as { data: { cep_destino: string | null } | null };
        const cep = data?.cep_destino ?? null;
        if (!cep || !entrada.itens.length) return Response.json({ cep, fretes: {} });

        /* 6 de cada vez, cada um com 5 s: a consulta do cliente não espera mais
           que alguns segundos. */
        const itens = [...new Set(entrada.itens.map((i) => i.toUpperCase()))];
        const fretes: Record<string, { gratis: boolean | null; custo: number | null }> = {};
        let ok = 0;
        let erro = 0;
        let ultimoErro: string | null = null;
        for (let i = 0; i < itens.length; i += 6) {
          const lote = itens.slice(i, i + 6);
          const res = await Promise.all(lote.map((it) => freteParaCep(it, cep)));
          res.forEach((r, k) => {
            const it = lote[k];
            if (it && r.status === 200 && r.gratis != null) {
              fretes[it] = { gratis: r.gratis, custo: r.custo };
              ok += 1;
            } else {
              erro += 1;
              ultimoErro = `${r.status} ${r.detalhe}`.slice(0, 120);
            }
          });
        }
        await gravarConfig({
          frete_cep_ultimo: JSON.stringify({
            quando: new Date().toISOString(),
            pedido: entrada.pedido,
            cep,
            ok,
            erro,
            ultimoErro,
          }),
        }).catch(() => {});
        return Response.json({ cep, fretes });
      },
    },
  },
});
