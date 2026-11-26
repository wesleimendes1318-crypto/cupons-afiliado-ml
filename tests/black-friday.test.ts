import assert from "node:assert/strict";
import test from "node:test";

import { categoriaBlackFriday, ofertasBlackFriday } from "../src/lib/black-friday";
import { menorDos30Dias, selosDoCartao } from "../src/lib/selos-cartao";
import type { Oferta } from "../src/lib/ofertas-vitrine";

const oferta = (o: Partial<Oferta>): Oferta => ({
  chave: "k",
  titulo: "Produto",
  imagem: null,
  preco: 100,
  antes: 100,
  economia: 0,
  loja: null,
  link: "https://meli.la/abc",
  tipo: "mesmo",
  urlProduto: null,
  recente: true,
  freteGratis: true,
  ...o,
});

test("categories by title, accessories out", () => {
  assert.equal(categoriaBlackFriday("Console PlayStation 5 Slim Digital"), "games");
  assert.equal(categoriaBlackFriday("Apple iPhone 16 128GB"), "celulares");
  assert.equal(categoriaBlackFriday("Capa para iPhone 16"), null);
  assert.equal(categoriaBlackFriday("Smart Tv 43 Aoc Led Roku Full Hd"), "tvs");
  assert.equal(categoriaBlackFriday("Air Fryer Mondial 5L"), "eletrodomesticos");
  assert.equal(categoriaBlackFriday("Notebook Lenovo IdeaPad 3"), "informatica");
  assert.equal(categoriaBlackFriday("Perfume 100ml"), null);
});

test("pool: free shipping confirmed, no repeats, biggest % first", () => {
  const lista = ofertasBlackFriday([
    [
      oferta({ chave: "a", titulo: "A", preco: 90, antes: 100, economia: 10 }),
      oferta({ chave: "b", titulo: "B", preco: 50, antes: 100, economia: 50 }),
      oferta({ chave: "c", titulo: "C", preco: 10, antes: 100, economia: 90, freteGratis: undefined }),
    ],
    [oferta({ chave: "b", titulo: "B2", preco: 1, antes: 100, economia: 99 })],
  ]);
  assert.deepEqual(
    lista.map((o) => o.chave),
    ["b", "a"],
  );
});

const DIA = 86_400_000;
const agora = Date.parse("2026-11-26T12:00:00Z");
const hist = (mn: number, mx: number, n: number, dias: number) => ({
  chave: "k",
  melhor_oficial: null,
  melhor_lider: null,
  alt_oficial: null,
  alt_lider: null,
  colado_oficial: null,
  colado_lider: null,
  minimo_30d: String(mn),
  maximo_30d: String(mx),
  leituras_30d: n,
  desde_30d: new Date(agora - dias * DIA).toISOString(),
});

test("30-day low needs real history and a real drop", () => {
  assert.equal(menorDos30Dias(100, hist(100, 130, 4, 25), agora), true);
  assert.equal(menorDos30Dias(100, hist(100, 130, 2, 25), agora), false); // few readings
  assert.equal(menorDos30Dias(100, hist(100, 130, 4, 10), agora), false); // short window
  assert.equal(menorDos30Dias(100, hist(100, 102, 4, 25), agora), false); // flat price
  assert.equal(menorDos30Dias(110, hist(100, 130, 4, 25), agora), false); // not the low
  assert.equal(menorDos30Dias(100, undefined, agora), false);
});

test("seller badge only from known seals", () => {
  assert.equal(selosDoCartao(oferta({ lojaOficial: true }), undefined).vendedor, "Loja oficial");
  assert.equal(
    selosDoCartao(oferta({ lojaOficial: false, mercadoLider: "platinum" }), undefined).vendedor,
    "MercadoLíder Platinum",
  );
  assert.equal(
    selosDoCartao(oferta({ lojaOficial: false, mercadoLider: "silver" }), undefined).vendedor,
    null,
  );
  assert.equal(
    selosDoCartao(oferta({ tipo: "menor" }), { ...hist(1, 1, 0, 0), colado_oficial: true })
      .vendedor,
    "Loja oficial",
  );
  assert.equal(selosDoCartao(oferta({}), undefined).vendedor, null);
});

test("extra rows: devices only, real price, buy path, honest type", async () => {
  const { ofertaExtraBlackFriday } = await import("../src/lib/black-friday");
  const base = {
    chave: "MLB1",
    imagem: null,
    loja: null,
    visto_em: new Date().toISOString(),
    loja_oficial: true,
  };
  const cat = ofertaExtraBlackFriday({
    ...base,
    titulo: "Smart TV 50 4K Samsung",
    tipo: "menor",
    preco: "2299",
    antes: "2299",
    economia: "0",
    link: null,
    url_produto: "https://www.mercadolivre.com.br/p/MLB1?pdp_filters=item_id%3AMLB2",
    fonte: "catalogo",
  });
  assert.equal(cat?.tipo, "menor");
  assert.equal(cat?.antes, 2299); // "Preço conferido", no discount claim
  assert.equal(cat?.lojaOficial, true);
  assert.equal(cat?.freteGratis, true);
  const linha = (o: object) =>
    ofertaExtraBlackFriday({
      ...base,
      tipo: "menor",
      preco: "100",
      antes: "100",
      economia: "0",
      link: "https://meli.la/x",
      url_produto: null,
      fonte: "comparado",
      titulo: "Air Fryer Mondial 5L",
      ...o,
    } as never);
  assert.equal(linha({ titulo: "Capa para iPhone 16" }), null);
  assert.equal(linha({ titulo: "Air Fryer Mondial 5L usada" }), null);
  assert.equal(linha({ preco: null }), null);
  assert.equal(linha({ link: "https://www.mercadolivre.com.br/x" }), null); // bare URL, no affiliate
  assert.equal(linha({})?.lojaOficial, undefined); // compared rows: seals from selos_da_vitrine
  const mesmo = linha({ tipo: "mesmo", preco: "246.32", antes: "282.30", economia: "35.98" });
  assert.equal(mesmo?.tipo, "mesmo");
  assert.equal(mesmo?.economia, 35.98);
});

test("pool dedupes the same product title across sources", () => {
  const lista = ofertasBlackFriday([
    [oferta({ chave: "a", titulo: "Smart Tv 43 AOC" })],
    [
      oferta({
        chave: "MLB9",
        titulo: "smart tv 43  aoc",
        link: null,
        urlProduto: "https://www.mercadolivre.com.br/p/MLB9",
      }),
    ],
  ]);
  assert.equal(lista.length, 1);
});

test("every offer in the Black Friday pool carries the seal", () => {
  const [o] = ofertasBlackFriday([[oferta({ chave: "s", titulo: "Selo" })]]);
  assert.equal(o?.selo, "Black Friday");
});
