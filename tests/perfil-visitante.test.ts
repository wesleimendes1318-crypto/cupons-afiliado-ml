import { beforeEach, describe, expect, test } from "bun:test";

import {
  calcularRecomendados,
  categoriaFavorita,
  comDecaimento,
  limparPerfil,
  obterPerfil,
  registrarAcaoVisitante,
  sugestoesDoPerfil,
} from "@/lib/perfil-visitante";

/* Navegador mínimo: localStorage em mapa e contador de eventos. */
const dados = new Map<string, string>();
let bloqueado = false;
let eventos = 0;
const armazenamento = {
  getItem: (k: string) => {
    if (bloqueado) throw new Error("SecurityError");
    return dados.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (bloqueado) throw new Error("QuotaExceededError");
    dados.set(k, v);
  },
  removeItem: (k: string) => {
    if (bloqueado) throw new Error("SecurityError");
    dados.delete(k);
  },
};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: armazenamento,
  dispatchEvent: () => {
    eventos++;
    return true;
  },
};
(globalThis as unknown as { CustomEvent: unknown }).CustomEvent ??= class {
  constructor(public type: string) {}
};

const T0 = Date.UTC(2026, 9, 27, 12);
const MIN = 60 * 1000;

beforeEach(() => {
  bloqueado = false;
  limparPerfil();
  dados.clear();
  eventos = 0;
});

describe("captura de sinais", () => {
  test("busca soma 3, categoria 2, detalhes 4 e compra 5 na categoria", () => {
    registrarAcaoVisitante({ tipo: "busca", termo: "Furadeira Bosch 650W" }, T0);
    expect(obterPerfil(T0)!.categorias["ferramentas"]).toBe(3);
    registrarAcaoVisitante({ tipo: "categoria", slug: "ferramentas" }, T0);
    expect(obterPerfil(T0)!.categorias["ferramentas"]).toBe(5);
    registrarAcaoVisitante(
      { tipo: "detalhes", produto: { titulo: "Parafusadeira Makita 12V", preco: 400 } },
      T0,
    );
    expect(obterPerfil(T0)!.categorias["ferramentas"]).toBe(9);
    registrarAcaoVisitante(
      {
        tipo: "compra",
        produto: { titulo: "Esmerilhadeira Dewalt", categoria: "ferramentas", freteGratis: true },
      },
      T0,
    );
    const p = obterPerfil(T0)!;
    expect(p.categorias["ferramentas"]).toBe(14);
    expect(p.sensivelAFreteGratis).toBe(true);
    expect(p.produtosInteragidos.map((x) => x.titulo)).toEqual([
      "Esmerilhadeira Dewalt",
      "Parafusadeira Makita 12V",
    ]);
    expect(eventos).toBe(4);
    expect(p.idAnonimo.length).toBeGreaterThan(8);
  });

  test("pontos param em 100 e caem pela metade em 7 dias", () => {
    for (let k = 0; k < 60; k++) registrarAcaoVisitante({ tipo: "categoria", slug: "casa" }, T0);
    expect(obterPerfil(T0)!.categorias["casa"]).toBe(100);
    expect(obterPerfil(T0 + 7 * 24 * 60 * MIN)!.categorias["casa"]).toBeCloseTo(50, 1);
    const p = obterPerfil(T0)!;
    expect(comDecaimento(p, T0 + 60 * 24 * 60 * MIN).categorias["casa"]).toBeUndefined();
  });

  test("termos recentes: 10 no máximo, sem repetir, o mais novo primeiro", () => {
    for (let k = 0; k < 12; k++)
      registrarAcaoVisitante({ tipo: "busca", termo: `termo ${k}` }, T0 + k);
    registrarAcaoVisitante({ tipo: "busca", termo: "Termo 5" }, T0 + 20);
    const termos = obterPerfil(T0 + 20)!.termosRecentes.map((t) => t.termo);
    expect(termos).toHaveLength(10);
    expect(termos[0]).toBe("Termo 5");
    expect(termos.filter((t) => t.toLowerCase() === "termo 5")).toHaveLength(1);
  });
});

describe("ticket médio", () => {
  test("média dos preços consultados e clicados; ignora preço vazio", () => {
    registrarAcaoVisitante({ tipo: "busca", termo: "air fryer", preco: 300 }, T0);
    registrarAcaoVisitante(
      { tipo: "detalhes", produto: { titulo: "Air Fryer Mondial", preco: 500 } },
      T0,
    );
    registrarAcaoVisitante(
      { tipo: "compra", produto: { titulo: "Air Fryer Philco", preco: null } },
      T0,
    );
    registrarAcaoVisitante(
      { tipo: "compra", produto: { titulo: "Air Fryer Britânia", preco: 400 } },
      T0,
    );
    const p = obterPerfil(T0)!;
    expect(p.ticketMedio).toBe(400);
    expect(p.precosNaMedia).toBe(3);
  });
});

describe("recomendação", () => {
  const catalogo = [
    { chave: "a", titulo: "Batom Matte Vermelho", categoria_site: "beleza", preco: 40 },
    {
      chave: "b",
      titulo: "Furadeira de Impacto Bosch 650W",
      categoria_site: "ferramentas",
      preco: 350,
    },
    { chave: "c", titulo: "Jogo de Panelas Tramontina", categoria_site: "casa", preco: 300 },
    { chave: "d", titulo: "Parafusadeira Bosch 12V", categoria_site: "ferramentas", preco: 2000 },
    {
      chave: "e",
      titulo: "Furadeira Black+Decker 560W",
      categoria_site: "ferramentas",
      preco: 330,
      freteGratis: true,
    },
  ];

  test("sem perfil, nada a recomendar", () => {
    expect(calcularRecomendados(catalogo, null)).toEqual([]);
    expect(calcularRecomendados(catalogo, obterPerfil())).toEqual([]);
  });

  test("reordena por categoria, palavras, faixa de preço e frete", () => {
    registrarAcaoVisitante(
      { tipo: "busca", termo: "furadeira bosch", preco: 340, freteGratis: true },
      T0,
    );
    const ordem = calcularRecomendados(catalogo, obterPerfil(T0), T0).map((i) => i.chave);
    expect(ordem[0]).toBe("b");
    expect(ordem.slice(0, 3).sort()).toEqual(["b", "d", "e"]);
    expect(ordem).not.toContain("a");
    expect(categoriaFavorita(obterPerfil(T0))).toBe("ferramentas");
  });

  test("produto visto nos últimos 10 minutos sai e volta depois", () => {
    registrarAcaoVisitante({ tipo: "busca", termo: "furadeira bosch", preco: 340 }, T0);
    registrarAcaoVisitante(
      { tipo: "detalhes", produto: { chave: "b", titulo: catalogo[1]!.titulo, preco: 350 } },
      T0,
    );
    const agora = calcularRecomendados(catalogo, obterPerfil(T0 + MIN), T0 + MIN);
    expect(agora.map((i) => i.chave)).not.toContain("b");
    expect(agora.map((i) => i.chave)).toContain("e");
    const depois = calcularRecomendados(catalogo, obterPerfil(T0 + 11 * MIN), T0 + 11 * MIN);
    expect(depois[0]!.chave).toBe("b");
  });

  test("campo vazio sugere últimos termos e 2 da categoria favorita", () => {
    registrarAcaoVisitante({ tipo: "categoria", slug: "ferramentas" }, T0);
    registrarAcaoVisitante({ tipo: "busca", termo: "furadeira" }, T0);
    const produtos = catalogo.map((c) => ({
      titulo: c.titulo,
      imagem: null,
      preco: c.preco,
      url: `https://www.mercadolivre.com.br/p/MLB${c.chave}`,
    }));
    const s = sugestoesDoPerfil(obterPerfil(T0), produtos, T0);
    expect(s[0]).toEqual({ tipo: "historico", texto: "furadeira" });
    const rec = s.filter((x) => x.tipo === "recomendado");
    expect(rec).toHaveLength(2);
    expect(rec.every((x) => /furadeira|parafusadeira/i.test(x.texto))).toBe(true);
  });
});

describe("armazenamento inacessível", () => {
  test("não quebra e guarda o perfil na memória da aba", () => {
    bloqueado = true;
    expect(obterPerfil()).toBeNull();
    expect(() => registrarAcaoVisitante({ tipo: "busca", termo: "tênis nike" }, T0)).not.toThrow();
    expect(obterPerfil(T0)!.termosRecentes[0]!.termo).toBe("tênis nike");
    expect(() => limparPerfil()).not.toThrow();
    expect(obterPerfil(T0)).toBeNull();
  });

  test("perfil corrompido ou da versão antiga é ignorado", () => {
    dados.set("melhorescolha_perfil", "{quebrado");
    expect(obterPerfil()).toBeNull();
    dados.set("melhorescolha_perfil", JSON.stringify({ versao: 1, clusters: {} }));
    expect(obterPerfil()).toBeNull();
    registrarAcaoVisitante({ tipo: "categoria", slug: "moda" }, T0);
    expect(obterPerfil(T0)!.categorias["moda"]).toBe(2);
  });
});
