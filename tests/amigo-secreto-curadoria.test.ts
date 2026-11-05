import { describe, expect, test } from "bun:test";

import { ampliarTermos, aprovadoNaVitrine, contextoDaVitrine, ideiasDaEpoca } from "@/lib/amigo-secreto-curadoria";

const ANNA =
  "Roupa de academia (M pra shorts, G pra camisetas e tops), Livros, Itens decorativos (Star Wars, Marvel) ou bijuterias/aneis (prata ou dourado)";

const academia = contextoDaVitrine(
  { titulo: "Roupas de academia (Shorts M e Camisetas e tops G)", termosBusca: ["short academia feminino", "top fitness feminino"] },
  ANNA,
);
const livros = contextoDaVitrine({ titulo: "Livros e leituras em alta", termosBusca: ["livro romance"] }, ANNA);
const geek = contextoDaVitrine(
  { titulo: "Decoração Star Wars e Marvel", termosBusca: ["star wars decoração", "marvel colecionável"] },
  ANNA,
);

describe("amigo secreto: curadoria", () => {
  test("adult woman's gym showcase drops kids' clothing", () => {
    expect(academia.adulto).toBe(true);
    expect(aprovadoNaVitrine("Conjunto Colorittá Menina Juvenil Blusa Shorts", academia)).toBe(false);
    expect(aprovadoNaVitrine("Conjunto Fitness Feminino Top + Short Cós Alto", academia)).toBe(true);
  });

  test("books showcase drops tax and exam books", () => {
    expect(aprovadoNaVitrine("Tenha Lucro Pagando Imposto", livros)).toBe(false);
    expect(aprovadoNaVitrine("Vade Mecum 2026", livros)).toBe(false);
    expect(aprovadoNaVitrine("Kit Com 48 Pacotes de Figurinhas Panini", livros)).toBe(false);
    expect(aprovadoNaVitrine("É Assim que Acaba - Colleen Hoover", livros)).toBe(true);
  });

  test("franchise showcase keeps only that franchise, adults can get toys", () => {
    expect(aprovadoNaVitrine("Boneco Patrulha Canina Skye", geek)).toBe(false);
    expect(aprovadoNaVitrine("Pelúcia Urso Genérico", geek)).toBe(false);
    expect(aprovadoNaVitrine("Funko Pop Star Wars Darth Vader", geek)).toBe(true);
    expect(aprovadoNaVitrine("Lego Marvel Homem-Aranha", geek)).toBe(true);
  });

  test("gym showcase gets at least 10 search terms for more results", () => {
    expect(ampliarTermos(["short academia feminino"], academia).length).toBeGreaterThanOrEqual(10);
  });

  test("november ideas are Christmas and summer", () => {
    expect(ideiasDaEpoca(new Date("2026-11-05T12:00:00Z")).titulo).toContain("Natal");
  });
});
