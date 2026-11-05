import { describe, expect, test } from "bun:test";
import { cabeNaFaixa } from "@/lib/amigo-secreto-busca";
import { aplicarPerfil, termosDosFavoritos, textoSigiloWhatsApp } from "@/lib/amigo-secreto-perfil";
import { aprovadoNaVitrine, contextoDaVitrine } from "@/lib/amigo-secreto-curadoria";

describe("amigo secreto: perfil, frete e sigilo", () => {
  test("WhatsApp nunca cita o sorteado e só leva link de afiliado", () => {
    const t = textoSigiloWhatsApp(
      [
        { titulo: "Top fitness", preco: 89.9, link: "https://meli.la/abc123" },
        { titulo: "Livro", preco: 90, link: "https://www.mercadolivre.com.br/p/MLB1" },
      ],
      "entre R$ 80 e R$ 100",
    );
    expect(t).toContain("https://meli.la/abc123");
    expect(t).not.toContain("mercadolivre.com.br");
    expect(t).not.toMatch(/Anna|sorteei|tirei/i);
  });
  test("frete a calcular só entra quando a pessoa aceita", () => {
    const r = { preco: 90, freteGratis: false };
    expect(cabeNaFaixa(r, 80, 100)).toBe(false);
    expect(cabeNaFaixa(r, 80, 100, true)).toBe(true);
    expect(cabeNaFaixa({ preco: 120, freteGratis: false }, 80, 100, true)).toBe(false);
    expect(cabeNaFaixa({ preco: 90, freteGratis: false, internacional: true }, 80, 100, true)).toBe(false);
  });
  test("questionário vence o texto (unissex tira o gênero)", () => {
    const c = contextoDaVitrine({ titulo: "Roupas de academia", termosBusca: ["top fitness"] }, "tops G");
    expect(c.genero).toBe("feminino");
    expect(aplicarPerfil(c, { estilo: "neutro" }).genero).toBeNull();
  });
  test("brinquedo da franquia pedida fica; de outra franquia sai", () => {
    const c = contextoDaVitrine({ titulo: "Decoração Star Wars e Marvel", termosBusca: ["funko marvel"] }, "Star Wars, Marvel");
    expect(aprovadoNaVitrine("Boneco Homem Aranha Miles Morales Spidey Amazing Friends", c)).toBe(true);
    expect(aprovadoNaVitrine("Boneco Patrulha Canina Chase", c)).toBe(false);
    expect(aprovadoNaVitrine("Funko Pop Marvel Homem Aranha", c)).toBe(true);
  });
  test("favoritos viram buscas curtas", () => {
    expect(termosDosFavoritos(["Garrafa Térmica Inox 1 Litro Preta"])[0]).toBe("garrafa térmica inox");
  });
});

test("vitrine de academia não aceita vestido nem relógio", () => {
  const c = contextoDaVitrine({ titulo: "Roupas de academia", termosBusca: ["conjunto fitness feminino"] }, "tops G");
  expect(aprovadoNaVitrine("Vestido curto feminino Alex Evenings", c)).toBe(false);
  expect(aprovadoNaVitrine("Conjunto Fitness Feminino Top + Short", c)).toBe(true);
});

test("vitrine Star Wars e Marvel aceita as duas e barra franquia não pedida", () => {
  const c = contextoDaVitrine({ titulo: "Decoração Star Wars e Marvel", termosBusca: ["funko star wars", "funko marvel"] }, "Star Wars, Marvel");
  expect(aprovadoNaVitrine("Boneco Homem Aranha Miles Morales", c)).toBe(true);
  expect(aprovadoNaVitrine("Funko Pop Darth Vader Star Wars", c)).toBe(true);
  expect(aprovadoNaVitrine("Funko Pop Pikachu Pokemon", c)).toBe(false);
});

test("livro técnico de engenharia sai da vitrine de livros", () => {
  const c = contextoDaVitrine({ titulo: "Livros e leituras em alta", termosBusca: ["livro romance"] }, "livros");
  expect(aprovadoNaVitrine("Livro Físico - Resistência De Materiais E Volumetria", c)).toBe(false);
});
