import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aplicarEscolha,
  contarFilhos,
  ESCOLHA_VAZIA,
  filtrosDisponiveis,
  ordenar,
} from "../src/lib/catalogo-no";

const item = (
  nome: string,
  categoria_no: string,
  preco: number,
  frete = false,
  oficial = false,
) => ({
  nome,
  categoria_no,
  preco,
  frete_gratis: frete,
  loja_oficial: oficial,
});

const ITENS = [
  item("SSD Kingston NV3 1TB M.2 NVMe", "ssd-nvme", 400, true, true),
  item("SSD WD Green 480GB SATA", "ssd-sata", 200, true),
  item("SSD Kingston 240GB", "ssd-sata", 120),
  item("Cartão de Memória 64GB Sandisk", "cartoes-de-memoria", 50),
];

test("filhos com produto e contagem pela subárvore", () => {
  const f = contarFilhos("armazenamento", ITENS);
  assert.ok(f.every((x) => x.total > 0));
  assert.equal(
    f.reduce((s, x) => s + x.total, 0),
    ITENS.length,
  );
});

test("filtro só aparece com 2 ou mais opções que têm produto", () => {
  const f = filtrosDisponiveis("armazenamento", ITENS);
  const cap = f.find((x) => x.id === "armazenamento");
  assert.ok(cap && cap.opcoes.length >= 2);
  assert.ok(cap.opcoes.every((o) => o.total > 0));
  assert.equal(filtrosDisponiveis("armazenamento", ITENS.slice(0, 1)).length, 0);
});

test("aplicar escolha e ordenar", () => {
  const um = aplicarEscolha(ITENS, { ...ESCOLHA_VAZIA, filtros: { armazenamento: "1tb" } });
  assert.deepEqual(
    um.map((i) => i.preco),
    [400],
  );
  assert.equal(aplicarEscolha(ITENS, { ...ESCOLHA_VAZIA, freteGratis: true }).length, 2);
  assert.equal(aplicarEscolha(ITENS, { ...ESCOLHA_VAZIA, lojaOficial: true }).length, 1);
  assert.equal(aplicarEscolha(ITENS, { ...ESCOLHA_VAZIA, faixa: "100-500" }).length, 3);
  assert.deepEqual(
    ordenar(ITENS, "menor-preco").map((i) => i.preco),
    [50, 120, 200, 400],
  );
  assert.equal(ordenar(ITENS, "relevancia"), ITENS);
});
