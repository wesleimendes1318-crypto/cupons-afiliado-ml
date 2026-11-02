import { describe, expect, test } from "bun:test";
import { ordenarResultados } from "@/lib/busca-resultados";

/* Busca real "maquina lava e seca" (02/11, 19h): o Weslei (Mogi, 220 V)
   achou na mão a Titanium Slim 220 V da loja oficial, frete grátis e
   R$ 320 abaixo das outras ofertas, que estava em 12º atrás de modelos
   127 V e de frete pago. */
type V = "127" | "220" | null;
const linha = (
  nome: string,
  preco: number,
  voltagem: V,
  frete: boolean | null,
  oficial: boolean,
  economia: number | null,
  maisVendido: number | null = null,
) => ({
  nome,
  preco,
  voltagem,
  freteGratis: frete,
  lojaOficial: oficial,
  economia,
  maisVendido,
  avaliacao: null,
});
const busca = [
  linha("LG VC4 12kg Inox", 5999, null, true, false, 314),
  linha("LG VC4 12kg Inox oficial", 4819, "220", false, true, 1250),
  linha("Electrolux LSC12", 4172.9, "220", true, true, 224),
  linha("Midea HealthGuard 11kg 127", 3369, "127", true, true, 230),
  linha("Midea Slim Branca 127", 3199, "127", false, true, 235),
  linha("Midea Ciclo Pets 127", 3199, "127", true, true, 330),
  linha("Samsung WD11T", 5192.49, null, true, false, null),
  linha("Samsung WD5000T", 5299, null, true, false, null),
  linha("Samsung WD11M", 3499, null, null, true, null, 1),
  linha("Midea Ciclo Pets 220", 3179, "220", false, true, 175),
  linha("Midea Titanium Slim 127", 3062, "127", false, true, 392),
  linha("Midea Titanium Slim 220", 3369, "220", true, true, 320),
  linha("Midea Titanium Slim 11,5 127", 3199, "127", true, true, 600),
  linha("Midea HealthGuard 13kg 127", 3599, "127", true, true, 300),
  linha("Electrolux LSB12 127", 3100, "127", true, false, null),
  linha("Midea HealthGuard 220", 3479, "220", false, true, 300),
];
const nomes = (l: Array<{ nome: string }>) => l.map((i) => i.nome);

describe("ordem da busca pela tomada da região", () => {
  test("Mogi (220 V): a Titanium Slim 220 V vem primeiro e nenhum 127 V antes dos 220 V", () => {
    const r = nomes(ordenarResultados(busca, "recomendados", new Map(), { rede: "220" }));
    expect(r[0]).toBe("Midea Titanium Slim 220");
    const primeiro127 = r.findIndex((n) => n.endsWith("127"));
    expect(r.slice(primeiro127).every((n) => n.endsWith("127"))).toBe(true);
  });
  test("menor preço também deixa o que não serve no fim", () => {
    const r = nomes(ordenarResultados(busca, "menor-preco", new Map(), { rede: "220" }));
    expect(r[0]).toBe("Midea Ciclo Pets 220");
    expect(r.at(-1)!.endsWith("127")).toBe(true);
  });
  test("sem a região, a ordem não olha a voltagem", () => {
    const r = nomes(ordenarResultados(busca, "menor-preco"));
    expect(r[0]).toBe("Midea Titanium Slim 127");
  });
});
