import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

/* Catálogo e modelo falsos: o que o Mercado Livre e o modelo devolveriam
   para buscas reais que vieram com resultado fora de contexto (27/10). */
type Produto = { id: string; name: string; domain_id: string };
const CATALOGO: Record<string, Produto[]> = {
  "tomada 2p+t 10a": [
    { id: "MLB1", name: "Tomada 2p+t 10a Branca Pial Plus", domain_id: "MLB-WALL_OUTLETS" },
    { id: "MLB2", name: "Tomada Hdmi Para Parede Com Espelho", domain_id: "MLB-WALL_OUTLETS" },
    { id: "MLB3", name: "Tomada De Antena Coaxial 4x2", domain_id: "MLB-WALL_OUTLETS" },
    { id: "MLB4", name: "Gabinete Banheiro Com Tomada 60cm", domain_id: "MLB-BATHROOM_CABINETS" },
    { id: "MLB5", name: "Tomada Rj45 Cat6 Keystone", domain_id: "MLB-WALL_OUTLETS" },
  ],
  "tomada 20a banheiro": [
    { id: "MLB6", name: "Tomada 20a Com Tampa Para Banheiro Ip54", domain_id: "MLB-WALL_OUTLETS" },
  ],
  "racao gatos castrados": [
    { id: "MLB10", name: "Ração Golden Gatos Castrados Salmão 10kg", domain_id: "MLB-CAT_FOODS" },
    { id: "MLB11", name: "Comedouro Elevado Para Ração De Gatos", domain_id: "MLB-PET_FEEDERS" },
    { id: "MLB12", name: "Brinquedo Bolinha De Ração Para Gatos", domain_id: "MLB-CAT_FOODS" },
  ],
  "pneu aro 14": [
    { id: "MLB20", name: "Pneu Aro 14 175/65r14 Pirelli P400", domain_id: "MLB-TIRES" },
    { id: "MLB21", name: "Chaveiro Pneu Aro 14 Miniatura Pirelli", domain_id: "MLB-TIRES" },
  ],
  "aspirador robo": [
    { id: "MLB30", name: "Aspirador Robô Xiaomi E10 Wi-Fi", domain_id: "MLB-ROBOT_VACUUMS" },
    {
      id: "MLB31",
      name: "Refil Escova Lateral Aspirador Robô Xiaomi",
      domain_id: "MLB-ROBOT_VACUUMS",
    },
  ],
};
const DOMINIOS: Record<string, string[]> = {
  "tomada 2p+t 10a": ["MLB-WALL_OUTLETS"],
  "tomada 20a banheiro": ["MLB-WALL_OUTLETS"],
  "racao gatos castrados": ["MLB-CAT_FOODS"],
  "pneu aro 14": ["MLB-TIRES"],
  "aspirador robo": ["MLB-ROBOT_VACUUMS"],
};
let respostaModelo = "";

/* API oficial falsa pelo fetch (como em comparar-agora.test.ts). */
const fetchOriginal = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = new URL(String(entrada));
    const q = u.searchParams.get("q") ?? "";
    if (u.pathname.includes("domain_discovery"))
      return Response.json((DOMINIOS[q] ?? []).map((domain_id) => ({ domain_id })));
    if (u.pathname === "/products/search") return Response.json({ results: CATALOGO[q] ?? [] });
    const id = u.pathname.split("/")[2]!;
    return Response.json({
      results: [{ item_id: id.replace("MLB", "MLB9"), price: 50, condition: "new" }],
    });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = fetchOriginal;
});
mock.module("@/lib/cheaper-inference", () => ({
  perguntarAoLlm: async () => ({ ok: true, texto: respostaModelo }),
}));

const { buscaGuiada, foraDaIntencao, intencaoDoModelo } = await import("@/lib/busca-guiada");

const modelo = (j: object) => {
  respostaModelo = JSON.stringify(j);
};
const nomes = async (q: string) => (await buscaGuiada(q, null)).resultados.map((r) => r.nome);

describe("busca com intenção universal", () => {
  test("tomada para banheiro: só tomada elétrica (nada de HDMI, antena, RJ45 ou móvel)", async () => {
    modelo({
      buscas: ["tomada 2p+t 10a", "tomada 20a banheiro"],
      tipoProduto: "tomada",
      contextoUso: "eletrica_residencial",
      termosNegativos: ["hdmi", "antena", "gabinete", "tomada"],
      resumo: "Tomadas para banheiro",
    });
    /* A que cita banheiro vem primeiro (mais fiel ao pedido). */
    expect(await nomes("tomada para banheiro")).toEqual([
      "Tomada 20a Com Tampa Para Banheiro Ip54",
      "Tomada 2p+t 10a Branca Pial Plus",
    ]);
  });

  test("sem termos do modelo, os conectores de outro sinal ainda saem da tomada", async () => {
    modelo({ buscas: ["tomada 2p+t 10a"], tipoProduto: "tomada", resumo: "" });
    const r = await nomes("tomada");
    expect(r.some((n) => /hdmi|antena|rj45/i.test(n))).toBe(false);
    expect(r).toContain("Tomada 2p+t 10a Branca Pial Plus");
  });

  test("pet: ração de gato não traz comedouro nem brinquedo", async () => {
    modelo({
      buscas: ["racao gatos castrados"],
      tipoProduto: "racao",
      contextoUso: "pet_gatos",
      termosNegativos: ["comedouro", "brinquedo"],
    });
    expect(await nomes("ração para gato castrado")).toEqual([
      "Ração Golden Gatos Castrados Salmão 10kg",
    ]);
  });

  test("automotivo: pneu de verdade, sem chaveiro ou miniatura", async () => {
    modelo({ buscas: ["pneu aro 14"], tipoProduto: "pneu", contextoUso: "automotivo" });
    expect(await nomes("pneu aro 14")).toEqual(["Pneu Aro 14 175/65r14 Pirelli P400"]);
  });

  test("aparelho x peça: aspirador robô sem refil de escova", async () => {
    modelo({ buscas: ["aspirador robo"], tipoProduto: "aspirador" });
    expect(await nomes("aspirador robô")).toEqual(["Aspirador Robô Xiaomi E10 Wi-Fi"]);
  });

  test("domínio previsto errado não zera a busca: refaz pelo tipo", async () => {
    DOMINIOS["pneu aro 14"] = ["MLB-OUTRA_COISA"];
    modelo({ buscas: ["pneu aro 14"], tipoProduto: "pneu" });
    expect(await nomes("pneu aro 14")).toEqual(["Pneu Aro 14 175/65r14 Pirelli P400"]);
    DOMINIOS["pneu aro 14"] = ["MLB-TIRES"];
  });
});

describe("filtro final da intenção", () => {
  const tomada = { tipoProduto: "tomada", termosNegativos: [], contextoUso: null };

  test("o que a pessoa digitou nunca exclui", () => {
    expect(foraDaIntencao("Tomada Hdmi Para Parede", tomada, "tomada hdmi")).toBe(false);
    expect(foraDaIntencao("Tomada Hdmi Para Parede", tomada, "tomada")).toBe(true);
  });

  test("miniatura e chaveiro só ficam em busca de presente ou infantil", () => {
    const pneu = { tipoProduto: "pneu", termosNegativos: [], contextoUso: null };
    expect(foraDaIntencao("Chaveiro Pneu Pirelli", pneu, "pneu")).toBe(true);
    expect(foraDaIntencao("Carrinho De Brinquedo", pneu, "carrinho")).toBe(true);
    expect(foraDaIntencao("Carrinho De Brinquedo", pneu, "presente menino 5 anos")).toBe(false);
  });

  test("plural simples do termo negativo também exclui", () => {
    const i = { tipoProduto: "racao", termosNegativos: ["comedouro"], contextoUso: "pet_gatos" };
    expect(foraDaIntencao("Kit 2 Comedouros Para Gatos", i, "racao gato")).toBe(true);
  });
});

describe("leitura da intenção do modelo", () => {
  test("valida domínios, tira negativo digitado e normaliza o tipo", () => {
    const i = intencaoDoModelo(
      {
        buscas: ["tomada 10a", "https://x.com"],
        tipoProduto: "Tomada",
        contextoUso: "Elétrica residencial",
        termosNegativos: ["HDMI", "banheiro", "tomada", "x"],
        dominiosPermitidos: ["MLB-WALL_OUTLETS", "inventado", "mlb-x"],
        precoMax: "80",
        resumo: "Feito por inteligência artificial",
      },
      "tomada para banheiro",
    )!;
    expect(i.buscas).toEqual(["tomada 10a"]);
    expect(i.tipoProduto).toBe("tomada");
    expect(i.contextoUso).toBe("eletrica_residencial");
    expect(i.termosNegativos).toEqual(["hdmi"]);
    expect(i.dominiosPermitidos).toEqual(["MLB-WALL_OUTLETS"]);
    expect(i.precoMax).toBe(80);
    expect(i.resumo).toBe("");
  });
});

describe("filtro em todas as fontes (print do Weslei, 27/10 16:52)", () => {
  const PRINT = [
    "Tomada Para Móveis Hdmi Preto Lumitek",
    "Tomada Para Painel 16A 30024 - Transmobil",
    "Tomada Para Móveis 10a Lumitek - Preto",
    "Tomada para Antena de TV Simon",
  ];

  test("sem a intenção do servidor (resposta guardada ou produto do site), o tipo da consulta basta", () => {
    expect(PRINT.filter((n) => !foraDaIntencao(n, {}, "tomada para banheiro"))).toEqual([]);
    expect(foraDaIntencao("Tomada 20a Com Tampa Ip54 Banheiro", {}, "tomada para banheiro")).toBe(
      false,
    );
  });

  test("quem busca tomada de móveis continua achando", () => {
    expect(foraDaIntencao(PRINT[2]!, {}, "tomada para moveis")).toBe(false);
  });

  test("arte da busca de tomada não é a de ferramentas", async () => {
    const { arteDaBusca, ARTE_NEUTRA } = await import("@/lib/artes");
    expect(arteDaBusca("tomada para banheiro").id).toBe(ARTE_NEUTRA.id);
  });
});
