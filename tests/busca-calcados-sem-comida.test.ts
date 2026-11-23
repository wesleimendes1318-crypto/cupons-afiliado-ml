import { describe, expect, test } from "bun:test";
import { ehBuscaDeCalcado, extrairIntencaoRapida, foraDaIntencao } from "@/lib/busca-intencao";
import { ampliarDominios, soCalcados } from "@/lib/familias-dominio";

const fora = (q: string, nome: string) => foraDaIntencao(nome, extrairIntencaoRapida(q), q);

/* Weslei, 23/11: footwear searches showed ketchup, mayonnaise, shoyu, candy.
   Domain predictions checked live on /domain_discovery the same day. */
const COMIDA = [
  "Ketchup Heinz Tradicional 397g",
  "Maionese Hellmann's Tradicional 500g",
  "Mostarda Heinz Amarela 255g",
  "Molho Shoyu Sakura Tradicional 1 Litro",
  "Bala Fini Gelatina Dentaduras 90g",
  "Batata Frita Congelada Mccain 2kg",
];

describe("footwear searches never show food (23/11)", () => {
  for (const q of [
    "rasteirinha moleca",
    "rasteirinha",
    "papete",
    "calçados",
    "sapatilha",
    "tamanco",
    "scarpin",
    "mocassim",
    "coturno",
  ])
    test(q, () => {
      for (const n of COMIDA) expect(fora(q, n)).toBe(true);
    });

  test("real footwear titles still pass, even without the query word", () => {
    expect(fora("rasteirinha moleca", "Sandália Rasteira Moleca Feminina Tiras")).toBe(false);
    expect(fora("rasteirinha", "Sandália Rasteirinha Feminina Com Strass")).toBe(false);
    expect(fora("papete", "Papete Feminina Velcro Conforto")).toBe(false);
    expect(fora("calçados", "Tênis Olympikus Corre 3 Masculino")).toBe(false);
    expect(fora("calçados", "Chinelo Havaianas Slim Feminino")).toBe(false);
    expect(fora("sapatilha", "Sapatilha Feminina Bico Redondo Confort")).toBe(false);
    expect(fora("mocassim", "Sapato Mocassim Masculino Couro")).toBe(false);
    expect(fora("coturno", "Bota Coturno Feminina Tratorada")).toBe(false);
  });

  test("colors that are also food words are not food", () => {
    expect(fora("bota feminina", "Bota Feminina Cano Curto Cor Chocolate")).toBe(false);
  });

  test("food shield is only for clothing and footwear", () => {
    expect(fora("panela", "Panela Para Molho Tramontina Inox")).toBe(false);
  });

  test("footwear phrase detection", () => {
    for (const q of ["rasteirinha moleca", "papete", "calçados", "tenis corrida", "bota feminina"])
      expect(ehBuscaDeCalcado(q)).toBe(true);
    expect(ehBuscaDeCalcado("ketchup heinz")).toBe(false);
    expect(ehBuscaDeCalcado("camiseta preta")).toBe(false);
  });
});

describe("footwear domains (live IDs, 23/11)", () => {
  test("predicted sauces/candies are dropped when a footwear domain is predicted", () => {
    const s = soCalcados(
      ampliarDominios(
        new Set(["MLB-SAUCES_AND_DRESSINGS", "MLB-CANDIES", "MLB-SANDALS_AND_CLOGS"]),
      ),
    )!;
    expect(s.has("MLB-SAUCES_AND_DRESSINGS")).toBe(false);
    expect(s.has("MLB-CANDIES")).toBe(false);
    for (const d of [
      "MLB-SANDALS_AND_CLOGS",
      "MLB-FLATS",
      "MLB-HEELS_AND_WEDGES",
      "MLB-BOOTS_AND_BOOTIES",
      "MLB-LOAFERS_AND_OXFORDS",
    ])
      expect(s.has(d)).toBe(true);
  });

  test("a prediction without footwear is kept as is", () => {
    const s = new Set(["MLB-KIMONOS"]);
    expect(soCalcados(s)).toBe(s);
    expect(soCalcados(null)).toBe(null);
  });
});
