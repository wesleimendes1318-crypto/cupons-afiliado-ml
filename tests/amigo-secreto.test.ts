import { describe, expect, test } from "bun:test";

import { cabeNaFaixa, carregarAte, passosIniciais, proximoPasso } from "../src/lib/amigo-secreto-busca";
import { alternarFavorito, juntarListas, lerGuardado, paraGuardar } from "../src/lib/amigo-secreto-estado";
import {
  faixaDoTexto,
  importarListaWhatsapp,
  interpretacaoDoModelo,
  interpretarLocal,
  selosDeTamanho,
} from "../src/lib/amigo-secreto-parser-local";

const ANNA =
  "Roupa de academia (M pra shorts, G pra camisetas e tops), Livros, Itens decorativos (Star Wars, Marvel) ou bijuterias/aneis (prata ou dourado)";
const NATH =
  "Roupa P, calçado 35, skincare/autocuidado, acessórios dourado, coisas de escritório, decoração, plantas/jardim, bolsa";

describe("amigo secreto: leitura dos pedidos", () => {
  test("Anna: 5 vitrines (academia, livros, Star Wars/Marvel, bijuterias, ideias)", () => {
    const r = interpretarLocal(ANNA);
    const t = r.vitrines.map((v) => v.titulo).join(" | ");
    expect(r.vitrines.length).toBe(5);
    expect(t).toMatch(/academia/i);
    expect(t).toMatch(/Livros/);
    expect(t).toMatch(/Star Wars e Marvel/);
    expect(t).toMatch(/Bijuterias.*prata e dourado/);
    expect(r.vitrines.at(-1)!.titulo).toMatch(/Ideias/);
    expect(selosDeTamanho(r.tamanhos)).toEqual(["Shorts: M", "Camisetas e tops: G"]);
    /* "Senhor dos anéis"-style collisions: the theme showcase never becomes rings. */
    expect(r.vitrines.find((v) => /Star Wars/.test(v.titulo))!.termos.every((x) => !/^anel/.test(x))).toBe(true);
  });

  test("Nath: tamanhos, calçado 35, decoração + jardim juntos, bolsa", () => {
    const r = interpretarLocal(NATH);
    const t = r.vitrines.map((v) => v.titulo);
    expect(r.tamanhos.roupa).toBe("P");
    expect(r.tamanhos.calcado).toBe("35");
    expect(t.some((x) => /Calçados femininos tamanho 35/.test(x))).toBe(true);
    expect(t.some((x) => /Skincare/.test(x))).toBe(true);
    expect(t.some((x) => /dourado/.test(x))).toBe(true);
    expect(t.some((x) => /Bolsas/.test(x))).toBe(true);
    expect(t.some((x) => /Decoração de casa e jardinagem/.test(x))).toBe(true);
    expect(t.some((x) => /pet/i.test(x))).toBe(false);
    expect(t.at(-1)).toMatch(/Ideias/);
    expect(r.vitrines.length).toBeLessThanOrEqual(7);
  });

  test("termos sem preço, sem link e no máximo 10 por vitrine", () => {
    for (const v of [...interpretarLocal(ANNA).vitrines, ...interpretarLocal(NATH).vitrines]) {
      expect(v.termos.length).toBeGreaterThan(0);
      expect(v.termos.length).toBeLessThanOrEqual(10);
      /* Metal specs (prata 925, ouro 18k) are not prices. */
      for (const x of v.termos) expect(x.replace(/\b(925|18k)\b/g, "")).not.toMatch(/r\$|http|\d{2,}/i);
    }
  });

  test("resposta do modelo: link, menção a IA e lista curta são recusados", () => {
    expect(interpretacaoDoModelo({ vitrines: [{ titulo: "Livros", termos: ["livro"] }] })).toBeNull();
    const ok = interpretacaoDoModelo({
      tamanhos: { roupa: "m", calcado: 35 },
      vitrines: [
        { titulo: "Livros", icone: "📚", termos: ["livro romance", "https://x.com"] },
        { titulo: "Ideias criativas e semelhantes", icone: "💡", termos: ["caneca"] },
      ],
    });
    expect(ok!.tamanhos.roupa).toBe("M");
    expect(ok!.tamanhos.calcado).toBe("35");
    expect(ok!.vitrines[0]!.termos).toEqual(["livro romance"]);
  });
});

describe("amigo secreto: lista do WhatsApp", () => {
  test("separa pessoas com prefixo do WhatsApp, numeração e nome sozinho", () => {
    const p = importarListaWhatsapp(`Amigo secreto da firma 🎁 valor: R$ 80 a R$ 100
[05/11/2026 10:12] Weslei: Anna: ${ANNA}
2) *Nath* - ${NATH}
Carlos
livros de suspense, café`);
    expect(p.map((x) => x.nome)).toEqual(["Anna", "Nath", "Carlos"]);
    expect(p[2]!.desejos).toBe("livros de suspense, café");
  });
  test("faixa escrita na lista", () => {
    expect(faixaDoTexto("valor: R$ 80 a R$ 100")).toEqual({ min: 80, max: 100 });
    expect(faixaDoTexto("presente até R$ 50")).toEqual({ min: null, max: 50 });
  });
});

describe("amigo secreto: faixa com custo real", () => {
  test("só frete grátis confirmado e dentro da faixa", () => {
    expect(cabeNaFaixa({ preco: 89.9, freteGratis: true }, 80, 100)).toBe(true);
    expect(cabeNaFaixa({ preco: 100, freteGratis: true }, 80, 100)).toBe(true);
    expect(cabeNaFaixa({ preco: 100.5, freteGratis: true }, 80, 100)).toBe(false);
    expect(cabeNaFaixa({ preco: 79.99, freteGratis: true }, 80, 100)).toBe(false);
    /* Frete desconhecido nunca vence. */
    expect(cabeNaFaixa({ preco: 90, freteGratis: null }, 80, 100)).toBe(false);
    expect(cabeNaFaixa({ preco: 90, freteGratis: false }, 80, 100)).toBe(false);
    /* Internacional sem tributos lidos também não. */
    expect(cabeNaFaixa({ preco: 90, freteGratis: true, internacional: true }, 80, 100)).toBe(false);
    expect(cabeNaFaixa({ preco: null, freteGratis: true }, 80, 100)).toBe(false);
    expect(cabeNaFaixa({ preco: 30, freteGratis: true }, null, 50)).toBe(true);
  });

  test("termos em rodízio, sem repetir anúncio entre vitrines, até a meta", async () => {
    let n = 0;
    const lotes: Record<string, number> = {};
    const original = globalThis.fetch;
    globalThis.fetch = (async (_u: string, init: { body: string }) => {
      const b = JSON.parse(init.body) as { termo: string; pagina: number };
      lotes[b.termo] = (lotes[b.termo] ?? 0) + 1;
      const resultados = Array.from({ length: 12 }, () => {
        n += 1;
        /* every 3rd repeats an earlier listing; every 4th is out of range */
        const id = n % 3 === 0 ? 1 : n;
        return {
          produto: `MLB${1000 + id}`,
          item: `MLB${9000 + id}`,
          nome: `${b.termo} ${id}`,
          imagem: null,
          preco: n % 4 === 0 ? 150 : 90,
          url: `https://www.mercadolivre.com.br/p/MLB${1000 + id}`,
          freteGratis: true,
        };
      });
      return new Response(JSON.stringify({ resultados, proximo: b.pagina < 3 ? b.pagina : null, variantes: [] }));
    }) as unknown as typeof fetch;
    try {
      const vistos = new Set<string>(["MLB9002"]);
      const r = await carregarAte({ passos: passosIniciais(["a", "b", "c"]), faixa: { min: 80, max: 100 }, vistos, alvo: 50 });
      expect(r.novos.length).toBeGreaterThanOrEqual(50);
      const ids = r.novos.map((x) => x.item);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain("MLB9002");
      expect(r.novos.every((x) => x.preco === 90)).toBe(true);
      /* round-robin: every term was read */
      expect(Object.keys(lotes).sort()).toEqual(["a", "b", "c"]);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("próximo passo: menor página ainda aberta", () => {
    const p = passosIniciais(["a", "b"]);
    p[0]!.pagina = 1;
    expect(proximoPasso(p)).toBe(1);
    p[1]!.fim = true;
    expect(proximoPasso(p)).toBe(0);
    p[0]!.fim = true;
    expect(proximoPasso(p)).toBe(-1);
  });
});

describe("amigo secreto: salvar", () => {
  test("guarda só o digitado (sem produtos) e volta igual", () => {
    const e = lerGuardado({
      orcamentoPadraoMin: 80,
      orcamentoPadraoMax: 100,
      amigos: [{ id: "a1", nome: "Anna", desejosTexto: ANNA, comprado: true, vitrines: [{ id: "v1", titulo: "Livros", icone: "📚", termos: ["livro romance"] }] }],
    });
    e.amigos[0]!.vitrines[0]!.produtos = [{ produto: "MLB1", item: "MLB2", nome: "x", imagem: null, preco: 90, url: "u" }];
    const g = paraGuardar(e);
    expect(JSON.stringify(g)).not.toContain("MLB2");
    const de = lerGuardado(JSON.parse(JSON.stringify(g)));
    expect(de.amigos[0]!.comprado).toBe(true);
    expect(de.amigos[0]!.vitrines[0]!.termosBusca).toEqual(["livro romance"]);
    expect(de.amigoAtivoId).toBe("a1");
  });
  test("conta + aparelho: junta sem duplicar pelo nome", () => {
    const conta = lerGuardado({ amigos: [{ id: "a1", nome: "Anna", desejosTexto: "livros" }] });
    const local = lerGuardado({ amigos: [{ id: "x", nome: "anna", desejosTexto: "x" }, { id: "b", nome: "Nath", desejosTexto: "bolsa" }] });
    expect(juntarListas(conta, local).amigos.map((a) => a.nome)).toEqual(["Anna", "Nath"]);
  });
});

describe("amigo secreto: favoritos", () => {
  const f = {
    produto: "MLB123",
    item: "MLB456",
    nome: "Livro",
    imagem: null,
    preco: 90,
    url: "https://www.mercadolivre.com.br/p/MLB123",
    freteGratis: true,
    favoritadoEm: "2026-11-05T19:00:00.000Z",
  };
  test("coração liga e desliga", () => {
    const um = alternarFavorito([], f);
    expect(um.length).toBe(1);
    expect(alternarFavorito(um, f)).toEqual([]);
  });
  test("salvo e lido de volta; link de fora do Mercado Livre é descartado", () => {
    const e = lerGuardado({ amigos: [{ id: "a", nome: "Anna", desejosTexto: "x", favoritos: [f, { ...f, produto: "MLB9", url: "https://golpe.com/x" }] }] });
    expect(e.amigos[0]!.favoritos!.map((x) => x.produto)).toEqual(["MLB123"]);
    expect(JSON.stringify(paraGuardar(e))).toContain("MLB123");
  });
});
