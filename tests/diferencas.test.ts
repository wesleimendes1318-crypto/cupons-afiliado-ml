import { test } from "node:test";
import assert from "node:assert/strict";

import { numero, significado } from "../src/lib/diferencas";

/* Pedido 1000048 (18/10): ar-condicionado de 12.000 BTUs x parecido de
   9.000 BTUs saía "Cabe 3 BTUS a menos que o seu". */
test("milhar com ponto é lido inteiro", () => {
  assert.deepEqual(numero("12.000 BTUs"), { n: 12000, u: "btu" });
  assert.deepEqual(numero("1.500 W"), { n: 1500, u: "w" });
  assert.deepEqual(numero("1,5 kg"), { n: 1.5, u: "kg" });
  assert.deepEqual(numero("477 L"), { n: 477, u: "l" });
});

test("capacidade em BTUs não diz 'cabe'", () => {
  assert.equal(
    significado("Capacidade", "12.000 BTUs", "9.000 BTUs", ""),
    "3.000 BTUs a menos de capacidade que o seu.",
  );
  assert.equal(significado("Capacidade", "477 L", "424 L", ""), "Cabe 53 L a menos que o seu.");
});
