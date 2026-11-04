import { describe, expect, test } from "bun:test";
import { vereditoDoPreco } from "@/lib/veredito-preco";

const serie = (...p: number[]) =>
  p.map((v, i) => ({ p: v, em: new Date(Date.UTC(2026, 9, 1 + i * 2)).toISOString() }));

describe("veredito do histórico", () => {
  test("série curta não opina", () => {
    expect(vereditoDoPreco(serie(100, 90), 90)).toBeNull();
    expect(vereditoDoPreco(serie(100, 90, 95, 92), null)).toBeNull();
  });
  test("menor preço", () => {
    expect(vereditoDoPreco(serie(120, 115, 118, 100), 100)?.tipo).toBe("menor");
  });
  test("acima da média", () => {
    const v = vereditoDoPreco(serie(100, 100, 102, 120), 120);
    expect(v?.tipo).toBe("alto");
    expect(v?.texto).toContain("%");
  });
  test("dentro da média", () => {
    expect(vereditoDoPreco(serie(100, 110, 95, 104), 104)?.tipo).toBe("media");
  });
  test("estável", () => {
    expect(vereditoDoPreco(serie(100, 100, 100, 100), 100)?.texto).toContain("estável");
  });
  test("alta antes do desconto", () => {
    expect(vereditoDoPreco(serie(100, 101, 99, 140, 100), 100)?.tipo).toBe("inflado");
  });
});

import { atalhosDoAlvo, lerReais } from "@/lib/veredito-preco";
test("atalhos e leitura do preço-alvo", () => {
  expect(atalhosDoAlvo(1000).map((a) => a.valor)).toEqual([950, 900, 850]);
  expect(atalhosDoAlvo(null)).toEqual([]);
  expect(lerReais("1.234,56")).toBe(1234.56);
  expect(lerReais("R$ 950")).toBe(950);
  expect(lerReais("1.299")).toBe(1299);
  expect(lerReais("99,9")).toBe(99.9);
  expect(lerReais("")).toBeNull();
});
