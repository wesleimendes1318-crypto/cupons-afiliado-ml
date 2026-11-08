import assert from "node:assert/strict";
import test from "node:test";

import { acoesDoProduto } from "../src/lib/afiliado";
import {
  caracteristicasValidas,
  ordenarVendedores,
  pilulasDaFicha,
} from "../src/lib/ficha-detalhes";

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

test("vendedores: tira o aberto e os sem link, custo desconhecido vai ao fim", () => {
  const v = (chave: string, total: number | null, preco: number, link: string | null) => ({
    chave,
    total,
    preco,
    link,
    urlLoja: null,
  });
  const r = ordenarVendedores(
    [
      v("colado", 100, 100, "https://meli.la/a"),
      v("x", null, 50, "https://meli.la/x"),
      v("y", 90, 85, "https://meli.la/y"),
      v("z", 80, 80, null),
      v("w", 95, 95, "https://meli.la/w"),
    ],
    "colado",
  );
  assert.deepEqual(
    r.map((x) => x.chave),
    ["y", "w", "x"],
  );
});
