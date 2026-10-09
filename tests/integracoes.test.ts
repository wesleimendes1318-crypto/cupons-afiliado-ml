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
