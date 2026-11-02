import { describe, expect, test } from "bun:test";
import type { ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";
import { economiaEntreOfertas, posicoesMaisVendidos } from "@/lib/busca-guiada";
import {
  ESCOLHA_BUSCA_VAZIA,
  filtrarResultados,
  filtrosDaBusca,
  marcaDoTitulo,
  marcasDosResultados,
  ordemInicial,
  ordenarResultados,
} from "@/lib/busca-resultados";

/* Weslei, 02/11: "filtrar de acordo com a busca e ordenar por preço,
   economia, mais vendidos". */
const cartao = (
  nome: string,
  preco: number | null,
  extra: Partial<{
    economia: number | null;
    maisVendido: number | null;
    avaliacao: string | null;
    freteGratis: boolean | null;
    lojaOficial: boolean;
  }> = {},
) => ({
  nome,
  preco,
  economia: null,
  maisVendido: null,
  avaliacao: null,
  freteGratis: null,
  lojaOficial: false,
  ...extra,
});
const itens = [
  cartao("Lava e Seca Samsung WD11A 11kg Inox 220V", 2799, {
    economia: 150,
    maisVendido: 3,
    avaliacao: "MLB1",
    freteGratis: true,
  }),
  cartao("Lava e Seca LG VC4 11kg Inox 127V", 3199, { maisVendido: 1, avaliacao: "MLB2" }),
  cartao("Lava e Seca Midea HealthGuard 11kg 220V", 2299, {
    economia: 40,
    avaliacao: "MLB3",
    lojaOficial: true,
  }),
  cartao("Lava e Seca Electrolux 11kg Perfect Care", null),
];
const nota = (n: number, total: number): ResumoAvaliacoes => ({
  item: null,
  avaliacoes: { nota: n, total },
  sem: false,
  detalhe: false,
});
const notas = new Map([
  ["MLB1", nota(4.8, 900)],
  ["MLB2", nota(4.9, 300)],
  ["MLB3", nota(4.7, 2)],
]);
const nomes = (l: typeof itens) => l.map((i) => marcaDoTitulo(i.nome));

describe("ordenar o resultado", () => {
  test("preço, sem preço no fim", () => {
    expect(nomes(ordenarResultados(itens, "menor-preco"))).toEqual([
      "Midea",
      "Samsung",
      "LG",
      "Electrolux",
    ]);
    expect(nomes(ordenarResultados(itens, "maior-preco"))).toEqual([
      "LG",
      "Samsung",
      "Midea",
      "Electrolux",
    ]);
  });
  test("economia medida, mais vendidos oficiais e nota com 5+ avaliações", () => {
    expect(nomes(ordenarResultados(itens, "economia"))).toEqual([
      "Samsung",
      "Midea",
      "LG",
      "Electrolux",
    ]);
    expect(nomes(ordenarResultados(itens, "mais-vendidos", notas))).toEqual([
      "LG",
      "Samsung",
      "Midea",
      "Electrolux",
    ]);
    expect(nomes(ordenarResultados(itens, "melhor-avaliados", notas))).toEqual([
      "LG",
      "Samsung",
      "Midea",
      "Electrolux",
    ]);
    expect(ordenarResultados(itens, "relevancia")).toBe(itens);
  });
  test("busca por 'barata' já abre no menor preço", () => {
    expect(ordemInicial("maquina lava e seca barata")).toBe("menor-preco");
    expect(ordemInicial("geladeira em conta")).toBe("menor-preco");
    expect(ordemInicial("lava e seca")).toBe("relevancia");
  });
});

describe("filtrar pelo que a busca trouxe", () => {
  test("marca, frete, loja oficial e preço", () => {
    expect(marcasDosResultados(itens).map((m) => m.marca)).toEqual([
      "Electrolux",
      "LG",
      "Midea",
      "Samsung",
    ]);
    const f = (m: Partial<typeof ESCOLHA_BUSCA_VAZIA>) =>
      nomes(filtrarResultados(itens, { ...ESCOLHA_BUSCA_VAZIA, ...m }));
    expect(f({ marca: "LG" })).toEqual(["LG"]);
    expect(f({ freteGratis: true })).toEqual(["Samsung"]);
    expect(f({ lojaOficial: true })).toEqual(["Midea"]);
    expect(f({ faixa: "2000-3000" })).toEqual(["Samsung", "Midea"]);
  });
  test("filtros da categoria (voltagem) saem dos títulos", () => {
    const voltagem = filtrosDaBusca(itens).find((x) => x.id === "voltagem");
    expect(voltagem?.opcoes.map((o) => [o.id, o.total])).toEqual([
      ["110", 1],
      ["220", 2],
    ]);
    const so220 = filtrarResultados(itens, {
      ...ESCOLHA_BUSCA_VAZIA,
      filtros: { voltagem: "220" },
    });
    expect(nomes(so220)).toEqual(["Samsung", "Midea"]);
  });
  test("marca pela 1ª citada no título", () => {
    expect(marcaDoTitulo("Smart TV LG 50 Polegadas Compatível Samsung")).toBe("LG");
    expect(marcaDoTitulo("Lavadora genérica 10kg")).toBeNull();
  });
});

describe("dados medidos no servidor", () => {
  test("economia = mediana das outras ofertas novas menos o preço", () => {
    expect(economiaEntreOfertas(2000, [2200, 2400, 2100])).toBe(200);
    expect(economiaEntreOfertas(2000, [1900])).toBe(0);
    expect(economiaEntreOfertas(2000, [])).toBeNull();
    expect(economiaEntreOfertas(null, [2200])).toBeNull();
  });
  test("posição na lista oficial de mais vendidos", () => {
    const p = posicoesMaisVendidos([
      ["MLB1", "MLB2"],
      ["MLB2", "MLB3"],
    ]);
    expect([p.get("MLB1"), p.get("MLB2"), p.get("MLB3")]).toEqual([1, 1, 2]);
  });
});
