import { expect, test } from "bun:test";

import { buscarProdutos } from "@/lib/busca-guiada-cliente";

const resposta = (nome: string, extra: object = {}) => ({
  resumo: "",
  buscas: [nome],
  resultados: [{ produto: "MLB1", item: "MLB2", nome, imagem: null, preco: 10, url: "https://x" }],
  enfileirados: 0,
  ...extra,
});

test("two-stage search: preview line first, full answer wins", async () => {
  const antes = globalThis.fetch;
  const linhas = `${JSON.stringify(resposta("previa", { previa: true }))}\n${JSON.stringify(resposta("final"))}\n`;
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(c) {
          // split mid-line to exercise the buffer
          const b = new TextEncoder().encode(linhas);
          c.enqueue(b.slice(0, 25));
          c.enqueue(b.slice(25));
          c.close();
        },
      }),
      { headers: { "content-type": "application/x-ndjson" } },
    )) as unknown as typeof fetch;
  try {
    const vistas: string[] = [];
    const r = await buscarProdutos("fone qcy", "home", "guiada", 0, undefined, undefined, (p) =>
      vistas.push(p.resultados[0]!.nome),
    );
    expect(vistas).toEqual(["previa"]);
    expect(r.resposta?.resultados[0]?.nome).toBe("final");
  } finally {
    globalThis.fetch = antes;
  }
});

test("two-stage search: full answer failing keeps the preview", async () => {
  const antes = globalThis.fetch;
  const linhas = `${JSON.stringify(resposta("previa", { previa: true }))}\n${JSON.stringify({ erro: "x" })}\n`;
  globalThis.fetch = (async () =>
    new Response(linhas, {
      headers: { "content-type": "application/x-ndjson" },
    })) as unknown as typeof fetch;
  try {
    const r = await buscarProdutos(
      "fone qcy 2",
      "home",
      "guiada",
      0,
      undefined,
      undefined,
      () => {},
    );
    expect(r.erro).toBeNull();
    expect(r.resposta?.resultados[0]?.nome).toBe("previa");
  } finally {
    globalThis.fetch = antes;
  }
});
