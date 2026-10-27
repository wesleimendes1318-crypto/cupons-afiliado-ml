import { describe, expect, test } from "bun:test";

import { ordenarPorPontuacao, pontuarItemVitrine } from "@/lib/vitrines-ranking";

describe("pontuarItemVitrine", () => {
  test("pesos máximos somam 1", () => {
    expect(
      pontuarItemVitrine({
        nota: 5,
        totalAvaliacoes: 50,
        economiaReais: 20,
        freteGratis: true,
        origemEmAlta: "vendidos",
        lojaOficial: true,
      }),
    ).toBeCloseTo(1);
  });

  test("nota abaixo de 4,5 e campos ausentes não pontuam (só a origem base)", () => {
    expect(pontuarItemVitrine({ nota: 4.4, totalAvaliacoes: 900 })).toBeCloseTo(0.15);
    expect(pontuarItemVitrine({})).toBeCloseTo(0.15);
  });

  test("procura: vendidos > tendência > curadoria", () => {
    const v = pontuarItemVitrine({ origemEmAlta: "vendidos" });
    const t = pontuarItemVitrine({ origemEmAlta: "tendencia" });
    const c = pontuarItemVitrine({ origemEmAlta: "curadoria" });
    expect(v).toBeGreaterThan(t);
    expect(t).toBeGreaterThan(c);
  });

  test("economia só conta a partir de R$ 20", () => {
    expect(pontuarItemVitrine({ economiaReais: 19.99 })).toBeCloseTo(0.15);
    expect(pontuarItemVitrine({ economiaReais: 20 })).toBeCloseTo(0.3);
  });

  test("ordenar é estável no empate", () => {
    const l = [
      { id: "a", nota: 4.6 },
      { id: "b", nota: 4.9, total: 60 },
      { id: "c", nota: 4.6 },
    ];
    expect(
      ordenarPorPontuacao(l, (x) => ({ nota: x.nota, totalAvaliacoes: x.total })).map((x) => x.id),
    ).toEqual(["b", "a", "c"]);
  });
});
