import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aplicarEscolha,
  buscarTexto,
  diversificarPorPreco,
  faixasDePreco,
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

test("busca por texto dentro da categoria", () => {
  const mesas = [
    item("Conjunto Mesa de Jantar 4 Cadeiras Madeira", "mesas", 900),
    item("Mesa Redonda Tampo de Vidro 6 Cadeiras", "mesas", 1500),
    item("Mesa de Jantar Retangular 14 Lugares", "mesas", 3000),
  ];
  assert.equal(buscarTexto(mesas, "4 cadeiras").length, 1);
  assert.equal(buscarTexto(mesas, "madeira").length, 1);
  assert.equal(buscarTexto(mesas, "redondas").length, 1);
  assert.equal(buscarTexto(mesas, "tampo de vidro").length, 1);
  assert.equal(buscarTexto(mesas, "  ").length, 3);
  assert.equal(buscarTexto(mesas, "sofá").length, 0);
});

test("faixas de preço pela mediana, arredondadas", () => {
  const f = faixasDePreco([300, 500, 800, 900, 1000, 1200, 2500]);
  assert.deepEqual(
    f.map((x) => x.id),
    ["0-500", "500-1500", "1500+"],
  );
  assert.equal(f[0]!.rotulo, "Até R$ 500");
  assert.equal(aplicarEscolha(ITENS, { ...ESCOLHA_VAZIA, faixa: "0-150" }).length, 2);
  assert.equal(aplicarEscolha(ITENS, { ...ESCOLHA_VAZIA, faixa: "300+" }).length, 1);
  assert.equal(faixasDePreco([10, 20]).length, 4); // poucos preços: as fixas
});

test("diversidade de preços no topo, perto do ticket do visitante", () => {
  const lista = [100, 110, 120, 130, 500, 510, 520, 530, 2000, 2100, 2200, 2300].map((p) =>
    item(`P${p}`, "x", p),
  );
  const d = diversificarPorPreco(lista, 0, 6)
    .slice(0, 6)
    .map((i) => i.preco);
  assert.deepEqual(d, [500, 100, 2000, 510, 110, 2100]);
  const t = diversificarPorPreco(lista, 2150, 4)
    .slice(0, 4)
    .map((i) => i.preco);
  assert.deepEqual(t, [2000, 500, 2100, 100]);
  assert.equal(diversificarPorPreco(lista).length, lista.length);
  assert.equal(new Set(diversificarPorPreco(lista)).size, lista.length);
});

test("buscas das subcategorias com poucos produtos", async () => {
  const { buscasDosNosRasos, termosDoNo } = await import("../src/lib/em-alta-catalogo");
  assert.deepEqual(termosDoNo({ slug: "mesas", nome: "Mesas e conjuntos de jantar" }).length, 3);
  assert.deepEqual(termosDoNo({ slug: "x", nome: "Redes, cadeiras de praia e gazebos" }), [
    "redes, cadeiras de praia e gazebos",
    "cadeiras de praia",
  ]);
  const termos = buscasDosNosRasos("casa", { mesas: 2 });
  assert.ok(termos.includes("mesa de jantar 4 cadeiras"));
  assert.ok(!buscasDosNosRasos("casa", { mesas: 40 }).includes("mesa de jantar 4 cadeiras"));
});
