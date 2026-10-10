import assert from "node:assert/strict";
import test from "node:test";

import { ehCerteza } from "../src/lib/busca-foto";
import { coletarMultiloja, termoDeBuscaExterna } from "../src/lib/coletor-multiloja";
import { publicarNoFacebook, textoSimples } from "../src/lib/facebook";
import { buscarNaAmazon } from "../src/lib/integracoes/amazon";
import { buscarNaShopee } from "../src/lib/integracoes/shopee";

const ENV = [
  "AMAZON_CREATORS_CREDENTIAL_ID",
  "AMAZON_CREATORS_CREDENTIAL_SECRET",
  "AMAZON_CREATORS_VERSION",
  "SHOPEE_AFFILIATE_APP_ID",
  "SHOPEE_AFFILIATE_SECRET",
  "FACEBOOK_PAGE_ID",
  "FACEBOOK_PAGE_ACCESS_TOKEN",
];
function limparEnv() {
  for (const n of ENV) delete process.env[n];
}

test("termo de busca externa sem ruído de venda", () => {
  assert.equal(
    termoDeBuscaExterna("Fone JBL Tune 520BT Original Lacrado Frete Grátis Envio Imediato"),
    "Fone JBL Tune 520BT",
  );
});

test("certeza da foto exige marca e modelo no nome do catálogo", () => {
  const id = {
    produto: "JBL Tune 520BT",
    marca: "JBL",
    modelo: "Tune 520BT",
    categoria: null,
    textoLido: null,
    confianca: 92,
  };
  assert.equal(ehCerteza(id, "Fone de Ouvido JBL Tune 520BT Bluetooth Preto"), true);
  assert.equal(ehCerteza(id, "Fone de Ouvido JBL Tune 510BT"), false);
  assert.equal(ehCerteza({ ...id, confianca: 70 }, "JBL Tune 520BT"), false);
  assert.equal(ehCerteza({ ...id, modelo: null }, "JBL Tune 520BT"), false);
});

test("sem credenciais: coletor devolve vazio sem chamar nada", async () => {
  limparEnv();
  const original = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas += 1;
    return new Response("{}");
  }) as typeof fetch;
  try {
    const r = await coletarMultiloja("Fone JBL Tune 520BT");
    assert.deepEqual([r.amazon, r.shopee, r.erros], [[], [], []]);
    assert.equal(chamadas, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("Amazon: token, busca Prime e link com a tag", async () => {
  limparEnv();
  process.env["AMAZON_CREATORS_CREDENTIAL_ID"] = "id-ficticio";
  process.env["AMAZON_CREATORS_CREDENTIAL_SECRET"] = "segredo-ficticio";
  process.env["AMAZON_CREATORS_VERSION"] = "3.1";
  const original = globalThis.fetch;
  const vistos: Array<{ url: string; headers: Headers; corpo: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    vistos.push({ url, headers: new Headers(init?.headers), corpo: String(init?.body ?? "") });
    if (url.includes("auth/o2/token"))
      return Response.json({ access_token: "tk", expires_in: 3600 });
    return Response.json({
      searchResult: {
        items: [
          {
            asin: "B0ABCDEFGH",
            detailPageURL: "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
            itemInfo: { title: { displayValue: "Fone JBL Tune 520BT" } },
            images: { primary: { large: { url: "https://m.media-amazon.com/images/I/x.jpg" } } },
            offersV2: {
              listings: [
                {
                  price: { money: { amount: 249.9 } },
                  condition: { value: "New" },
                  merchantInfo: { name: "Amazon.com.br" },
                  isBuyBoxWinner: true,
                },
              ],
            },
          },
          {
            asin: "B0USADO000",
            itemInfo: { title: { displayValue: "Usado" } },
            offersV2: {
              listings: [{ price: { money: { amount: 10 } }, condition: { value: "Used" } }],
            },
          },
        ],
      },
    });
  }) as typeof fetch;
  try {
    const r = await buscarNaAmazon("Fone JBL Tune 520BT", 5_000);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.link, "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20");
    assert.deepEqual(r[0]!.selos, ["Prime"]);
    assert.equal(r[0]!.freteGratis, null);
    const busca = vistos.find((v) => v.url.endsWith("/catalog/v1/searchItems"))!;
    assert.equal(busca.headers.get("x-marketplace"), "www.amazon.com.br");
    assert.equal(busca.headers.get("authorization"), "Bearer tk");
    const corpo = JSON.parse(busca.corpo);
    assert.equal(corpo.partnerTag, "melhoresc0fff-20");
    assert.deepEqual(corpo.deliveryFlags, ["Prime"]);
  } finally {
    globalThis.fetch = original;
    limparEnv();
  }
});

test("Shopee: assinatura no cabeçalho, sem pedir comissão, só link de afiliado", async () => {
  limparEnv();
  process.env["SHOPEE_AFFILIATE_APP_ID"] = "123456";
  process.env["SHOPEE_AFFILIATE_SECRET"] = "segredo";
  const original = globalThis.fetch;
  let cabecalho = "";
  let corpo = "";
  globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
    cabecalho = new Headers(init?.headers).get("authorization") ?? "";
    corpo = String(init?.body ?? "");
    return Response.json({
      data: {
        productOfferV2: {
          nodes: [
            {
              itemId: 1,
              productName: "Fone JBL",
              priceMin: "199.90",
              imageUrl: "https://down-br.img.susercontent.com/file/a",
              offerLink: "https://s.shopee.com.br/AbC123",
              productLink: "https://shopee.com.br/x-i.1.1",
              shopName: "Loja X",
            },
            {
              itemId: 2,
              productName: "Sem link",
              priceMin: "100",
              offerLink: "https://exemplo.com/x",
            },
          ],
        },
      },
    });
  }) as typeof fetch;
  try {
    const r = await buscarNaShopee("Fone JBL", 5_000);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.link, "https://s.shopee.com.br/AbC123");
    assert.match(cabecalho, /^SHA256 Credential=123456, Timestamp=\d+, Signature=[0-9a-f]{64}$/);
    assert.doesNotMatch(corpo, /commission/i);
  } finally {
    globalThis.fetch = original;
    limparEnv();
  }
});

test("coletor: Shopee fora do ar não derruba a Amazon", async () => {
  limparEnv();
  process.env["AMAZON_CREATORS_CREDENTIAL_ID"] = "id";
  process.env["AMAZON_CREATORS_CREDENTIAL_SECRET"] = "s";
  process.env["SHOPEE_AFFILIATE_APP_ID"] = "1";
  process.env["SHOPEE_AFFILIATE_SECRET"] = "s";
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("shopee")) throw new Error("rede");
    if (url.includes("token")) return Response.json({ access_token: "tk", expires_in: 3600 });
    return Response.json({ searchResult: { items: [] } });
  }) as typeof fetch;
  try {
    const r = await coletarMultiloja("Fone JBL", 3_000);
    assert.deepEqual(r.amazon, []);
    assert.equal(r.shopee.length, 0);
    assert.equal(r.erros.length, 1);
    assert.match(r.erros[0]!, /^shopee/);
  } finally {
    globalThis.fetch = original;
    limparEnv();
  }
});

test("Facebook: legenda em texto simples e token fora da URL", async () => {
  assert.equal(
    textoSimples("🔥 <b>Fone</b>\n🏷️ Anúncio: <s>R$ 10,00</s> &amp; mais"),
    "🔥 Fone\n🏷️ Anúncio: R$ 10,00 & mais",
  );
  limparEnv();
  const semConfig = await publicarNoFacebook("https://x/y.jpg", "oi");
  assert.equal(semConfig.ok, false);
  process.env["FACEBOOK_PAGE_ID"] = "1234567890";
  process.env["FACEBOOK_PAGE_ACCESS_TOKEN"] = "token-secreto";
  const original = globalThis.fetch;
  let url = "";
  let corpo = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input);
    corpo = String(init?.body ?? "");
    return Response.json({ id: "9", post_id: "1234567890_9" });
  }) as typeof fetch;
  try {
    const r = await publicarNoFacebook("https://http2.mlstatic.com/a-O.jpg", "Legenda");
    assert.deepEqual(r, { ok: true, postId: "1234567890_9" });
    assert.match(url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d\/1234567890\/photos$/);
    assert.doesNotMatch(url, /token/);
    assert.match(corpo, /access_token=token-secreto/);
    assert.match(corpo, /caption=Legenda/);
  } finally {
    globalThis.fetch = original;
    limparEnv();
  }
});

test("multiloja: a tela só recebe link de afiliado, foto conhecida e selo Prime", async () => {
  const { limparResultado } = await import("../src/lib/multiloja-resultado");
  const base = {
    titulo: "JBL Tune 520BT",
    preco: 249.9,
    loja: null,
    freteGratis: null,
    custoFrete: null,
    notaFrete: null,
    muda: null,
    semelhanca: null,
    qualidade: null,
  };
  const r = limparResultado({
    ativo: true,
    lojas: [
      {
        ...base,
        marketplace: "amazon",
        id: "B0ABCDEF12",
        relacao: "mesmo",
        selos: ["Prime", "<b>x</b>"],
        link: "https://www.amazon.com.br/dp/B0ABCDEF12?tag=melhoresc0fff-20",
        imagem: "https://m.media-amazon.com/images/I/61x.jpg",
      },
      {
        ...base,
        marketplace: "amazon",
        id: "B0OUTRATAG",
        relacao: "mesmo",
        selos: [],
        link: "https://www.amazon.com.br/dp/B0OUTRATAG?tag=outra-20",
        imagem: null,
      },
      {
        ...base,
        marketplace: "shopee",
        id: "1",
        relacao: "parecido",
        selos: [],
        link: "https://s.shopee.com.br/AbC1",
        imagem: "https://evil.example/x.jpg",
      },
      {
        ...base,
        marketplace: "shopee",
        id: "2",
        relacao: "talvez",
        selos: [],
        link: "https://s.shopee.com.br/AbC2",
        imagem: null,
      },
    ],
  });
  assert.deepEqual(
    r.lojas.map((l) => l.id),
    ["B0ABCDEF12", "1"],
  );
  assert.deepEqual(r.lojas[0]!.selos, ["Prime"]);
  assert.equal(r.lojas[1]!.imagem, null);
});

test("multiloja: usado e falso nunca chegam à tela; resumo só com números", async () => {
  const { limparResultado } = await import("../src/lib/multiloja-resultado");
  const base = {
    marketplace: "amazon",
    preco: 199.9,
    loja: null,
    freteGratis: null,
    custoFrete: null,
    notaFrete: null,
    muda: null,
    semelhanca: null,
    qualidade: null,
    selos: [],
    imagem: null,
    relacao: "mesmo",
  };
  const r = limparResultado({
    ativo: true,
    lojas: [
      {
        ...base,
        id: "B0AAAAAAA1",
        titulo: "Fone JBL Tune 520BT Recondicionado",
        link: "https://www.amazon.com.br/dp/B0AAAAAAA1?tag=melhoresc0fff-20",
      },
      {
        ...base,
        id: "B0AAAAAAA2",
        titulo: "Fone Bluetooth Réplica Primeira Linha",
        link: "https://www.amazon.com.br/dp/B0AAAAAAA2?tag=melhoresc0fff-20",
      },
      {
        ...base,
        id: "B0AAAAAAA3",
        titulo: "Fone JBL Tune 520BT Preto",
        link: "https://www.amazon.com.br/dp/B0AAAAAAA3?tag=melhoresc0fff-20",
        desvantagens: ["Sem cabo", 3],
      },
    ],
    resumo: {
      amazon: { lidas: 39, conferidas: 4, motivo: null },
      shopee: "x",
      outra: { lidas: 1 },
    },
    incompleto: true,
  });
  assert.deepEqual(
    r.lojas.map((l) => l.id),
    ["B0AAAAAAA3"],
  );
  assert.deepEqual(r.lojas[0]!.desvantagens, ["Sem cabo"]);
  assert.deepEqual(r.resumo, { amazon: { lidas: 39, conferidas: 4, motivo: null } });
  assert.equal(r.incompleto, true);
});

test("servidor: mesma escolha de candidatos da extensão (até 4, sem usado)", async () => {
  const { escolherCandidatos } = await import("../src/lib/coletor-multiloja");
  const original = { titulo: "Fone de Ouvido JBL Tune 520BT Bluetooth Preto", preco: 299.9 };
  const e = escolherCandidatos(
    [
      { titulo: "Fone de Ouvido JBL Tune 520BT Bluetooth Preto", preco: 289.9 },
      { titulo: "Fone de Ouvido JBL Tune 520BT Bluetooth Preto Original", preco: 279.9 },
      { titulo: "JBL Tune 520BT Fone de Ouvido Bluetooth Preto", preco: 269.9 },
      { titulo: "Fone JBL Tune 520BT Bluetooth Preto Usado", preco: 99.9 },
      { titulo: "Fone JBL Tune 520BT Azul", preco: 239.9 },
      { titulo: "JBL Tune 520BT", preco: 199.9 },
    ],
    original,
  );
  assert.equal(e.length, 4);
  assert.ok(e.some((o) => o.preco === 199.9));
  assert.ok(!e.some((o) => /usado/i.test(o.titulo)));
});

test("comparação final: só disputa o mais barato quem tem custo confirmado", async () => {
  const m = await import("../src/lib/comparacao-marketplaces");
  const ml = {
    jogador: "mercadolivre" as const,
    titulo: "Fone",
    loja: "Loja A",
    preco: 249.9,
    freteGratis: true,
    custoFrete: null,
    notaFrete: null,
    prime: false,
    oficial: false,
    link: "https://meli.la/1AbCdEf",
  };
  const lojaAmazon = {
    marketplace: "amazon" as const,
    id: "B0ABCDEFGH",
    titulo: "Fone",
    preco: 199.9,
    link: "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
    imagem: null,
    loja: null,
    freteGratis: null,
    custoFrete: null,
    notaFrete: "Frete grátis para assinantes Prime",
    selos: ["Prime"],
    relacao: "mesmo" as const,
    muda: null,
    semelhanca: 95,
    qualidade: null,
  };
  const parecidoMaisBarato = {
    ...lojaAmazon,
    id: "B0PARECIDO",
    preco: 99.9,
    relacao: "parecido" as const,
  };
  const amazon = m.melhorDoMarketplace([parecidoMaisBarato, lojaAmazon], "amazon");
  /* parecido nunca é a melhor oferta do mesmo produto */
  assert.equal(amazon?.preco, 199.9);
  assert.equal(m.totalConfirmado(amazon!), null);
  assert.equal(amazon?.prime, true);

  /* Prime não confirma o custo: o Mercado Livre continua o mais barato e a
     Amazon aparece como menor preço no produto. */
  const d = m.decidirEntreMarketplaces([ml, amazon, null]);
  assert.equal(d.vencedor?.jogador, "mercadolivre");
  assert.equal(d.menorNoProduto?.jogador, "amazon");
  assert.deepEqual(
    d.ofertas.map((o) => o.jogador),
    ["mercadolivre", "amazon"],
  );

  /* Com frete grátis confirmado, a Amazon disputa e ganha. */
  const amazonGratis = m.ofertaExterna({ ...lojaAmazon, freteGratis: true });
  const d2 = m.decidirEntreMarketplaces([ml, amazonGratis]);
  assert.equal(d2.vencedor?.jogador, "amazon");
  assert.equal(d2.menorNoProduto, null);

  /* Empate (menos de R$ 0,50): Mercado Livre primeiro. */
  const d3 = m.decidirEntreMarketplaces([{ ...amazonGratis, preco: 249.6 }, ml]);
  assert.equal(d3.vencedor?.jogador, "mercadolivre");

  /* Link de outro programa não vira botão. */
  assert.equal(
    m.ofertaExterna({ ...lojaAmazon, link: "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=outra-20" })
      .link,
    null,
  );
});

test("comparação final: diferença contra o colado e frete em linha própria", async () => {
  const m = await import("../src/lib/comparacao-marketplaces");
  /* toLocaleString usa espaço sem quebra depois do "R$". */
  const dif = (...a: Parameters<typeof m.diferencaContraColado>) =>
    m.diferencaContraColado(...a)?.replace(/\u00a0/g, " ") ?? null;
  const colado = { preco: 300, totalConfirmado: 300 };
  assert.equal(
    dif({ preco: 250, freteGratis: true, custoFrete: null }, colado),
    "R$ 50,00 a menos no custo final, já com o frete",
  );
  assert.equal(
    dif({ preco: 250, freteGratis: null, custoFrete: null }, colado),
    "R$ 50,00 a menos no produto",
  );
  assert.equal(
    dif({ preco: 280, freteGratis: false, custoFrete: 30 }, colado),
    "R$ 10,00 a mais no custo final, já com o frete",
  );
  assert.equal(
    dif({ preco: 250, freteGratis: true, custoFrete: null }, { preco: 300, totalConfirmado: null }),
    "R$ 50,00 a menos no produto",
  );
  assert.equal(
    dif({ preco: 300, freteGratis: null, custoFrete: null, ehColado: true }, colado),
    "É o anúncio que você colou",
  );
  for (const t of [
    m.linhaDoFrete({ freteGratis: true, custoFrete: null, notaFrete: null }),
    m.linhaDoFrete({ freteGratis: false, custoFrete: 19.9, notaFrete: null }),
    m.linhaDoFrete({
      freteGratis: null,
      custoFrete: null,
      notaFrete: "Frete grátis para assinantes Prime",
    }),
    m.linhaDoFrete({ freteGratis: null, custoFrete: null, notaFrete: null }),
  ])
    assert.ok(t.startsWith("Frete"), t);
  /* Nenhuma diferença junta valor em reais com "frete" fora da frase
     padrão do site ("já com o frete"). */
  assert.ok(
    !/R\$ [\d.,]+ (?:de )?frete|\+ ?frete/i.test(
      dif({ preco: 280, freteGratis: false, custoFrete: 30 }, colado) ?? "",
    ),
  );
});

test("o que muda é cortado no último item completo", async () => {
  const { cortarNoItem } = await import("../src/lib/conferir-produto");
  const muda =
    "Marca: Logitech -> não informada; Cor: Grafite/Preto -> Azul/Branco; Conectividade: 2.4GHz -> Bluetooth + USB 2.4GHz; Alimentação: Pilha -> Bateria recarregável";
  const r = cortarNoItem(muda, 140);
  assert.equal(
    r,
    "Marca: Logitech -> não informada; Cor: Grafite/Preto -> Azul/Branco; Conectividade: 2.4GHz -> Bluetooth + USB 2.4GHz",
  );
  assert.ok(!/->\s*$/.test(r));
  assert.equal(cortarNoItem("Cor: preto -> azul", 140), "Cor: preto -> azul");
  assert.equal(cortarNoItem("x".repeat(200), 10), "xxxxxxxxx…");
});

test("item cortado no meio do que muda não aparece na tela", async () => {
  const { limparResultado } = await import("../src/lib/multiloja-resultado");
  const r = limparResultado({
    ativo: true,
    lojas: [
      {
        marketplace: "amazon",
        id: "B0GQ8ZWP2L",
        titulo: "Kit Teclado e Mouse Sem Fio",
        preco: 53.19,
        link: "https://www.amazon.com.br/dp/B0GQ8ZWP2L?tag=melhoresc0fff-20",
        imagem: null,
        loja: null,
        freteGratis: null,
        custoFrete: null,
        notaFrete: null,
        selos: [],
        relacao: "parecido",
        muda: "Marca: Logitech -> não informada; Cor: Grafite -> Azul; Alimentação: Pilha -> ",
        semelhanca: 20,
        qualidade: "incerta",
      },
    ],
  });
  assert.equal(r.lojas[0]!.muda, "Marca: Logitech -> não informada; Cor: Grafite -> Azul");
});

test("comparação: frete a confirmar no Mercado Livre também não disputa a Melhor escolha", async () => {
  const m = await import("../src/lib/comparacao-marketplaces");
  const base = {
    titulo: "Fone",
    loja: "Loja",
    notaFrete: null,
    prime: false,
    oficial: false,
    link: null,
  };
  const ml = {
    ...base,
    jogador: "mercadolivre" as const,
    preco: 100,
    freteGratis: null,
    custoFrete: null,
  };
  const shopee = {
    ...base,
    jogador: "shopee" as const,
    preco: 120,
    freteGratis: false,
    custoFrete: 9.9,
  };
  const d = m.decidirEntreMarketplaces([ml, shopee]);
  /* a Shopee tem o custo confirmado (R$ 129,90); o Mercado Livre não */
  assert.equal(d.vencedor?.jogador, "shopee");
  assert.equal(d.menorNoProduto?.jogador, "mercadolivre");
  assert.equal(m.totalConfirmado(shopee), 129.9);
  /* ninguém confirmado: sem vencedor, o menor no produto aparece */
  const d2 = m.decidirEntreMarketplaces([ml, { ...shopee, custoFrete: null, freteGratis: null }]);
  assert.equal(d2.vencedor, null);
  assert.equal(d2.menorNoProduto?.jogador, "mercadolivre");
});

test("comparação: célula do frete, o que muda, marca, rótulo e qualidade", async () => {
  const m = await import("../src/lib/comparacao-marketplaces");
  const sp = (t: string) => t.replace(/\u00a0/g, " ");
  assert.equal(
    m.celulaDoFrete({ freteGratis: true, custoFrete: null, notaFrete: null, prime: false }),
    "Grátis",
  );
  assert.equal(
    sp(m.celulaDoFrete({ freteGratis: false, custoFrete: 12.9, notaFrete: null, prime: false })),
    "R$ 12,90",
  );
  assert.equal(
    m.celulaDoFrete({
      freteGratis: null,
      custoFrete: null,
      notaFrete: "Frete grátis para assinantes Prime",
      prime: false,
    }),
    "Grátis só para assinantes Prime",
  );
  assert.equal(
    m.celulaDoFrete({ freteGratis: null, custoFrete: null, notaFrete: null, prime: false }),
    "A confirmar",
  );
  assert.equal(
    m.linhaDoFrete({ freteGratis: null, custoFrete: null, notaFrete: "Frete: confira no anúncio" }),
    "Frete a confirmar",
  );

  const muda =
    "Marca: Logitech -> não informada; Cor: Grafite/Preto -> Azul/Branco; Alimentação: Pilha -> ";
  assert.deepEqual(m.itensDoQueMuda(muda), [
    { campo: "Marca", seu: "Logitech", este: "não informada" },
    { campo: "Cor", seu: "Grafite/Preto", este: "Azul/Branco" },
  ]);
  assert.equal(m.marcaDoParecido(muda), null);
  assert.equal(
    m.marcaDoParecido("Marca: Logitech -> Multilaser; Cor: Preto -> Azul"),
    "Multilaser",
  );
  assert.equal(m.marcaDoParecido("Cor: Preto -> Azul"), null);
  assert.deepEqual(m.detalhesDoParecido(muda), ["Azul/Branco"]);
  assert.deepEqual(m.comparacaoDoParecido(muda), [
    "Marca: o seu Logitech → este não informada",
    "Cor: o seu Grafite/Preto → este Azul/Branco",
  ]);
  assert.deepEqual(m.detalhesDoParecido("Não confirmado: cor"), ["Não confirmado: cor"]);

  assert.equal(m.rotuloDaRelacao({ semelhanca: 75 }), "Parecido");
  assert.equal(m.rotuloDaRelacao({ semelhanca: 20 }), "Produto diferente");
  assert.equal(m.rotuloDaRelacao({ semelhanca: 20, mesmaFoto: true }), "Parecido");
  assert.equal(m.qualidadeDoCartao("superior").texto, "Qualidade superior à do seu");
  assert.equal(m.qualidadeDoCartao("inferior").nivel, "inferior");
  assert.equal(m.qualidadeDoCartao(null).texto, "Qualidade não confirmada");
});
