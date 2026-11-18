import { expect, test } from "bun:test";

import { buscarCategoria } from "../src/content/categorias";

// 18/11/2026: departamentos sem texto editorial eram o ponto fraco do AdSense.
const NOVOS = ["moveis", "saude", "pet", "esportes", "bebes", "mercado", "papelaria"];

for (const slug of NOVOS) {
  test(`categoria ${slug}: texto editorial dentro das regras`, () => {
    const c = buscarCategoria(slug);
    expect(c).toBeDefined();
    expect(c!.comoAvaliar.length).toBeGreaterThanOrEqual(4);
    expect(c!.comoAvaliar.length).toBeLessThanOrEqual(6);
    expect(c!.cuidados.length).toBeGreaterThanOrEqual(4);
    expect(c!.cuidados.length).toBeLessThanOrEqual(6);
    expect(c!.perguntas.length).toBeGreaterThanOrEqual(3);
    expect(c!.perguntas.length).toBeLessThanOrEqual(4);
    const texto = [
      c!.chamada,
      ...c!.comoAvaliar,
      ...c!.cuidados,
      ...c!.perguntas.flatMap((p) => [p.pergunta, p.resposta]),
    ].join("\n");
    expect(texto).not.toMatch(/\d/); // nenhum número inventado
    expect(texto).not.toMatch(/cupo/i); // a página esconderia o item
    expect(texto).not.toContain("—");
  });
}
