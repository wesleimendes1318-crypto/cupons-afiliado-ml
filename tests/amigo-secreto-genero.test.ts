import { expect, test } from "bun:test";

import { aprovadoNaVitrine, contextoDaVitrine, generoDaPessoa } from "@/lib/amigo-secreto-curadoria";
import { interpretarLocal } from "@/lib/amigo-secreto-parser-local";

test("o nome define o gênero quando o texto não diz", () => {
  expect(generoDaPessoa("corrente prata e pulseira", "Vinicius")).toBe("masculino");
  expect(generoDaPessoa("corrente prata", "Juliana")).toBe("feminino");
  expect(generoDaPessoa("brinco de argola", "Vinicius")).toBe("masculino");
  expect(generoDaPessoa("presente feminino", "Vinicius")).toBe("feminino");
  expect(generoDaPessoa("caneca", "Alex")).toBeNull();
});

test("Vinicius: joias masculinas, nunca conjunto de noiva", () => {
  const lida = interpretarLocal("corrente prata, pulseira", "Vinicius");
  const joia = lida.vitrines.find((v) => /joias/i.test(v.titulo))!;
  expect(joia.titulo).toContain("masculinos");
  expect(joia.termos.every((t) => !/ponto de luz|ear cuff|riviera|vivara/.test(t))).toBe(true);
  const c = contextoDaVitrine({ titulo: joia.titulo, termosBusca: joia.termos }, "corrente prata, pulseira", "Vinicius");
  expect(c.tipo).toBe("joia");
  expect(aprovadoNaVitrine("Conjunto Colar e Brinco Strass Noivas Prata", c)).toBe(false);
  expect(aprovadoNaVitrine("Corrente Masculina Prata 925 Grumet 60cm", c)).toBe(true);
});

test("gênero vale em toda vitrine, não só roupa", () => {
  const c = contextoDaVitrine({ titulo: "Perfumes", termosBusca: ["perfume"] }, "perfume", "Bruno");
  expect(aprovadoNaVitrine("Perfume Feminino Floral 100ml", c)).toBe(false);
  expect(aprovadoNaVitrine("Perfume Unissex Amadeirado 100ml", c)).toBe(true);
  const f = contextoDaVitrine({ titulo: "Perfumes", termosBusca: ["perfume"] }, "perfume", "Camila");
  expect(aprovadoNaVitrine("Perfume Masculino Amadeirado", f)).toBe(false);
});

test("camiseta oversized vira vitrine de roupas com termos limpos", () => {
  const lida = interpretarLocal("alguma camiseta oversized masculina");
  const r = lida.vitrines.find((v) => v.titulo === "Roupas masculinas")!;
  expect(r.termos[0]).toBe("camiseta oversized masculina");
  expect(r.termos.length).toBeGreaterThanOrEqual(4);
  expect(lida.vitrines.some((v) => /alguma/i.test(v.titulo))).toBe(false);
});

test("roupa de academia continua na vitrine de academia", () => {
  const lida = interpretarLocal("legging e top de academia, tamanho M");
  expect(lida.vitrines.some((v) => /academia/i.test(v.titulo))).toBe(true);
  expect(lida.vitrines.some((v) => /^Roupas( femininas)?$/.test(v.titulo))).toBe(false);
});
