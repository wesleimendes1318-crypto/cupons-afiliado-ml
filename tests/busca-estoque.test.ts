import { describe, expect, test } from "bun:test";
import { filtrarEstoque } from "@/lib/busca-guiada";

const linha = (nome: string, preco: number | null, extra: Record<string, unknown> = {}) => ({
  produto: "MLB123456",
  item: "MLB999999",
  nome,
  imagem: null,
  preco,
  url: null,
  frete_gratis: null,
  loja_oficial: null,
  dominio_ml: "MLB-WASHING_MACHINES",
  ...extra,
});

describe("estoque próprio na busca", () => {
  test("domínio, piso, falsificado e preço desconhecido", () => {
    const r = filtrarEstoque(
      [
        linha("Lava E Seca Samsung 11kg Inox 220v", 2899),
        linha("Lava E Seca Réplica 1:1", 2000),
        linha("Placa Lava E Seca", 300),
        linha("Nicho Lava E Seca", 1500, { dominio_ml: "MLB-FURNITURE" }),
        linha("Lava E Seca LG", null),
      ],
      ["lava e seca"],
      { pisoPreco: 1200, dominios: new Set(["MLB-WASHING_MACHINES"]) },
    );
    expect(r.map((x) => x.nome)).toEqual(["Lava E Seca Samsung 11kg Inox 220v"]);
    expect(r[0]!.voltagem).toBe("220");
    /* frete não informado continua desconhecido (nunca vira grátis) */
    expect(r[0]!.freteGratis).toBeNull();
    expect(r[0]!.url).toContain("item_id%3AMLB999999");
  });

  test("sem domínio, o tipo da busca tem de estar no nome", () => {
    const r = filtrarEstoque(
      [linha("Smartwatch Xiaomi Band", 300), linha("Pulseira Para Relógio", 30)],
      ["smartwatch"],
      { dominios: null },
    );
    expect(r.map((x) => x.nome)).toEqual(["Smartwatch Xiaomi Band"]);
  });
});
