import { describe, expect, test } from "bun:test";

import { contextoDoHub, limparResposta, promptDoCopiloto } from "../src/lib/copiloto-admin";

describe("copiloto do painel", () => {
  test("troca link que não é de afiliado e mantém o meli.la", () => {
    const t = limparResposta(
      "Veja https://produto.mercadolivre.com.br/MLB-1 e https://meli.la/2sfJJDp",
    );
    expect(t).toContain("[link de afiliado]");
    expect(t).toContain("https://meli.la/2sfJJDp");
    expect(t).not.toContain("produto.mercadolivre");
  });
  test("prompt leva contexto, conversa e pede JSON", () => {
    const p = promptDoCopiloto({ totais: { buscas: 3 } }, [{ papel: "voce", texto: "Oi?" }]);
    expect(p).toContain('"buscas":3');
    expect(p).toContain("Weslei: Oi?");
    expect(p).toContain('{"resposta"');
  });
  test("hub do ML vai em reais, com vendas por produto e o que falta como null", () => {
    const c = contextoDoHub([
      {
        capturado_em: "2026-11-07T00:25:00Z",
        comissao_estimada_centavos: 1599,
        comissao_aprovada_centavos: null,
        comissao_pendente_centavos: 1599,
        faturamento_gerado_centavos: 19990,
        pedidos_totais: 1,
        cliques_totais: 40,
        taxa_conversao: 2.5,
        itens: [
          {
            produto: "Fone X",
            valor_centavos: 19990,
            comissao_centavos: 1599,
            comissao_pct: 8,
            tipo: "direta",
            status: "Pendente",
            data: "05/11/2026",
            liberacao: "05/12/2026",
            quantidade: null,
          },
        ],
      },
    ]) as Record<string, unknown>;
    expect(c.ganho_estimado_reais).toBe(15.99);
    expect(c.comissao_aprovada_reais).toBeNull();
    expect((c.vendas_por_produto as { liberacao: string }[])[0]!.liberacao).toBe("05/12/2026");
    expect(contextoDoHub([])).toHaveProperty("status");
  });
});
