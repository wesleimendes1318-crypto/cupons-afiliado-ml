import { createFileRoute } from "@tanstack/react-router";

import { segredoDoWebhook } from "@/lib/telegram";

/* Registra o webhook do bot no Telegram (abrir uma vez depois do deploy). Só
   aponta para o próprio site e manda o segredo que o webhook confere; não
   devolve o token nem o segredo. */
export const Route = createFileRoute("/api/public/telegram-setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env["API_TELEGRAM"];
        if (!token)
          return Response.json(
            { erro: "API_TELEGRAM não configurada nos Secrets" },
            { status: 503 },
          );
        const webhook = `${new URL(request.url).origin}/api/public/telegram-webhook`;
        try {
          const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: webhook,
              secret_token: await segredoDoWebhook(token),
              allowed_updates: ["message", "edited_message"],
              drop_pending_updates: true,
            }),
            signal: AbortSignal.timeout(10_000),
          });
          const j = (await r.json().catch(() => null)) as {
            ok?: boolean;
            description?: string;
          } | null;
          return Response.json({ webhook, ok: j?.ok ?? false, telegram: j?.description ?? null });
        } catch (e) {
          return Response.json(
            { erro: String((e as Error)?.message ?? e).slice(0, 120) },
            { status: 502 },
          );
        }
      },
    },
  },
});
