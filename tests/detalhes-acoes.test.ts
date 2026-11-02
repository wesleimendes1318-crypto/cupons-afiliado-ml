import assert from "node:assert/strict";
import test from "node:test";

import { acoesDoProduto } from "../src/lib/afiliado";

test("link de afiliado pronto vira o Comprar; o produto vai para o comparador", () => {
  const r = acoesDoProduto("https://meli.la/1AbC", "https://www.mercadolivre.com.br/x/p/MLB123");
  assert.deepEqual(r.comprar, { href: "https://meli.la/1AbC" });
  assert.equal(r.comparar, "https://www.mercadolivre.com.br/x/p/MLB123");
});

test("sem link pronto, o endereço do Mercado Livre gera o link no clique", () => {
  const r = acoesDoProduto(null, "https://produto.mercadolivre.com.br/MLB-123456789-capa");
  assert.deepEqual(r.comprar, { gerar: "https://produto.mercadolivre.com.br/MLB-123456789-capa" });
  assert.equal(r.comparar, "https://produto.mercadolivre.com.br/MLB-123456789-capa");
});

test("endereço de catálogo relativo vira absoluto", () => {
  const r = acoesDoProduto(null, "/p/MLB999");
  assert.deepEqual(r.comprar, { gerar: "https://www.mercadolivre.com.br/p/MLB999" });
});

test("Amazon sem tag ganha a tag do Weslei", () => {
  const r = acoesDoProduto(null, "https://www.amazon.com.br/Capa/dp/B0ABCDEFGH?tag=outro-20");
  assert.deepEqual(r.comprar, {
    href: "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
  });
});

test("link de outra loja não vira compra, mas ainda compara", () => {
  const r = acoesDoProduto("https://www.magazineluiza.com.br/x", null);
  assert.equal(r.comprar, null);
  assert.equal(r.comparar, "https://www.magazineluiza.com.br/x");
  assert.deepEqual(acoesDoProduto(null, null), { comprar: null, comparar: null });
});
