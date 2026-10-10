import { describe, expect, test } from "bun:test";

import { itemDaOferta, itemDoEndereco, percentual, resumoDaLinha } from "@/lib/avaliacoes-detalhe";

describe("anúncio do endereço (igual ao banco)", () => {
  test("filtro do catálogo, wid e endereço do anúncio", () => {
    expect(
      itemDoEndereco(
        "https://www.mercadolivre.com.br/p/MLB76296980?pdp_filters=item_id%3AMLB7582045378",
      ),
    ).toBe("MLB7582045378");
    expect(itemDoEndereco("https://www.mercadolivre.com.br/x/p/MLB1?wid=MLB4300834149")).toBe(
      "MLB4300834149",
    );
    expect(itemDoEndereco("https://produto.mercadolivre.com.br/MLB-6469885548-caixa-_JM")).toBe(
      "MLB6469885548",
    );
  });
  test("página de catálogo sem anúncio vira o produto (MLBP)", () => {
    expect(itemDoEndereco("https://www.mercadolivre.com.br/p/MLB13409956")).toBe("MLBP13409956");
  });
  test("link curto, outra loja ou vazio: nada", () => {
    expect(itemDoEndereco("https://meli.la/2tKW17F")).toBeNull();
    expect(itemDoEndereco("https://www.amazon.com.br/dp/B0BHZSH1J7")).toBeNull();
    expect(itemDoEndereco(null)).toBeNull();
  });
  test("oferta: o item gravado vale antes do endereço", () => {
    expect(itemDaOferta({ item: "MLB-4899794982", url: null })).toBe("MLB4899794982");
    expect(itemDaOferta({ url: "https://produto.mercadolivre.com.br/MLB-6469885548" })).toBe(
      "MLB6469885548",
    );
  });
});

describe("resumo da leitura", () => {
  test("nota conferida; sem avaliações só sem nota", () => {
    const r = resumoDaLinha({ item: "MLB1234567", nota: "4.94", total: 81, com_detalhe: true });
    expect(r.avaliacoes).toEqual({ nota: 4.9, total: 81 });
    expect(r.detalhe).toBe(true);
    expect(r.sem).toBe(false);
    const s = resumoDaLinha({ item: "MLB1234567", nota: null, total: null, sem_avaliacoes: true });
    expect(s.avaliacoes).toBeNull();
    expect(s.sem).toBe(true);
    expect(resumoDaLinha({ item: "lixo", nota: 9, total: 0 }).item).toBeNull();
  });
  test("percentual arredonda para baixo", () => {
    const niveis = [
      { estrelas: 5, total: 2370 },
      { estrelas: 4, total: 150 },
      { estrelas: 3, total: 27 },
      { estrelas: 2, total: 9 },
      { estrelas: 1, total: 30 },
    ];
    expect(percentual(niveis[0]!, niveis)).toBe(91);
    expect(percentual(niveis[4]!, niveis)).toBe(1);
  });
});
