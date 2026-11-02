import { describe, expect, test } from "bun:test";
import { acessorioDoPedido, comAcessorio, foraDaIntencao } from "@/lib/busca-intencao";

describe("acessório x aparelho (02/11)", () => {
  test("capinha do iPhone é a capinha, o iPhone só filtra", () => {
    const i = comAcessorio(
      {
        buscas: ["iPhone 17 Pro Max"],
        tipoProduto: "iphone",
        marca: "Apple",
        modelo: "iPhone 17 Pro Max",
      },
      "Capinha masculina iPhone 17 pro max",
    );
    expect(i.tipoProduto).toBe("capinha");
    expect(i.buscas).toEqual(["capinha iPhone 17 Pro Max"]);
    expect(i.marca).toBeNull();
    expect(
      foraDaIntencao(
        "Capinha Case Anti Impacto Para iPhone 17 Pro Max",
        i,
        "capinha iphone 17 pro max",
      ),
    ).toBe(false);
    expect(
      foraDaIntencao("Capinha Case Para iPhone 16 Pro Max", i, "capinha iphone 17 pro max"),
    ).toBe(true);
  });
  test("película, carregador e fone", () => {
    expect(acessorioDoPedido("Película de vidro Galaxy S24")).toBe("pelicula");
    expect(acessorioDoPedido("carregador turbo samsung")).toBe("carregador");
    expect(acessorioDoPedido("fone bluetooth jbl")).toBe("fone");
  });
  test("aparelho com acessório junto continua sendo o aparelho", () => {
    expect(acessorioDoPedido("iPhone 15 com carregador")).toBeNull();
    expect(acessorioDoPedido("geladeira frost free")).toBeNull();
    const i = { buscas: ["geladeira frost free"], tipoProduto: "geladeira" };
    expect(comAcessorio(i, "geladeira frost free")).toBe(i);
  });
});

import { extrairIntencaoRapida, faixaDePreco } from "@/lib/busca-intencao";

describe("extrairIntencaoRapida (02/11)", () => {
  test("capinha: o acessório é o produto, sinônimo na 2ª busca", () => {
    const i = extrairIntencaoRapida("Capinha iPhone 17 Pro Max");
    expect(i.tipoProduto).toBe("capinha");
    expect(i.buscas).toEqual(["capinha iphone 17 pro max", "capa iphone 17 pro max"]);
  });
  test("faixa de preço", () => {
    expect(faixaDePreco("fone bluetooth até R$ 100")).toMatchObject({ min: null, max: 100 });
    expect(faixaDePreco("air fryer menos de 300 reais")).toMatchObject({ max: 300 });
    expect(faixaDePreco("tenis entre 150 e 300")).toMatchObject({ min: 150, max: 300 });
    expect(faixaDePreco("monitor a partir de 800")).toMatchObject({ min: 800, max: null });
    const i = extrairIntencaoRapida("fone bluetooth até R$ 100");
    expect(i).toMatchObject({ precoMax: 100, tipoProduto: "fone", buscas: ["fone bluetooth"] });
  });
  test("sem acessório nem preço: a frase é a busca", () => {
    const i = extrairIntencaoRapida("geladeira frost free");
    expect(i.buscas).toEqual(["geladeira frost free"]);
    expect(i.precoMax).toBeNull();
  });
});
