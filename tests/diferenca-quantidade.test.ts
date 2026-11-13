import { describe, expect, test } from "bun:test";
import { diferencaNaMesmaQuantidade, rotuloDaQuantidade } from "@/lib/alternativa";

const colado = { preco: 28.24, titulo: "Café Melitta Tradicional Torrado Moído 500g" };

describe("diferencaNaMesmaQuantidade (café 13/11)", () => {
  test("250 g por R$ 15,12 sai R$ 2,00 mais caro em 500 g", () => {
    const d = diferencaNaMesmaQuantidade(colado, {
      preco: 15.12,
      titulo: "Café Torrado e Moído Tradicional Melitta Pacote 250g",
    });
    expect(d?.valor).toBe(2);
    expect(rotuloDaQuantidade(d!.quantidade)).toBe("500 g");
  });
  test("mesma quantidade fica com a diferença normal", () => {
    expect(
      diferencaNaMesmaQuantidade(colado, { preco: 22.8, titulo: "Café Mellita Tradicional 500g" }),
    ).toBeNull();
  });
  test("sem medida no título não inventa", () => {
    expect(diferencaNaMesmaQuantidade(colado, { preco: 10, titulo: "Café Melitta" })).toBeNull();
  });
  test("rótulos", () => {
    expect(rotuloDaQuantidade({ qtd: 1000, tipo: "g" })).toBe("1 kg");
    expect(rotuloDaQuantidade({ qtd: 1500, tipo: "ml" })).toBe("1,5 L");
  });
});
