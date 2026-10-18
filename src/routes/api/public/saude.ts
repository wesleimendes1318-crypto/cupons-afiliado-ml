import { createFileRoute } from "@tanstack/react-router";

import { chaveDeServico } from "@/integrations/supabase/projeto";
import { excedeuLimite } from "@/lib/public-ai-api";

/* SAÚDE DO SITE (16/10: a consulta do Lovable ao banco deu 504 por horas e o
   Guardião ficou sem ver nada). O próprio servidor do site responde, só
   leitura e sem dado de cliente: se o banco responde (e em quanto tempo), a
   versão e a pausa da extensão, há quanto tempo saiu o último pedido pronto,
   quantos pedidos de cliente da última hora falharam, ficaram sem link ou
   parados, e quantos brinquedos a página /brinquedos tem. Sem link, sem id,
   sem chave, sem comissão, sem o erro bruto do banco. Limite por endereço. */

const PRAZO_MS = 8000;

function comPrazo<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, falhar) => setTimeout(() => falhar(new Error("tempo")), PRAZO_MS)),
  ]);
}

const minutosDesde = (iso: unknown) => {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60_000)) : null;
};

const responder = (body: object, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

export const Route = createFileRoute("/api/public/saude")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (excedeuLimite(request)) return responder({ erro: "Aguarde um minuto." }, 429);
        const t0 = Date.now();
        const em = new Date().toISOString();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabaseAdmin as any;
          const umaHora = new Date(Date.now() - 3_600_000).toISOString();
          const [config, ultimo, recentes, brinquedos] = await Promise.allSettled([
            comPrazo(
              db
                .from("sinc_config")
                .select("chave, valor")
                .in("chave", ["versao_extensao", "extensao_pausada", "operacao_pausada"]),
            ),
            comPrazo(
              db
                .from("pedidos_link")
                .select("criado_em, atendido_em")
                .eq("status", "pronto")
                .order("id", { ascending: false })
                .limit(1),
            ),
            comPrazo(
              db
                .from("pedidos_link")
                .select("status, link, criado_em")
                .gte("criado_em", umaHora)
                .or("origem.is.null,origem.neq.teste")
                .limit(500),
            ),
            comPrazo(db.rpc("curadoria_brinquedos")),
          ]);
          const ms = Date.now() - t0;
          const dados = (r: PromiseSettledResult<unknown>) =>
            r.status === "fulfilled" && !(r.value as { error?: unknown })?.error
              ? ((r.value as { data?: unknown }).data ?? null)
              : null;
          const cfg = dados(config) as Array<{ chave: string; valor: string | null }> | null;
          if (!cfg) {
            const motivo =
              config.status === "rejected" && String(config.reason).includes("tempo")
                ? "sem resposta em 8 s"
                : "erro na consulta";
            /* Só o código e o status HTTP do erro (nunca a mensagem): bastam
               para saber se é banco pausado, chave recusada ou cache do
               esquema (PGRST002). */
            const r =
              config.status === "fulfilled"
                ? (config.value as { error?: { code?: unknown }; status?: unknown })
                : null;
            const codigo = String(r?.error?.code ?? "")
              .replace(/[^A-Za-z0-9_]/g, "")
              .slice(0, 12);
            const status = typeof r?.status === "number" ? r.status : null;
            return responder(
              { banco: "falhou", motivo, codigo: codigo || null, status, ms, em },
              503,
            );
          }
          const valor = (c: string) => cfg.find((x) => x.chave === c)?.valor ?? null;
          const u = (
            dados(ultimo) as Array<{ criado_em: string; atendido_em: string | null }>
          )?.[0];
          const lista = dados(recentes) as Array<{
            status: string;
            link: string | null;
            criado_em: string;
          }> | null;
          const vinte = Date.now() - 20 * 60_000;
          const brinq = dados(brinquedos);
          return responder({
            banco: "ok",
            ms,
            em,
            extensao: {
              versao: valor("versao_extensao"),
              pausada: valor("extensao_pausada") === "true",
            },
            operacaoPausada: valor("operacao_pausada") === "true",
            ultimoProntoHaMin: u ? minutosDesde(u.atendido_em ?? u.criado_em) : null,
            ultimaHora: lista
              ? {
                  clientes: lista.length,
                  falhou: lista.filter((p) => p.status === "falhou").length,
                  prontoSemLink: lista.filter(
                    (p) => p.status === "pronto" && !/^https:\/\/meli\.la\//.test(p.link ?? ""),
                  ).length,
                  parados: lista.filter(
                    (p) =>
                      (p.status === "pendente" || p.status === "processando") &&
                      Date.parse(p.criado_em) < vinte,
                  ).length,
                }
              : null,
            brinquedos: Array.isArray(brinq) ? brinq.length : null,
          });
        } catch {
          /* Só COMO a chave do banco próprio foi achada (pelo nome, pelo
             valor, várias ou ausente), nunca o valor (18/10). */
          return responder(
            {
              banco: "falhou",
              motivo: "erro no servidor",
              chaveServico: chaveDeServico().origem,
              ms: Date.now() - t0,
              em,
            },
            503,
          );
        }
      },
    },
  },
});
