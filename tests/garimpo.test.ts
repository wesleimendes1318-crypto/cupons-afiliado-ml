import { describe, expect, test } from "bun:test";

import { limparGarimpo, melhorDoMesmo } from "@/lib/garimpo-cliente";
import { dadosDoHtml } from "@/lib/identificar-link";

describe("página da loja sem afiliação (preço, foto e categoria)", () => {
  const html = `<html><head>
    <meta property="og:title" content="Mouse Gamer Logitech G203 Lightsync RGB | Magalu">
    <meta property="og:image" content="https://a-static.mlcdn.com.br/450x450/mouse-gamer-logitech/123.jpg">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList",
      "itemListElement":[{"@type":"ListItem","position":1,"name":"Home"},
      {"@type":"ListItem","position":2,"name":"Informática"},{"@type":"ListItem","position":3,"name":"Mouse"}]}</script>
    <script type="application/ld+json">{"@type":"Product","name":"Mouse Gamer Logitech G203",
      "offers":{"@type":"Offer","price":"129.90","priceCurrency":"BRL"}}</script>
  </head></html>`;

  test("lê título, preço, foto e categoria da própria página", () => {
    const d = dadosDoHtml(html);
    expect(d.titulo).toBe("Mouse Gamer Logitech G203 Lightsync RGB");
    expect(d.preco).toBe(129.9);
    expect(d.imagem).toBe("https://a-static.mlcdn.com.br/450x450/mouse-gamer-logitech/123.jpg");
    expect(d.categoria).toBe("Informática > Mouse");
  });

  test("foto de servidor desconhecido não entra; sem preço, nada inventado", () => {
    const d = dadosDoHtml(
      `<meta property="og:title" content="Produto X Modelo Y"><meta property="og:image" content="https://evil.example.com/a.jpg">`,
    );
    expect(d.imagem).toBeNull();
    expect(d.preco).toBeNull();
  });

  test("preço no formato brasileiro do meta", () => {
    const d = dadosDoHtml(
      `<title>Geladeira Brastemp 375L</title><meta property="product:price:amount" content="3.599,00">`,
    );
    expect(d.preco).toBe(3599);
  });
});

describe("trava do resultado do garimpo (regra nº 1)", () => {
  const bruto = {
    original: {
      titulo: "Echo Dot 5ª geração",
      preco: 379.05,
      imagem: "https://m.media-amazon.com/images/I/71x.jpg",
      link: "https://www.amazon.com.br/dp/B09B8V1LZ3?tag=melhoresc0fff-20",
      selos: ["Prime"],
    },
    ofertas: [
      {
        marketplace: "amazon",
        id: "B000000001",
        titulo: "Echo Dot 5ª geração Smart speaker",
        preco: 349,
        link: "https://www.amazon.com.br/dp/B000000001?tag=melhoresc0fff-20",
        imagem: "https://m.media-amazon.com/images/I/1.jpg",
        relacao: "mesmo",
      },
      {
        marketplace: "amazon",
        id: "B000000002",
        titulo: "Echo Dot 5ª geração",
        preco: 300,
        link: "https://www.amazon.com.br/dp/B000000002?tag=outra-tag-20",
        relacao: "mesmo",
      },
      {
        marketplace: "amazon",
        id: "B000000003",
        titulo: "Echo Dot 5ª geração usado",
        preco: 200,
        link: "https://www.amazon.com.br/dp/B000000003?tag=melhoresc0fff-20",
        relacao: "mesmo",
      },
      {
        marketplace: "amazon",
        id: "B000000004",
        titulo: "Smart speaker Echo Pop",
        preco: 299,
        link: "https://www.amazon.com.br/dp/B000000004?tag=melhoresc0fff-20",
        imagem: "https://evil.example.com/x.jpg",
        relacao: "busca",
      },
    ],
    lidas: 20,
    conferidas: 4,
    conferencia: "ok",
  };

  test("só link de afiliado do Weslei, sem usado; busca nunca vira mesmo produto", () => {
    const r = limparGarimpo(bruto, "amazon");
    expect(r).not.toBeNull();
    const ids = r!.ofertas.map((o) => `${o.id}:${o.relacao}`);
    expect(ids).toEqual(["B000000001:mesmo", "B000000004:busca"]);
    expect(r!.ofertas[1]!.imagem).toBeNull();
    expect(r!.original.link).toContain("tag=melhoresc0fff-20");
    expect(melhorDoMesmo(r)?.id).toBe("B000000001");
  });

  test("link de outro afiliado no produto de origem é descartado", () => {
    const r = limparGarimpo(
      {
        ...bruto,
        original: { ...bruto.original, link: "https://www.amazon.com.br/dp/X?tag=x-20" },
      },
      "amazon",
    );
    expect(r!.original.link).toBeNull();
  });

  test("oferta de outro player não entra no garimpo da Shopee", () => {
    const r = limparGarimpo(bruto, "shopee");
    expect(r!.ofertas).toHaveLength(0);
  });
});
