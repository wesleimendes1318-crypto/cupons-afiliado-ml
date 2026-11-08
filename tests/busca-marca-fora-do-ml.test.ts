import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

/* Weslei, 08/11 after PR #152: "insider camiseta" came back empty. Insider
   sells off ML, so the catalog has books and lipstick with that word and no
   t-shirt. Same type without the brand, every other shield kept. */
const CATALOGO: Record<string, string[]> = {
  "insider camiseta": [
    "Livro - Insider Trading",
    "Batom Maybelline Superstay Matte Ink Insider",
    "Conjunto Roupa Fitness Paris SOMAMI",
  ],
  camiseta: [
    "Conjunto Infantil Escolar Frio Blusa Moletom",
    "Camiseta Básica Masculina 100% Algodão Pima",
    "Jogo Uno Para Revender Atacado",
    "Camiseta Hering Super Cotton Preta",
  ],
  "nike camiseta": ["Camiseta Nike Dri-Fit Masculina", "Camiseta Hering Super Cotton Preta"],
};
const nomes = Object.values(CATALOGO).flat();
const idDe = (n: string) => `MLB${100 + nomes.indexOf(n)}`;

let lida: Record<string, unknown> = {};
mock.module("@/lib/cheaper-inference", () => ({
  perguntarAoLlm: async () => ({ ok: true, texto: JSON.stringify(lida) }),
}));
const { buscaGuiada } = await import("@/lib/busca-guiada");

const fetchOriginal = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = new URL(String(entrada));
    const q = u.searchParams.get("q") ?? "";
    if (u.pathname.includes("domain_discovery")) return Response.json([]);
    if (u.pathname.startsWith("/highlights/")) return Response.json({ content: [] });
    if (u.pathname === "/products/search")
      return Response.json({
        results: (CATALOGO[q] ?? []).map((name) => ({ id: idDe(name), name, domain_id: "" })),
      });
    const id = u.pathname.split("/")[2]!;
    if (/^\/products\/MLB\d+$/.test(u.pathname))
      return Response.json({ id, name: nomes[Number(id.slice(3)) - 100] });
    return Response.json({
      results: [{ item_id: id.replace("MLB", "MLB9"), price: 59.9, condition: "new" }],
    });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchOriginal;
});

describe("brand off ML falls back to the same type (Weslei, 08/11)", () => {
  test("'insider camiseta': adult t-shirts with an honest notice", async () => {
    lida = { buscas: ["insider camiseta"], tipoProduto: "camiseta", marca: "insider" };
    const { resultados, intencao } = await buscaGuiada("insider camiseta", null);
    expect(resultados.map((r) => r.nome).sort()).toEqual([
      "Camiseta Básica Masculina 100% Algodão Pima",
      "Camiseta Hering Super Cotton Preta",
    ]);
    expect(intencao.ignorarMarca).toBe(true);
    expect(intencao.resumo).toContain("marca Insider");
  });

  test("same answer when the reading has no brand (preview / timeout)", async () => {
    lida = { buscas: ["insider camiseta"], tipoProduto: "insider" };
    const { resultados } = await buscaGuiada("insider camiseta", null);
    expect(resultados.length).toBe(2);
    expect(resultados.every((r) => r.nome.startsWith("Camiseta"))).toBe(true);
  });

  test("brand on ML: only that brand, no fallback", async () => {
    lida = { buscas: ["nike camiseta"], tipoProduto: "camiseta", marca: "nike" };
    const { resultados, intencao } = await buscaGuiada("nike camiseta", null);
    expect(resultados.map((r) => r.nome)).toEqual(["Camiseta Nike Dri-Fit Masculina"]);
    expect(intencao.ignorarMarca).toBeUndefined();
  });
});
