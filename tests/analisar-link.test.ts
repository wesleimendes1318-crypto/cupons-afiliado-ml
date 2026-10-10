import { test } from "node:test";
import assert from "node:assert/strict";

import { analisarLink, limparSlug, nomeParaTela } from "../src/lib/analisar-link";

test("1. meli.la é Mercado Livre (encurtado)", () => {
  const a = analisarLink("https://meli.la/2XyZ123");
  assert.equal(a.origem, "mercadolivre");
  assert.equal(a.urlLimpa, "https://meli.la/2XyZ123");
  assert.equal(a.encurtado, true);
});

test("2. anúncio do Mercado Livre: tira o rastreio e lê o MLB", () => {
  const a = analisarLink(
    "https://produto.mercadolivre.com.br/MLB-123456789-tenis-corrida?matt_tool=123",
  );
  assert.equal(a.origem, "mercadolivre");
  assert.equal(a.urlLimpa, "https://produto.mercadolivre.com.br/MLB-123456789-tenis-corrida");
  assert.equal(a.identificador, "MLB123456789");
  assert.equal(a.termoIdentificado, "tenis corrida");
});

test("2b. ficha de catálogo mantém só a oferta escolhida", () => {
  const a = analisarLink(
    "https://www.mercadolivre.com.br/echo-dot-5-geracao/p/MLB19837468?pdp_filters=item_id:MLB123&tracking_id=x#wid=1",
  );
  assert.equal(a.origem, "mercadolivre");
  assert.equal(
    a.urlLimpa,
    "https://www.mercadolivre.com.br/echo-dot-5-geracao/p/MLB19837468?pdp_filters=item_id%3AMLB123",
  );
  assert.equal(a.identificador, "MLB19837468");
  assert.equal(a.termoIdentificado, "echo dot 5 geracao");
});

test("3. Amazon: ASIN do /dp/ e encurtado amzn.to", () => {
  const a = analisarLink("https://www.amazon.com.br/dp/B08N5WRWNW");
  assert.equal(a.origem, "amazon");
  assert.equal(a.identificador, "B08N5WRWNW");
  assert.equal(a.urlLimpa, "https://www.amazon.com.br/dp/B08N5WRWNW");

  const curto = analisarLink("https://amzn.to/3xyz");
  assert.equal(curto.origem, "amazon");
  assert.equal(curto.encurtado, true);
  assert.equal(curto.urlLimpa, "https://amzn.to/3xyz");
});

test("3b. Amazon com nome no endereço e rastreio", () => {
  const a = analisarLink(
    "https://www.amazon.com.br/Echo-Dot-5%C2%AA-gera%C3%A7%C3%A3o-Cor-Preta/dp/B09B8V1LZ3/ref=sr_1_1?crid=ABC&tag=outro-20",
  );
  assert.equal(a.origem, "amazon");
  assert.equal(a.identificador, "B09B8V1LZ3");
  assert.equal(a.urlLimpa, "https://www.amazon.com.br/dp/B09B8V1LZ3");
  assert.equal(a.termoIdentificado, "Echo Dot 5ª geração Cor Preta");
});

test("3c. compartilhado pelo app: o nome vem do texto em volta", () => {
  const a = analisarLink("Confira este produto: Echo Dot 5ª geração https://a.co/d/abc123");
  assert.equal(a.origem, "amazon");
  assert.equal(a.encurtado, true);
  assert.equal(a.termoIdentificado, "Echo Dot 5ª geração");
});

test("3d. frase de compartilhar sem o nome não vira termo", () => {
  const a = analisarLink("Confira este produto que encontrei na Amazon! https://a.co/d/abc123");
  assert.equal(a.origem, "amazon");
  assert.equal(a.termoIdentificado, undefined);
  const b = analisarLink("Olha que legal: Fone JBL Tune 520BT por R$ 199,90 https://shope.ee/abc");
  assert.equal(b.origem, "shopee");
  assert.equal(b.termoIdentificado, "Fone JBL Tune 520BT");
});

test("4. Shopee: nome do slug, sem o código da loja e do item", () => {
  const a = analisarLink(
    "https://shopee.com.br/Ventilador-de-Teto-Silencioso-120w-Bivolt-3-h%C3%A9lices-Retratil-i.1299327674.58262359246",
  );
  assert.equal(a.origem, "shopee");
  assert.equal(a.termoIdentificado, "Ventilador de Teto Silencioso 120w Bivolt 3 hélices Retratil");
  assert.equal(a.identificador, "1299327674.58262359246");
});

test("5. Magalu (loja sem afiliado): outro_player com o nome do produto", () => {
  const a = analisarLink(
    "https://www.magazineluiza.com.br/fritadeira-eletrica-sem-oleo-air-fryer-4l/p/2345678/ep/frap/",
  );
  assert.equal(a.origem, "outro_player");
  assert.equal(a.termoIdentificado, "fritadeira eletrica sem oleo air fryer 4l");
  assert.equal(a.identificador, "2345678");
  assert.equal(a.nomeLoja, "Magalu");
});

test("5b. outras lojas: KaBuM!, Shein, Americanas e endereço sem https", () => {
  const k = analisarLink(
    "https://www.kabum.com.br/produto/123456/mouse-gamer-logitech-g203-lightsync-rgb",
  );
  assert.equal(k.origem, "outro_player");
  assert.equal(k.nomeLoja, "KaBuM!");
  assert.equal(k.termoIdentificado, "mouse gamer logitech g203 lightsync rgb");
  assert.equal(k.identificador, "123456");

  const s = analisarLink("https://br.shein.com/Vestido-Midi-Floral-p-12345678-cat-1727.html");
  assert.equal(s.nomeLoja, "Shein");
  assert.equal(s.termoIdentificado, "Vestido Midi Floral");

  const am = analisarLink("www.americanas.com.br/produto/987654321/cafeteira-expresso-15-bar");
  assert.equal(am.origem, "outro_player");
  assert.equal(am.nomeLoja, "Americanas");
  assert.equal(am.termoIdentificado, "cafeteira expresso 15 bar");
});

test("5c. loja sem nome no endereço fica sem termo (o servidor tenta o título)", () => {
  const a = analisarLink("https://pt.aliexpress.com/item/1005001234567890.html");
  assert.equal(a.origem, "outro_player");
  assert.equal(a.nomeLoja, "AliExpress");
  assert.equal(a.identificador, "1005001234567890");
  assert.equal(a.termoIdentificado, undefined);
});

test("6. texto sem link: inválido, com o nome para buscar quando parece produto", () => {
  const a = analisarLink("fone jbl tune 520 bluetooth");
  assert.equal(a.origem, "invalido");
  assert.equal(a.urlLimpa, "");
  assert.equal(a.termoIdentificado, "fone jbl tune 520 bluetooth");

  assert.equal(analisarLink("   ").origem, "invalido");
  assert.equal(analisarLink("   ").termoIdentificado, undefined);
  assert.equal(analisarLink("12").termoIdentificado, undefined);
});

test("limparSlug e nomeParaTela", () => {
  assert.equal(
    limparSlug("smartphone-samsung-galaxy-a15_55064488"),
    "smartphone samsung galaxy a15",
  );
  assert.equal(limparSlug("MLB-1234567-camiseta-basica-_JM"), "camiseta basica");
  assert.equal(limparSlug("%E0%A4%A"), "%E0%A4%A");
  assert.equal(nomeParaTela("fritadeira eletrica"), "Fritadeira eletrica");
});

test("bot: link de outra loja com o produto, só link de afiliado e sem preço", async () => {
  const { mensagemOutraLoja, tecladoOutraLoja } = await import("../src/lib/telegram");
  const amz = analisarLink("https://www.amazon.com.br/Echo-Dot-5a-geracao/dp/B09B8V1LZ3");
  const t = tecladoOutraLoja(amz);
  assert.equal(
    t.inline_keyboard[0]![0]!.url,
    "https://www.amazon.com.br/dp/B09B8V1LZ3?tag=melhoresc0fff-20",
  );
  assert.equal(t.inline_keyboard[0]![0]!.text, "🛡️ Comprar com segurança");
  assert.match(t.inline_keyboard[1]![0]!.url, /^https:\/\/melhorescolha\.io\/\?link=/);
  assert.match(mensagemOutraLoja(amz), /Produto identificado:<\/b> Echo Dot 5a geracao/);

  const sh = analisarLink(
    "https://shopee.com.br/Ventilador-de-Teto-Silencioso-120w-Bivolt-3-h%C3%A9lices-Retratil-i.1299327674.58262359246",
  );
  const ts = tecladoOutraLoja(sh);
  assert.equal(ts.inline_keyboard.length, 1);
  assert.doesNotMatch(mensagemOutraLoja(sh), /R\$/);

  const ali = analisarLink("https://pt.aliexpress.com/item/1005001234567890.html");
  assert.equal(tecladoOutraLoja(ali).inline_keyboard[0]![0]!.text, "✍️ Escrever o nome e buscar");
});
