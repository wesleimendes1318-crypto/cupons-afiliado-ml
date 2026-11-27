import assert from "node:assert/strict";
import test from "node:test";

import { textoRecomendacao } from "../src/lib/compartilhar-oferta";

test("recomendação traz o link de afiliado e a página do produto no site", () => {
  const t = textoRecomendacao({
    titulo: "Fone *Bluetooth*  JBL",
    preco: 199.9,
    link: "https://meli.la/1AbC",
    pagina: "MLB123456",
  });
  assert.match(t, /^🔥 \*Fone Bluetooth JBL\*\n/);
  assert.match(t, /R\$\s199,90/);
  assert.match(t, /👉 Comprar com segurança: https:\/\/meli\.la\/1AbC/);
  assert.match(t, /https:\/\/melhorescolha\.io\/produto\/MLB123456$/);
  assert.doesNotMatch(t, /frete|grátis|pix|desconto/i);
});

test("sem preço conhecido, a linha do preço some; sem página, vai a home", () => {
  const t = textoRecomendacao({ titulo: "X", preco: null, link: "https://amzn.to/abc", pagina: null });
  assert.doesNotMatch(t, /💰/);
  assert.match(t, /Melhor Escolha: https:\/\/melhorescolha\.io$/);
});
