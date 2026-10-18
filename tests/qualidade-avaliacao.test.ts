import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aprovadaParaCanal,
  bemAvaliadosPrimeiro,
  passaNaQualidade,
  pontuacaoDaAvaliacao,
  reprovadaPelaAvaliacao,
  seloDeAvaliacao,
  vereditoDaAvaliacao,
} from "../src/lib/qualidade-avaliacao";

const nota = (n: number, total: number) => ({ avaliacoes: { nota: n, total } });

test("nota baixa ou sem avaliações nunca aparece", () => {
  assert.equal(vereditoDaAvaliacao(nota(4.4, 6101)), "fraca");
  assert.ok(reprovadaPelaAvaliacao(nota(4.4, 6101)));
  assert.ok(reprovadaPelaAvaliacao({ avaliacoes: null, sem: true }));
  assert.ok(!reprovadaPelaAvaliacao(nota(4.5, 3)));
  assert.ok(!reprovadaPelaAvaliacao(null));
});

test("vitrine de comparados exige nota lida; mais vendidos aceita ainda não lida", () => {
  assert.ok(passaNaQualidade(nota(4.8, 200), true));
  assert.ok(!passaNaQualidade(null, true));
  assert.ok(passaNaQualidade(null, false));
  assert.ok(!passaNaQualidade({ avaliacoes: null, sem: true }, false));
  assert.ok(!passaNaQualidade(nota(4.2, 231), false));
});

test("nota com volume vale mais que 5,0 com uma avaliação", () => {
  assert.ok(pontuacaoDaAvaliacao(nota(4.8, 5000)) > pontuacaoDaAvaliacao(nota(5, 1)));
  assert.equal(pontuacaoDaAvaliacao(nota(4.3, 5000)), 0);
  assert.equal(pontuacaoDaAvaliacao(null), 0);
});

test("bem avaliados primeiro, sem embaralhar o resto", () => {
  const lista = [
    { id: "a", r: null },
    { id: "b", r: nota(4.9, 10) },
    { id: "c", r: null },
    { id: "d", r: nota(4.6, 80) },
  ];
  assert.deepEqual(
    bemAvaliadosPrimeiro(lista, (x) => x.r).map((x) => x.id),
    ["b", "d", "a", "c"],
  );
});

test("selo só com nota alta e volume lidos", () => {
  assert.equal(seloDeAvaliacao(nota(4.8, 50)), "Muito bem avaliado");
  assert.equal(seloDeAvaliacao(nota(4.9, 12)), null);
  assert.equal(seloDeAvaliacao(nota(4.7, 9000)), null);
  assert.equal(seloDeAvaliacao(null), null);
});

test("canal: nota boa com pelo menos 5 avaliações; sem nota, só loja oficial", () => {
  assert.ok(aprovadaParaCanal({ nota: 4.7, total: 120 }, false));
  assert.ok(!aprovadaParaCanal({ nota: 5, total: 2 }, false));
  assert.ok(!aprovadaParaCanal({ nota: 4.3, total: 900 }, true));
  assert.ok(!aprovadaParaCanal(null, false));
  assert.ok(aprovadaParaCanal(null, true));
});
