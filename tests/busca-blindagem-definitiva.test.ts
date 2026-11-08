import { describe, expect, test } from "bun:test";
import { extrairIntencaoRapida, extrairTipoEMarca, foraDaIntencao } from "@/lib/busca-intencao";
import { ehLinkDeCompra } from "@/lib/afiliado";

const fora = (q: string, nome: string) => foraDaIntencao(nome, extrairIntencaoRapida(q), q);

describe("precision guard (Weslei, 08/11)", () => {
  test("'insider camiseta': type camiseta, brand insider", () => {
    const i = extrairIntencaoRapida("insider camiseta");
    expect(i.tipoProduto).toBe("camiseta");
    expect(i.marca).toBe("insider");
    expect(extrairTipoEMarca("camiseta insider")).toEqual({
      tipo: "camiseta",
      marcaProvavel: "insider",
    });
    expect(extrairTipoEMarca("stanley copo").marcaProvavel).toBe("stanley");
    expect(extrairTipoEMarca("mizuno tenis").tipo).toBe("tenis");
  });

  test("'insider camiseta' rejects other products, kids and other brands", () => {
    for (const q of ["insider camiseta", "camiseta insider"]) {
      for (const n of [
        "Conjunto Roupa Fitness Paris SOMAMI",
        "Conjunto Infantil Escolar Frio Blusa Moletom",
        "Livro - Insider Trading",
        "Camiseta preta Oversize",
        "Camiseta Insider Infantil Menino",
      ])
        expect(fora(q, n)).toBe(true);
      expect(fora(q, "Camiseta Insider Tech T-Shirt Masculina Preta")).toBe(false);
    }
    /* Same rule when the remote reading kept the free word as the type. */
    const q = "insider camiseta";
    const lida = { tipoProduto: "insider" };
    expect(foraDaIntencao("Conjunto Roupa Fitness Paris SOMAMI", lida, q)).toBe(true);
    expect(foraDaIntencao("Camiseta Insider Tech", lida, q)).toBe(false);
  });

  test("descriptions are never read as a brand", () => {
    for (const q of [
      "camiseta preta oversize",
      "camiseta oversize",
      "camiseta masculina",
      "tenis corrida",
      "vestido longo",
      "kit camiseta",
      "mesa para notebook",
      "jogo de lencol",
      "perfume importado",
    ])
      expect(extrairTipoEMarca(q).marcaProvavel).toBeNull();
    expect(extrairTipoEMarca("mesa para notebook").tipo).toBe("mesa");
    expect(fora("camiseta oversize", "Camiseta Over Size Algodão Unissex")).toBe(false);
  });

  test("'capinha iPhone 17 pro Max': accessory type and full model", () => {
    const i = extrairIntencaoRapida("capinha iPhone 17 pro Max");
    expect(i.tipoProduto).toBe("capinha");
    expect(i.modelo).toBe("iphone 17 pro max");
    expect(i.marca).toBeNull();
  });

  test("'capinha iPhone 17 pro Max' rejects base model and multi-model cases", () => {
    const q = "capinha iPhone 17 pro Max";
    for (const n of [
      "Capa iPhone para iPhone 17 Tinto",
      "Capa Capinha Transparente Para iPhone 11 12 13",
      "Capa iPhone 17 Pro Silicone",
      "Capinha Galaxy S25 Ultra",
    ])
      expect(fora(q, n)).toBe(true);
    expect(fora(q, "Capa Silicone iPhone 17 Pro Max Magsafe Preta")).toBe(false);
    expect(fora(q, "Capinha Anti Impacto Para iPhone 17 Pro Max")).toBe(false);
  });

  test("best sellers use the same shield: a fitness set never fills a t-shirt search", () => {
    /* maisVendidosDaCategoria discards with opcoes.rejeitar = foraDaIntencao. */
    const rejeitar = (n: string) => fora("insider camiseta", n);
    const maisVendidos = [
      "Conjunto Roupa Fitness Paris SOMAMI",
      "Calça Moletom Infantil Escolar",
      "Camiseta Insider Tech Preta",
    ];
    expect(maisVendidos.filter((n) => !rejeitar(n))).toEqual(["Camiseta Insider Tech Preta"]);
  });

  test("rule no. 1: the guard only drops cards; buy links stay affiliate links", () => {
    expect(ehLinkDeCompra("https://meli.la/1AbCdEf", "mercadolivre")).toBe(true);
    expect(ehLinkDeCompra("https://www.mercadolivre.com.br/p/MLB123", "mercadolivre")).toBe(false);
  });
});
