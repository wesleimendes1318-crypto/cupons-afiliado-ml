import { describe, expect, test } from "bun:test";
import {
  dicasDaEspera,
  etapaDaEspera,
  formatarSegundos,
  microEstadosDoLink,
  progressoDaEspera,
  relogioDaEspera,
} from "@/lib/espera";

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

describe("espera do link colado", () => {
  test("frete só aparece com o CEP da pessoa", () => {
    expect(microEstadosDoLink("outras-lojas", null).join(" ")).not.toMatch(/frete/i);
    expect(microEstadosDoLink("outras-lojas", "08700-000")).toContain(
      "Simulando o frete para o CEP 08700-000",
    );
    expect(dicasDaEspera(null).some((d) => d.tipo === "frete")).toBe(false);
    expect(dicasDaEspera("08700-000").some((d) => d.tipo === "frete")).toBe(true);
  });
  test("toda fase real tem ao menos uma frase, e nenhuma promete o que não faz", () => {
    for (const f of ["enviando", "na-fila", "outras-lojas", "lendo", "outra"]) {
      const m = microEstadosDoLink(f, "01001-000");
      expect(m.length).toBeGreaterThan(0);
      expect(m.join(" ")).not.toMatch(/centenas|milhares|golpe/i);
    }
  });
  test("relógio ancorado na medição real", () => {
    expect(formatarSegundos(5)).toBe("5s");
    expect(formatarSegundos(65)).toBe("1min 05s");
    expect(relogioDaEspera(3, null)).toEqual({ titulo: "Comparando há 3s", nota: null, pct: null });
    const dentro = relogioDaEspera(10, { segundos: 30, amostras: 40 });
    expect(dentro.titulo).toBe("Pronto em cerca de 20s");
    expect(dentro.pct).toBe(33);
    const passou = relogioDaEspera(45, { segundos: 30, amostras: 40 });
    expect(passou.pct).toBeNull();
    expect(passou.titulo).toMatch(/Finalizando/);
  });
});
