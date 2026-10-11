import { describe, expect, test } from "bun:test";

import { determinarCampeaoDoSegmento } from "@/lib/campeao-segmento";
import { nomeTemOTipo, termoDoProduto, tipoDoProduto } from "@/lib/termo-busca";

const campeao = (titulo: string, preco: number | null = null, categoria: string | null = null) =>
  determinarCampeaoDoSegmento({ titulo, preco, categoria }).player;

describe("campeão do segmento (links de lojas sem afiliação)", () => {
  test("livros e Kindle vão para a Amazon", () => {
    expect(campeao("Livro O Pequeno Príncipe - Capa Comum")).toBe("amazon");
    expect(campeao("Kindle 11ª Geração 16GB")).toBe("amazon");
  });

  test("mouse, teclado e Alexa da Magalu/KaBuM! vão para a Amazon", () => {
    expect(campeao("Mouse Gamer Logitech G203 Lightsync RGB", 129.9)).toBe("amazon");
    expect(campeao("Mouse sem fio Multilaser 1200dpi", 29.9)).toBe("amazon");
    expect(campeao("Echo Dot 5ª Geração Smart Speaker com Alexa")).toBe("amazon");
    expect(campeao("Teclado Mecânico Redragon Kumara")).toBe("amazon");
  });

  test("peça de carro, pneu e ferramenta pesada vão para o Mercado Livre", () => {
    expect(campeao("Kit Pastilha de Freio Dianteira Gol G5 Cobreq")).toBe("mercadolivre");
    expect(campeao("Pneu Aro 15 Pirelli Cinturato P1 185/60R15")).toBe("mercadolivre");
    expect(campeao("Amortecedor Traseiro Onix 2020")).toBe("mercadolivre");
    expect(campeao("Esmerilhadeira Angular Bosch GWS 850W")).toBe("mercadolivre");
  });

  test("linha branca, beleza e moda vão para o Mercado Livre", () => {
    expect(campeao("Geladeira Brastemp Frost Free 375L")).toBe("mercadolivre");
    expect(campeao("Máquina de Lavar Electrolux 12kg")).toBe("mercadolivre");
    expect(campeao("Perfume Malbec Eau de Toilette 100ml")).toBe("mercadolivre");
    expect(campeao("Base Líquida Ruby Rose Maquiagem", 19.9)).toBe("mercadolivre");
    expect(campeao("Tênis Adidas Run Falcon")).toBe("mercadolivre");
  });

  test("acessório barato, bijuteria e papelaria vão para a Shopee", () => {
    expect(campeao("Capinha Transparente Anti Impacto iPhone 13", 19.9)).toBe("shopee");
    expect(campeao("Capinha Transparente iPhone 13")).toBe("shopee");
    expect(campeao("Brinco Argola Folheado a Ouro", 12)).toBe("shopee");
    expect(campeao("Caderno Inteligente Fofo A5 Papelaria", 39.9)).toBe("shopee");
  });

  test("acessório caro sai da regra de preço baixo", () => {
    expect(campeao("Capa para iPhone 15 Pro MagSafe Couro Apple", 499)).not.toBe("shopee");
  });

  test("indeterminado vai para o Mercado Livre", () => {
    expect(campeao("Rede de Descanso Casal Algodão")).toBe("mercadolivre");
    expect(campeao("")).toBe("mercadolivre");
  });

  test("categoria lida na página também conta", () => {
    expect(campeao("Coleção completa volume 1", null, "Livros > Ficção")).toBe("amazon");
  });
});

describe("termo de busca do mesmo produto (bebedouro x fonte de Buda, 11/10)", () => {
  const bebedouro =
    "Fonte de Água para Gato Cachorro Bebedouro Automático Bivolt Silenciosa Frete Grátis Promoção";

  test("tira o ruído de venda e a voltagem", () => {
    const t = termoDoProduto(bebedouro, 12);
    expect(t).not.toMatch(/bivolt|frete|promo/i);
    expect(t).toMatch(/Bebedouro/);
  });

  test("tira código de rastreio e SKU, mantém o modelo", () => {
    expect(termoDoProduto("Mouse Logitech MK235 SKU: 99887766 BR123456789BR")).toBe(
      "Mouse Logitech MK235",
    );
  });

  test("tipo do produto e conferência pelo nome", () => {
    expect(tipoDoProduto("Bebedouro Fonte Pet Gato Automático")).toBe("bebedouro");
    expect(nomeTemOTipo("Bebedouro Fonte Gato 2L Filtro", "bebedouro")).toBe(true);
    expect(
      nomeTemOTipo("Fonte Água Cascata Relaxante Decorativa 3 Quedas Moinho Buda", "bebedouro"),
    ).toBe(false);
    expect(nomeTemOTipo("Kit 2 Bebedouros Automáticos", "bebedouro")).toBe(true);
  });
});
