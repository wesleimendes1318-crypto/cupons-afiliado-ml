import { expect, test } from "bun:test";

import { foraDaIntencao } from "@/lib/busca-intencao";

const Q = "Mesa de jantar de luxo";
const intencao = { tipoProduto: "mesa", termosNegativos: [], marca: null, modelo: null };
const fora = (nome: string, q = Q, i: object = intencao) => foraDaIntencao(nome, i, q);

test("mesa de jantar: real dining tables stay (07/11 cache)", () => {
  for (const n of [
    "Mesa Jantar Para 6 Lugares Pés Madeira Maciça Luxo Off White Mel",
    "Mesa Jantar 90cm Redonda Carvalho Preto",
    "Mesa Jantar Eloise Laminado 6 Cadeiras Isadora Capuccino",
    "Conjunto Mesa Jantar 6 Cadeiras Madeira Lívia Mobillare Imbuia",
  ])
    expect(fora(n)).toBe(false);
});

test("mesa de jantar: 'de mesa' accessories are out (07/11 cache)", () => {
  for (const n of [
    "Organizador Cabos De Mesa Em Couro Legítimo M Cor Preto",
    "Abajur Luminaria De Mesa Techled Articulavel Luminaria Mesa Estrutura Amarelo",
    "Mousepad Grande 70x30 Couro Mesa Computador Notebook Couse Preto",
    "Organizador Cabos Magnético Kit 6 Prendedor Fios Mesa Gamer Preto",
    "Luminária Mesa LED USB Western LUM10 Branco",
    "Mecolour Mesa 120x75CM Moveis Escritorio Escrivaninhas Mesa para jogos Com Led Preto",
  ])
    expect(fora(n)).toBe(true);
});

test("no kind in the request: unchanged; quality words are not a kind", () => {
  expect(fora("Luminária Mesa LED USB Western LUM10 Branco", "mesa", { tipoProduto: "mesa" })).toBe(
    false,
  );
  expect(fora("Mesa Escrivaninha 120cm Preta", "mesa de luxo", { tipoProduto: "mesa" })).toBe(
    false,
  );
  expect(
    fora("Cadeira Escritório Giratória Presidente", "cadeira de escritorio", {
      tipoProduto: "cadeira",
    }),
  ).toBe(false);
});
