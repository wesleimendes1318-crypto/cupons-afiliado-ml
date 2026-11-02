import { describe, expect, test } from "bun:test";
import { extrairIntencaoRapida, foraDaIntencao, pisoDoAparelho } from "@/lib/busca-intencao";
import {
  ehItemSecundarioOuInsumo,
  ordenarPelaIntencao,
  produtosDaBusca,
} from "@/lib/busca-sugestoes";
import { tipoDoProduto } from "@/lib/termo-busca";

/* Weslei, 02/11: "maquina lava e seca barata" trouxe nicho, secante,
   placa, pés antivibração e detergente de lava-louças. */
const fica = (q: string, nome: string) => !foraDaIntencao(nome, extrairIntencaoRapida(q), q);

describe("busca do aparelho x peça, móvel e insumo", () => {
  const q = "maquina lava e seca barata";
  test("lava e seca: só a máquina completa", () => {
    for (const nome of [
      "Lava e Seca Samsung WD11A 11kg Inox Look com Ecobubble e Lavagem a Seco",
      "Lavadora e Secadora LG VC4 11kg Inteligência Artificial AIDD Inox",
      "Máquina de Lavar Lava e Seca Midea Healthguard 11kg Branca LSE11",
      "Lava e Seca Electrolux 11kg Perfect Care Inverter com Motor Inverter",
    ])
      expect(fica(q, nome)).toBe(true);
    for (const nome of [
      "Nicho Para Máquina Lava E Seca Madeira MDF Branco",
      "Kit Secante Lava Louças Finish 250ml",
      "Placa Eletrônica Lavadora Lava e Seca Samsung WD11",
      "Kit 4 Pés Antivibração Borracha Máquina de Lavar",
      "Detergente Líquido Lava Louças Finish 1L",
      "Lava Louças Brastemp 8 Serviços Branca",
      "Armário Para Máquina de Lavar Lava e Seca 2 Portas",
      "Amortecedor Máquina Lava e Seca LG",
      "Lavadora Brastemp 12kg com Ciclo Tira Manchas e Dispenser de Sabão",
      "Máquina de Lavar Electrolux 12kg Essential Care",
    ])
      expect(fica(q, nome)).toBe(false);
  });
  test("a busca fica limpa, com as buscas certas e o piso", () => {
    const i = extrairIntencaoRapida(q);
    expect(i.buscas.slice(0, 2)).toEqual(["lava e seca", "lava e seca samsung"]);
    expect(i.buscas.join(" ")).not.toContain("barat");
    expect(pisoDoAparelho(q)).toBe(1200);
  });
  test("ar condicionado: sem mini ventilador USB nem suporte", () => {
    const a = "ar condicionado barato";
    expect(fica(a, "Ar Condicionado Split Inverter Samsung 12000 BTUs Frio")).toBe(true);
    expect(fica(a, "Ar Condicionado Portátil Elgin 12000 Btus Frio 220v")).toBe(true);
    expect(fica(a, "Mini Ar Condicionado Portátil Climatizador Usb Led")).toBe(false);
    expect(fica(a, "Suporte Ar Condicionado Split 400mm Par")).toBe(false);
    expect(pisoDoAparelho(a)).toBe(800);
  });
  test("tv 50 polegadas: identifica TV e tira suporte, cabo e conversor", () => {
    const t = "tv 50 polegadas barata";
    expect(tipoDoProduto(t)).toBe("tv");
    expect(extrairIntencaoRapida(t).tipoProduto).toBe("tv");
    expect(fica(t, "Smart TV 50 Polegadas Samsung Crystal UHD 4K")).toBe(true);
    expect(fica(t, "Smart TV LED 32 HD Philco com Conversor Digital")).toBe(true);
    expect(fica(t, "Suporte Articulado Para TV 32 a 75 Polegadas")).toBe(false);
    expect(fica(t, "Cabo HDMI 2.0 4K 3 Metros")).toBe(false);
    expect(fica(t, "Conversor Digital Para TV Full HD")).toBe(false);
    expect(pisoDoAparelho(t)).toBe(900);
    expect(pisoDoAparelho("tv 32 polegadas")).toBeNull();
  });
  test("geladeira 2 portas continua sendo a geladeira", () => {
    expect(fica("geladeira 2 portas", "Geladeira Frost Free Brastemp 375L 2 Portas Inox")).toBe(
      true,
    );
    expect(pisoDoAparelho("geladeira 2 portas")).toBe(1000);
  });
  test("preço pedido ou peça pedida: sem piso", () => {
    expect(pisoDoAparelho("suporte de tv 50 polegadas")).toBeNull();
    expect(pisoDoAparelho("placa lava e seca samsung")).toBeNull();
    expect(pisoDoAparelho("notebook")).toBeNull();
  });
});

describe("quem busca a peça ou o acessório continua achando", () => {
  test("suporte de tv, secante, placa e capinha", () => {
    expect(fica("suporte de tv", "Suporte Articulado Para TV 32 a 75 Polegadas")).toBe(true);
    expect(fica("secante lava loucas", "Secante Finish Lava Louças 250ml")).toBe(true);
    expect(
      fica("placa lava e seca samsung", "Placa Eletrônica Lavadora Lava e Seca Samsung WD11"),
    ).toBe(true);
    expect(fica("capinha iphone 17", "Capinha Case Anti Impacto Para iPhone 17")).toBe(true);
  });
  test("fora de aparelho, o produto é o próprio item", () => {
    expect(fica("motor portao eletronico", "Motor Portão Eletrônico Deslizante PPA")).toBe(true);
    expect(fica("detergente ype", "Detergente Líquido Ypê Neutro 500ml")).toBe(true);
    expect(ehItemSecundarioOuInsumo("Detergente Líquido Ypê Neutro 500ml")).toBe(true);
  });
});

describe("listas do site seguem a mesma regra", () => {
  const nomes = [
    "Nicho Para Máquina Lava E Seca Madeira MDF Branco",
    "Lava e Seca Samsung WD11A 11kg Inox",
    "Kit 4 Pés Antivibração Borracha Máquina de Lavar",
  ];
  test("ordenarPelaIntencao e produtosDaBusca", () => {
    expect(ordenarPelaIntencao("lava e seca", nomes, (n) => n)).toEqual([
      "Lava e Seca Samsung WD11A 11kg Inox",
    ]);
    const conhecidos = nomes.map((titulo, k) => ({
      titulo,
      imagem: null,
      preco: 100,
      url: `https://x/${k}`,
    }));
    expect(produtosDaBusca("lava e seca", conhecidos).map((p) => p.titulo)).toEqual([
      "Lava e Seca Samsung WD11A 11kg Inox",
    ]);
  });
});
