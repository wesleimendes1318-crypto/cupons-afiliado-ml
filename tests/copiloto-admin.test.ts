import { describe, expect, test } from "bun:test";

import { limparResposta, promptDoCopiloto } from "../src/lib/copiloto-admin";

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
});
