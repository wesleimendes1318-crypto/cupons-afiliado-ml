import { describe, expect, test } from "bun:test";

import type { ResultadoGarimpo } from "@/lib/garimpo-cliente";
import {
  chipsDoMuda,
  estadoDoGarimpo,
  estadoDoMercadoLivre,
  rotuloMercadoLivre,
  vencedorDoPlacar,
  vereditoDoGarimpo,
  type EstadoPlayer,
} from "@/lib/placar-garimpo";

const oferta = (o: Partial<ResultadoGarimpo["ofertas"][number]>) => ({
  marketplace: "shopee" as const,
  id: "1",
  titulo: "Bebedouro fonte gato 2L",
  preco: 50,
  link: "https://s.shopee.com.br/AbC1",
  imagem: null,
  loja: null,
  freteGratis: null,
  custoFrete: null,
  notaFrete: null,
  selos: [],
  relacao: "mesmo" as const,
  muda: null,
  semelhanca: null,
  qualidade: null,
  ...o,
});

const resultado = (
  ofertas: ResultadoGarimpo["ofertas"],
  original?: Partial<ResultadoGarimpo["original"]>,
) =>
  ({
    player: "shopee",
    original: {
      titulo: "Bebedouro",
      preco: null,
      imagem: null,
      link: null,
      selos: [],
      ...original,
    },
    ofertas,
    lidas: 24,
    conferidas: 5,
    conferencia: "ok",
    em: null,
  }) satisfies ResultadoGarimpo;

/* O real vem com espaço fino (NBSP) do toLocaleString. */
const n = (s: string | null | undefined) => String(s ?? "").replace(/\u00a0/g, " ");

const naoConsultado = (player: EstadoPlayer["player"]): EstadoPlayer => ({
  player,
  status: "nao_consultado",
  melhor: null,
  lidas: null,
  conferidas: null,
  conferiu: false,
});

describe("veredito do garimpo", () => {
  test("mesmo produto mais barato: economize na Shopee", () => {
    const shopee = estadoDoGarimpo(
      "shopee",
      "pronto",
      resultado([oferta({ preco: 72.69 })]),
      false,
    );
    const v = vereditoDoGarimpo(74.98, [shopee, naoConsultado("amazon")]);
    expect(v.tipo).toBe("economia");
    if (v.tipo !== "economia") return;
    expect(n(v.titulo)).toBe("Economize R$ 2,29 na Shopee!");
    expect(v.similar).toBe(false);
    expect(vencedorDoPlacar(v, [shopee])).toBe("shopee");
  });

  test("parecido só entra com qualidade equivalente e sem vir menos", () => {
    const fraco = estadoDoGarimpo(
      "shopee",
      "pronto",
      resultado([oferta({ relacao: "parecido", preco: 30, qualidade: "inferior" })]),
      false,
    );
    expect(vereditoDoGarimpo(74.98, [fraco]).tipo).toBe("melhor_preco");
    const menos = estadoDoGarimpo(
      "shopee",
      "pronto",
      resultado([
        oferta({
          relacao: "parecido",
          preco: 30,
          qualidade: "equivalente",
          muda: "Quantidade: 3 -> 1",
        }),
      ]),
      false,
    );
    expect(vereditoDoGarimpo(74.98, [menos]).tipo).toBe("melhor_preco");
    const bom = estadoDoGarimpo(
      "shopee",
      "pronto",
      resultado([
        oferta({
          relacao: "parecido",
          preco: 60,
          qualidade: "equivalente",
          muda: "Cor: amarelo -> rosa",
        }),
      ]),
      false,
    );
    const v = vereditoDoGarimpo(74.98, [bom]);
    expect(v.tipo).toBe("economia");
    if (v.tipo === "economia") {
      expect(v.similar).toBe(true);
      expect(n(v.titulo)).toBe("Economize até R$ 14,98 na Shopee com modelo similar.");
    }
  });

  test("nada mais barato: o seu já é o melhor preço (link do próprio player vence)", () => {
    const amazon = estadoDoGarimpo(
      "amazon",
      "pronto",
      {
        ...resultado(
          [
            oferta({
              marketplace: "amazon",
              preco: 90,
              link: "https://www.amazon.com.br/dp/B000000001?tag=melhoresc0fff-20",
            }),
          ],
          {
            preco: 79.9,
            link: "https://www.amazon.com.br/dp/B09B8V1LZ3?tag=melhoresc0fff-20",
          },
        ),
        player: "amazon",
      },
      true,
    );
    expect(amazon.melhor?.relacao).toBe("seu");
    const v = vereditoDoGarimpo(79.9, [amazon, naoConsultado("shopee")]);
    expect(v.tipo).toBe("melhor_preco");
    if (v.tipo === "melhor_preco")
      expect(n(v.subtitulo)).toContain("Ainda falta comparar: Shopee.");
    expect(vencedorDoPlacar(v, [amazon])).toBe("amazon");
  });

  test("ainda carregando e sem economia: conferindo; sem preço do link: sem economia", () => {
    const carregando: EstadoPlayer = { ...naoConsultado("shopee"), status: "carregando" };
    expect(vereditoDoGarimpo(50, [carregando]).tipo).toBe("conferindo");
    const shopee = estadoDoGarimpo("shopee", "pronto", resultado([oferta({ preco: 40 })]), false);
    const v = vereditoDoGarimpo(null, [shopee]);
    expect(v.tipo).toBe("melhor_do_mesmo");
  });

  test("busca sem conferência nunca vira economia", () => {
    const busca = estadoDoGarimpo(
      "shopee",
      "pronto",
      { ...resultado([oferta({ relacao: "busca", preco: 10 })]), conferencia: "sem_foto" },
      false,
    );
    expect(vereditoDoGarimpo(74.98, [busca]).tipo).toBe("nenhum");
  });
});

describe("rótulo honesto do Mercado Livre (11/10)", () => {
  test("mais caro que a Shopee: opções similares, nunca menor preço", () => {
    const r = rotuloMercadoLivre(74.98, 79.9, [{ player: "shopee", preco: 72.69 }]);
    expect(r.tipo).toBe("similar");
    expect(n(r.titulo)).toBe(
      "Opções similares no Mercado Livre a partir de R$ 74,98 (+R$ 2,29 que na Shopee)",
    );
  });
  test("mais caro que o visto: +R$ do que você viu", () => {
    const r = rotuloMercadoLivre(80, 74.98, []);
    expect(n(r.titulo)).toBe(
      "Opções similares no Mercado Livre a partir de R$ 80,00 (+R$ 5,02 do que você viu)",
    );
    expect(n(r.detalhe)).toBe("Não localizamos o mesmo modelo mais barato nesta análise.");
  });
  test("mais barato que o visto e que os outros: menor preço", () => {
    const r = rotuloMercadoLivre(60, 74.98, [{ player: "amazon", preco: 70 }]);
    expect(r.tipo).toBe("menor");
    expect(n(r.titulo)).toBe("Menor preço no Mercado Livre: R$ 60,00");
  });
  test("sem preço do link nem outros: nunca menor preço; sem resultado: sem modelo compatível", () => {
    expect(rotuloMercadoLivre(60, null, []).tipo).toBe("similar");
    expect(rotuloMercadoLivre(null, 50, []).titulo).toBe("Sem modelo compatível nesta análise");
  });
  test("estado do Mercado Livre: a mais barata com preço", () => {
    const e = estadoDoMercadoLivre("pronto", [
      { nome: "A", preco: null, imagem: null, url: "https://x/1" },
      { nome: "B", preco: 80, imagem: null, url: "https://x/2" },
      { nome: "C", preco: 75, imagem: null, url: "https://x/3" },
    ]);
    expect(e.melhor?.preco).toBe(75);
    expect(e.melhor?.relacao).toBe("busca");
  });
});

describe("o que muda em chips, sem setas", () => {
  test("campo e valor deste produto; o seu fica no original", () => {
    expect(
      chipsDoMuda(
        "Não é idêntico ao seu. Muda: Cor: amarelo -> rosa, preto; Formato: quadrado -> redondo em cascata",
      ),
    ).toEqual([
      { icone: "🎨", campo: "Cor", valor: "Rosa/Preto", original: "Amarelo" },
      { icone: "📐", campo: "Formato", valor: "Redondo em cascata", original: "Quadrado" },
    ]);
  });
  test("vários campos separados por vírgula e texto livre", () => {
    expect(
      chipsDoMuda("Cor: preto → branco, Capacidade: 2L → 3L").map(
        (c) => `${c.icone} ${c.campo}: ${c.valor}`,
      ),
    ).toEqual(["🎨 Cor: Branco", "💧 Capacidade: 3L"]);
    expect(chipsDoMuda("outra marca, tamanho maior").map((c) => c.valor)).toEqual([
      "Outra marca",
      "Tamanho maior",
    ]);
    expect(chipsDoMuda(null)).toEqual([]);
  });
});
