import { describe, expect, test } from "bun:test";
import { aplicarPrecosDoRobo, comPrecosDoRobo, soComPreco } from "@/lib/precos-robo";
import type { ResultadoBusca } from "@/lib/busca-guiada";

/* Weslei, 27/11: "pode adicionar os valores! sempre deve ter!". Only a real,
   recent, national buy box price ever fills a card. */
const card = (produto: string, preco: number | null = null): ResultadoBusca => ({
  produto,
  item: preco == null ? "" : "MLB900",
  nome: `Air Fryer ${produto}`,
  imagem: null,
  preco,
  url: `https://www.mercadolivre.com.br/p/${produto}`,
});

describe("price robot on search cards (27/11)", () => {
  test("fills only cards without price, with the buy box item in the link", () => {
    const [a, b, c, d] = aplicarPrecosDoRobo(
      [card("MLB1"), card("MLB2", 300), card("MLB3"), card("MLB4")],
      [
        {
          produto: "MLB1",
          item: "MLB11",
          preco: "399.9",
          loja_oficial: true,
          internacional: false,
        },
        { produto: "MLB2", item: "MLB22", preco: 1, loja_oficial: false, internacional: false },
        { produto: "MLB3", item: "MLB33", preco: 250, loja_oficial: false, internacional: true },
      ],
    );
    expect(a).toMatchObject({ preco: 399.9, item: "MLB11", lojaOficial: true, freteGratis: null });
    expect(a!.url).toBe("https://www.mercadolivre.com.br/p/MLB1?pdp_filters=item_id%3AMLB11");
    expect(b!.preco).toBe(300); // already priced: untouched
    expect(c!.preco).toBeNull(); // international: never shown with a price
    expect(d!.preco).toBeNull(); // not read yet
  });

  test("a product the robot found with no seller is never shown (27/11)", () => {
    const linhas = [
      { produto: "MLB1", item: null, preco: null, loja_oficial: false, internacional: false, sem_vendedor: true },
      { produto: "MLB2", item: null, preco: null, loja_oficial: false, internacional: false, sem_vendedor: false },
    ];
    expect(aplicarPrecosDoRobo([card("MLB1"), card("MLB2"), card("MLB3", 50)], linhas).map((r) => r.produto)).toEqual(["MLB2", "MLB3"]);
  });

  test("a price outside the requested range drops the card", () => {
    const linhas = [
      { produto: "MLB1", item: "MLB11", preco: 900, loja_oficial: false, internacional: false },
    ];
    expect(aplicarPrecosDoRobo([card("MLB1")], linhas, { precoMax: 500 })).toHaveLength(0);
    expect(aplicarPrecosDoRobo([card("MLB1")], linhas, { precoMin: 1000 })).toHaveLength(0);
    expect(aplicarPrecosDoRobo([card("MLB1")], linhas, { precoMax: 1000 })).toHaveLength(1);
  });

  test("reads only fresh rows and survives a database error", async () => {
    let desde = "";
    const db = (erro: boolean) => ({
      from: () => ({
        select: () => ({
          in: () => ({
            gte: (_c: string, v: string) => {
              desde = v;
              return Promise.resolve(
                erro
                  ? { data: null, error: { message: "x" } }
                  : {
                      data: [
                        {
                          produto: "MLB1",
                          item: "MLB11",
                          preco: 50,
                          loja_oficial: false,
                          internacional: false,
                        },
                      ],
                      error: null,
                    },
              );
            },
          }),
        }),
      }),
    });
    const resposta = { resumo: "", buscas: [], resultados: [card("MLB1")], enfileirados: 0 };
    expect((await comPrecosDoRobo(db(false), resposta)).resultados[0]!.preco).toBe(50);
    expect(Date.now() - Date.parse(desde)).toBeGreaterThan(11.9 * 3600_000);
    expect(Date.now() - Date.parse(desde)).toBeLessThan(12.1 * 3600_000);
    // Hiding on (his card, 28/11 01:16): a card without a real price is not shown.
    expect((await comPrecosDoRobo(db(true), resposta)).resultados).toHaveLength(0);
    const misto = [card("MLB7", 120), card("MLB8")];
    expect(soComPreco(misto, true).map((r) => r.produto)).toEqual(["MLB7"]);
  });
});
