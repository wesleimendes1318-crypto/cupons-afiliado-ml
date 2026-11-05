import { describe, expect, test } from "bun:test";

import { achadoDoGarimpo, linhasDoAcervo, resultadoDoAcervo, tituloCombina } from "../src/lib/acervo";

const base = { produto: "MLB123", item: "MLB456", nome: "Tênis Feminino", imagem: null, preco: 90, url: "https://www.mercadolivre.com.br/p/MLB123", freteGratis: true };

describe("acervo", () => {
  test("keeps only listings with ids, price and a shipping answer", () => {
    const linhas = linhasDoAcervo("Tênis Feminino", [
      base,
      { ...base, produto: "x" },
      { ...base, produto: "MLB9", preco: null },
      { ...base, produto: "MLB8", freteGratis: null },
    ] as never);
    expect(linhas.map((l) => l.produto)).toEqual(["MLB123"]);
    expect(linhas[0]!.termos).toEqual(["tenis feminino"]);
    expect(resultadoDoAcervo(linhas[0]!).preco).toBe(90);
  });

  test("title must hold every meaningful word of the term", () => {
    expect(tituloCombina("tênis feminino", "Tenis Casual Feminino Branco")).toBe(true);
    expect(tituloCombina("tênis feminino", "Sandália Feminina")).toBe(false);
  });

  test("garimpo find uses the price of the listing the link opens", () => {
    const url = "https://www.mercadolivre.com.br/p/MLB123?pdp_filters=item_id%3AMLB456";
    const r = achadoDoGarimpo({ titulo: "Tênis", imagem: null, preco: "99.9", url_produto: url, frete_gratis: true });
    expect(r?.preco).toBe(99.9);
    expect(r?.url).toBe(url);
    expect(achadoDoGarimpo({ titulo: "Tênis", imagem: null, preco: 99, url_produto: url, frete_gratis: false })).toBeNull();
    expect(achadoDoGarimpo({ titulo: "Tênis", imagem: null, preco: 99, url_produto: "https://x/p/MLB1", frete_gratis: true })).toBeNull();
  });
});
