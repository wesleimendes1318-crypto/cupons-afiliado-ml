import { describe, expect, test } from "bun:test";

import { vantagensDaOferta } from "@/lib/vantagens-oferta";

describe("vantagensDaOferta", () => {
  test("só o que foi lido, na ordem", () => {
    const v = vantagensDaOferta(
      {
        preco: 3999,
        freteGratis: true,
        mercadoLider: "gold",
        avaliacoes: { nota: 4.87, total: 1200 },
      },
      { preco: 4299 },
    );
    expect(v[0]).toContain("300,00 a menos");
    expect(v).toContain("Frete grátis");
    expect(v).toContain("Vendedor MercadoLíder");
    expect(v.at(-1)).toContain("Nota 4,8 de 5");
  });
  test("mais cara, frete desconhecido e nota baixa: nenhuma vantagem inventada", () => {
    expect(
      vantagensDaOferta(
        { preco: 5000, freteGratis: null, avaliacoes: { nota: 4.2, total: 9 } },
        { preco: 4299 },
      ),
    ).toEqual([]);
  });
  test("nacional contra colado importado", () => {
    expect(vantagensDaOferta({ preco: 10 }, { preco: null, internacional: true })).toEqual([
      "Enviado do Brasil, sem imposto de importação no pagamento",
    ]);
  });
});
