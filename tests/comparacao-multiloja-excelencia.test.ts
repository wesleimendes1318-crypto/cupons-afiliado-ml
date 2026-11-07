import { describe, expect, it } from "bun:test";
import { ehLinkDeCompra } from "@/lib/afiliado";
import { escolherCandidatos } from "@/lib/coletor-multiloja";
import {
  celulaDoFrete,
  decidirEntreMarketplaces,
  linhaDoFrete,
  type OfertaDoJogador,
} from "@/lib/comparacao-marketplaces";
import { limparResultado } from "@/lib/multiloja-resultado";
import { travaDeComparacao } from "@/lib/modelo-titulo";

const oferta = (o: Partial<OfertaDoJogador> & Pick<OfertaDoJogador, "jogador" | "preco">) =>
  ({
    titulo: null,
    loja: null,
    freteGratis: null,
    custoFrete: null,
    notaFrete: null,
    prime: false,
    oficial: false,
    link: null,
    ...o,
  }) as OfertaDoJogador;

describe("trava de marca e ecossistema", () => {
  it("capinha de iPhone recusa capas da Samsung", () => {
    const o = "Capinha iPhone 17 Pro Max MagSafe Transparente";
    expect(travaDeComparacao(o, "Capa Samsung Galaxy A55 Anti Impacto")).toEqual({
      descartar: "Outra marca",
    });
    expect(travaDeComparacao(o, "Capinha Galaxy S24 Transparente")).toEqual({
      descartar: "Outra marca",
    });
    expect(travaDeComparacao(o, "Capa Capinha iPhone 17 Pro Max MagSafe Transparente")).toBeNull();
  });

  it("PlayStation 5 recusa acessórios de Xbox e Switch", () => {
    const o = "Console Sony PlayStation 5 Slim 1TB";
    expect(travaDeComparacao(o, "Controle Xbox Series X Sem Fio")).toEqual({
      descartar: "Outra marca",
    });
    expect(travaDeComparacao(o, "Nintendo Switch OLED 64GB")).toEqual({ descartar: "Outra marca" });
    expect(travaDeComparacao(o, "Sony PlayStation 5 Slim Digital 1TB")).toBeNull();
  });
});

describe("peça ou acessório no lugar do aparelho", () => {
  const iphone = "Apple iPhone 16 128GB Preto";
  it("carcaça, display e capa nunca são o iPhone 16", () => {
    for (const t of [
      "Carcaça iPhone 16 Com Botões",
      "Display Tela iPhone 16 Original",
      "Capa Silicone iPhone 16",
      "Película 3D iPhone 16",
      "Pulseira Para Apple Watch Series 9",
    ])
      expect(
        travaDeComparacao(t.startsWith("Pulseira") ? "Apple Watch Series 9 45mm" : iphone, t),
      ).toEqual({
        descartar: "Apenas peça / acessório",
      });
  });
  it("o aparelho continua valendo", () => {
    expect(travaDeComparacao(iphone, "iPhone 16 Apple 128GB Preto Lacrado")).toBeNull();
    expect(travaDeComparacao(iphone, "Apple iPhone 16 (128 GB) - Preto")).toBeNull();
  });
  it("acessório colado aceita o mesmo acessório", () => {
    expect(
      travaDeComparacao("Capa Silicone iPhone 16", "Capinha Silicone iPhone 16 Rosa"),
    ).toBeNull();
  });
});

describe("geração e versão", () => {
  it("iPhone 15 Pro Max e iPhone 16 base viram parecidos, com o que muda", () => {
    const o = "Apple iPhone 16 Pro Max 256GB Titânio";
    expect(travaDeComparacao(o, "Apple iPhone 15 Pro Max 256GB")).toEqual({
      muda: "Modelo: iPhone 16 Pro Max -> iPhone 15 Pro Max",
    });
    expect(travaDeComparacao(o, "Apple iPhone 16 256GB")).toEqual({
      muda: "Modelo: iPhone 16 Pro Max -> iPhone 16",
    });
  });
  it("Galaxy S24 x S24 Ultra", () => {
    expect(travaDeComparacao("Samsung Galaxy S24 256GB", "Samsung Galaxy S24 Ultra 256GB")).toEqual(
      { muda: "Modelo: Galaxy S24 -> Galaxy S24 Ultra" },
    );
  });
});

describe("tela final dos marketplaces (limparResultado)", () => {
  const base = {
    preco: 100,
    imagem: null,
    loja: null,
    freteGratis: true,
    custoFrete: null,
    notaFrete: null,
    selos: [],
    muda: null,
    semelhanca: 90,
    qualidade: "equivalente",
  };
  it("tira marca rival e peça; outra geração vira parecido", () => {
    const r = limparResultado(
      {
        lojas: [
          {
            ...base,
            id: "1",
            marketplace: "amazon",
            relacao: "mesmo",
            titulo: "Capa Galaxy S24",
            link: "https://www.amazon.com.br/dp/B0TESTE001?tag=melhoresc0fff-20",
          },
          {
            ...base,
            id: "2",
            marketplace: "shopee",
            relacao: "mesmo",
            titulo: "Carcaça iPhone 16",
            link: "https://s.shopee.com.br/abc123",
          },
          {
            ...base,
            id: "3",
            marketplace: "amazon",
            relacao: "mesmo",
            titulo: "Apple iPhone 15 128GB",
            link: "https://www.amazon.com.br/dp/B0TESTE003?tag=melhoresc0fff-20",
          },
          {
            ...base,
            id: "4",
            marketplace: "amazon",
            relacao: "mesmo",
            titulo: "Apple iPhone 16 128GB",
            link: "https://www.amazon.com.br/dp/B0TESTE004?tag=melhoresc0fff-20",
          },
        ],
      },
      "Apple iPhone 16 128GB Preto",
    );
    expect(r.lojas.map((l) => [l.id, l.relacao])).toEqual([
      ["4", "mesmo"],
      ["3", "parecido"],
    ]);
    expect(r.lojas[1]!.muda).toContain("Modelo: iPhone 16 -> iPhone 15");
  });

  it("link sem a tag do Weslei ou fora do afiliado nunca chega à tela", () => {
    const r = limparResultado(
      {
        lojas: [
          {
            ...base,
            id: "1",
            marketplace: "amazon",
            relacao: "mesmo",
            titulo: "Apple iPhone 16 128GB",
            link: "https://www.amazon.com.br/dp/B0TESTE001",
          },
          {
            ...base,
            id: "2",
            marketplace: "amazon",
            relacao: "mesmo",
            titulo: "Apple iPhone 16 128GB",
            link: "https://www.amazon.com.br/dp/B0TESTE002?tag=outro-20",
          },
          {
            ...base,
            id: "3",
            marketplace: "shopee",
            relacao: "mesmo",
            titulo: "Apple iPhone 16 128GB",
            link: "https://shopee.com.br/produto-i.1.2",
          },
        ],
      },
      "Apple iPhone 16 128GB Preto",
    );
    expect(r.lojas).toEqual([]);
  });

  it("só aceita os formatos de afiliado", () => {
    expect(ehLinkDeCompra("https://meli.la/1AbCdEf", "mercadolivre")).toBe(true);
    expect(
      ehLinkDeCompra("https://www.amazon.com.br/dp/B0TESTE001?tag=melhoresc0fff-20", "amazon"),
    ).toBe(true);
    expect(ehLinkDeCompra("https://s.shopee.com.br/abc123", "shopee")).toBe(true);
    expect(ehLinkDeCompra("https://produto.mercadolivre.com.br/MLB-123", "mercadolivre")).toBe(
      false,
    );
    expect(ehLinkDeCompra("https://www.amazon.com.br/dp/B0TESTE001", "amazon")).toBe(false);
  });

  it("candidatos de marca rival nem vão para a conferência pela foto", () => {
    const c = escolherCandidatos(
      [
        { titulo: "Capa Galaxy S24 Transparente", preco: 30 },
        { titulo: "Capa iPhone 17 Pro Max Transparente MagSafe", preco: 35 },
      ],
      { titulo: "Capinha iPhone 17 Pro Max Transparente MagSafe", preco: 40 },
    );
    expect(c.map((x) => x.titulo)).toEqual(["Capa iPhone 17 Pro Max Transparente MagSafe"]);
  });
});

describe("custo total", () => {
  it("frete a confirmar não vence total confirmado no Brasil", () => {
    const d = decidirEntreMarketplaces([
      oferta({ jogador: "mercadolivre", preco: 1000, freteGratis: true }),
      oferta({ jogador: "shopee", preco: 900 }),
    ]);
    expect(d.vencedor?.jogador).toBe("mercadolivre");
    expect(d.menorNoProduto?.jogador).toBe("shopee");
  });

  it("Prime é rotulado como só para assinantes e não vira frete grátis geral", () => {
    const prime = oferta({ jogador: "amazon", preco: 950, prime: true, notaFrete: "Prime" });
    expect(linhaDoFrete(prime)).toBe("Frete grátis só para assinantes Prime");
    expect(celulaDoFrete(prime)).toBe("Grátis só para assinantes Prime");
    const d = decidirEntreMarketplaces([
      oferta({ jogador: "mercadolivre", preco: 1000, custoFrete: 20 }),
      prime,
    ]);
    expect(d.vencedor?.jogador).toBe("mercadolivre");
  });

  it("empate abaixo de R$ 0,50: Mercado Livre primeiro, depois loja oficial", () => {
    const d = decidirEntreMarketplaces([
      oferta({ jogador: "amazon", preco: 500.3, freteGratis: true, oficial: true }),
      oferta({ jogador: "mercadolivre", preco: 500.5, freteGratis: true }),
    ]);
    expect(d.vencedor?.jogador).toBe("mercadolivre");
  });
});
