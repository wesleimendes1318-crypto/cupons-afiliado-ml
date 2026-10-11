import assert from 'node:assert/strict';
import test from 'node:test';

import { produtoAmazonDoHtml } from '../amazon.js';
import { asinDoPedido, itemShopeeDoPedido, melhorDoMesmo, semAOrigem } from '../garimpo.js';

/* Recorte no formato da pagina de produto da Amazon (/dp/<ASIN>). */
const paginaDp = `
<span id="productTitle" class="a-size-large product-title-word-break">  Echo Dot 5ª geração | Smart speaker com Alexa  </span>
<div id="corePriceDisplay_desktop_feature_div">
  <span class="a-price a-text-price" data-a-color="secondary"><span class="a-offscreen">R$&nbsp;499,00</span></span>
  <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay"><span class="a-offscreen">R$&nbsp;379,05</span></span>
</div>
<img alt="Echo Dot" src="https://m.media-amazon.com/images/I/71xoR4A6q-L._AC_SX425_.jpg" data-old-hires="https://m.media-amazon.com/images/I/71xoR4A6q-L._AC_SL1000_.jpg" id="landingImage">`;

test('produto da pagina da Amazon: titulo, preco atual (nao o riscado) e foto grande', () => {
  const p = produtoAmazonDoHtml(paginaDp);
  assert.equal(p.titulo, 'Echo Dot 5ª geração | Smart speaker com Alexa');
  assert.equal(p.preco, 379.05);
  assert.equal(p.imagem, 'https://m.media-amazon.com/images/I/71xoR4A6q-L._AC_SL1000_.jpg');
});

test('pagina sem os blocos: nada inventado', () => {
  assert.deepEqual(produtoAmazonDoHtml('<html><title>Amazon.com.br</title></html>'),
    { titulo: null, preco: null, imagem: null });
});

test('ASIN e item da Shopee do pedido', () => {
  assert.equal(asinDoPedido({ id_origem: 'b09b8v1lz3' }), 'B09B8V1LZ3');
  assert.equal(asinDoPedido({ url: 'https://www.amazon.com.br/Echo-Dot/dp/B09B8V1LZ3?ref=x' }), 'B09B8V1LZ3');
  assert.equal(asinDoPedido({ url: 'https://www.amazon.com.br/s?k=echo' }), null);
  assert.deepEqual(itemShopeeDoPedido({ id_origem: '123456.987654321' }), { shop: '123456', item: '987654321' });
  assert.deepEqual(itemShopeeDoPedido({ url: 'https://shopee.com.br/Capinha-i.123456.987654321' }),
    { shop: '123456', item: '987654321' });
});

test('a origem nao entra como candidata e a melhor do mesmo e a mais barata conferida', () => {
  const ofertas = [{ asin: 'B000000001', preco: 10 }, { asin: 'B000000002', preco: 8 }];
  assert.deepEqual(semAOrigem(ofertas, 'amazon', { asin: 'B000000001' }).map(o => o.asin), ['B000000002']);
  assert.deepEqual(semAOrigem([{ item: '9' }, { item: '7' }], 'shopee', { item: '9' }).map(o => o.item), ['7']);
  const m = melhorDoMesmo([
    { relacao: 'parecido', preco: 5 }, { relacao: 'mesmo', preco: 30 }, { relacao: 'mesmo', preco: 25 },
    { relacao: 'busca', preco: 1 }
  ]);
  assert.equal(m.preco, 25);
  assert.equal(melhorDoMesmo([{ relacao: 'busca', preco: 1 }]), null);
});

test('termo nos outros marketplaces sem bivolt, voltagem, SKU nem rastreio', async () => {
  const { termoDeBuscaExterna } = await import('../multiloja.js');
  assert.equal(termoDeBuscaExterna('Bebedouro Fonte Gato Bivolt 220v SKU: 99887766 Frete Grátis'),
    'Bebedouro Fonte Gato');
});
