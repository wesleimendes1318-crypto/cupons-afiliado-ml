import { describe, expect, test } from "bun:test";

import { itemDoProduto } from "@/lib/lista-desejos";
import {
  PLANEJADORES,
  diasAte,
  estadoInicial,
  itensDoPresente,
  lerEstado,
  mudarItem,
  ordenarOfertas,
  planejadorDo,
  resumir,
  serveNaVoltagem,
} from "@/lib/planejadores";
import type { Resultado } from "@/lib/busca-guiada-cliente";

const casa = planejadorDo("casa-nova")!;
const produto = (preco: number) =>
  itemDoProduto({
    chave: "MLB123",
    titulo: "Geladeira Frost Free",
    preco,
    url: "https://www.mercadolivre.com.br/p/MLB123",
  })!;

describe("planejadores", () => {
  test("every planner has unique item ids, 3 phases and search terms", () => {
    const slugs = new Set<string>();
    for (const p of PLANEJADORES) {
      expect(slugs.has(p.slug)).toBe(false);
      slugs.add(p.slug);
      const ids = p.itens.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const f of [1, 2, 3]) expect(p.itens.some((i) => i.fase === f)).toBe(true);
      for (const i of p.itens) {
        expect(i.id).toMatch(/^[a-z0-9-]+$/);
        expect(i.termos.length).toBeGreaterThan(0);
      }
    }
    expect(PLANEJADORES.length).toBe(8);
  });

  test("lerEstado drops junk and unknown items, keeps checked products", () => {
    const e = lerEstado(
      {
        configurado: true,
        orcamento: -5,
        volts: "110",
        listaId: "x",
        itens: {
          geladeira: { status: "comprei", escolhido: produto(3000), presente: true },
          fogao: {
            status: "hack",
            escolhido: { titulo: "x", loja: "mercadolivre", url: "https://evil.com" },
            presente: true,
          },
          inventado: { status: "tenho" },
        },
      },
      casa,
    );
    expect(e.orcamento).toBeNull();
    expect(e.volts).toBeNull();
    expect(e.listaId).toBeNull();
    expect(e.itens["geladeira"]?.escolhido?.preco).toBe(3000);
    expect(e.itens["fogao"]).toEqual({ status: "falta", escolhido: null, presente: false });
    expect(e.itens["inventado"]).toBeUndefined();
  });

  test("totals only count chosen products; gifts list only what is still missing", () => {
    let e = { ...estadoInicial(), configurado: true };
    e = mudarItem(e, "geladeira", (x) => ({ ...x, escolhido: produto(3000), presente: true }));
    e = mudarItem(e, "colchao", (x) => ({ ...x, status: "comprei", escolhido: produto(1000) }));
    const r = resumir(casa, e);
    expect(r.faltaEssencial).toBe(3000);
    expect(r.gasto).toBe(1000);
    expect(r.faltaTotal).toBe(0); // the fridge was asked as a gift
    expect(r.essenciaisSemProduto).toBe(casa.itens.filter((i) => i.fase === 1).length - 2);
    expect(itensDoPresente(casa, e).map((i) => i.id)).toEqual(["MLB123"]);
    e = mudarItem(e, "geladeira", (x) => ({ ...x, status: "ganhei" }));
    expect(itensDoPresente(casa, e)).toEqual([]);
  });

  test("voltage gate and ordering", () => {
    const r = (o: Partial<Resultado>): Resultado => ({
      produto: "MLB1",
      item: "MLB1",
      nome: "x",
      imagem: null,
      preco: 100,
      url: "",
      ...o,
    });
    expect(serveNaVoltagem(r({ voltagem: "220" }), "127", true)).toBe(false);
    expect(serveNaVoltagem(r({ voltagem: "bivolt" }), "127", true)).toBe(true);
    expect(serveNaVoltagem(r({ voltagem: null, nome: "Panela" }), "127", true)).toBe(true);
    expect(serveNaVoltagem(r({ voltagem: "220" }), "127", false)).toBe(true);
    const a = r({ item: "a", preco: 50 });
    const b = r({ item: "b", preco: 200, lojaOficial: true });
    expect(ordenarOfertas([b, a], "economico").map((x) => x.item)).toEqual(["a", "b"]);
    expect(ordenarOfertas([a, b], "equilibrado").map((x) => x.item)).toEqual(["b", "a"]);
  });

  test("diasAte", () => {
    expect(diasAte("2026-11-10", new Date(2026, 10, 6, 15))).toBe(4);
    expect(diasAte(null)).toBeNull();
  });
});
