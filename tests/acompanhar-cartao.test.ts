import { describe, expect, test } from "bun:test";

import { chaveDoProduto, traduzirErro } from "../src/lib/acompanhar-cartao";

describe("sino do cartão", () => {
  test("mesmo anúncio com endereços diferentes dá a mesma chave do banco", () => {
    expect(chaveDoProduto("https://produto.mercadolivre.com.br/MLB-4739054961-capinha-_JM?x=1")).toBe(
      "MLB4739054961",
    );
    expect(
      chaveDoProduto("https://www.mercadolivre.com.br/x/p/MLB123456?pdp_filters=item_id%3AMLB4739054961"),
    ).toBe("MLB4739054961");
    expect(chaveDoProduto("https://www.mercadolivre.com.br/lava/p/MLB2345678")).toBe("MLB2345678");
  });

  test("sem comparação pronta, compara primeiro em vez de dar erro", () => {
    expect(traduzirErro("P0001 sem comparacao")).toMatchObject({ ok: false, motivo: "comparar" });
    expect(traduzirErro("PGRST202 Could not find the function")).toMatchObject({ motivo: "comparar" });
  });

  test("limite de 20 produtos por navegador continua valendo", () => {
    expect(traduzirErro("limite de 20 produtos acompanhados")).toMatchObject({ motivo: "limite" });
  });
});
