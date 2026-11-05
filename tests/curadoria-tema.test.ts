import { describe, expect, test } from "bun:test";
import { curarResultados } from "../src/lib/curadoria";

describe("busca temática", () => {
  test("luminária 3D Star Wars vem antes do chaveiro", () => {
    const r = curarResultados("star wars", ["Chaveiro Star Wars Darth", "Luminária Led 3D Star Wars Estrela da Morte 16 Cores"], (x) => x);
    expect(r[0]).toContain("Luminária");
  });
  test("quem pede caneca não tem a ordem mexida", () => {
    const r = curarResultados("caneca star wars", ["Caneca Star Wars Yoda", "Luminária Led 3D Star Wars Vader"], (x) => x);
    expect(r[0]).toContain("Caneca");
  });
});
