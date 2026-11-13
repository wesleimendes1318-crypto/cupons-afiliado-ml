import { describe, expect, test } from "bun:test";

import { lerDadosCategoria, textoDosDados } from "../src/lib/dados-categoria";

const linha = {
  categoria: "Ferramentas",
  comparados: 63,
  com_economia: 28,
  economia_mediana: "16.50",
  economia_mediana_pct: "11.8",
  economia_p90: "82.37",
  pequenas: 6,
  frete_conhecido: 27,
  mais_barata_cobra_frete: 0,
  inicio: "2026-10-18",
  fim: "2026-11-13",
};

describe("lerDadosCategoria", () => {
  test("maps the DB row and builds text only from its numbers", () => {
    const d = lerDadosCategoria([linha], "ferramentas");
    expect(d?.comparados).toBe(63);
    const t = textoDosDados("Ferramentas", d!).join(" ");
    expect(t).toContain("Comparei 63 anúncios de ferramentas entre 18/10/2026 e 13/11/2026");
    expect(t).toContain("Em 44% deles");
    expect(t).toContain("frete quase nunca inverte");
  });
  test("no block without data or below 20 comparisons", () => {
    expect(lerDadosCategoria(null, "ferramentas")).toBeNull();
    expect(lerDadosCategoria([{ ...linha, comparados: 12 }], "ferramentas")).toBeNull();
    expect(lerDadosCategoria([linha], "moveis")).toBeNull();
  });
});
