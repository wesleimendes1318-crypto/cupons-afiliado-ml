import { describe, expect, test } from "bun:test";

import {
  aplicarEnvio,
  custoIncompleto,
  ordenarPorCustoTotal,
  custoTotalDaOferta,
  envioDasTags,
  tributosDoTexto,
} from "@/lib/internacional";

/* Caso real (Weslei, 01/11): Switch 2 MLB49200061, oferta MLB4487458199. */
const TRECHO = `<div>Tributações estimadas</div><div><span>Imposto de importação</span>
<span>R$ 1.579,89</span></div><div><span>ICMS</span><span>R$ 918,71</span></div>`;

describe("envio internacional e tributos", () => {
  test("lê o imposto de importação e o ICMS da página", () => {
    const t = tributosDoTexto(TRECHO);
    expect(t?.impostoImportacao).toBe(1579.89);
    expect(t?.icms).toBe(918.71);
    expect(t?.total).toBe(2498.6);
  });

  test("tags da lista oficial: cbt_item com cbt_fulfillment_us = EUA", () => {
    expect(envioDasTags(["kvs_primary", "cbt_fulfillment_us", "cbt_item"])).toEqual({
      internacional: true,
      paisOrigem: "EUA",
    });
    expect(envioDasTags(["kvs_primary", "cart_eligible"]).internacional).toBe(false);
  });

  test("custo real = produto + tributos lidos: R$ 5.404,92", () => {
    expect(
      custoTotalDaOferta({
        final: 2906.32,
        freteGratis: true,
        internacional: true,
        tributosEstimados: 2498.6,
      }),
    ).toBe(5404.92);
  });

  test("internacional sem tributos lidos não tem custo conhecido", () => {
    const o = { final: 2906.32, freteGratis: true, internacional: true };
    expect(custoTotalDaOferta(o)).toBeNull();
    expect(custoIncompleto(o)).toBe(true);
  });

  test("o nacional de R$ 4.277,91 vence o importado por R$ 1.127,01", () => {
    const nacional = custoTotalDaOferta({ final: 4277.91, freteGratis: true });
    const importado = custoTotalDaOferta({
      final: 2906.32,
      freteGratis: true,
      internacional: true,
      tributosEstimados: 2498.6,
    });
    expect(nacional).toBe(4277.91);
    expect(Math.round(((importado as number) - (nacional as number)) * 100) / 100).toBe(1127.01);
  });

  test("marca as ofertas pelas chaves da tela, sem apagar o que a extensão leu", () => {
    const a = aplicarEnvio(
      {
        referencias: [{ url: "x" }, { url: "y", internacional: false }],
      },
      {
        colado: { internacional: true, paisOrigem: "EUA" },
        "ref-0": { internacional: true, paisOrigem: "EUA" },
        "ref-1": { internacional: true, paisOrigem: "EUA" },
      },
    );
    expect(a.internacional).toBe(true);
    expect(a.referencias?.[0]?.internacional).toBe(true);
    expect(a.referencias?.[1]?.internacional).toBe(false);
  });
});

describe("ordenarPorCustoTotal", () => {
  test("importado sem tributos lidos nunca passa na frente da nacional mais barata", () => {
    const lista = [
      {
        id: "eua",
        final: 2906.32,
        freteGratis: true,
        internacional: true,
        tributosEstimados: null,
      },
      { id: "nac", final: 3999, freteGratis: true },
      {
        id: "eua-lido",
        final: 2906.32,
        freteGratis: true,
        internacional: true,
        tributosEstimados: 2498.6,
      },
      { id: "frete", final: 3800, freteGratis: false, custoFrete: 50 },
    ];
    expect(ordenarPorCustoTotal(lista).map((o) => o.id)).toEqual([
      "frete",
      "nac",
      "eua-lido",
      "eua",
    ]);
  });
});
