import assert from "node:assert/strict";
import { test } from "node:test";

import {
  medianaDosPrecos,
  precoMuitoAbaixo,
  precosDoMesmoProduto,
} from "../src/lib/preco-suspeito";

test("casos reais de 09/10 ficam fora do canal", () => {
  /* Malbec: colado R$ 379, lojas R$ 200 e R$ 361,34. */
  const malbec = precosDoMesmoProduto({
    preco: 379,
    outrasLojas: [
      { preco: 200, final: 200 },
      { preco: 361.34, final: 361.34 },
    ],
  });
  assert.deepEqual(malbec, [379, 200, 361.34]);
  assert.equal(precoMuitoAbaixo(200, malbec), true);
  /* Aspirador: colado R$ 227,38, lojas R$ 50 e R$ 120. */
  const aspirador = precosDoMesmoProduto({
    preco: "227.38",
    outrasLojas: [{ final: "50" }, { final: "120" }],
  });
  assert.equal(precoMuitoAbaixo(50, aspirador), true);
});

test("desconto normal continua valendo", () => {
  assert.equal(precoMuitoAbaixo(279.9, [299.9, 279.9, 289]), false);
  /* Com menos de 3 preços não há mediana: não julga. */
  assert.equal(medianaDosPrecos([100, 20]), null);
  assert.equal(precoMuitoAbaixo(20, [100, 20]), false);
  assert.equal(precosDoMesmoProduto(null).length, 0);
});
