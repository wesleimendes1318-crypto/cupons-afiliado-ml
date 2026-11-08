import assert from "node:assert/strict";
import test from "node:test";

import { acoesDoProduto } from "../src/lib/afiliado";
import { caracteristicasValidas, pilulasDaFicha } from "../src/lib/ficha-detalhes";

test("Comprar com segurança do painel usa o meli.la do Weslei", () => {
  const r = acoesDoProduto("https://meli.la/2abcXYZ", null);
  assert.deepEqual(r.comprar, { href: "https://meli.la/2abcXYZ" });
});

test("ficha descarta itens vazios", () => {
  const v = caracteristicasValidas([
    { nome: "Material", valor: "Vidro Borossilicato" },
    { nome: "", valor: "Invalido" },
    { nome: "Capacidade", valor: " " },
    null,
    { nome: "best_seller", valor: "MAIS VENDIDO" },
    { nome: "Capacidade", valor: "640ml" },
  ]);
  assert.deepEqual(
    v.map((c) => c.nome),
    ["Material", "Capacidade"],
  );
});

test("pílulas seguem a prioridade e pulam valores longos", () => {
  const p = pilulasDaFicha([
    { nome: "Cor", valor: "Preto" },
    { nome: "Modelo", valor: "Uma frase longa demais para caber numa pílula" },
    { nome: "Marca", valor: "Mondial" },
    { nome: "Voltagem", valor: "110V" },
    { nome: "Potência", valor: "1200 W" },
  ]);
  assert.deepEqual(
    p.map((c) => c.valor),
    ["Mondial", "110V", "1200 W"],
  );
});
