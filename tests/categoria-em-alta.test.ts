import { test } from "node:test";
import assert from "node:assert/strict";

import { categoriaDoMaisVendido as cat } from "../src/lib/categoria-em-alta";

/* Casos reais da lista oficial de mais vendidos de 09/10. */
test("produto que o Mercado Livre lista em outra categoria vai para a certa", () => {
  assert.equal(cat("Guarda Chuva Abre E Fecha Automático Reforçado Contra Vento", "moda"), "casa");
  assert.equal(cat("Guarda-chuva Automático Mão Santa Preto com Fivela", "moda"), "casa");
  assert.equal(cat("100Unid Presilhas Estrela Colorida Tic Tac Infantil", "moda"), "beleza");
  assert.equal(cat("Bolsa Isotérmica Térmica Lancheira Marmita Sacola", "moda"), "casa");
  assert.equal(cat("Papel Higiênico Folha Dupla 30m L24p22 Personal", "beleza"), "casa");
  assert.equal(cat("Percarbonato De Sódio 100% Puro Tira Manchas", "beleza"), "casa");
  assert.equal(cat("Panos Scott Duramax com 58 unidades", "automotivo"), "casa");
  assert.equal(cat("Estilete largo, lâmina de 18 mm, ES 218, VONDER", "automotivo"), "ferramentas");
  assert.equal(cat("Power Bank 20.000mAh 22.5W Carga Rápida", "informatica"), "celulares");
  assert.equal(
    cat("Controle Joystick Sem Fio Sony PlayStation 5 DualSense", "informatica"),
    "eletronicos",
  );
  assert.equal(cat("Mochila Viagem Feminina Masculina Para Notebook", "informatica"), "moda");
  assert.equal(
    cat("Mini Ventilador Portátil Basike de 3 Velocidades", "informatica"),
    "eletrodomesticos",
  );
  assert.equal(cat("Astronauta para Quarto com Luz Nebulosa e Galáxia", "informatica"), "casa");
  assert.equal(cat("SSD Kingston NV3 1TB M.2 2280 PCIe 4.0 NVMe", "eletronicos"), "informatica");
  assert.equal(
    cat("Inversor De Tensão Veicular 12v Para E 300w Automotivo", "eletronicos"),
    "automotivo",
  );
  assert.equal(cat("Kit 10 Peças Conexão Automática Wago 2 Fios", "eletronicos"), "ferramentas");
  assert.equal(
    cat("Kit Chave Precisão Profissional 115 Peças Manutenção Celular", "celulares"),
    "ferramentas",
  );
});

test("acessório de cabelo é beleza", () => {
  assert.equal(cat("Kit Amarrador Elástico Laycra Outubro Rosa Feminino", "moda"), "beleza");
  assert.equal(cat("Tic Tac Presilha De Cabelo Aranha Festa Halloween", "moda"), "beleza");
});

test("relógio inteligente é acessório de celular, não moda", () => {
  assert.equal(cat("Relógio Inteligente Gps Smartwatch Amoled 3atm", "celulares"), "celulares");
  assert.equal(cat("Relógio Masculino Casio Vintage Dourado", "moda"), "moda");
});

test("fora: código digital, fralda e tela de reposição", () => {
  assert.equal(cat("Sony PlayStation Store Gift Card R$ 150 (Digital)", "informatica"), null);
  assert.equal(cat("Xbox Game Pass Ultimate assinatura 1 mês (Digital)", "eletronicos"), null);
  assert.equal(cat("Razer Gold Digital R$ 30 (digital)", "informatica"), null);
  assert.equal(cat("Fralda Bigfral Derma Plus M 8 Unidades", "beleza"), null);
  assert.equal(
    cat("Tela Compatível A02 A12 A125 M12 Frontal Display Lcd Touch", "celulares"),
    null,
  );
});

test("categorias novas de 09/10: eletrodomésticos e ferramentas", () => {
  assert.equal(cat("Aspirador Pó E Água Soprador Wap Gtw 10 1400w", "casa"), "eletrodomesticos");
  assert.equal(
    cat("Fritadeira Elétrica Air Fryer Quad Fry Elgin 4,2 L", "casa"),
    "eletrodomesticos",
  );
  assert.equal(cat("Parafusadeira Furadeira De Impacto The Black Tools", "casa"), "ferramentas");
  assert.equal(cat("Óculos de Proteção Ampla Visão Incolor", "moda"), "ferramentas");
  assert.equal(cat("Kit 10 Potes Vidro Hermetico Microondas Marmita", "casa"), "casa");
  assert.equal(cat("Aspirador De Pó Automotivo Portátil 12v", "automotivo"), "automotivo");
  assert.equal(
    cat("Auxiliar de Partida Bateria e Compressor de Ar para Carro", "automotivo"),
    "automotivo",
  );
});

test("o que já está certo continua", () => {
  assert.equal(cat("Fila Rise Up Masculino", "moda"), "moda");
  assert.equal(cat("Gravata Masculina Premium Tradicional", "moda"), "moda");
  assert.equal(cat("Smartphone Motorola Moto G06 - 256gb", "celulares"), "celulares");
  assert.equal(cat("Bateria De Moto Moura 12v 5ah", "automotivo"), "automotivo");
  assert.equal(cat("Fone De Ouvido Para Capacete Bluetooth Headset", "automotivo"), "automotivo");
  /* Clone de "AirPods Pro" sem marca: fora (pareceFalso, 09/10). */
  assert.equal(
    cat("Fone De Ouvido Bluetooth Pro 4 Com Case Carregador E Microfone", "celulares"),
    null,
  );
  assert.equal(
    cat("Controle Para Xbox 360 Com Fio Joystick Manete Gamepass", "eletronicos"),
    "eletronicos",
  );
  assert.equal(
    cat("Mouse Recarregável Bluetooth Notebook Pc Tablet Smartphone", "informatica"),
    "informatica",
  );
  assert.equal(cat("Kit 3 Perfumes Cebolinha Jequiti 25ml Infantil", "beleza"), "beleza");
  assert.equal(cat("2 Colônias Hot Wheels Monster Trucks 25ml - Jequiti", "beleza"), "beleza");
  assert.equal(cat("Brinquedo Lança Bolha Sabão Automática Capivara", "brinquedos"), "brinquedos");
  assert.equal(cat("Kit Com 2 Fronhas Barbie Boneca Menina", "casa"), "casa");
  assert.equal(cat("Patinete Infantil 3 Rodas com Led", "brinquedos"), "brinquedos");
  assert.equal(cat("Lava Roupas Líquido Omo 7 L", "casa"), "casa");
  assert.equal(cat("Pilha Alcalina Aa Pequena Duracell", "eletronicos"), "eletronicos");
});
