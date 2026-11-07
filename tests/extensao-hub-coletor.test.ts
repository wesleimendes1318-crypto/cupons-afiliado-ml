import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// hub-leitura.js is a classic content script: run it in a sandbox and take its global.
const ctx: Record<string, unknown> = {};
ctx.globalThis = ctx;
runInNewContext(readFileSync(new URL("../extensao/hub-leitura.js", import.meta.url), "utf8"), ctx);
const L = ctx.meHubLeitura as {
  LOTE: number;
  itemDoLink: (h: string) => string | null;
  lerCartao: (c: { href: string; texto: string; riscado?: string; imagem?: string }) => Record<string, unknown> | null;
  fatiar: <T>(l: T[], t?: number) => T[][];
};

test("MLB id: listing item_id beats catalog id; MLB- listing; junk refused", () => {
  assert.equal(L.itemDoLink("https://www.mercadolivre.com.br/fone/p/MLB123456?pdp_filters=item_id%3AMLB987654321#x"), "MLB987654321");
  assert.equal(L.itemDoLink("https://www.mercadolivre.com.br/fone/p/MLB123456"), "MLB123456");
  assert.equal(L.itemDoLink("https://produto.mercadolivre.com.br/MLB-4455667788-fone-_JM"), "MLB4455667788");
  assert.equal(L.itemDoLink("https://www.mercadolivre.com.br/afiliados/hub"), null);
});

const card = (ganhos: string) => ({
  href: "https://produto.mercadolivre.com.br/MLB-4455667788-fone-_JM",
  texto: ["Selecionar", "MAIS VENDIDO", "Fone de Ouvido Bluetooth QCY T13 ANC", "R$", "299", ",", "90", "R$", "199", ",", "90", "33% OFF",
    "4.8 | +10 mil vendidos", ganhos, "Compartilhar"].join("\n"),
  imagem: "https://http2.mlstatic.com/x.webp",
});

test("card: prices, discount, best seller, rating, sold, canonical URL", () => {
  const i = L.lerCartao(card("GANHOS 12%"))!;
  assert.equal(i.item, "MLB4455667788");
  assert.equal(i.url, "https://produto.mercadolivre.com.br/MLB-4455667788-fone-_JM");
  assert.equal(i.titulo, "Fone de Ouvido Bluetooth QCY T13 ANC");
  assert.equal(i.preco, 199.9);
  assert.equal(i.preco_original, 299.9);
  assert.equal(i.desconto_pct, 33);
  assert.equal(i.mais_vendido, true);
  assert.equal(i.avaliacao, 4.8);
  assert.equal(i.vendidos, "+10 mil vendidos");
});

test("commission: read only into comissao_pct, never into title or other fields", () => {
  for (const [linha, pct] of [["GANHOS 12%", 12], ["Ganhos\n5%", 5], ["Ganhos extras\n7,5%", 7.5]] as const) {
    const i = L.lerCartao(card(linha))!;
    assert.equal(i.comissao_pct, pct);
    const resto = JSON.stringify({ ...i, comissao_pct: undefined });
    assert.doesNotMatch(resto, /ganho/i);
    assert.doesNotMatch(resto, /Selecionar/);
  }
  assert.equal(L.lerCartao(card("Compartilhar"))!.comissao_pct, null);
  assert.equal(L.lerCartao(card("GANHOS 90%"))!.comissao_pct, null); // implausible rate dropped
});

test("non-ML link never becomes the product URL", () => {
  const i = L.lerCartao({ ...card("GANHOS 12%"), href: "https://evil.example/MLB-4455667788" })!;
  assert.equal(i.url, "https://produto.mercadolivre.com.br/MLB-4455667788");
});

test("batches of 100", () => {
  assert.equal(L.LOTE, 100);
  const lotes = L.fatiar(Array.from({ length: 250 }, (_, k) => k));
  assert.equal(JSON.stringify(lotes.map((l) => l.length)), "[100,100,50]"); // other vm realm: compare as JSON
  assert.equal(L.fatiar([]).length, 0);
});
