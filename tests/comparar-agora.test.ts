import { test } from "node:test";
import assert from "node:assert/strict";

import { compararAgora } from "../src/lib/comparar-agora";

/* Comparação pelo servidor sem a extensão (19/10): a lista oficial da ficha,
   com respostas da API no formato real (/products/{id} e /items). */
const FICHA = {
  name: "Ar Condicionado LG Inverter 12.000 Btus Frio",
  pictures: [{ secure_url: "https://http2.mlstatic.com/D_NQ_NP_123-O.jpg" }],
  buy_box_winner: { item_id: "MLB7811771900" },
};
const OFERTAS = {
  results: [
    {
      item_id: "MLB7811771900",
      price: 2549,
      seller_id: 1,
      condition: "new",
      official_store_id: 99,
      shipping: { free_shipping: true, cost: 0 },
    },
    {
      item_id: "MLB6199360994",
      price: 2250,
      seller_id: 2,
      condition: "new",
      shipping: { free_shipping: false, cost: 143.97 },
    },
    {
      item_id: "MLB6199322700",
      price: 2200,
      seller_id: 2,
      condition: "new",
      shipping: { free_shipping: true },
    },
    {
      item_id: "MLB5000000001",
      price: 1500,
      seller_id: 3,
      condition: "used",
      shipping: { free_shipping: true },
    },
    {
      item_id: "MLB5000000002",
      price: 2549,
      seller_id: 1,
      condition: "new",
      shipping: { free_shipping: true },
    },
  ],
};

function comApiFalsa<T>(fn: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = String(entrada);
    if (/\/products\/MLB27727511\/items/.test(u)) return Response.json(OFERTAS);
    if (/\/products\/MLB27727511/.test(u)) return Response.json(FICHA);
    if (/\/users\/\d+/.test(u)) return Response.json({ nickname: "LOJA" });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test("link de catálogo sem anúncio: a oferta em destaque é a referência e as lojas vêm da lista", async () => {
  const r = await comApiFalsa(() =>
    compararAgora("https://www.mercadolivre.com.br/ar-condicionado-lg/p/MLB27727511"),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const a = r.analise as {
    preco: number;
    lojaOficial: boolean;
    modoServidor: boolean;
    referencias: { preco: number; url: string; freteGratis: boolean | null }[];
  };
  assert.equal(a.preco, 2549);
  assert.equal(a.lojaOficial, true);
  assert.equal(a.modoServidor, true);
  /* Usado fica fora; a mesma loja do colado sem preço menor fica fora; uma
     linha por loja (a mais barata dela). */
  assert.deepEqual(
    a.referencias.map((x) => x.preco),
    [2200],
  );
  assert.match(a.referencias[0]!.url, /pdp_filters=item_id%3AMLB6199322700/);
  assert.equal(a.referencias[0]!.freteGratis, true);
  /* Sem link já gerado, nenhum link é inventado: o botão gera no clique. */
  assert.equal(r.link, null);
});

test("ficha sem oferta em destaque: a mais barata da lista é a referência", async () => {
  const original = FICHA.buy_box_winner;
  (FICHA as { buy_box_winner: unknown }).buy_box_winner = null;
  try {
    const r = await comApiFalsa(() =>
      compararAgora("https://www.mercadolivre.com.br/ar-condicionado-lg/p/MLB27727511"),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const a = r.analise as { preco: number; urlDaOferta: string; referencias: unknown[] };
    assert.equal(a.preco, 2200);
    assert.match(a.urlDaOferta, /item_id%3AMLB6199322700/);
    /* A loja 2 só tem outro anúncio mais caro: fica de fora; a loja 1 entra. */
    assert.equal(a.referencias.length, 1);
  } finally {
    (FICHA as { buy_box_winner: unknown }).buy_box_winner = original;
  }
});

test("anúncio do link fora da lista: não afirma preço, busca pelo nome", async () => {
  const r = await comApiFalsa(() =>
    compararAgora(
      "https://www.mercadolivre.com.br/ar/p/MLB27727511?pdp_filters=item_id%3AMLB9999999999",
    ),
  );
  assert.deepEqual(r, { ok: false, termo: FICHA.name, perfil: false });
});

test("link sem ficha de catálogo: devolve o nome do endereço para a busca", async () => {
  const r = await compararAgora(
    "https://produto.mercadolivre.com.br/MLB-4739054961-capinha-silicone-iphone-15-_JM",
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.termo ?? "", /capinha silicone iphone 15/i);
});
