import { createFileRoute } from "@tanstack/react-router";

import {
  coletarMercado,
  medirCanal,
  prepararRevalidacao,
  removerPublicacao,
} from "@/lib/inteligencia";
import { chamadaAutorizada, operacaoPausada, registrarExecucao } from "@/lib/segredo-cron";

/* ROTINA DE INTELIGÊNCIA (Weslei, 05/10), chamada pelas tarefas do banco
   (pg_cron) com o cabeçalho x-cron-secret:
   - ?tarefa=mercado  coleta os sinais externos do dia (API oficial do
                      Mercado Livre + Google Trends) e mede o canal;
   - ?tarefa=preparar compara de novo as melhores economias para o garimpo
                      publicar oferta conferida na hora;
   - ?tarefa=remover&publicacao=<id> apaga do canal um post registrado em
                      canal_publicacoes (só sob pedido; não é agendado).
   Com sinc_config.operacao_pausada = 'true' não faz nada (pausa). */

async function executar(request: Request) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const negado = await chamadaAutorizada(request, db);
  if (negado) return negado;
  if (await operacaoPausada(db)) return Response.json({ ok: true, pausada: true });

  const tarefa = new URL(request.url).searchParams.get("tarefa");
  if (tarefa === "mercado") {
    const resumo = await registrarExecucao(db, "mercado", async () => {
      const mercado = await coletarMercado(db);
      const canal = await medirCanal(db).catch((e) => ({ ok: false, erro: String(e) }));
      return { ok: mercado.ok, mercado, canal };
    });
    return Response.json(resumo);
  }
  if (tarefa === "preparar") {
    const resumo = await registrarExecucao(db, "preparar", () => prepararRevalidacao(db));
    return Response.json(resumo);
  }
  if (tarefa === "remover") {
    const id = Number(new URL(request.url).searchParams.get("publicacao"));
    if (!Number.isInteger(id) || id <= 0)
      return Response.json({ ok: false, erro: "publicação inválida" }, { status: 400 });
    const resumo = await registrarExecucao(db, "remover", () =>
      removerPublicacao(db, id, "não cumpre a premissa de qualidade equivalente ou melhor"),
    );
    return Response.json(resumo);
  }
  return Response.json({ ok: false, erro: "tarefa desconhecida" }, { status: 400 });
}

export const Route = createFileRoute("/api/public/operacao")({
  server: {
    handlers: {
      GET: async ({ request }) => executar(request),
      POST: async ({ request }) => executar(request),
    },
  },
});
