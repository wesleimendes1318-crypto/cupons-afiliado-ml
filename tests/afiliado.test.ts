import assert from "node:assert/strict";
import test from "node:test";

import {
  ehLinkDeAfiliado,
  ehLinkDeAfiliadoAmazon,
  ehLinkDeAfiliadoShopee,
  ehLinkDeCompra,
  gerarUrlAfiliadoAmazon,
  urlBuscaAmazon,
  marketplaceDoLink,
} from "../src/lib/afiliado";

test("trava do Mercado Livre continua só meli.la", () => {
  assert.equal(ehLinkDeAfiliado("https://meli.la/1AbC"), true);
  assert.equal(
    ehLinkDeAfiliado("https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20"),
    false,
  );
  assert.equal(ehLinkDeCompra("https://amzn.to/3xYz", "mercadolivre"), false);
});

test("Amazon: só com a tag do Weslei ou amzn.to", () => {
  assert.equal(
    ehLinkDeAfiliadoAmazon("https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20"),
    true,
  );
  assert.equal(
    ehLinkDeAfiliadoAmazon("https://amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20&th=1"),
    true,
  );
  assert.equal(ehLinkDeAfiliadoAmazon("https://amzn.to/3xYzAbc"), true);
  assert.equal(
    ehLinkDeAfiliadoAmazon("https://www.amazon.com.br/dp/B0ABCDEFGH?tag=outro-20"),
    false,
  );
  assert.equal(ehLinkDeAfiliadoAmazon("https://www.amazon.com.br/dp/B0ABCDEFGH"), false);
  assert.equal(
    ehLinkDeAfiliadoAmazon(
      "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20&tag=outro-20",
    ),
    false,
  );
  assert.equal(
    ehLinkDeAfiliadoAmazon("http://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20"),
    false,
  );
  assert.equal(
    ehLinkDeAfiliadoAmazon("https://www.amazon.com/dp/B0ABCDEFGH?tag=melhoresc0fff-20"),
    false,
  );
  assert.equal(
    ehLinkDeAfiliadoAmazon("https://amazon.com.br.golpe.com/dp/B0ABCDEFGH?tag=melhoresc0fff-20"),
    false,
  );
});

test("Shopee: só o encurtado do programa", () => {
  assert.equal(ehLinkDeAfiliadoShopee("https://s.shopee.com.br/AbC123"), true);
  assert.equal(ehLinkDeAfiliadoShopee("https://shope.ee/AbC123"), true);
  assert.equal(ehLinkDeAfiliadoShopee("https://shopee.com.br/produto-i.1.2"), false);
});

test("marketplace pelo link", () => {
  assert.equal(marketplaceDoLink("https://meli.la/1AbC"), "mercadolivre");
  assert.equal(marketplaceDoLink("https://amzn.to/3xYz"), "amazon");
  assert.equal(marketplaceDoLink("https://s.shopee.com.br/AbC"), "shopee");
  assert.equal(marketplaceDoLink("https://exemplo.com/x"), null);
});

test("gera link da Amazon limpo com a tag", () => {
  assert.equal(
    gerarUrlAfiliadoAmazon(
      "https://www.amazon.com.br/Fone-JBL/dp/b0abcdefgh/ref=sr_1_1?crid=X&tag=outro-20",
    ),
    "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
  );
  assert.equal(
    gerarUrlAfiliadoAmazon("https://www.amazon.com.br/gp/product/B0ABCDEFGH"),
    "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
  );
  assert.equal(gerarUrlAfiliadoAmazon("https://www.amazon.com.br/s?k=fone"), null);
  assert.equal(gerarUrlAfiliadoAmazon("https://www.amazon.com/dp/B0ABCDEFGH"), null);
  const gerado = gerarUrlAfiliadoAmazon("https://amazon.com.br/dp/B0ABCDEFGH");
  assert.equal(ehLinkDeAfiliadoAmazon(gerado), true);
});

test("Amazon: ASIN puro e termo de busca com a tag (Conferir na Amazon)", () => {
  assert.equal(
    gerarUrlAfiliadoAmazon("B0ABCDEFGH"),
    "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
  );
  assert.equal(
    gerarUrlAfiliadoAmazon("b0abcdefgh"),
    "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
  );
  const busca = gerarUrlAfiliadoAmazon("Fone JBL Tune 520BT");
  assert.equal(
    busca,
    "https://www.amazon.com.br/s?k=Fone%20JBL%20Tune%20520BT&tag=melhoresc0fff-20",
  );
  assert.equal(ehLinkDeAfiliadoAmazon(busca), true);
  assert.equal(
    urlBuscaAmazon("  a&b=c  "),
    "https://www.amazon.com.br/s?k=a%26b%3Dc&tag=melhoresc0fff-20",
  );
  assert.equal(ehLinkDeAfiliadoAmazon(urlBuscaAmazon("tag=outro-20")), true);
  assert.equal(urlBuscaAmazon("   "), null);
  assert.equal(gerarUrlAfiliadoAmazon(""), null);
  assert.equal(gerarUrlAfiliadoAmazon("amazon.com.br/dp/B0ABCDEFGH"), null);
  assert.equal(gerarUrlAfiliadoAmazon("https://golpe.com/dp/B0ABCDEFGH"), null);
});
