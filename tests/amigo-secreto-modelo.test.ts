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

test("modelos diferentes com o começo do título igual não se fundem", () => {
  expect(assinaturaDoModelo("Tênis Feminino Casual Academia Caminhada Leve Vili Olimp")).not.toBe(
    assinaturaDoModelo("Tênis Feminino Casual Academia Caminhada Leve Actvitta Knit"),
  );
});
