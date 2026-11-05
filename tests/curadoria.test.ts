import { expect, test } from "bun:test";
import { aprovadoPeloCurador, curarResultados } from "@/lib/curadoria";

const id = (x: string) => x;
test("brinquedo nunca aparece numa busca de skincare", () => {
  expect(aprovadoPeloCurador("kit skincare", "Kit Skincare Poderosa Zona Criativa")).toBe(false);
  expect(aprovadoPeloCurador("brinquedo maquiagem infantil", "Kit Maquiagem Infantil Brinquedo")).toBe(true);
});
test("calçado masculino sai da busca feminina", () => {
  expect(aprovadoPeloCurador("chinelo feminino", "Chinelo Kenner Kivah Line")).toBe(false);
});
test("mesmo modelo em outra cor aparece uma vez", () => {
  const r = curarResultados("tenis feminino", [
    "Tênis Feminino Vili Olimp Caminhada Academia Rosa",
    "Tênis Feminino Vili Olimp Caminhada Academia Verde",
  ], id);
  expect(r.length).toBe(1);
});
test("melhor marca primeiro entre resultados equivalentes", () => {
  const r = curarResultados("hidratante facial", ["Hidratante Facial Genérico Xyz", "Hidratante Facial Cerave 52g"], id);
  expect(r[0]).toBe("Hidratante Facial Cerave 52g");
});
test("no verão, sandália vem antes de bota", () => {
  const r = curarResultados("calçado feminino", ["Bota Feminina Cano Curto", "Sandália Feminina Rasteira Moda"], id, new Date("2026-12-10T12:00:00Z"));
  expect(r[0]).toBe("Sandália Feminina Rasteira Moda");
});
