import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

/* Weslei, 26/11: "smart tv 50 4k" came back empty. ML answers 403
   PA_UNAUTHORIZED_RESULT_FROM_POLICIES on /products/{id}/items (checked live
   27/11), so every catalog product was dropped. They now come without a price
   (only "Comparar preço"), never with an invented one. */
const NOMES = [
  "Smart TV 50 Polegadas Samsung Crystal UHD 4K",
  "Smart TV LG 50 4K UHD ThinQ AI",
  "Suporte Articulado Para TV 32 a 75 Polegadas",
];
const idDe = (n: string) => `MLB${100 + NOMES.indexOf(n)}`;

mock.module("@/lib/cheaper-inference", () => ({
  perguntarAoLlm: async () => ({ ok: false, texto: "" }),
}));
const { buscaGuiada } = await import("@/lib/busca-guiada");
const { tipoDoProduto } = await import("@/lib/termo-busca");

const fetchOriginal = globalThis.fetch;
let leiturasItems = 0;
beforeAll(() => {
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = new URL(String(entrada));
    if (u.pathname.includes("domain_discovery")) return Response.json([]);
    if (u.pathname.startsWith("/highlights/")) return Response.json({ content: [] });
    if (u.pathname === "/products/search")
      return Response.json({
        results: NOMES.map((name) => ({
          id: idDe(name),
          name,
          domain_id: /suporte/i.test(name) ? "MLB-TV_MOUNTS" : "MLB-TELEVISIONS",
        })),
      });
    if (u.pathname.endsWith("/items")) {
      leiturasItems += 1;
      return Response.json(
        { status: 403, code: "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" },
        { status: 403 },
      );
    }
    const id = u.pathname.split("/")[2]!;
    return Response.json({ id, name: NOMES[Number(id.slice(3)) - 100] });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchOriginal;
});

describe("offers read refused by ML (27/11)", () => {
  test("'smart tv' reads the type as tv", () => {
    expect(tipoDoProduto("smart tv 50 4k")).toBe("tv");
    expect(tipoDoProduto("Smart TV LG 50 4K")).toBe("tv");
    expect(tipoDoProduto("smartwatch xiaomi")).toBe("smartwatch");
  });

  test("'smart tv 50 4k' shows the TVs without a price instead of nothing", async () => {
    const { resultados } = await buscaGuiada("smart tv 50 4k", null);
    const tvs = resultados.filter((r) => /smart tv/i.test(r.nome));
    expect(tvs.length).toBeGreaterThanOrEqual(2);
    for (const r of tvs) {
      expect(r.preco).toBeNull();
      expect(r.item).toBe("");
      expect(r.url).toMatch(/^https:\/\/www\.mercadolivre\.com\.br\/p\/MLB\d+$/);
    }
    expect(resultados.some((r) => /suporte/i.test(r.nome))).toBe(false);
    // The 403 stays memoized: each product's offers are asked at most once.
    expect(leiturasItems).toBeLessThanOrEqual(NOMES.length);
  });
});
