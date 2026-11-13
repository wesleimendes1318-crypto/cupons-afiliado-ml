import { describe, expect, test } from "bun:test";

import { produtoDaApi } from "@/lib/produto-pagina";

describe("produtoDaApi (product page, 13/11)", () => {
  test("catalog: buy box price, real discount, Full only from logistic_type", () => {
    const p = produtoDaApi(
      "MLB54982411",
      {
        name: "Galaxy A17",
        domain_id: "MLB-CELLPHONES",
        pictures: [{ url: "http://http2.mlstatic.com/a-O.jpg" }, { url: "https://evil.com/x.jpg" }],
        attributes: [{ id: "VOLTAGE", name: "Voltagem", value_name: "Bivolt" }],
        buy_box_winner: {
          item_id: "MLB4217058289",
          price: 1342.92,
          original_price: 1599,
          condition: "new",
          official_store_id: 12,
          shipping: { free_shipping: true, logistic_type: "fulfillment" },
        },
      },
      true,
    )!;
    expect(p.fotos).toEqual(["https://http2.mlstatic.com/a-O.jpg"]);
    expect(p.item).toBe("MLB4217058289");
    expect(p.preco).toBe(1342.92);
    expect(p.precoOriginal).toBe(1599);
    expect(p.full).toBe(true);
    expect(p.lojaOficial).toBe(true);
    expect(p.condicao).toBe("novo");
    expect(p.voltagem).toBe("Bivolt");
    expect(p.url).toBe("https://www.mercadolivre.com.br/p/MLB54982411");
  });

  test("no fake discount or Full, listing url for items", () => {
    const p = produtoDaApi(
      "MLB4217058289",
      { title: "X", price: 100, original_price: 90, shipping: { logistic_type: "drop_off" } },
      false,
    )!;
    expect(p.precoOriginal).toBeNull();
    expect(p.full).toBe(false);
    expect(p.lojaOficial).toBe(false);
    expect(p.url).toBe("https://produto.mercadolivre.com.br/MLB-4217058289");
  });

  test("without a name there is no page", () => {
    expect(produtoDaApi("MLB1", {}, true)).toBeNull();
  });
});
