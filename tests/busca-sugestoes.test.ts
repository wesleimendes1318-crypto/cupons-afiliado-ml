import { describe, expect, test } from "bun:test";

import { analisarLink } from "@/lib/analisar-link";
import { obterSugestoes, ordenarPelaIntencao, type ProdutoConhecido } from "@/lib/busca-sugestoes";

const p = (titulo: string, preco = 100): ProdutoConhecido => ({
  titulo,
  preco,
  imagem: null,
  url: `https://www.mercadolivre.com.br/p/MLB${titulo.length}${preco}`,
});

const PRODUTOS = [
  p("Echo Pop Smart Speaker Alexa Preto", 299),
  p("Echo Dot 3ª Geração Alexa", 249),
  p("Echo Dot 5ª Geração Com Relógio Alexa", 399),
  p("Capinha Silicone Para iPhone 15", 29),
  p("Carcaça Tampa Traseira iPhone 15 Preto", 89),
  p("Apple iPhone 15 128 Gb Preto", 4999),
  p("Fritadeira Air Fryer Mondial 4l Preta", 349),
];

describe("sugestões enquanto digita", () => {
  test("menos de 2 caracteres não dispara", () => {
    expect(obterSugestoes("", { produtos: PRODUTOS })).toEqual([]);
    expect(obterSugestoes("e", { produtos: PRODUTOS })).toEqual([]);
    expect(obterSugestoes(" a ", { produtos: PRODUTOS })).toEqual([]);
  });

  test("marca e modelo exatos: Echo Dot 5ª na frente, sem Echo Pop nem Echo Dot 3ª", () => {
    const s = obterSugestoes("echo dot 5", { produtos: PRODUTOS });
    const produtos = s.filter((x) => x.tipo === "produto").map((x) => x.texto);
    expect(produtos[0]).toBe("Echo Dot 5ª Geração Com Relógio Alexa");
    expect(produtos).not.toContain("Echo Pop Smart Speaker Alexa Preto");
    expect(produtos).not.toContain("Echo Dot 3ª Geração Alexa");
  });

  test("peça e acessório não entram quando a busca é o aparelho", () => {
    const produtos = obterSugestoes("iphone 15", { produtos: PRODUTOS })
      .filter((x) => x.tipo === "produto")
      .map((x) => x.texto);
    expect(produtos).toEqual(["Apple iPhone 15 128 Gb Preto"]);
  });

  test("busca pela peça mostra a peça", () => {
    const produtos = obterSugestoes("capinha iphone", { produtos: PRODUTOS })
      .filter((x) => x.tipo === "produto")
      .map((x) => x.texto);
    expect(produtos).toContain("Capinha Silicone Para iPhone 15");
  });

  test("categoria pelo começo do nome e busca sugerida que completa", () => {
    const s = obterSugestoes("eletrodom");
    expect(s.some((x) => x.tipo === "categoria" && x.texto === "Eletrodomésticos")).toBe(true);
    const t = obterSugestoes("air fr", { produtos: PRODUTOS }).find((x) => x.tipo === "termo");
    expect(t?.texto.toLowerCase()).toContain("air fryer");
  });

  test("histórico do aparelho entra como recente", () => {
    const s = obterSugestoes("mondial", {
      recentes: [{ titulo: "Air Fryer Mondial 4l", url: "https://meli.la/abc", imagem: null }],
    });
    expect(s[0]).toMatchObject({ tipo: "recente", url: "https://meli.la/abc" });
  });

  test("link colado não vira sugestão", () => {
    expect(
      obterSugestoes("https://www.amazon.com.br/dp/B09B8V1LZ3", { produtos: PRODUTOS }),
    ).toEqual([]);
  });
});

describe("ordem da busca pela intenção", () => {
  test("modelo exato primeiro e peça fora", () => {
    const r = ordenarPelaIntencao(
      "Echo Dot 5ª Geração",
      ["Echo Pop", "Echo Dot 3ª Geração", "Carcaça Echo Dot 5", "Echo Dot 5ª Geração Relógio"],
      (x) => x,
    );
    expect(r[0]).toBe("Echo Dot 5ª Geração Relógio");
    expect(r).not.toContain("Carcaça Echo Dot 5");
  });
});

describe("identificação imediata do link (sem rede)", () => {
  test("Mercado Livre, Amazon e Shopee pelo endereço", () => {
    expect(analisarLink("https://produto.mercadolivre.com.br/MLB-123456789-fone").origem).toBe(
      "mercadolivre",
    );
    expect(analisarLink("https://meli.la/1AbCdE").origem).toBe("mercadolivre");
    expect(analisarLink("https://www.amazon.com.br/dp/B09B8V1LZ3").origem).toBe("amazon");
    expect(analisarLink("https://amzn.to/3xYz").origem).toBe("amazon");
    expect(analisarLink("https://shopee.com.br/produto-i.123.456").origem).toBe("shopee");
    expect(analisarLink("https://shope.ee/abc").origem).toBe("shopee");
    expect(analisarLink("air fryer mondial").origem).toBe("invalido");
  });
});
