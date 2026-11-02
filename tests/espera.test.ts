import { describe, expect, test } from "bun:test";
import { etapaDaEspera, progressoDaEspera } from "@/lib/espera";

describe("espera ativa", () => {
  test("barra rápida no começo, nunca passa de 90%", () => {
    expect(progressoDaEspera(0)).toBe(0);
    expect(progressoDaEspera(300)).toBeCloseTo(0.4);
    expect(progressoDaEspera(2000)).toBeCloseTo(0.8);
    expect(progressoDaEspera(600_000)).toBeLessThanOrEqual(0.9);
    let antes = 0;
    for (let ms = 0; ms <= 60_000; ms += 500) {
      const p = progressoDaEspera(ms);
      expect(p).toBeGreaterThanOrEqual(antes);
      antes = p;
    }
  });
  test("etapas por tempo", () => {
    expect(etapaDaEspera(0)).toBe(0);
    expect(etapaDaEspera(1600)).toBe(1);
    expect(etapaDaEspera(3500)).toBe(2);
    expect(etapaDaEspera(40_000)).toBe(3);
  });
});
