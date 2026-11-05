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

import { idDaFoto, quaseIgual, palavrasDoModelo, repetido } from "@/lib/curadoria";

test("mesma foto do Mercado Livre tem o mesmo id em tamanhos diferentes", () => {
  const a = idDaFoto("https://http2.mlstatic.com/D_NQ_NP_2X_812345-MLB71234567890_092024-F.webp");
  expect(a).toBe("foto:812345-MLB71234567890_092024");
  expect(idDaFoto("https://http2.mlstatic.com/D_812345-MLB71234567890_092024-O.jpg")).toBe(a);
  expect(idDaFoto("https://exemplo.com/x.jpg")).toBeNull();
});

test("kit, 3x e grafia dobrada não fazem o mesmo produto aparecer duas vezes", () => {
  expect(assinaturaDoModelo("Kit 3x Máscara Multirrestauradora Wella Fusion 150ml")).toBe(
    assinaturaDoModelo("Máscara Multirestauradora Wella Fusion 3un"),
  );
  expect(palavrasDoModelo("Combo 2 unidades Sérum Facial")).toEqual(["serum", "facial"]);
});

test("título quase igual (mais de 70% das palavras) fica de fora; diferente entra", () => {
  const a = palavrasDoModelo("Luminária Led 3D Star Wars Darth Vader Abajur Mesa");
  expect(quaseIgual(a, palavrasDoModelo("Luminária 3D Led Star Wars Darth Vader Abajur"))).toBe(true);
  expect(quaseIgual(a, palavrasDoModelo("Caneca Porcelana Star Wars Yoda 325ml"))).toBe(false);
  const vistos = new Set<string>();
  const titulos: string[][] = [];
  expect(repetido(vistos, titulos, "Livro O Hobbit Capa Dura", "https://http2.mlstatic.com/D_1-MLB1_01-O.jpg")).toBe(false);
  expect(repetido(vistos, titulos, "Outro título qualquer aqui", "https://http2.mlstatic.com/D_NQ_NP_1-MLB1_01-F.webp")).toBe(true);
});

test("volume 1 e volume 2 de uma série são produtos diferentes", () => {
  expect(assinaturaDoModelo("Livro Box Harry Potter Volume 1")).not.toBe(assinaturaDoModelo("Livro Box Harry Potter Volume 2"));
  expect(quaseIgual(palavrasDoModelo("Livro Box Harry Potter Volume 1"), palavrasDoModelo("Livro Box Harry Potter Volume 2"))).toBe(false);
});
