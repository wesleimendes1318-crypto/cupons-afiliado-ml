import { describe, expect, test } from "bun:test";
import { obterNatalBrasilia, resumoDoPrazo, textoDaEntrega } from "@/lib/prazo-entrega";

/* 05/11/2026 22:30 em Brasília = 06/11 01:30 UTC: "hoje" ainda é 05/11. */
const noite = new Date("2026-11-06T01:30:00Z");

describe("data de entrega no cartão", () => {
  test("usa a opção que chega antes e a data MAIS TARDIA da faixa", () => {
    const r = resumoDoPrazo({
      opcoes: [
        { custo: 0, de: "2026-11-10", ate: "2026-11-12", tipo: "slow" },
        { custo: 19.9, de: "2026-11-06", ate: "2026-11-07", tipo: "two_days" },
      ],
    });
    expect(r).toEqual({
      chega_ate: "2026-11-07",
      tipo: "two_days",
      custo: 19.9,
      frete_gratis: false,
    });
  });
  test("sem estimativa não inventa data", () => {
    expect(resumoDoPrazo(null)).toBeNull();
    expect(resumoDoPrazo({ opcoes: [] })).toBeNull();
  });
  test("textos no fuso de Brasília, mesmo à noite", () => {
    const r = { tipo: null, custo: 0, frete_gratis: false };
    expect(textoDaEntrega({ ...r, chega_ate: "2026-11-05" }, noite)).toEqual({
      texto: "Receba hoje",
      rapida: true,
    });
    expect(textoDaEntrega({ ...r, chega_ate: "2026-11-06" }, noite)).toEqual({
      texto: "Chega amanhã, 06/11",
      rapida: true,
    });
    expect(textoDaEntrega({ ...r, chega_ate: "2026-11-10" }, noite)).toEqual({
      texto: "Chega até ter., 10/11",
      rapida: false,
    });
    expect(textoDaEntrega({ ...r, chega_ate: "2026-11-06", frete_gratis: true }, noite).texto).toBe(
      "Frete grátis · chega amanhã, 06/11",
    );
  });
  test("chip de Natal só na temporada", () => {
    expect(obterNatalBrasilia(noite)).toBe("2026-12-24");
    expect(obterNatalBrasilia(new Date("2026-10-20T15:00:00Z"))).toBeNull();
    expect(obterNatalBrasilia(new Date("2026-12-26T15:00:00Z"))).toBeNull();
  });
});
