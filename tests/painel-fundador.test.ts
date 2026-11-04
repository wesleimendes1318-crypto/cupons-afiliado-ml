import { describe, expect, test } from "bun:test";

import { dossie, resumo, type Painel } from "../src/lib/painel-fundador";

const dia = (d: string, n: Partial<Painel["serie"][number]> = {}) => ({
  dia: d,
  visitas: 0,
  buscas_link: 0,
  buscas_texto: 0,
  comparacoes: 0,
  cliques_ml: 0,
  cliques_amazon: 0,
  cliques_shopee: 0,
  favoritados: 0,
  alertas_ativos: 0,
  alertas_disparados: 0,
  ...n,
});

const base: Painel = {
  gerado_em: "2026-11-04T03:00:00Z",
  de: "2026-11-01",
  ate: "2026-11-04",
  serie: [dia("2026-11-03", { buscas_link: 8, buscas_texto: 2, cliques_ml: 3, cliques_amazon: 1 })],
  vendas: [],
  monitorados: 5,
  seguidores: 7,
  categorias: [],
  termos: [],
  top_produtos: [
    {
      titulo: "Fone | X",
      categoria: "Eletrônicos",
      preco: 100,
      melhor_loja: "Loja",
      melhor_preco: 90,
      vezes: 4,
      cliques: 2,
    },
  ],
  gaps: [],
  falhas_busca: 0,
  saude: {
    extensao_versao: null,
    extensao_visto_em: null,
    extensao_pausada: null,
    operacao_pausada: null,
    ia_esgotadas: [],
    cron: [],
    ofertas_24h: 0,
  },
};

describe("painel do fundador", () => {
  test("sem leitura do portal, comissão fica null (nunca 0 inventado)", () => {
    expect(resumo(base).comissaoMes).toBeNull();
    expect(dossie(base)).toContain("aguardando sincronização");
  });
  test("taxa de decisão = cliques / buscas", () => {
    expect(resumo(base).taxaDecisao).toBeCloseTo(40);
  });
  test("comissão soma o mês e compara semanas", () => {
    const p = {
      ...base,
      vendas: [
        {
          data: "2026-11-02",
          marketplace: "amazon" as const,
          pedidos: 1,
          comissao_centavos: 300,
          cliques: 2,
          status: null,
          capturado_em: "2026-11-02T10:00:00Z",
        },
        {
          data: "2026-10-26",
          marketplace: "mercadolivre" as const,
          pedidos: 1,
          comissao_centavos: 200,
          cliques: 2,
          status: null,
          capturado_em: "2026-10-26T10:00:00Z",
        },
      ],
    };
    const r = resumo(p);
    expect(r.comissaoMes).toBe(300);
    expect(r.variacaoSemana).toBeCloseTo(50);
  });
  test("dossiê traz as 5 seções e escapa a barra da tabela", () => {
    const md = dossie(base);
    for (const s of ["## 1.", "## 2.", "## 3.", "## 4.", "## 5."]) expect(md).toContain(s);
    expect(md).toContain("Fone / X");
  });
});
