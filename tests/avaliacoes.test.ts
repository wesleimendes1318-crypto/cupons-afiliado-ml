import { test } from "node:test";
import assert from "node:assert/strict";

import {
  avaliacoesValidas,
  linhaDasAvaliacoes,
  rotuloDasAvaliacoes,
  totalEscrito,
} from "../src/lib/avaliacoes";

const sp = (s: string) => s.replace(/ /g, " ");

test("avaliação só com nota de 0 a 5 e pelo menos 1 avaliação", () => {
  assert.deepEqual(avaliacoesValidas({ nota: 4.9, total: 5056 }), { nota: 4.9, total: 5056 });
  assert.equal(avaliacoesValidas({ nota: 0, total: 10 }), null);
  assert.equal(avaliacoesValidas({ nota: 5.2, total: 10 }), null);
  assert.equal(avaliacoesValidas({ nota: 4.5, total: 0 }), null);
  assert.equal(avaliacoesValidas({ nota: "4.5", total: 3 }), null);
  assert.equal(avaliacoesValidas(null), null);
  /* Nunca arredonda para cima. */
  assert.deepEqual(avaliacoesValidas({ nota: 4.96, total: 3 }), { nota: 4.9, total: 3 });
});

test("textos da avaliação", () => {
  const a = { nota: 4.9, total: 5056 };
  assert.equal(sp(totalEscrito(a)), "5.056 avaliações");
  assert.equal(totalEscrito({ nota: 5, total: 1 }), "1 avaliação");
  assert.equal(sp(rotuloDasAvaliacoes(a)), "Nota 4,9 de 5, 5.056 avaliações");
  assert.equal(sp(linhaDasAvaliacoes(a) ?? ""), "⭐ 4,9 de 5 (5.056 avaliações)");
  assert.equal(linhaDasAvaliacoes({ nota: 4, total: 0 }), null);
});
