import { test } from "node:test";
import assert from "node:assert/strict";

import { pareceFalso } from "../src/lib/falsificado";

test("falso assumido ou clone sem marca fica de fora", () => {
  assert.ok(pareceFalso("Fone De Ouvido Bluetooth Bateria de Longa Duração Pro 4 Branco"));
  assert.ok(pareceFalso("Smartwatch S10 Série 10 Relógio Digital Masculino"));
  assert.ok(pareceFalso("Fone i12 TWS Bluetooth"));
  assert.ok(pareceFalso("AirPods Pro 2 Linha Premium AAA"));
  assert.ok(pareceFalso("Perfume Inspirado Sauvage 100ml"));
  assert.ok(pareceFalso("Tênis Réplica Primeira Linha"));
});

test("produto de marca passa", () => {
  assert.ok(!pareceFalso("Apple AirPods Pro (2ª geração) com estojo USB-C"));
  assert.ok(!pareceFalso("Samsung Galaxy Buds Core branco"));
  assert.ok(!pareceFalso("Fone de Ouvido Bluetooth 5.4 soundcore P30i da Anker"));
  assert.ok(!pareceFalso("Relógio Inteligente Amazfit Bip 6"));
  assert.ok(!pareceFalso("Pilha Alcalina AAA Duracell com 4 unidades"));
  assert.ok(!pareceFalso("Kaiak Ultra Natura Colônia Perfume Masculino 100ml"));
});
