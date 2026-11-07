import { expect, test } from "bun:test";
import {
  buscasDeRoupa,
  extrairIntencaoRapida,
  foraDaIntencao,
  qualificadorFora,
} from "@/lib/busca-intencao";

/* Weslei, 07/11: real titles from the "roupa de academia masculino" screen. */
const q = "roupa de academia masculino";
const i = extrairIntencaoRapida(q);
const fora = (n: string, consulta = q) =>
  foraDaIntencao(n, extrairIntencaoRapida(consulta), consulta);

test("roupa de academia masculino: feminino, bolsa e umbanda saem", () => {
  for (const n of [
    "Calça Legging Feminina Ausare de Poliamida com Compressão UV50+",
    "Roupas femininas Paca Fashion Roupas femininas 30 peças",
    "Bolsa Mala De Roupa Academia Cor Grafite",
    "conjunto academia feminino de malha crepe calça e blusa manga",
    "Roupa Branca Conjunto Masculino Umbanda Candomblé 2 Peças",
    "Kit 3 Conjunto Fitness Virginia Croped Short Academia Treino",
    "Top Feminino Ausare com Tule, Proteção UV50+, para Academia",
    "Conjunto Feminino Fitness Top+short Saia Roupa Academia",
  ])
    expect(foraDaIntencao(n, i, q)).toBe(true);
});

test("roupa de academia masculino: peças masculinas de treino ficam", () => {
  for (const n of [
    "Camiseta Dry Fit Masculina Academia Treino",
    "Kit 5 Camisetas Masculinas Dry Fit Academia",
    "Bermuda Masculina Academia Tactel Treino",
    "Regata Masculina Fitness Academia Cavada",
  ])
    expect(foraDaIntencao(n, i, q)).toBe(false);
});

test("a busca vira peças reais do gênero e do uso", () => {
  expect(i.buscas).toEqual([
    "camiseta academia masculino",
    "bermuda academia masculino",
    "regata academia masculino",
  ]);
  expect(buscasDeRoupa("roupa de academia feminina")[0]).toBe("legging academia feminina");
  expect(buscasDeRoupa("tênis de corrida")).toEqual([]);
});

test("gênero pedido vale para qualquer produto", () => {
  expect(fora("Tênis Feminino Casual Branco", "tênis masculino")).toBe(true);
  expect(fora("Tênis Masculino Casual Branco", "tênis masculino")).toBe(false);
  expect(fora("Camisa Social Masculina Slim", "camisa feminina")).toBe(true);
  expect(fora("Perfume Unissex Feminino e Masculino", "perfume masculino")).toBe(false);
  // sem gênero pedido, nada muda
  expect(fora("Calça Legging Feminina", "calça legging")).toBe(false);
});

test("uso pedido na roupa: academia exige peça de treino", () => {
  expect(fora("Camiseta Masculina Social Algodão", "camiseta academia masculina")).toBe(true);
  expect(fora("Camiseta Masculina Dry Fit", "camiseta academia masculina")).toBe(false);
});

test("roupa de academia: peça de treino sem a palavra academia fica (07/11, vinha vazio)", () => {
  // the remote reading types it as "roupa", like the live site did
  const lida = { ...i, tipoProduto: "roupa" };
  for (const n of [
    "Camiseta Masculina Dry Fit Básica",
    "Kit 3 Camisetas Dry Fit Masculina",
    "Bermuda Masculina Treino Tactel",
    "Regata Masculina Fitness",
    "Conjunto Masculino Treino Bermuda e Camiseta",
  ])
    expect(foraDaIntencao(n, lida, q)).toBe(false);
});

test("roupa de cama não é roupa de vestir", () => {
  expect(qualificadorFora("jogo de lencol casal 4 pecas algodao", "roupa de cama casal")).toBe(
    false,
  );
  expect(buscasDeRoupa("roupa de cama casal")).toEqual([]);
});
