import { test } from "node:test";
import assert from "node:assert/strict";

import { itensSemLink, semRecusados } from "../src/lib/anuncios-recusados";

/* Pedido 1000040 (18/10): a oferta de R$ 400 era de vendedor com reputação
   vermelha e não tinha link de afiliado possível. */
const analise = {
  outrasLojas: [{ item: "MLB5028272297", link: "https://meli.la/1BPdGMu" }],
  referencias: [
    { url: "https://www.mercadolivre.com.br/p/MLB19493953?pdp_filters=item_id%3AMLB5321570461" },
    { url: "https://www.mercadolivre.com.br/p/MLB19493953?pdp_filters=item_id%3AMLB5028272297" },
  ],
  parecidos: [{ url: "https://produto.mercadolivre.com.br/MLB-4186106864", link: null }],
};

test("só pergunta pelos anúncios que dependem do link no clique", () => {
  assert.deepEqual(itensSemLink(analise).sort(), [
    "MLB4186106864",
    "MLB5028272297",
    "MLB5321570461",
  ]);
});

test("anúncio recusado sem link vira semAfiliado; com link próprio fica", () => {
  const r = semRecusados(analise, new Set(["MLB5321570461", "MLB5028272297"]));
  assert.equal(r.referencias?.[0]?.semAfiliado, true);
  assert.equal(r.referencias?.[1]?.semAfiliado, true);
  assert.equal(r.outrasLojas?.[0]?.semAfiliado, undefined);
  assert.equal(r.parecidos?.[0]?.semAfiliado, undefined);
  assert.equal(semRecusados(analise, new Set()), analise);
});
