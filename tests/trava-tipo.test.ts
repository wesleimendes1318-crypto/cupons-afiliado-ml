import { describe, expect, test } from "bun:test";
import { extrairIntencaoRapida, foraDaIntencao } from "@/lib/busca-intencao";

const fora = (q: string, nome: string) => foraDaIntencao(nome, extrairIntencaoRapida(q), q);

describe("strict product type + kids shield (Weslei, 08/11)", () => {
  test("'Camiseta preta Oversize' keeps only t-shirts", () => {
    const q = "Camiseta preta Oversize";
    for (const n of [
      "Calça Jeans Masculino Azul Slim Com Elastano Premium da Meteoro",
      "Conjunto Roupa Fitness Paris SOMIARI",
      "Conjunto Infantil Camiseta E Bermuda Kids Bege",
      "Roupas Femininas Faca Fashion Roupas Femininas 30 peças",
      "Kit Body Gamer de Algodão Para Bebê e Camiseta Pai Branco",
      "Conjunto Kyly Infantil Menina Casaco Legging Inverno",
      "Jogo Uno Infantil E Adulto Para Revender Atacado 10 Unidades",
      "Colete Corta-Vento Mtb Endurance 2.0 Preto",
    ])
      expect(fora(q, n)).toBe(true);
    expect(fora(q, "Camiseta preta Oversized 100% Algodão Streetwear")).toBe(false);
  });

  test("kids items only when the request is for kids", () => {
    const n = "Camiseta Infantil Menino Kids Brandili";
    expect(fora("Camiseta basica algodao", n)).toBe(true);
    expect(fora("Camiseta infantil menino algodao", n)).toBe(false);
    expect(fora("mochila escolar", "Mochila Escolar Infantil Menina")).toBe(false);
  });

  test("a set needs its kind: 'jogo de lençol' is never plates", () => {
    expect(fora("jogo de lencol casal", "Jogo Pratos Fundo Vidro Nadir Figueiredo Branco")).toBe(
      true,
    );
    expect(fora("jogo de lencol casal", "Jogo Lençol Casal 3 Peças 400 Fios")).toBe(false);
    expect(fora("jogo de cama casal", "Jogo De Lençol Casal 4 Peças")).toBe(false);
    expect(fora("jogo de panelas", "Conjunto De Panelas Tramontina Antiaderente")).toBe(false);
  });

  /* Valid titles WITHOUT the query's own word (lesson of PR #137). */
  test("catalog synonyms are not rejected", () => {
    const validos: [string, string][] = [
      ["fone bluetooth", "Headphone JBL Tune 520BT Bluetooth"],
      ["celular samsung", "Smartphone Samsung Galaxy A15 128gb"],
      ["relogio inteligente", "Smartwatch Xiaomi Redmi Watch 5"],
      ["perfume masculino", "Bleu De Chanel Eau De Parfum Masculino 100ml"],
      ["geladeira frost free", "Refrigerador Brastemp Frost Free 375l"],
      ["oculos de sol", "Óculos De Sol Ray-Ban Aviador"],
      ["conjunto de academia feminino", "Conjunto Fitness Feminino Legging E Top"],
      ["kit de ferramentas", "Maleta Kit Ferramentas 129 Peças"],
      ["capinha iphone 17 pro max", "Capa Magsafe Transparente Para iPhone 17 Pro Max"],
    ];
    for (const [q, n] of validos) expect(fora(q, n)).toBe(false);
  });
});
