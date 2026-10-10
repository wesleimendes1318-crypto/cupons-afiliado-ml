import { describe, expect, test } from "bun:test";

import { decisaoDaTela, enviadoSemLink, opcoesDaAnalise } from "@/lib/ajudar-escolher";
import { quandoFoiLido } from "@/lib/busca-guiada-cliente";
import { mensagemDaComparacao } from "@/lib/telegram";

/* Pedido 1215 (10/10): o link da ficha do catálogo foi descartado e o
   anúncio colado (R$ 8 + frete R$ 7,99) ficou sem link de afiliado. */
const analise = {
  titulo: "Pó Facial Banana Fenzza Makeup",
  preco: 8,
  vendedor: "gloriosoachado",
  freteGratis: false,
  custoFrete: 7.99,
  referencias: [
    {
      vendedor: "Santa Achou",
      final: 8,
      preco: 8,
      freteGratis: false,
      custoFrete: 9.99,
      link: "https://meli.la/1JY8wQg",
      url: "https://www.mercadolivre.com.br/p/MLB21600949?pdp_filters=item_id%3AMLB7359965814",
    },
    {
      vendedor: "VITORIAACESSORIOSVARIEDADES",
      final: 12,
      preco: 12,
      freteGratis: false,
      custoFrete: 7.99,
      link: "https://meli.la/2JhNjxj",
    },
  ],
};
const urlColado =
  "https://www.mercadolivre.com.br/p/MLB23095587?pdp_filters=item_id%3AMLB5141126371";

describe("anúncio enviado sem link de afiliado", () => {
  test("entra só como referência de preço", () => {
    const opcoes = opcoesDaAnalise(analise, null);
    expect(opcoes.some((o) => o.tipo === "colado")).toBe(false);
    const enviado = enviadoSemLink(analise, opcoes);
    expect(enviado?.preco).toBe(8);
    expect(enviado?.link).toBe("");
    /* Com o link do colado, nada muda. */
    expect(enviadoSemLink(analise, opcoesDaAnalise(analise, "https://meli.la/abc123"))).toBeNull();
  });

  test("mais barato pelo total: nenhuma loja vira a melhor opção", () => {
    const opcoes = opcoesDaAnalise(analise, null);
    const { melhorMesmo } = decisaoDaTela(opcoes, enviadoSemLink(analise, opcoes));
    expect(melhorMesmo).toBeNull();
  });

  test("o bot indica o anúncio enviado e manda comprar pelo site", () => {
    const { texto } = mensagemDaComparacao(analise, null, urlColado);
    expect(texto).toContain("o anúncio que você enviou já é o melhor preço");
    expect(texto).toContain("https://melhorescolha.io/?link=");
    expect(texto).not.toContain("R$ 0,00 a menos");
    expect(texto).not.toContain("1gs8n9j");
  });

  test("loja mais barata que o enviado: a diferença é contra o enviado", () => {
    const a = { ...analise, preco: 20, freteGratis: true, custoFrete: null };
    const { texto } = mensagemDaComparacao(a, null, urlColado);
    expect(texto).toMatch(/o mesmo produto por R\$\s?2,01 a menos/);
  });
});

describe("hora do preço da busca guiada", () => {
  const agora = Date.parse("2026-10-10T18:00:00Z");
  test("agora, hora de Brasília ou mais de um dia", () => {
    expect(quandoFoiLido(undefined, agora)).toBe("agora");
    expect(quandoFoiLido("2026-10-10T17:55:00Z", agora)).toBe("agora");
    expect(quandoFoiLido("2026-10-10T14:05:00Z", agora)).toBe("às 11:05");
    expect(quandoFoiLido("2026-10-08T14:05:00Z", agora)).toBe("há mais de um dia");
  });
});
