import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

/* Weslei, 02/11 depois de publicar: "maquina lava e seca barata" voltou só
   1 máquina, e cara. O catálogo do ML para "lava e seca" é quase só peça,
   móvel e lava-louças (conferido no em alta do site); as máquinas reais
   vêm pela marca e pelos mais vendidos da categoria. */
type Produto = { id: string; name: string; domain_id: string };
const CATALOGO: Record<string, Produto[]> = {
  "lava e seca": [
    {
      id: "MLB1",
      name: "Nicho Decorativo para Máquina Lava e Seca 91x69x64cm",
      domain_id: "MLB-DECORATIVE_PAINTINGS",
    },
    {
      id: "MLB2",
      name: "Lava-louça Electrolux 8 Serviços Lava E Seca 50 Min",
      domain_id: "MLB-DISHWASHERS",
    },
    { id: "MLB3", name: "Mop Lava E Seca Condor", domain_id: "MLB-CLEANING_MOPS" },
    {
      id: "MLB4",
      name: "Balcão Torre Para Embutir Lava E Seca Mdf",
      domain_id: "MLB-WASHING_MACHINES",
    },
    {
      id: "MLB5",
      name: "Máquina Lava e Seca Akibra 3kg Automática Motorhome",
      domain_id: "MLB-WASHING_MACHINES",
    },
    {
      id: "MLB6",
      name: "Módulo Inversor IKCM20L60GA para Lava e Seca",
      domain_id: "MLB-WASHING_MACHINES",
    },
  ],
  "lava e seca samsung": [
    {
      id: "MLB7",
      name: "Amortecedor Cesto Traseiro Lava E Seca Samsung",
      domain_id: "MLB-WASHING_MACHINE_SHOCK_ABSORBERS",
    },
    {
      id: "MLB8",
      name: "Lava e Seca Samsung WD11A 11kg Inox Look",
      domain_id: "MLB-WASHING_MACHINES",
    },
  ],
  "lava e seca lg": [
    { id: "MLB9", name: "Lavadora e Secadora LG VC4 11kg Inox", domain_id: "MLB-LAUNDRY_CENTERS" },
    {
      id: "MLB10",
      name: "Placa Display Interface Lava E Seca LG",
      domain_id: "MLB-WASHING_MACHINES",
    },
  ],
};
const DESTAQUES: Record<string, string[]> = { MLB21168: ["MLB11", "MLB12", "MLB13"] };
const FICHAS: Record<string, string> = {
  MLB11: "Lava e Seca Midea HealthGuard 11kg LSE11",
  MLB12: "Lava e Seca Electrolux 11kg Perfect Care",
  MLB13: "Placa Eletrônica Maquina Lava E Seca Midea",
};
const PRECO: Record<string, number> = {
  MLB4: 1345,
  MLB5: 3999.99,
  MLB6: 119,
  MLB8: 2799,
  MLB9: 3199,
  MLB10: 945,
  MLB11: 2299,
  MLB12: 2599,
  MLB13: 479,
};

mock.module("@/lib/cheaper-inference", () => ({
  perguntarAoLlm: async () => ({
    ok: true,
    texto: JSON.stringify({ buscas: ["maquina lava e seca"], tipoProduto: "maquina", resumo: "" }),
  }),
}));
const { buscaGuiada, ordenarPorPrecoSeBarato } = await import("@/lib/busca-guiada");

const fetchOriginal = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = new URL(String(entrada));
    const q = u.searchParams.get("q") ?? "";
    if (u.pathname.includes("domain_discovery")) return Response.json([]);
    if (u.pathname.startsWith("/highlights/MLB/category/"))
      return Response.json({
        content: (DESTAQUES[u.pathname.split("/").pop()!] ?? []).map((id) => ({
          id,
          type: "PRODUCT",
        })),
      });
    if (u.pathname === "/products/search") return Response.json({ results: CATALOGO[q] ?? [] });
    const id = u.pathname.split("/")[2]!;
    if (/^\/products\/MLB\d+$/.test(u.pathname)) return Response.json({ id, name: FICHAS[id] });
    return Response.json({
      results: [{ item_id: id.replace("MLB", "MLB9"), price: PRECO[id] ?? 50, condition: "new" }],
    });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchOriginal;
});

describe("lava e seca barata: várias máquinas reais, da mais barata", () => {
  test("só máquinas completas, em ordem de preço", async () => {
    const { resultados, intencao } = await buscaGuiada("maquina lava e seca barata", null);
    expect(resultados.map((r) => [r.nome, r.preco])).toEqual([
      ["Lava e Seca Midea HealthGuard 11kg LSE11", 2299],
      ["Lava e Seca Electrolux 11kg Perfect Care", 2599],
      ["Lava e Seca Samsung WD11A 11kg Inox Look", 2799],
      ["Lavadora e Secadora LG VC4 11kg Inox", 3199],
      ["Máquina Lava e Seca Akibra 3kg Automática Motorhome", 3999.99],
    ]);
    expect(intencao.buscas).toContain("lava e seca samsung");
  });
  test("sem 'barata' a ordem do catálogo fica", () => {
    const itens = [{ preco: 3 }, { preco: 1 }, { preco: null }];
    expect(ordenarPorPrecoSeBarato("lava e seca", itens)).toBe(itens);
    expect(ordenarPorPrecoSeBarato("lava e seca em conta", itens).map((i) => i.preco)).toEqual([
      1,
      3,
      null,
    ]);
  });
});
