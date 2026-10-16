import { describe, expect, test } from "bun:test";

import { termoDeBuscaExterna } from "@/lib/termo-busca-externa";
import { termoDoProduto } from "@/lib/termo-busca";

describe("termo nos outros marketplaces (igual à extensão)", () => {
  test("sai ruído de venda, SKU e rastreio; ficam voltagem e especificações", () => {
    expect(
      termoDeBuscaExterna("Fone JBL Tune 520BT Original Lacrado Frete Grátis Bluetooth Preto"),
    ).toBe("Fone JBL Tune 520BT Bluetooth Preto");
    expect(termoDeBuscaExterna("Bebedouro Fonte Gato Bivolt 220v SKU: 99887766 Frete Grátis")).toBe(
      "Bebedouro Fonte Gato Bivolt 220v",
    );
    expect(
      termoDeBuscaExterna(
        "Bebedouro Fonte Para Gatos Cães Silenciosa Automática Com Filtro Carvão Retangular Inox 2 Litros Bivolt Envio Rápido",
      ),
    ).toBe("Bebedouro Fonte Para Gatos Cães Automática Com Filtro Retangular Inox 2 Litros");
    expect(
      termoDeBuscaExterna("Caixa de Areia Para Gato Fechada Econômica Grande Promoção Oferta 3L"),
    ).toBe("Caixa de Areia Para Gato Fechada Grande 3L");
  });
});

describe("termo do mesmo produto no Mercado Livre", () => {
  test("4 a 6 palavras-chave, sem adjetivo de venda; formato, material e capacidade ficam", () => {
    const titulo =
      "Bebedouro Fonte Para Gatos Cães Silenciosa Automática Com Filtro Carvão Retangular Inox 2 Litros USB Bivolt";
    expect(termoDoProduto(titulo, 6)).toBe(
      "Bebedouro Fonte Para Gatos Cães Com Filtro Carvão Retangular 2 Litros",
    );
    expect(termoDoProduto(titulo, 4)).toBe("Bebedouro Fonte Para Gatos Cães Retangular 2 Litros");
  });

  test("USB e automática no nome do produto continuam", () => {
    expect(termoDoProduto("Ventilador USB De Mesa Silencioso Premium", 4)).toBe(
      "Ventilador USB De Mesa",
    );
    expect(termoDoProduto("Cafeteira Automática Philco Econômica 220v", 6)).toBe(
      "Cafeteira Automática Philco",
    );
  });
});
