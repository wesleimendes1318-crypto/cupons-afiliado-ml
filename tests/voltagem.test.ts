import { describe, expect, test } from "bun:test";
import {
  voltagemDaRegiao,
  voltagemDosAtributos,
  voltagemDoTexto,
} from "@/lib/voltagem";
import { ESCOLHA_BUSCA_VAZIA, filtrarResultados } from "@/lib/busca-resultados";

const item = (nome: string, voltagem: "127" | "220" | "bivolt" | null) => ({
  nome,
  preco: 3000,
  freteGratis: true,
  lojaOficial: false,
  voltagem,
});

describe("voltagem da região pelo CEP", () => {
  test("Mogi das Cruzes/SP é 220 V", () => {
    expect(voltagemDaRegiao("Mogi das Cruzes", "SP")?.volts).toBe("220");
  });
  test("São Paulo capital é 127 V", () => {
    expect(voltagemDaRegiao("São Paulo", "SP")?.volts).toBe("127");
  });
  test("Florianópolis/SC é 220 V e Porto Alegre/RS é 127 V", () => {
    expect(voltagemDaRegiao("Florianópolis", "SC")?.volts).toBe("220");
    expect(voltagemDaRegiao("Porto Alegre", "RS")?.volts).toBe("127");
  });
  test("sem cidade não afirma nada", () => {
    expect(voltagemDaRegiao(null, "SP")).toBeNull();
  });
});

describe("voltagem do produto", () => {
  test("atributo oficial VOLTAGE", () => {
    expect(voltagemDosAtributos([{ id: "VOLTAGE", value_name: "220V" }])).toBe("220");
    expect(voltagemDosAtributos([{ id: "VOLTAGE", value_name: "127V" }])).toBe("127");
    expect(voltagemDosAtributos([{ id: "VOLTAGE", value_name: "Bivolt" }])).toBe("bivolt");
  });
  test("título com 127 volts", () => {
    expect(voltagemDoTexto("Lava e Seca Midea 11kg 127 volts")).toBe("127");
  });
});

describe("filtro 220 V", () => {
  const itens = [
    item("Lava e Seca LG 12kg", "220"),
    item("Lava e Seca Midea 11kg", "127"),
    item("Lava e Seca Samsung 13kg", "bivolt"),
    item("Lava e Seca Electrolux 12kg", null),
  ];
  test("mostra 220 V e bivolt, tira 127 V e sem voltagem", () => {
    const r = filtrarResultados(itens, { ...ESCOLHA_BUSCA_VAZIA, filtros: { voltagem: "220" } });
    expect(r.map((i) => i.voltagem)).toEqual(["220", "bivolt"]);
  });
  test("atributo oficial manda sobre o título", () => {
    const r = filtrarResultados([item("Lava e Seca 127v", "220")], {
      ...ESCOLHA_BUSCA_VAZIA,
      filtros: { voltagem: "220" },
    });
    expect(r).toHaveLength(1);
  });
});
