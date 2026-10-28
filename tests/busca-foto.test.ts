import { describe, expect, test } from "bun:test";

import { bateComAFoto, type Identificacao } from "../src/lib/busca-foto";
import { foraDoModelo } from "../src/lib/busca-intencao";

const id = (marca: string | null, modelo: string | null): Identificacao => ({
  produto: "Nike TC 7900 Beige Navy",
  marca,
  modelo,
  categoria: "Calçados",
  textoLido: null,
  confianca: 90,
});

describe("bateComAFoto", () => {
  test("recusa produto sem a marca e o modelo da foto", () => {
    expect(bateComAFoto(id("Nike", "TC 7900"), "Kit Organizador de Calçados Para 6 Pares")).toBe(false);
    expect(bateComAFoto(id("Nike", "TC 7900"), "Tênis Nike Air Max")).toBe(false);
  });
  test("aceita o mesmo modelo escrito de outro jeito", () => {
    expect(bateComAFoto(id("Nike", "TC 7900"), "Tênis Nike Tc-7900 Feminino")).toBe(true);
  });
  test("sem marca nem modelo lidos, não filtra", () => {
    expect(bateComAFoto(id(null, null), "Qualquer coisa")).toBe(true);
  });
});

describe("foraDoModelo (busca por nome)", () => {
  test("outra marca ou modelo sai", () => {
    expect(foraDoModelo("Vans Old Skool Sem gênero Adultos", "Nike", "TC 7900")).toBe(true);
    expect(foraDoModelo("Tênis Nike TC 7900 Feminino", "Nike", "TC 7900")).toBe(false);
  });
  test("outra versão sai", () => {
    expect(foraDoModelo("Apple iPhone 15 Pro 128 GB", "Apple", "iPhone 15")).toBe(true);
    expect(foraDoModelo("Apple iPhone 15 128 GB Preto", "Apple", "iPhone 15")).toBe(false);
  });
  test("pedido genérico não filtra", () => {
    expect(foraDoModelo("Tênis de corrida Olympikus", null, null)).toBe(false);
  });
});
