import { expect, test } from "bun:test";

import { kitsDoPresente, montarKit, type Candidato } from "@/lib/amigo-secreto-kit";
import type { Resultado } from "@/lib/busca-guiada-cliente";

const r = (id: number, nome: string, preco: number, extra: Partial<Resultado> = {}): Resultado => ({
  produto: `MLB${id}`,
  item: `MLB${id}0`,
  nome,
  imagem: null,
  preco,
  url: `https://meli.la/x${id}`,
  freteGratis: true,
  ...extra,
});
const cands: Candidato[] = [
  { r: r(1, "Perfume Floral 100ml", 45, { maisVendido: 3 }), grupo: "perfume" },
  { r: r(2, "Perfume Amadeirado 50ml", 55), grupo: "perfume" },
  { r: r(3, "Caneca Térmica Inox", 35, { lojaOficial: true }), grupo: "cozinha" },
  { r: r(4, "Livro Romance Best Seller", 40, { maisVendido: 20 }), grupo: "livros" },
  { r: r(5, "Vela Aromática Vidro", 25), grupo: "decoracao" },
  { r: r(6, "Fone Bluetooth", 95, { maisVendido: 1, freteGratis: false }), grupo: "eletronicos" },
];

test("kit cabe no teto, mistura categorias e ignora custo desconhecido", () => {
  const k = montarKit(cands, 100, { estilo: "custo", seed: 1, misturar: true })!;
  expect(k.total).toBeLessThanOrEqual(100);
  expect(k.itens.some((x) => x.nome.startsWith("Fone"))).toBe(false);
  expect(new Set(k.itens.map((x) => x.nome.split(" ")[0])).size).toBe(k.itens.length);
  expect(k.itens[0]!.maisVendido).toBe(3);
});

test("kit melhor fica entre o teto e +20%", () => {
  const { dentro, melhor } = kitsDoPresente(cands, 100, { estilo: "custo", seed: 2, misturar: true });
  expect(dentro!.total).toBeLessThanOrEqual(100);
  if (melhor) {
    expect(melhor.total).toBeGreaterThan(100);
    expect(melhor.total).toBeLessThanOrEqual(120);
  }
});

test("luxo usa no máximo 2 itens", () => {
  const k = montarKit(cands, 100, { estilo: "luxo", seed: 3, misturar: true })!;
  expect(k.itens.length).toBeLessThanOrEqual(2);
});

test("kit de custo nunca é 1 item só no teto (07/11)", () => {
  const caros: Candidato[] = [
    { r: r(7, "Espelho Orgânico Moldura", 99.99, { maisVendido: 3 }), grupo: "decor" },
    { r: r(8, "Luminária de Mesa", 89), grupo: "decor" },
  ];
  expect(montarKit(caros, 100, { estilo: "custo", seed: 1, misturar: false })).toBeNull();
  const k = montarKit([...caros, ...cands], 100, { estilo: "custo", seed: 1, misturar: false })!;
  expect(k.itens.length).toBeGreaterThanOrEqual(2);
  expect(k.itens.every((x) => x.preco <= 50)).toBe(true);
});

test("misturar com 2 vitrines ainda junta mais de 2 itens (07/11)", () => {
  const dois: Candidato[] = [
    { r: r(11, "Vela Aromática Vidro", 20), grupo: "decor" },
    { r: r(12, "Bandeja Espelhada", 24), grupo: "decor" },
    { r: r(13, "Luminária Touch", 30), grupo: "decor" },
    { r: r(14, "Caneca Inox", 18), grupo: "cozinha" },
  ];
  const k = montarKit(dois, 100, { estilo: "custo", seed: 1, misturar: true })!;
  expect(k.itens.length).toBeGreaterThanOrEqual(3);
  expect(new Set(k.itens.map((x) => x.produto)).size).toBe(k.itens.length);
  expect(k.total).toBeLessThanOrEqual(100);
});

test("kit respeita o mínimo escolhido pela pessoa (07/11)", () => {
  const baratos: Candidato[] = [
    { r: r(21, "Vela Aromática", 20), grupo: "a" },
    { r: r(22, "Caneca Inox", 18), grupo: "b" },
  ];
  expect(montarKit(baratos, 100, { estilo: "custo", seed: 1, misturar: true, minimo: 80 })).toBeNull();
  const k = montarKit(cands, 100, { estilo: "custo", seed: 1, misturar: true, minimo: 80 });
  if (k) expect(k.total).toBeGreaterThanOrEqual(80);
});
