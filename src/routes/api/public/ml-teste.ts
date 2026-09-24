import { createFileRoute } from "@tanstack/react-router";

import { lerConfig, testarBuscaDeCatalogo } from "@/lib/ml-api";

/* Teste dos enderecos da API usados pela comparacao. Protegido por uma chave
   de uso unico guardada no banco (sinc_config.ml_chave_teste). So leitura. */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const Route = createFileRoute("/api/public/ml-teste")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const chave = new URL(request.url).searchParams.get("chave") ?? "";
        const cfg = await lerConfig(["ml_chave_teste"]);
        if (!chave || !cfg["ml_chave_teste"] || chave !== cfg["ml_chave_teste"]) {
          return new Response("Chave de teste invalida.", { status: 403 });
        }
        const d = await testarBuscaDeCatalogo({
          catalogo: "MLB19486347", up: "MLBU1966707846", termo: "banco que vira mesa 8 lugares",
        });
        const linhas = Object.entries(d).map(([k, v]) => `<li><b>${esc(k)}</b>: ${v.status} ${esc(v.detalhe)}</li>`).join("");
        return new Response(
          `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font:16px system-ui;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.5">
<h1 style="font-size:20px">Teste da busca no catálogo</h1><ul>${linhas}</ul><p>Pode fechar esta página.</p></body>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      },
    },
  },
});
