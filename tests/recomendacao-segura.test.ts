import { test } from "node:test";
import assert from "node:assert/strict";

import { decisaoDaTela, opcoesDaAnalise } from "../src/lib/ajudar-escolher";
import { custosDoMesmoProduto } from "../src/lib/preco-suspeito";
import { seguraParaRecomendar } from "../src/lib/recomendacao-segura";

/* Pedido 1000048 (18/10): ar-condicionado R$ 1.199 contra R$ 2.250 a
   R$ 4.800 nas outras lojas (mediana R$ 2.549). */
const precos = [2549, 1199, 2250, 2459, 2549, 2799, 4800];

test("preço muito abaixo sem o link de afiliado não vira recomendação", () => {
  assert.equal(
    seguraParaRecomendar(
      { preco: 1199, link: null, avaliacoes: { nota: 4.9, total: 2713 } },
      precos,
    ),
    false,
  );
});

test("preço muito abaixo com link e boa avaliação pode ser recomendado", () => {
  assert.equal(
    seguraParaRecomendar(
      { preco: 1199, link: "https://meli.la/1AbCd2E", avaliacoes: { nota: 4.9, total: 2713 } },
      precos,
    ),
    true,
  );
});

test("preço muito abaixo com link mas sem avaliação: só loja oficial", () => {
  const o = { preco: 1199, link: "https://meli.la/1AbCd2E", avaliacoes: null };
  assert.equal(seguraParaRecomendar(o, precos), false);
  assert.equal(seguraParaRecomendar({ ...o, lojaOficial: true }, precos), true);
});

test("preço muito abaixo com poucas avaliações não passa", () => {
  assert.equal(
    seguraParaRecomendar(
      { preco: 1199, link: "https://meli.la/1AbCd2E", avaliacoes: { nota: 5, total: 2 } },
      precos,
    ),
    false,
  );
});

test("nota baixa conhecida nunca vira recomendação; preço normal sem nota passa", () => {
  assert.equal(
    seguraParaRecomendar(
      { preco: 2250, link: null, avaliacoes: { nota: 4.2, total: 300 } },
      precos,
    ),
    false,
  );
  assert.equal(seguraParaRecomendar({ preco: 2250, link: null, avaliacoes: null }, precos), true);
});

/* A mesma régua no bot e no "Me ajude a escolher" (decisaoDaTela). */
const analiseAr = (avaliacoesDaMaisBarata: unknown) => ({
  titulo: "Ar Condicionado LG Inverter 12.000 Btus",
  preco: 2549,
  freteGratis: true,
  outrasLojas: [
    {
      vendedor: "SILU",
      final: 1199,
      freteGratis: true,
      link: "https://meli.la/1AAAAAA",
      avaliacoes: avaliacoesDaMaisBarata,
    },
    {
      vendedor: "CM",
      final: 2250,
      freteGratis: true,
      link: "https://meli.la/1BBBBBB",
      avaliacoes: { nota: 4.9, total: 2713 },
    },
    { vendedor: "LG", final: 2459, freteGratis: true, link: "https://meli.la/1CCCCCC" },
  ],
});

test("bot: preço muito abaixo sem avaliação cede a vez à próxima loja segura", () => {
  const a = analiseAr(null);
  const d = decisaoDaTela(
    opcoesDaAnalise(a, "https://meli.la/1DDDDDD"),
    null,
    custosDoMesmoProduto(a),
  );
  assert.equal(d.melhorMesmo?.loja, "CM");
});

test("bot: preço muito abaixo com link e boa avaliação continua recomendado", () => {
  const a = analiseAr({ nota: 4.9, total: 2713 });
  const d = decisaoDaTela(
    opcoesDaAnalise(a, "https://meli.la/1DDDDDD"),
    null,
    custosDoMesmoProduto(a),
  );
  assert.equal(d.melhorMesmo?.loja, "SILU");
});

test("custo para o cliente soma o frete de valor conhecido", () => {
  assert.deepEqual(
    custosDoMesmoProduto({
      preco: 20,
      freteGratis: true,
      outrasLojas: [{ final: 8, freteGratis: false, custoFrete: 9.99 }],
    }),
    [20, 17.99],
  );
});
