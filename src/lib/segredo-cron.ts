/* Autorização das chamadas agendadas (Weslei, 05/10). Aceita CRON_SECRET
   (Secrets) ou o segredo gerado no próprio banco (sinc_config.cron_segredo,
   usado pelas tarefas do pg_cron); sem nenhum dos dois, o token do bot. O
   segredo nunca vai para o navegador nem para os registros. */

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

function mesmoSegredo(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function chamadaAutorizada(request: Request, db: Db): Promise<Response | null> {
  const { data } = await db
    .from("sinc_config")
    .select("valor")
    .eq("chave", "cron_segredo")
    .maybeSingle();
  const aceitos = [process.env["CRON_SECRET"], data?.valor].filter(
    (v): v is string => typeof v === "string" && v.length >= 16,
  );
  if (!aceitos.length && process.env["API_TELEGRAM"]) aceitos.push(process.env["API_TELEGRAM"]);
  if (!aceitos.length)
    return Response.json({ ok: false, erro: "sem segredo configurado" }, { status: 503 });
  const enviado = request.headers.get("x-cron-secret") ?? "";
  if (!aceitos.some((a) => mesmoSegredo(enviado, a)))
    return Response.json({ ok: false, erro: "não autorizado" }, { status: 403 });
  return null;
}

/** Pausa administrativa: sinc_config.operacao_pausada = 'true'. */
export async function operacaoPausada(db: Db) {
  const { data } = await db
    .from("sinc_config")
    .select("valor")
    .eq("chave", "operacao_pausada")
    .maybeSingle();
  return data?.valor === "true";
}

/** Registra uma execução da rotina (início/fim, resultado). */
export async function registrarExecucao(
  db: Db,
  tarefa: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const { data: linha } = await t
    .from("operacao_execucoes")
    .insert({ tarefa })
    .select("id")
    .maybeSingle();
  try {
    const resumo = await fn();
    if (linha?.id)
      await t
        .from("operacao_execucoes")
        .update({ fim: new Date().toISOString(), ok: resumo["ok"] !== false, resumo })
        .eq("id", linha.id);
    return resumo;
  } catch (e) {
    const erro = String((e as Error)?.message ?? e).slice(0, 300);
    if (linha?.id)
      await t
        .from("operacao_execucoes")
        .update({ fim: new Date().toISOString(), ok: false, erro })
        .eq("id", linha.id);
    return { ok: false, erro };
  }
}
