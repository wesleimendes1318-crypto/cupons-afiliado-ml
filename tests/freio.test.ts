import { expect, test } from "bun:test";

import { criarFreio } from "../src/lib/freio";

test("freio: segura depois do máximo e solta quando a janela passa", () => {
  const freado = criarFreio(2, 1000);
  expect(freado("a", 0)).toBe(false);
  expect(freado("a", 10)).toBe(false);
  expect(freado("a", 20)).toBe(true);
  expect(freado("b", 20)).toBe(false);
  expect(freado("a", 1015)).toBe(false);
});
