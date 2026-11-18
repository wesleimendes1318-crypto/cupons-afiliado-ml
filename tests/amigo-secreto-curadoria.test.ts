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

describe("amigo secreto: skincare, bijuterias e calçados (05/11)", () => {
  const NATH = "Nath - roupa P, calçado 35, skincare, acessórios dourados, plantas, bolsa";
  const pele = contextoDaVitrine({ titulo: "Skincare e autocuidado", termosBusca: ["sallve kit"] }, NATH);
  const joia = contextoDaVitrine({ titulo: "Bijuterias e semijoias (dourado)", termosBusca: ["colar ponto de luz"] }, NATH);
  const pe = contextoDaVitrine({ titulo: "Calçados femininos tamanho 35", termosBusca: ["sandália feminina"] }, NATH);

  test("brinquedo nunca entra em skincare", () => {
    expect(aprovadoNaVitrine("Kit Skincare Poderosa Zonacriativa Zona Criativa", pele)).toBe(false);
    expect(aprovadoNaVitrine("Principia Kit 2 Gel De Limpeza Facial Gl-01", pele)).toBe(true);
  });
  test("pingente avulso sai; colar moderno fica", () => {
    expect(joia.tipo).toBe("joia");
    expect(aprovadoNaVitrine("Pingente Estrela Banhado a Ouro para Corrente", joia)).toBe(false);
    expect(aprovadoNaVitrine("Colar Ponto de Luz Zircônia Banhado a Ouro 18k", joia)).toBe(true);
  });
  test("chinelo masculino sai da vitrine feminina", () => {
    expect(aprovadoNaVitrine("Chinelo Kenner Kivah Line Sem Desenho", pe)).toBe(false);
    expect(aprovadoNaVitrine("Sandália Feminina Salto Baixo Bloco Vizzano", pe)).toBe(true);
  });
});

/* 18/11: Nath's real list (production screenshots). */
import { kitsDoPresente, type Candidato } from "@/lib/amigo-secreto-kit";
import { interpretarLocal, vitrinesSemInvencao } from "@/lib/amigo-secreto-parser-local";
import type { Resultado } from "@/lib/busca-guiada-cliente";

const NATH =
  "Nath, mulher, calçado 35, gosta de produtos sobre cuidados com a pele, sabonetes artesanais, esmaltes, colar de material semiprecioso, geleia de morango";

describe("amigo secreto: Nath's list (18/11)", () => {
  const lida = interpretarLocal(NATH);
  const titulos = lida.vitrines.map((v) => v.titulo.toLowerCase());
  const termos = lida.vitrines.flatMap((v) => v.termos);

  test("name, gender and shoe size never become showcases or searches", () => {
    expect(titulos.some((t) => /^nath|^mulher|cal[cç]ado/.test(t))).toBe(false);
    expect(termos.some((t) => /^(nath|mulher)$/.test(t) || /sand[aá]lia|calcado|cal[cç]ado/.test(t))).toBe(false);
    expect(lida.tamanhos.calcado).toBe("35");
  });

  test("beauty, jewelry and treats showcases with the named items", () => {
    expect(titulos).toContain("skincare e autocuidado");
    expect(termos).toContain("sabonetes artesanais perfumados");
    expect(termos).toContain("kit esmaltes cores neutras");
    expect(titulos.some((t) => /bijuterias/.test(t))).toBe(true);
    const doces = lida.vitrines.find((v) => /geleias/i.test(v.titulo));
    expect(doces?.termos[0]).toBe("geleia artesanal frutas vermelhas");
    expect(titulos.some((t) => /escrit|papelaria|decora|jardin|bolsas/.test(t))).toBe(false);
  });

  test("model showcases the text never asked for are dropped", () => {
    const modelo = {
      tamanhos: { roupa: null, calcado: "35", observacoes: null },
      vitrines: [
        { titulo: "Skincare e autocuidado", icone: "🌿", termos: ["serum facial"] },
        { titulo: "Calçados femininos", icone: "👠", termos: ["sandália feminina"] },
        { titulo: "Escritório e papelaria", icone: "🖊️", termos: ["kit canetas"] },
        { titulo: "Decoração e jardinagem", icone: "🪴", termos: ["vaso"] },
        { titulo: "Nath", icone: "🎁", termos: ["nath"] },
        { titulo: "Ideias da época", icone: "💡", termos: ["copo termico"] },
      ],
    };
    expect(vitrinesSemInvencao(modelo, NATH, "Nath").vitrines.map((v) => v.titulo)).toEqual([
      "Skincare e autocuidado",
      "Ideias da época",
    ]);
  });

  test("a wish verb keeps shoes a wish", () => {
    expect(interpretarLocal("gosta de tênis 37, livros").vitrines.some((v) => /cal[cç]ados/i.test(v.titulo))).toBe(true);
  });

  test("grocery condiments never enter a treats showcase", () => {
    const doces = contextoDaVitrine(
      { titulo: "Geleias, chocolates e delícias artesanais", termosBusca: ["geleia artesanal frutas vermelhas"] },
      NATH,
      "Nath",
    );
    expect(doces.tipo).toBe("gourmet");
    for (const t of ["Ketchup Heinz 397g", "Mostarda Heinz Amarela 255g", "Mel Puro 1kg Silvestre", "Molho Barbecue Heinz 397g"])
      expect(aprovadoNaVitrine(t, doces)).toBe(false);
    expect(aprovadoNaVitrine("Geleia Artesanal De Morango 250g", doces)).toBe(true);
    expect(aprovadoNaVitrine("Caixa De Bombons Finos Presente", doces)).toBe(true);
    /* Typed it, gets it. */
    const pediu = contextoDaVitrine({ titulo: "Churrasco", termosBusca: ["kit churrasco"] }, "ama ketchup e churrasco");
    expect(aprovadoNaVitrine("Ketchup Heinz 397g", pediu)).toBe(true);
  });

  test("gift kit keeps to beauty, jewelry and treats; the better kit drops the fillers", () => {
    const r = (id: number, nome: string, preco: number): Resultado => ({
      produto: `MLB${id}`, item: `MLB${id}0`, nome, imagem: null, preco, url: `https://meli.la/x${id}`, freteGratis: true,
    });
    const c: Candidato[] = [
      { r: r(1, "Kit Escolar Compactor 4 Canetas", 12), grupo: "ideias", tipo: "ideias" },
      { r: r(2, "Sandália Rasteira Feminina", 17), grupo: "calcados", tipo: "calcado" },
      { r: r(3, "Sabonete Artesanal Lavanda", 19), grupo: "pele", tipo: "beleza" },
      { r: r(4, "Sérum Vitamina C Facial", 45), grupo: "pele", tipo: "beleza" },
      { r: r(5, "Colar Pedra Quartzo Rosa Prata", 40), grupo: "joia", tipo: "joia" },
      { r: r(6, "Geleia Artesanal Morango", 22), grupo: "doces", tipo: "gourmet" },
      { r: r(7, "Caixa Bombons Finos", 55), grupo: "doces", tipo: "gourmet" },
    ];
    for (const seed of [1, 2, 3]) {
      const { dentro, melhor } = kitsDoPresente(c, 100, { estilo: "custo", seed, misturar: true });
      expect(dentro).not.toBeNull();
      expect(dentro!.itens.some((x) => /canetas|sand[aá]lia/i.test(x.nome))).toBe(false);
      const baratos = dentro!.itens.filter((x) => x.preco < 25);
      if (melhor) for (const b of baratos) expect(melhor.itens).not.toContain(b);
    }
  });
});
