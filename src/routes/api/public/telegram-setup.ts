import { createFileRoute } from "@tanstack/react-router";

import { chamadaAutorizada } from "@/lib/segredo-cron";

import { segredoDoWebhook, SITE } from "@/lib/telegram";

/* Configuração administrativa: POST com x-cron-secret. Usa o domínio
   canônico e preserva as mensagens pendentes. Não devolve credenciais. */
export const Route = createFileRoute("/api/public/telegram-setup")({
  server: {
    handlers: {
      GET: async () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
      POST: async ({ request }) => {
        if (!request.headers.get("x-cron-secret"))
          return Response.json({ erro: "não autorizado" }, { status: 403 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const negado = await chamadaAutorizada(request, supabaseAdmin);
        if (negado) return negado;
        const token = process.env["API_TELEGRAM"];
        if (!token)
          return Response.json(
            { erro: "API_TELEGRAM não configurada nos Secrets" },
            { status: 503 },
          );
        const webhook = `${SITE}/api/public/telegram-webhook`;
        try {
          const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: webhook,
              secret_token: await segredoDoWebhook(token),
              allowed_updates: ["message", "edited_message"],
              drop_pending_updates: false,
            }),
            signal: AbortSignal.timeout(10_000),
          });
          const j = (await r.json().catch(() => null)) as {
            ok?: boolean;
            description?: string;
          } | null;
          const ok = r.ok && j?.ok === true;
          return Response.json({ webhook, ok }, { status: ok ? 200 : 502 });
        } catch {
          return Response.json({ erro: "Não foi possível configurar o webhook." }, { status: 502 });
        }
      },
    },
  },
});
