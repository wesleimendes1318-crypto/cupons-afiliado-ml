import { describe, expect, test } from "bun:test";

import { NOS } from "@/content/taxonomia";
import type { ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";
import type { PerfilVisitante } from "@/lib/perfil-visitante";
import {
  COMPLEMENTOS,
  NOS_RECOMPRA,
  chipDoSemelhante,
  montarHistorico,
  nichoDoVisitante,
  selecionarComplementos,
  selecionarPensados,
  selecionarRecompra,
  selecionarSazonal,
  selecionarSemelhantes,
  type ItemRec,
} from "@/lib/recomendacoes";
import { TEMPORADAS } from "@/lib/sazonal";

let n = 0;
const item = (nome: string, preco: number, extra: Partial<ItemRec> = {}): ItemRec => ({
  produto: `MLBP${++n}`,
  categoria_site: "casa",
  posicao: 50,
  nome,
  imagem: null,
  preco,
  frete_gratis: true,
  loja_oficial: false,
  url: `https://www.mercadolivre.com.br/p/MLB${1000000 + n}`,
  atualizado_em: "2026-10-27T12:00:00Z",
  ...extra,
});
const resumo = (nota: number, total: number): ResumoAvaliacoes => ({
  item: null,
  avaliacoes: { nota, total },
  sem: false,
  detalhe: false,
});
const semNota = () => undefined;
const perfil = (p: Partial<PerfilVisitante> = {}): PerfilVisitante => ({
  versao: 2,
  idAnonimo: "x",
  categorias: {},
  termosRecentes: [],
  ticketMedio: 0,
  precosNaMedia: 0,
  produtosInteragidos: [],
  sensivelAFreteGratis: false,
  atualizadoEm: Date.now(),
  ...p,
});

describe("nós usados existem na taxonomia", () => {
  test("recompra e complementos", () => {
    expect(NOS_RECOMPRA.length).toBeGreaterThan(10);
    for (const lista of Object.values(COMPLEMENTOS))
      for (const s of lista) expect(NOS[s], s).toBeDefined();
  });
});

describe("recompra", () => {
  test("só reposição entre os mais vendidos ou muito bem avaliada", () => {
    const shampoo = item("Shampoo Elseve Hidra Hialurônico 400ml", 25, {
      categoria_no: "shampoos",
      posicao: 3,
    });
    const hidratante = item("Hidratante Corporal Nivea 400ml", 30, {
      categoria_no: "cuidados-corporais",
      posicao: 90,
    });
    const desodorante = item("Desodorante Rexona Aerosol 150ml", 15, {
      categoria_no: "higiene-pessoal",
      posicao: 90,
    });
    const furadeira = item("Furadeira Bosch 650W", 300, {
      categoria_no: "furadeiras-e-parafusadeiras",
      posicao: 1,
    });
    const notas = new Map([[hidratante.produto, resumo(4.9, 320)]]);
    const lista = selecionarRecompra(
      [shampoo, hidratante, desodorante, furadeira],
      (i) => notas.get(i.produto),
      null,
    );
    expect(lista.map((i) => i.nome).sort()).toEqual([hidratante.nome, shampoo.nome].sort());
    expect(lista[0]).toBe(hidratante);
  });

  test("nota baixa lida tira o item", () => {
    const s = item("Shampoo Barato 300ml", 10, { categoria_no: "shampoos", posicao: 1 });
    expect(selecionarRecompra([s], () => resumo(3.9, 100), null)).toEqual([]);
  });

  test("falsificado e sem avaliações ficam fora", () => {
    const replica = item("Perfume Importado Réplica 1:1 100ml", 60, {
      categoria_no: "perfumes",
      posicao: 1,
    });
    const semAval = item("Shampoo Novo 300ml", 20, { categoria_no: "shampoos", posicao: 2 });
    const notas = new Map([[semAval.produto, { ...resumo(0, 0), avaliacoes: null, sem: true }]]);
    expect(selecionarRecompra([replica, semAval], (i) => notas.get(i.produto), null)).toEqual([]);
  });
});

describe("você também pode se interessar", () => {
  test("celular puxa fone e carregador; peça avulsa fica fora", () => {
    const p = perfil({
      categorias: { celulares: 20 },
      termosRecentes: [{ termo: "iphone 15", em: 1 }],
    });
    const fone = item("Fone de Ouvido Bluetooth JBL Tune 520BT", 250, {
      categoria_no: "fones-bluetooth",
    });
    const carregador = item("Carregador Turbo 20W USB-C", 60, {
      categoria_no: "carregadores",
      frete_gratis: false,
    });
    const tela = item("Tela Frontal Display Compatível iPhone 11", 150, {
      categoria_no: "carregadores",
    });
    const panela = item("Jogo de Panelas Tramontina", 300, { categoria_no: "panelas" });
    const lista = selecionarComplementos([carregador, fone, tela, panela], semNota, p);
    expect(lista).toEqual([fone, carregador]);
  });

  test("sem categoria favorita, nada", () => {
    expect(selecionarComplementos([item("Fone JBL", 100)], semNota, perfil())).toEqual([]);
  });
});

describe("pensados para você", () => {
  test("nicho de 2º nível e só nota 4,5+ lida com frete grátis", () => {
    const p = perfil({
      produtosInteragidos: [
        {
          chave: "a",
          titulo: "Furadeira de Impacto Bosch 650W",
          categoria: "ferramentas",
          preco: 300,
          foto: null,
          em: 1,
        },
      ],
    });
    const nicho = nichoDoVisitante(p);
    expect(nicho).toBeTruthy();
    expect(NOS[nicho!]!.nivel).toBeLessThanOrEqual(2);
    const boa = item("Parafusadeira Makita 12V", 400);
    const semFrete = item("Parafusadeira Wap 12V", 200, { frete_gratis: false });
    const semLeitura = item("Parafusadeira Vonder 12V", 250);
    const notas = new Map([
      [boa.produto, resumo(4.8, 80)],
      [semFrete.produto, resumo(4.9, 80)],
    ]);
    expect(selecionarPensados([boa, semFrete, semLeitura], (i) => notas.get(i.produto), p)).toEqual(
      [boa],
    );
  });
});

describe("semelhantes", () => {
  const ref = { titulo: "Furadeira de Impacto Bosch GSB 550 650W", preco: 389 };
  test("mesmo tipo, preço igual ou menor, chip com o que é igual", () => {
    const barata = item("Furadeira de Impacto Black+Decker 650W", 351, {
      categoria_no: "furadeiras-e-parafusadeiras",
    });
    const cara = item("Furadeira de Impacto Makita 710W", 520, {
      categoria_no: "furadeiras-e-parafusadeiras",
    });
    const outra = item("Serra Tico-Tico Bosch 650W", 300, { categoria_no: "serras" });
    const igual = item(ref.titulo, 389, { categoria_no: "furadeiras-e-parafusadeiras" });
    const lista = selecionarSemelhantes([cara, outra, igual, barata], semNota, null, ref);
    expect(lista).toEqual([barata]);
    expect(chipDoSemelhante(ref, barata, undefined)).toMatch(/^Mesmo 650W · R\$\s38 a menos$/);
  });
});

describe("sazonal", () => {
  test("combina com a temporada e tem frete grátis", () => {
    const natal = TEMPORADAS.find((t) => t.id === "natal")!;
    const perfume = item("Perfume Malbec Boticário 100ml", 200);
    const semFrete = item("Kit Presente Natura Kaiak", 150, { frete_gratis: false });
    const furadeira = item("Furadeira Bosch 650W", 300);
    const usado = item("Console Playstation 5 Usado", 2500);
    expect(selecionarSazonal([perfume, semFrete, furadeira, usado], semNota, null, natal)).toEqual([
      perfume,
    ]);
    expect(selecionarSazonal([perfume], semNota, null, null)).toEqual([]);
  });
});

describe("seu histórico", () => {
  test("junta comparados e produtos vistos, sem repetir, mais recente primeiro", () => {
    const p = perfil({
      produtosInteragidos: [
        {
          chave: "MLB1",
          titulo: "Air Fryer Mondial 4L",
          categoria: "eletrodomesticos",
          preco: 349,
          foto: null,
          url: "https://www.mercadolivre.com.br/p/MLB1",
          em: 300,
        },
        { chave: "x", titulo: "Sem endereço", categoria: null, preco: 10, foto: null, em: 400 },
      ],
    });
    const comparados = [
      {
        titulo: "Air Fryer Mondial 4L",
        url: "https://x/1",
        imagem: null,
        melhor: 330,
        quando: 100,
      },
      { titulo: "Fone JBL Tune 520", url: "https://x/2", imagem: null, melhor: 199, quando: 200 },
      { titulo: 3 as unknown as string, url: "quebrado" },
    ];
    const h = montarHistorico(comparados, p);
    expect(h.map((x) => x.titulo)).toEqual(["Air Fryer Mondial 4L", "Fone JBL Tune 520"]);
    expect(h[0]!.preco).toBe(349);
    expect(montarHistorico([], null)).toEqual([]);
  });
});
