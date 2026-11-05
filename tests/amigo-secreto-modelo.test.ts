import { expect, test } from "bun:test";
import { assinaturaDoModelo } from "@/lib/amigo-secreto-busca";

test("mesmo modelo em outra cor tem a mesma assinatura", () => {
  expect(assinaturaDoModelo("Tênis Feminino Vili Olimp Caminhada Academia Rosa")).toBe(
    assinaturaDoModelo("Tênis Feminino Vili Olimp Caminhada Academia Verde"),
  );
  expect(assinaturaDoModelo("Sandália Feminina Salto Baixo Bloco Vizzano")).not.toBe(
    assinaturaDoModelo("Tênis Feminino Vili Olimp Caminhada Academia"),
  );
});
