import { describe, expect, test } from "bun:test";

import { lerListaPublica, naFaixa, resumoDaLista } from "../src/lib/lista-publica";

const item = (id: string, preco: number | null, link = "https://meli.la/abc123") => ({
  id, titulo: `Produto ${id}`, preco, foto: null, url: null, linkAfiliado: link, loja: "mercadolivre", adicionadoEm: "2026-11-05T10:00:00Z",
});

describe("lista pública", () => {
  test("drops items without Weslei's link or an ML address and hides nothing else", () => {
    const l = lerListaPublica({
      id: "abcDEF2345", titulo: "Aniversário", ocasiao: "Aniversário",
      itens: [item("MLB1", 40), item("MLB2", 90, "https://outro-afiliado.com/x")],
      presentes: { MLB1: { nome: "Ana", em: "2026-11-05T11:00:00Z", quem: "segredo" } },
    });
    expect(l?.itens.map((i) => i.id)).toEqual(["MLB1"]);
    expect(l?.presentes["MLB1"]).toEqual({ nome: "Ana", em: "2026-11-05T11:00:00Z" });
  });

  test("budget pills and summary", () => {
    const itens = lerListaPublica({ id: "abcDEF2345", itens: [item("MLB1", 35), item("MLB2", 100), item("MLB3", 250), item("MLB4", null)] })!.itens;
    expect(naFaixa(itens, 0)).toHaveLength(4);
    expect(naFaixa(itens, 1).map((i) => i.id)).toEqual(["MLB1"]);
    expect(naFaixa(itens, 2).map((i) => i.id)).toEqual(["MLB2"]);
    expect(naFaixa(itens, 4).map((i) => i.id)).toEqual(["MLB3"]);
    expect(resumoDaLista(itens)).toBe("4 presentes selecionados • Opções de R$ 35 a R$ 250");
  });
});
