import { describe, expect, test } from "bun:test";

import {
  alternar,
  itemDoProduto,
  juntar,
  lerLista,
  remover,
  textoWhatsApp,
  urlML,
} from "../src/lib/lista-desejos";

const ML = "https://www.mercadolivre.com.br/fone-x/p/MLB123456789";
const t0 = new Date("2026-11-05T10:00:00Z");
const t1 = new Date("2026-11-05T11:00:00Z");

describe("lista de desejos", () => {
  test("card -> item only with Weslei's link or an ML address", () => {
    expect(itemDoProduto({ chave: "x", titulo: "Fone", url: ML })?.id).toBe("MLBP123456789");
    expect(itemDoProduto({ chave: "x", titulo: "Fone", url: "https://loja.com/p" })).toBeNull();
    expect(
      itemDoProduto({ chave: "x", titulo: "Fone", link: "https://amazon.com.br/dp/B0ABCDEFGH" }),
    ).toBeNull();
    const amz = itemDoProduto({ chave: "amazon:B0ABCDEFGH", titulo: "Fone", link: "https://amzn.to/abc12" });
    expect(amz?.loja).toBe("amazon");
    expect(urlML("/p/MLB1234567")).toBe("https://www.mercadolivre.com.br/p/MLB1234567");
  });

  test("storage drops third-party links and junk", () => {
    const l = lerLista({
      itens: [
        {
          id: "a",
          titulo: "A",
          loja: "mercadolivre",
          url: ML,
          linkAfiliado: "https://www.mercadolivre.com.br/x?matt_word=outro",
        },
        { id: "b", titulo: "B", loja: "shopee", linkAfiliado: "https://shopee.com.br/x" },
        "lixo",
      ],
    });
    expect(l.itens.map((i) => i.id)).toEqual(["a"]);
    expect(l.itens[0]!.linkAfiliado).toBeNull();
  });

  test("toggle and merge keep the latest event per item", () => {
    const item = itemDoProduto({ chave: "x", titulo: "Fone", url: ML, link: "https://meli.la/AbC12" }, t0)!;
    const a = alternar({ itens: [], removidos: {} }, item, t0);
    const b = remover(a, [item.id], t1);
    expect(b.itens).toHaveLength(0);
    expect(juntar(a, b).itens).toHaveLength(0); // removal on another device wins
    const c = alternar(b, item, new Date("2026-11-05T12:00:00Z"));
    expect(juntar(b, c).itens).toHaveLength(1); // re-added later wins
  });

  test("WhatsApp text carries only affiliate links", () => {
    const com = itemDoProduto(
      { chave: "x", titulo: "Fone *top*", preco: 199.9, url: ML, link: "https://meli.la/AbC12" },
      t0,
    )!;
    const sem = itemDoProduto(
      { chave: "y", titulo: "Mouse", url: "https://produto.mercadolivre.com.br/MLB-1234567890" },
      t0,
    )!;
    const txt = textoWhatsApp([com, sem]);
    expect(txt).not.toContain("mercadolivre.com.br");
    expect(txt).not.toContain("Mouse");
    expect(txt).toContain("Fone top");
    expect(txt.match(/https?:\/\/\S+/g)).toEqual(["https://meli.la/AbC12"]);
  });
});
