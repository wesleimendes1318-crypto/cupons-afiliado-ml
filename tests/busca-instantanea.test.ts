import { afterAll, beforeAll, expect, mock, test } from "bun:test";

/* Instant stage (08/11): own stock only, no ML read, same shields. */
let linhas: Array<Record<string, unknown>> | null = null;
const consulta = () => {
  const q: Record<string, unknown> = {};
  for (const m of [
    "select",
    "gte",
    "lte",
    "not",
    "in",
    "or",
    "order",
    "ilike",
    "limit",
    "eq",
    "contains",
  ])
    q[m] = () => q;
  q.then = (ok: (v: unknown) => void, falha: (e: unknown) => void) =>
    linhas ? ok({ data: linhas }) : falha(new Error("sem banco"));
  return q;
};
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: consulta, rpc: async () => ({ data: null }) },
}));
const { buscaGuiada } = await import("@/lib/busca-guiada");
const { extrairIntencaoRapida } = await import("@/lib/busca-intencao");

const linha = (n: number, nome: string, preco: number) => ({
  produto: `MLB10${n}`,
  item: `MLB20${n}`,
  nome,
  imagem: `https://http2.mlstatic.com/D_${n}-O.jpg`,
  preco,
  url: null,
  frete_gratis: true,
  loja_oficial: false,
  dominio_ml: null,
});

const fetchOriginal = globalThis.fetch;
let leiturasML = 0;
beforeAll(() => {
  globalThis.fetch = (async () => {
    leiturasML += 1;
    throw new Error("no ML read in the instant stage");
  }) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchOriginal;
  linhas = null;
});

test("instant stage: own stock, model and ecosystem locks, no ML read", async () => {
  linhas = [
    linha(1, "Capa Anti Impacto Compatível Galaxy S24 Ultra Samsung", 39),
    linha(2, "Capa Magsafe Transparente Para iPhone 17 Pro Max", 49),
    linha(3, "Capa Silicone Para iPhone 16 Pro Max", 29),
  ];
  const q = "capinha iphone 17 pro max";
  const r = await buscaGuiada(q, null, 0, extrairIntencaoRapida(q), { instantaneo: true });
  linhas = null;
  expect(leiturasML).toBe(0);
  expect(r.resultados.map((x) => x.nome)).toEqual([
    "Capa Magsafe Transparente Para iPhone 17 Pro Max",
  ]);
});

test("instant stage: appliance floor keeps parts out", async () => {
  linhas = [
    linha(4, "Pé Nivelador De Borracha Para Lava E Seca", 35),
    linha(5, "Lava E Seca Samsung 11kg Inox 220v", 2899),
  ];
  const q = "lava e seca 11kg";
  const r = await buscaGuiada(q, null, 0, extrairIntencaoRapida(q), { instantaneo: true });
  linhas = null;
  expect(leiturasML).toBe(0);
  expect(r.resultados.map((x) => x.nome)).toEqual(["Lava E Seca Samsung 11kg Inox 220v"]);
});

test("instant stage: database down returns empty, never throws", async () => {
  const q = "fone bluetooth";
  const r = await buscaGuiada(q, null, 0, extrairIntencaoRapida(q), { instantaneo: true });
  expect(r.resultados).toEqual([]);
});

test("viral title cleaning drops sales words, keeps the product", async () => {
  const { termoDeBuscaExterna } = await import("@/lib/termo-busca-externa");
  const limpo = termoDeBuscaExterna(
    "Super Oferta Relâmpago 10pcs Prato Formato Torrada Frete Grátis",
  );
  expect(limpo).not.toMatch(/frete|oferta|rel[aâ]mpago/i);
  expect(limpo).toContain("Prato Formato Torrada");
});
