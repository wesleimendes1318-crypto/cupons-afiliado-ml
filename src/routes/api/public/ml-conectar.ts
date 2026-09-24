import { createFileRoute } from "@tanstack/react-router";

import { gravarConfig, lerConfig, temCredencialMl, urlDeAutorizacao } from "@/lib/ml-api";

/* Inicio da conexao com a API oficial. Precisa da chave de conexao que fica
   no banco (sinc_config.ml_chave_conexao): sem ela, ninguem de fora consegue
   trocar a conta ligada ao site. */
export const Route = createFileRoute("/api/public/ml-conectar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const chave = new URL(request.url).searchParams.get("chave") ?? "";
        const cfg = await lerConfig(["ml_chave_conexao"]);
        if (!chave || !cfg["ml_chave_conexao"] || chave !== cfg["ml_chave_conexao"]) {
          return new Response("Chave de conexao invalida.", { status: 403 });
        }
        if (!temCredencialMl()) {
          return new Response("Faltam ML_CLIENT_ID e ML_CLIENT_SECRET nos Secrets do Lovable (e publicar de novo).", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        const state = crypto.randomUUID();
        await gravarConfig({ ml_oauth_state: state });
        return new Response(null, { status: 302, headers: { Location: urlDeAutorizacao(state) } });
      },
    },
  },
});
