import { expect, test } from "bun:test";

import { ampliarTermos, aprovadoNaVitrine, contextoDaVitrine } from "@/lib/amigo-secreto-curadoria";
import { interpretarLocal } from "@/lib/amigo-secreto-parser-local";
import { arquetipoDoTitulo, intercalarPorDiversidade } from "@/lib/curadoria";

test("intercala arquétipos sem perder nem repetir itens", () => {
  const titulos = [
    "Vaso Decorativo Cerâmica Branco",
    "Vasos Decorativos Kit 3",
    "Vaso de Vidro Moderno",
    "Luminária de Mesa LED",
    "Quadro Decorativo Abstrato",
    "Vaso Centro de Mesa",
    "Luminária Abajur Quarto",
  ];
  const r = intercalarPorDiversidade(titulos, arquetipoDoTitulo);
  expect(r.length).toBe(titulos.length);
  expect(new Set(r).size).toBe(titulos.length);
  expect(r.slice(0, 3).map(arquetipoDoTitulo)).toEqual(["vaso", "luminaria", "quadro"]);
});

test("joias femininas: modernas, sem noiva, tiara nem corte masculino", () => {
  const v = interpretarLocal("brincos e colares prata", "Juliana").vitrines[0]!;
  expect(v.termos[0]).toContain("choker");
  const c = contextoDaVitrine({ titulo: v.titulo, termosBusca: v.termos }, "brincos e colares prata", "Juliana");
  expect(aprovadoNaVitrine("Tiara Noiva Strass Prata", c)).toBe(false);
  expect(aprovadoNaVitrine("Corrente Grumet Prata 925 60cm", c)).toBe(false);
  expect(aprovadoNaVitrine("Brinco Argola Gota Chunky Prata 925", c)).toBe(true);
});

test("decoração ganha pool equilibrado e não abre com vaso", () => {
  const v = interpretarLocal("decoração de casa").vitrines[0]!;
  expect(v.termos[0]).not.toMatch(/vaso/);
  const c = contextoDaVitrine({ titulo: v.titulo, termosBusca: v.termos }, "decoração de casa");
  const t = ampliarTermos(v.termos, c);
  expect(t.length).toBe(16);
  expect(t.filter((x) => /vaso/.test(x)).length).toBeLessThanOrEqual(1);
});

test("lote de etiquetas e peças a granel saem das joias", () => {
  const c = contextoDaVitrine({ titulo: "Bijuterias e semijoias", termosBusca: ["choker prata"] }, "colar", "Juliana");
  expect(aprovadoNaVitrine("250 Un Tag Gravata Brincos Corrente Pulseira", c)).toBe(false);
  expect(aprovadoNaVitrine("Choker Borboleta Prata 925", c)).toBe(true);
});

test("cozinha ganha louça de cerâmica e caneca política sai", () => {
  const v = interpretarLocal("coisas de cozinha").vitrines[0]!;
  const c = contextoDaVitrine({ titulo: v.titulo, termosBusca: v.termos }, "coisas de cozinha");
  expect(ampliarTermos(v.termos, c).concat()).toBeDefined();
  expect(aprovadoNaVitrine("Kit 2 Canecas Eleições Lula Vidro 225ml", c)).toBe(false);
  expect(aprovadoNaVitrine("Conjunto 6 Pratos Fundos Oxford Ryo Maresia 22,5cm", c)).toBe(true);
});
