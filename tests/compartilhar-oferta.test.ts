import assert from "node:assert/strict";
import test from "node:test";

import { textoRecomendacao } from "../src/lib/compartilhar-oferta";

test("recomendação traz o link de afiliado e a página do produto no site", () => {
  const t = textoRecomendacao({
    titulo: "Fone *Bluetooth*  JBL",
    preco: 199.9,
    vistoEm: new Date(Date.now() - 3600_000).toISOString(),
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

test("preço lido há mais de 12 h ou sem data não entra na mensagem", () => {
  const base = { titulo: "X", preco: 50, link: "https://meli.la/1AbC", pagina: "MLB1" };
  const velho = new Date(Date.now() - 13 * 3600_000).toISOString();
  assert.doesNotMatch(textoRecomendacao({ ...base, vistoEm: velho }), /💰/);
  assert.doesNotMatch(textoRecomendacao({ ...base, vistoEm: null }), /💰/);
  assert.doesNotMatch(textoRecomendacao(base), /💰/);
});
