import { describe, expect, test } from "bun:test";

import { ofertaExtraBlackFriday } from "@/lib/black-friday";
import { freteAbsurdo, precoAbsurdo, semOfertasImpossiveis } from "@/lib/preco-suspeito";

describe("price out of scale (28/11)", () => {
  test("x1000 misreads are hidden, real expensive items stay", () => {
    expect(precoAbsurdo(4664550)).toBe(true);
    expect(precoAbsurdo("98919")).toBe(true);
    expect(precoAbsurdo(26833.71)).toBe(false);
    expect(precoAbsurdo(null, 3599)).toBe(false);
  });

  test("Black Friday card with a x1000 price is dropped", () => {
    const linha = {
      chave: "X",
      titulo: "Console Playstation 5 Digital Edition Branco/preto",
      imagem: null,
      tipo: "menor",
      preco: 4664550,
      antes: 4664550,
      economia: 0,
      loja: null,
      link: "https://meli.la/1kHXNCK",
      url_produto: null,
      visto_em: new Date().toISOString(),
      loja_oficial: false,
      fonte: "comparado",
    } as const;
    expect(ofertaExtraBlackFriday(linha as never)).toBeNull();
  });

  test("absurd shipping becomes unknown, normal shipping stays", () => {
    expect(freteAbsurdo(6097.56, 279.9)).toBe(true);
    expect(freteAbsurdo(74.99, 15)).toBe(false);
    expect(freteAbsurdo(450, 5000)).toBe(false);
    const a = semOfertasImpossiveis({
      preco: 344.35,
      final: true,
      parecidos: [
        { preco: 279.9, custoFrete: 6097.56, freteGratis: false },
        { preco: 312, custoFrete: 0, freteGratis: true },
      ],
    } as never) as { parecidos: Array<{ custoFrete: number | null; freteGratis: boolean | null }> };
    expect(a.parecidos[0]).toMatchObject({ custoFrete: null, freteGratis: null });
    expect(a.parecidos[1]).toMatchObject({ custoFrete: 0, freteGratis: true });
  });
});
