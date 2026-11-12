import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

/* Weslei, 11/11/2026: "melhoria em todos os caminhos de buscas". Typo
   tolerance, hybrid own-stock ranking and the precision shields together. */
let linhas: Array<Record<string, unknown>> = [];
let hibrido: Array<Record<string, unknown>> | null = null;
let pedidoHibrido: Record<string, unknown> | null = null;
const consulta = () => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "gte", "lte", "not", "in", "or", "order", "ilike", "limit", "eq", "contains"])
    q[m] = () => q;
  q.then = (ok: (v: unknown) => void) => ok({ data: linhas });
  return q;
};
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: consulta,
    rpc: async (f: string, a: Record<string, unknown>) => {
      if (f !== "buscar_estoque_hibrido") return { data: null };
      pedidoHibrido = a;
      return hibrido ? { data: hibrido, error: null } : { data: null, error: { message: "missing" } };
    },
  },
}));
const { buscaGuiada } = await import("@/lib/busca-guiada");
const { corrigirBusca, extrairIntencaoRapida, foraDaIntencao, pisoDoAparelho } = await import(
  "@/lib/busca-intencao"
);
const { distanciaDeEdicao } = await import("@/lib/corretor-busca");

const linha = (n: number, nome: string, preco: number, origem = "estoque") => ({
  produto: `MLB30${n}`,
  item: `MLB40${n}`,
  nome,
  imagem: `https://http2.mlstatic.com/D_${n}-O.jpg`,
  preco,
  url: null,
  frete_gratis: true,
  loja_oficial: false,
  dominio_ml: null,
  origem,
});

const fetchOriginal = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async () => {
    throw new Error("no ML read in the instant stage");
  }) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchOriginal;
});

const fora = (nome: string, q: string) => foraDaIntencao(nome, extrairIntencaoRapida(q), q);

describe("typo tolerance", () => {
  test("mistyped type or brand becomes the real word", () => {
    expect(corrigirBusca("air fayer mondial")).toBe("air fryer mondial");
    expect(corrigirBusca("camisteta insider")).toBe("camiseta insider");
    expect(corrigirBusca("geladera brastemp")).toBe("geladeira brastemp");
    expect(corrigirBusca("mondail air fryer")).toBe("mondial air fryer");
    expect(corrigirBusca("samsumg galaxy s24")).toBe("samsung galaxy s24");
    expect(corrigirBusca("celuar motorola")).toBe("celular motorola");
  });

  test("right words, brands, models and sizes are never changed", () => {
    for (const q of [
      "Insider camiseta",
      "capinha iPhone 17 pro Max",
      "corpo dourado",
      "bola de futebol",
      "frigideira antiaderente",
      "projetor",
      "caneta",
      "caixa organizadora",
      "Jaqueta Corta-Vento",
      "kit relação riffel z750",
      "tv 55 polegadas",
      "ar condicionado barato",
      "esmalte",
    ])
      expect(corrigirBusca(q)).toBe(q);
  });

  test("swap of two letters counts as one edit", () => {
    expect(distanciaDeEdicao("mondail", "mondial")).toBe(1);
    expect(distanciaDeEdicao("fayer", "fryer")).toBe(1);
  });

  test("shields read the corrected phrase: Mondial air fryer in, other brand out", () => {
    expect(fora("Fritadeira Elétrica Air Fryer Mondial 4L Preta", "air fayer mondial")).toBe(false);
    expect(fora("Fritadeira Air Fryer Philco 4L", "air fayer mondial")).toBe(true);
  });
});

describe("hybrid own stock (database ranking)", () => {
  test("phrase-ranked rows come first and still pass every shield", async () => {
    linhas = [linha(9, "Air Fryer Mondial Oven 12L Inox", 549)];
    hibrido = [
      linha(2, "Fritadeira Air Fryer Philco 4L", 259),
      linha(1, "Fritadeira Elétrica Air Fryer Mondial 4L Preta", 299, "acervo"),
    ];
    const q = "air fayer mondial";
    const r = await buscaGuiada(q, null, 0, extrairIntencaoRapida(q), { instantaneo: true });
    hibrido = null;
    expect(pedidoHibrido?.p_termo).toBe("air fryer mondial");
    expect(r.resultados.map((x) => x.nome)).toEqual([
      "Fritadeira Elétrica Air Fryer Mondial 4L Preta",
      "Air Fryer Mondial Oven 12L Inox",
    ]);
  });

  test("database without the function: the regular stock read still answers", async () => {
    linhas = [linha(8, "Camiseta Hering Básica Masculina Algodão", 49)];
    hibrido = null;
    const q = "camiseta hering";
    const r = await buscaGuiada(q, null, 0, extrairIntencaoRapida(q), { instantaneo: true });
    expect(r.resultados.map((x) => x.nome)).toEqual(["Camiseta Hering Básica Masculina Algodão"]);
  });
});

describe("precision shields", () => {
  test("Insider camiseta: kids, fitness sets and card games stay out", () => {
    const q = "Insider camiseta";
    expect(fora("Conjunto Infantil Escolar Frio Blusa Moletom", q)).toBe(true);
    expect(fora("Conjunto Roupa Fitness Paris SOMAMI", q)).toBe(true);
    expect(fora("Jogo Uno Para Revender Atacado", q)).toBe(true);
    expect(fora("Camiseta Insider Tech T-Shirt Preta", q)).toBe(false);
  });

  test("capinha iPhone 17 Pro Max: base iPhone 17 and 17 Pro are rejected", () => {
    const q = "capinha iPhone 17 pro Max";
    expect(fora("Capa iPhone para iPhone 17 Tinto", q)).toBe(true);
    expect(fora("Capinha Silicone iPhone 17 Pro Preta", q)).toBe(true);
    expect(fora("Capinha Magsafe Transparente iPhone 17 Pro Max", q)).toBe(false);
  });

  test("lava e seca Brastemp: real appliance floor and no replacement parts", () => {
    const q = "lava e seca brastemp";
    expect(pisoDoAparelho(q)).toBe(1200);
    expect(fora("Lava e Seca Brastemp 11kg Inox BNQ11AR", q)).toBe(false);
    expect(fora("Placa Eletrônica Lava e Seca Brastemp", q)).toBe(true);
  });
});
