import { createFileRoute } from "@tanstack/react-router";

import { diagnosticoApi, gravarConfig, lerConfig, trocarCodigoPorToken } from "@/lib/ml-api";

/* Retorno da autorizacao no Mercado Livre: troca o codigo pelo token, guarda
   no banco e ja testa quais enderecos da API respondem para esta conta. */
const pagina = (titulo: string, corpo: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title><body style="font:16px system-ui;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.5">
<h1 style="font-size:20px">${titulo}</h1>${corpo}</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const Route = createFileRoute("/api/public/ml-retorno")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const codigo = u.searchParams.get("code") ?? "";
        const state = u.searchParams.get("state") ?? "";
        const cfg = await lerConfig(["ml_oauth_state"]);
        if (!codigo || !state || state !== cfg["ml_oauth_state"]) {
          return pagina("Conexão recusada", "<p>O retorno não corresponde a um pedido de conexão feito agora. Abra o link de conexão de novo.</p>", 403);
        }
        await gravarConfig({ ml_oauth_state: "" });
        try {
          const { temRefresh } = await trocarCodigoPorToken(codigo);
          const d = await diagnosticoApi({ item: "MLB4739054961", catalogo: "MLB19486347", termo: "capa case motorola" });
          const linhas = Object.entries(d)
            .map(([k, v]) => `<li><b>${esc(k)}</b>: ${v.status} ${esc(v.detalhe)}</li>`).join("");
          return pagina("Conta conectada à API oficial",
            `<p>Pronto. ${temRefresh ? "A conexão se renova sozinha." : "Atenção: o Mercado Livre não devolveu renovação automática; ative o escopo offline_access no aplicativo."}</p>
<p>Teste dos endereços da API (só leitura):</p><ul>${linhas}</ul><p>Pode fechar esta página.</p>`);
        } catch (e) {
          return pagina("Não consegui conectar", `<p>${esc((e as Error).message)}</p>`, 502);
        }
      },
    },
  },
});
