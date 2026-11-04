import { describe, expect, test } from "bun:test";
import {
  assistenteLocal,
  limparRespostaDoModelo,
  precoMaximoDoPedido,
  type ItemAssistente,
} from "@/lib/assistente-busca";
import { ordenarRecomendados, ordemInicial } from "@/lib/busca-resultados";
import { passosDasSeguintes } from "@/lib/busca-guiada";

const itens: ItemAssistente[] = [
  {
    id: "a",
    nome: "Lava e Seca Midea 11kg 127V",
    preco: 3199,
    freteGratis: true,
    nota: 4.8,
    avaliacoes: 900,
  },
  {
    id: "b",
    nome: "Lava e Seca LG 12kg 220V",
    preco: 5999,
    freteGratis: true,
    lojaOficial: true,
    nota: 4.8,
    avaliacoes: 155,
  },
  {
    id: "c",
    nome: "Lava e Seca Electrolux 12kg Bivolt",
    preco: 3799,
    freteGratis: false,
    nota: 4.2,
    avaliacoes: 40,
  },
];

describe("assistente de compra depois da busca", () => {
  test("lê o preço máximo do pedido", () => {
    expect(precoMaximoDoPedido("até R$ 3.500")).toBe(3500);
    expect(precoMaximoDoPedido("no máximo 3 mil")).toBe(3000);
  });

  test("127V aceita 127V e bivolt, nunca 220V", () => {
    expect(assistenteLocal("quero 127v", itens).ids).toEqual(["a", "c"]);
  });

  test("até R$ 3.500 só deixa o de R$ 3.199", () => {
    expect(assistenteLocal("até R$ 3.500", itens).ids).toEqual(["a"]);
  });

  test("bem avaliada exige nota 4,5 ou mais", () => {
    expect(assistenteLocal("a mais bem avaliada", itens).ids).not.toContain("c");
  });

  test("resposta do modelo com preço inventado é descartada", () => {
    expect(
      limparRespostaDoModelo({ resposta: "A melhor sai por R$ 2.000,00.", ids: ["a"] }, itens),
    ).toBeNull();
  });

  test("resposta do modelo só mantém produtos recebidos", () => {
    const r = limparRespostaDoModelo(
      { resposta: "A Midea sai por R$ 3.199,00.", ids: ["a", "zzz"] },
      itens,
    );
    expect(r?.ids).toEqual(["a"]);
  });
});

describe("ordem recomendada da busca", () => {
  test("padrão é Recomendados (menor preço se pediu barato)", () => {
    expect(ordemInicial("geladeira frost free")).toBe("recomendados");
    expect(ordemInicial("geladeira barata")).toBe("menor-preco");
  });

  test("mais barato bem avaliado primeiro, mais caro no fim, nota ruim depois", () => {
    const notas = new Map([
      ["x1", { item: "x1", avaliacoes: { nota: 4.8, total: 500 }, sem: false, detalhe: false }],
      ["x3", { item: "x3", avaliacoes: { nota: 3.9, total: 50 }, sem: false, detalhe: false }],
    ]) as never;
    const lista = [
      { nome: "caro", preco: 5000, avaliacao: null },
      { nome: "barato bom", preco: 2000, avaliacao: "x1" },
      { nome: "barato ruim", preco: 1800, avaliacao: "x3" },
      { nome: "medio", preco: 3000, avaliacao: null },
      { nome: "sem preco", preco: null, avaliacao: null },
    ];
    expect(ordenarRecomendados(lista, notas).map((i) => i.nome)).toEqual([
      "barato bom",
      "medio",
      "caro",
      "barato ruim",
      "sem preco",
    ]);
  });
});

describe("carregar mais da busca", () => {
  test("continua no catálogo até a posição 120 e depois pelas marcas", () => {
    const p = passosDasSeguintes(["geladeira"], ["geladeira Consul"]);
    expect(p[0]).toEqual({ buscas: ["geladeira"], offset: 84 });
    expect(p.every((x) => x.offset + 20 <= 120)).toBe(true);
    expect(p.filter((x) => x.buscas[0] === "geladeira Consul").length).toBe(6);
  });
});

import { tresEscolhas } from "@/lib/assistente-busca";
describe("três escolhas da tela", () => {
  const itens = [
    { id: "a", nome: "A", preco: 900, freteGratis: null, nota: 4.9, avaliacoes: 300 },
    { id: "b", nome: "B", preco: 1000, freteGratis: true, nota: 4.0, avaliacoes: 10 },
    {
      id: "c",
      nome: "C",
      preco: 1100,
      freteGratis: true,
      lojaOficial: true,
      nota: 4.7,
      avaliacoes: 50,
    },
    { id: "d", nome: "D", preco: 2500, freteGratis: false, nota: 4.8, avaliacoes: 80 },
    { id: "e", nome: "E", preco: 3000, nota: 4.2, avaliacoes: 500 },
  ];
  test("frete desconhecido não conta como custo total menor", () => {
    const r = tresEscolhas(itens);
    expect(r.menorCusto?.id).toBe("b");
    expect(r.custoBeneficio?.id).toBe("c");
    expect(r.premium?.id).toBe("d");
  });
  test("sem dados, sem escolha inventada", () => {
    const r = tresEscolhas([{ id: "x", nome: "X", preco: null }]);
    expect([r.menorCusto, r.custoBeneficio, r.premium]).toEqual([null, null, null]);
  });
});
