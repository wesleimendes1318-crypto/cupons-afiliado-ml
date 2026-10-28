import { describe, expect, test } from "bun:test";

import { marketplaceDe } from "@/lib/afiliado";
import { arteDaBusca, ARTE_NEUTRA, arteDaCategoria } from "@/lib/artes";
import { produtosDaBusca } from "@/lib/busca-sugestoes";
import { faixaDaNota, idsDoEndereco, mesclarSemRepetir } from "@/lib/busca-resultados";

describe("resultados da busca por texto", () => {
  test("o mesmo anúncio do site e do catálogo vira um cartão só", () => {
    const local = [{ url: "https://produto.mercadolivre.com.br/MLB-4012345678-capa-iphone" }];
    const remoto = [
      {
        url: "https://www.mercadolivre.com.br/p/MLB2233445566?pdp_filters=item_id%3AMLB4012345678",
      },
      {
        url: "https://www.mercadolivre.com.br/p/MLB9988776655?pdp_filters=item_id%3AMLB4000000001",
      },
    ];
    const r = mesclarSemRepetir([local, remoto], (i) => i.url);
    expect(r).toHaveLength(2);
    expect(r[0]).toBe(local[0]);
    expect(idsDoEndereco(remoto[0]!.url)).toEqual(["MLB2233445566", "MLB4012345678"]);
  });

  test("nota acima de 4,5 na frente e nota baixa no fim, sem inventar", () => {
    const com = (nota: number) => ({
      item: "MLB1234567",
      avaliacoes: { nota, total: 10 },
      sem: false,
      detalhe: false,
    });
    expect(faixaDaNota(com(4.8) as never)).toBe(0);
    expect(faixaDaNota(undefined)).toBe(1);
    expect(faixaDaNota(com(4.5) as never)).toBe(2);
  });

  test("selo da loja pelo link de afiliado ou endereço", () => {
    expect(marketplaceDe("https://meli.la/1AbCdEf")).toBe("mercadolivre");
    expect(marketplaceDe("https://www.mercadolivre.com.br/p/MLB123456789")).toBe("mercadolivre");
    expect(marketplaceDe("https://amzn.to/3xYz12")).toBe("amazon");
    expect(marketplaceDe("https://s.shopee.com.br/AbC123")).toBe("shopee");
    expect(marketplaceDe("https://exemplo.com/x")).toBeNull();
  });

  test("arte pelo tema da busca, neutra no genérico", () => {
    expect(arteDaBusca("capinha iphone 17 pro max").id).toBe("celular-acessorios");
    expect(arteDaBusca("fone bluetooth").id).toBe("celular-acessorios");
    expect(arteDaBusca("panela de pressão").id).toBe(arteDaCategoria("casa")!.id);
    expect(arteDaBusca("presente para mãe")).toBe(ARTE_NEUTRA);
    /* 28/10: decoração de Natal mostrava panelas. */
    expect(arteDaBusca("decoração de natal").src).toBe("/campanhas/estudio-natal.webp");
    expect(arteDaBusca("cortina blackout")).toBe(ARTE_NEUTRA);
  });

  test("resposta imediata: só o que casa, sem réplica e sem peça", () => {
    const p = (titulo: string) => ({ titulo, imagem: null, preco: 10, url: `https://x/${titulo}` });
    const r = produtosDaBusca("iphone 15", [
      p("Apple iPhone 15 128 GB"),
      p("iPhone 15 réplica 1:1"),
      p("Carcaça iPhone 15 traseira"),
      p("Samsung Galaxy S24"),
    ]);
    expect(r.map((x) => x.titulo)).toEqual(["Apple iPhone 15 128 GB"]);
  });
});
