import { describe, expect, test } from "bun:test";

import { ofertaExtraBlackFriday } from "@/lib/black-friday";
import { ofertaDo } from "@/lib/ofertas-vitrine";
import { precoImpossivel, semOfertasImpossiveis, vitrineSemImpossivel } from "@/lib/preco-suspeito";

/* 27/11: PS5 Slim R$ 4.850 stored a "same product" mini game at R$ 20,34. */
const ps5 = {
  chave: "MLB8059853222",
  titulo: "Console PlayStation® 5 Slim Edição Digital 825 GB Branco - Sony",
  imagem: null,
  categoria: null,
  categoria_site: "eletronicos",
  loja: null,
  preco: 4850,
  url_produto: "https://www.mercadolivre.com.br/p/MLB29001054?pdp_filters=item_id%3AMLB8059853222",
  link: "https://meli.la/2wMMWJT",
  melhor_loja: null,
  melhor_preco: 20.34,
  melhor_link: "https://meli.la/1Jaxy6H",
  economia: 4829.66,
  lojas_comparadas: 3,
  vezes: 1,
  visto_em: new Date().toISOString(),
  cupom_codigo: null,
  cupom_desconto: null,
  alt_preco: null,
  alt_economia: null,
  alt_titulo: null,
  alt_link: null,
  alt_loja: null,
  alt_oficial: null,
  alt_vantagem: null,
  alt_frete_gratis: null,
  alt_muda: null,
};

describe("preço impossível do mesmo produto", () => {
  test("metade do preço ou menos", () => {
    expect(precoImpossivel(20.34, 4850)).toBe(true);
    expect(precoImpossivel("2424", "4850")).toBe(true);
    expect(precoImpossivel(4799.99, 4850)).toBe(false);
    expect(precoImpossivel(null, 4850)).toBe(false);
    expect(precoImpossivel(20, null)).toBe(false);
  });

  test("vitrine fica com a oferta do próprio anúncio", () => {
    const v = vitrineSemImpossivel(ps5);
    expect(v.melhor_preco).toBeNull();
    expect(v.melhor_link).toBeNull();
    expect(v.economia).toBeNull();
    expect(v.link).toBe("https://meli.la/2wMMWJT");
    expect(ofertaDo(ps5)).toBeNull();
    const boa = { ...ps5, melhor_preco: 4600, economia: 250, melhor_link: "https://meli.la/abc" };
    expect(vitrineSemImpossivel(boa)).toBe(boa);
  });

  test("análise perde só a loja impossível", () => {
    const a = semOfertasImpossiveis({
      preco: 4850,
      outraLoja: { final: 20.34, preco: 20.34 },
      outrasLojas: [
        { final: 20.34, preco: 20.34 },
        { final: 4700, preco: 4700 },
      ],
    });
    expect(a.outrasLojas).toEqual([{ final: 4700, preco: 4700 }]);
    expect(a.outraLoja).toEqual({ final: 4700, preco: 4700 });
  });

  test("Black Friday não mostra o cartão", () => {
    const linha = {
      chave: ps5.chave,
      titulo: ps5.titulo,
      imagem: null,
      tipo: "mesmo",
      preco: 20.34,
      antes: 4850,
      economia: 4829.66,
      loja: null,
      link: "https://meli.la/1Jaxy6H",
      url_produto: ps5.url_produto,
      visto_em: ps5.visto_em,
      loja_oficial: false,
      fonte: "comparado",
    };
    expect(ofertaExtraBlackFriday(linha as never)).toBeNull();
  });
});
