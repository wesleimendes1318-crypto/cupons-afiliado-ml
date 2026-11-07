import { describe, expect, it } from "bun:test";
import { ehUrlDeBuscaML } from "@/lib/analisar-link";
import {
  extrairIntencaoRapida,
  foraDaIntencao,
  foraDoModelo,
  modeloDaFrase,
} from "@/lib/busca-intencao";
import { arquetipoDoTitulo, intercalarPorDiversidade, limitarPorArquetipo } from "@/lib/curadoria";
import { chaveDeServico } from "@/integrations/supabase/projeto";
import { enviar, estadoDoPrazo } from "@/lib/prazo-cliente";

describe("Auditoria e Blindagem da Plataforma", () => {
  it("detecta URLs de busca do ML e impede geracao de link invalido", () => {
    expect(ehUrlDeBuscaML("https://lista.mercadolivre.com.br/qcy-t29")).toBe(true);
    expect(ehUrlDeBuscaML("https://www.mercadolivre.com.br/p/MLB12345678")).toBe(false);
    expect(ehUrlDeBuscaML("https://meli.la/1AbCdEf")).toBe(false);
  });

  it("bloqueia acessorios e modelos rivais na busca estrita", () => {
    expect(foraDoModelo("Capa Galaxy S24 Ultra", "Apple", "iPhone 17 Pro Max")).toBe(true);
    expect(foraDoModelo("iPhone 17 Pro Max 256GB Titânio", "Apple", "iPhone 17 Pro Max")).toBe(
      false,
    );
    expect(foraDoModelo("Apple iPhone 16 Pro Max 256GB", "Apple", "iPhone 17 Pro Max")).toBe(true);
    expect(foraDoModelo("Apple iPhone 17 256GB", "Apple", "iPhone 17 Pro Max")).toBe(true);
    expect(foraDoModelo("Samsung Galaxy S24 Ultra 512GB", "Samsung", "Galaxy S2")).toBe(true);
    expect(
      foraDoModelo("Carregador Samsung para iPhone 17 Pro Max", null, "iPhone 17 Pro Max"),
    ).toBe(true);
    // marca citada que não é linha continua obrigatória
    expect(foraDoModelo("Tênis Olympikus TC 7900", "Nike", "TC 7900")).toBe(true);
  });

  it("le a linha do aparelho na frase, sem rede", () => {
    expect(modeloDaFrase("iPhone 17 Pro Max barato")).toEqual({
      marca: "Apple",
      modelo: "iphone 17 pro max",
    });
    expect(modeloDaFrase("capa galaxy s24 ultra")?.modelo).toBe("galaxy s24 ultra");
    expect(modeloDaFrase("fone bluetooth")).toBeNull();
  });

  it("busca do aparelho nao traz capa, pelicula nem outra geracao", () => {
    const q = "iPhone 17 Pro Max";
    const i = { ...extrairIntencaoRapida(q), marca: "Apple", modelo: "iphone 17 pro max" };
    expect(foraDaIntencao("Apple iPhone 17 Pro Max (256 GB) - Laranja", i, q)).toBe(false);
    expect(foraDaIntencao("Apple iPhone 17 Pro Max 256GB com cabo USB-C", i, q)).toBe(false);
    expect(foraDaIntencao("Película iPhone 17 Pro Max Vidro 3D", i, q)).toBe(true);
    expect(foraDaIntencao("Capa Para iPhone 17 Pro Max Silicone", i, q)).toBe(true);
    expect(foraDaIntencao("Apple iPhone 16 Pro Max 256GB", i, q)).toBe(true);
    expect(foraDaIntencao("Samsung Galaxy S25 Ultra", i, q)).toBe(true);
    // pedido de acessório: a capa é o produto
    const qa = "capa iphone 17 pro max";
    const ia = { ...extrairIntencaoRapida(qa), marca: null, modelo: "iphone 17 pro max" };
    expect(foraDaIntencao("Capa Para iPhone 17 Pro Max Silicone", ia, qa)).toBe(false);
    expect(foraDaIntencao("Capa iPhone 16 Pro Max", ia, qa)).toBe(true);
  });

  it("intercala arquétipos evitando monopólio de vasos na decoração", () => {
    const itens = [
      { id: "1", tipo: "vaso" },
      { id: "2", tipo: "vaso" },
      { id: "3", tipo: "vaso" },
      { id: "4", tipo: "abajur" },
      { id: "5", tipo: "quadro" },
      { id: "6", tipo: "espelho" },
    ];
    const misturados = intercalarPorDiversidade(itens, (x) => x.tipo);
    expect(misturados[0]!.tipo).not.toBe(misturados[1]!.tipo);
    expect(new Set(misturados.slice(0, 4).map((x) => x.tipo)).size).toBe(4);
  });

  it("no máximo 2 do mesmo tipo a cada 10, sem perder nenhum", () => {
    const tipos = [
      "vaso",
      "vaso",
      "vaso",
      "vaso",
      "vaso",
      "abajur",
      "quadro",
      "espelho",
      "difusor",
      "bandeja",
      "vela",
      "relogio",
      "manta",
      "almofada",
    ];
    const itens = tipos.map((tipo, i) => ({ id: i, tipo }));
    const r = limitarPorArquetipo(itens, (x) => x.tipo, 2, 10);
    expect(r).toHaveLength(itens.length);
    expect(r.slice(0, 10).filter((x) => x.tipo === "vaso")).toHaveLength(2);
    expect(arquetipoDoTitulo("Abajur de Mesa Madeira")).toBe(
      arquetipoDoTitulo("Luminária de Mesa LED"),
    );
    expect(arquetipoDoTitulo("Kit 3 Vasos Decorativos")).toBe("vaso");
  });

  it("chave de serviço: nomes alternativos só com chave deste projeto", () => {
    expect(chaveDeServico({ SUPABASE_SERVICE_KEY: "sb_secret_abc" }).chave).toBe("sb_secret_abc");
    const jwt = (ref: string) => `x.${btoa(JSON.stringify({ ref, role: "service_role" }))}.y`;
    expect(chaveDeServico({ SERVICE_ROLE_KEY: jwt("itgdvxvqbwjcvmglfval") }).origem).toBe("nome");
    expect(chaveDeServico({ SERVICE_ROLE_KEY: jwt("outroprojeto") }).chave).toBeUndefined();
  });

  it("prazo: falha não trava o cartão, resposta explícita fica", async () => {
    const original = globalThis.fetch;
    let chamadas = 0;
    globalThis.fetch = (async () => {
      chamadas++;
      return chamadas === 1
        ? new Response("", { status: 429 })
        : Response.json({ prazos: { MLB1111111: null } });
    }) as unknown as typeof fetch;
    try {
      await enviar("01001000", ["MLB1111111", "MLB2222222"], [1]);
      expect(chamadas).toBe(2);
      expect(estadoDoPrazo("01001000", "MLB1111111").guardado).toBeNull();
      // omitido pelo servidor: pode ser pedido de novo
      expect(estadoDoPrazo("01001000", "MLB2222222").pedido).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });
});
