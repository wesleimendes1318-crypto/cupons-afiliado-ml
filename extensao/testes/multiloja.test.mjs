import assert from 'node:assert/strict';
import test from 'node:test';

import { ehCaptchaAmazon, ehLinkAfiliadoAmazon, gerarLinkAfiliadoAmazon, ofertaAmazonParaSite,
         ofertasAmazonDoHtml, precoBr } from '../amazon.js';
import { ehLinkAfiliadoShopee, idsDoProdutoShopee, ofertaShopeeParaSite, urlCanonicaShopee } from '../shopee.js';
import { escolherCandidatos, parecencaDoTitulo, termoDeBuscaExterna } from '../multiloja.js';

/* Recorte no formato da pagina de busca da Amazon (cartao com data-asin,
   titulo no h2, preco no a-offscreen, foto s-image, selo Prime). */
const cartao = (asin, titulo, preco, extra = '') => `
<div role="listitem" data-asin="${asin}" data-index="3" data-component-type="s-search-result" class="sg-col-4-of-24 s-result-item">
  <div class="puis-card-container">
    <img class="s-image" src="https://m.media-amazon.com/images/I/61${asin}._AC_UL320_.jpg" alt="${titulo}">
    <h2 aria-label="${titulo}" class="a-size-base-plus a-spacing-none a-color-base a-text-normal"><span>${titulo}</span></h2>
    ${extra}
    <span class="a-price" data-a-size="xl" data-a-color="base"><span class="a-offscreen">R$&nbsp;${preco}</span><span aria-hidden="true">R$</span></span>
    <span class="a-price a-text-price" data-a-color="secondary"><span class="a-offscreen">R$&nbsp;999,90</span></span>
  </div>
</div>`;

test('amazon: le os cartoes da busca e ignora patrocinado, usado e sem preco', () => {
  const html = '<html><body>' +
    cartao('B0ABCDEF12', 'JBL Fone de Ouvido Tune 520BT Bluetooth - Preto', '249,90', '<i class="a-icon a-icon-prime"></i> Frete GRÁTIS') +
    cartao('B0SPONS000', 'Fone Qualquer', '99,90', '<span class="puis-label-popover-default">Patrocinado</span>') +
    cartao('B0USADO000', 'JBL Tune 520BT (Recondicionado)', '149,90') +
    `<div data-asin="B0SEMPRECO" data-component-type="s-search-result"><h2><span>Sem preço</span></h2></div>` +
    cartao('B0XYZ98765', 'Fone JBL Tune 510BT Azul', '1.199,00') +
    '</body></html>';
  const l = ofertasAmazonDoHtml(html);
  assert.deepEqual(l.map(o => o.asin), ['B0ABCDEF12', 'B0XYZ98765']);
  assert.equal(l[0].preco, 249.9);
  assert.equal(l[0].prime, true);
  assert.equal(l[0].mencionaFreteGratis, true);
  assert.match(l[0].imagem, /^https:\/\/m\.media-amazon\.com\/images\//);
  assert.equal(l[1].preco, 1199);
  assert.equal(l[1].prime, false);
});

test('amazon: link de afiliado so com ASIN valido e a tag do Weslei', () => {
  assert.equal(gerarLinkAfiliadoAmazon('b0abcdef12'), 'https://www.amazon.com.br/dp/B0ABCDEF12?tag=melhoresc0fff-20');
  assert.equal(gerarLinkAfiliadoAmazon('curto'), null);
  assert.equal(ehLinkAfiliadoAmazon('https://www.amazon.com.br/dp/B0ABCDEF12?tag=melhoresc0fff-20'), true);
  assert.equal(ehLinkAfiliadoAmazon('https://www.amazon.com.br/dp/B0ABCDEF12?tag=outra-20'), false);
  assert.equal(ehLinkAfiliadoAmazon('https://amzn.to/3AbCdEf'), true);
  assert.equal(ehLinkAfiliadoAmazon('http://amzn.to/3AbCdEf'), false);
  const o = ofertaAmazonParaSite({ asin: 'B0ABCDEF12', titulo: 'X', preco: 10, imagem: null, prime: false });
  assert.equal(o.freteGratis, null);
  assert.equal(o.notaFrete, 'Frete: confira no anúncio');
  assert.equal(ofertaAmazonParaSite({ asin: 'B0ABCDEF12', titulo: 'X', preco: 10, prime: true }).notaFrete,
    'Frete grátis para assinantes Prime');
});

test('amazon: reconhece a verificacao de robo', () => {
  assert.equal(ehCaptchaAmazon('<form action="/errors/validateCaptcha">', 'https://www.amazon.com.br/s?k=x'), true);
  assert.equal(ehCaptchaAmazon('<p>Digite os caracteres que você vê abaixo</p>', ''), true);
  assert.equal(ehCaptchaAmazon('<html>resultados</html>', 'https://www.amazon.com.br/s?k=x'), false);
  assert.equal(precoBr('R$&nbsp;2.345,67'), 2345.67);
  assert.equal(precoBr('sem preço'), null);
});

test('shopee: travas de link e ids do produto', () => {
  assert.equal(ehLinkAfiliadoShopee('https://s.shopee.com.br/AbC123xY'), true);
  assert.equal(ehLinkAfiliadoShopee('https://shope.ee/9xYz'), true);
  assert.equal(ehLinkAfiliadoShopee('https://shopee.com.br/produto-i.1.2'), false);
  assert.equal(ehLinkAfiliadoShopee('https://s.shopee.com.br/AbC123?x=1'), false);
  assert.deepEqual(idsDoProdutoShopee('https://shopee.com.br/Fone-JBL-i.123456.987654321?sp_atk=x'), { shop: '123456', item: '987654321' });
  assert.deepEqual(idsDoProdutoShopee('https://shopee.com.br/product/123456/987654321'), { shop: '123456', item: '987654321' });
  assert.equal(urlCanonicaShopee({ shop: '1234', item: '5678' }), 'https://shopee.com.br/product/1234/5678');
  assert.equal(ofertaShopeeParaSite({ item: '5678', titulo: 'X', preco: 10, imagem: 'https://evil.com/a.jpg' }, 'https://s.shopee.com.br/AbC1').imagem, null);
  assert.equal(ofertaShopeeParaSite({ item: '5678', titulo: 'X', preco: 10 }, 'https://shopee.com.br/x'), null);
});

test('termo de busca e escolha dos candidatos', () => {
  assert.equal(termoDeBuscaExterna('Fone JBL Tune 520BT Original Lacrado Frete Grátis Bluetooth Preto'),
    'Fone JBL Tune 520BT Bluetooth Preto');
  const original = { titulo: 'Fone de Ouvido JBL Tune 520BT Bluetooth Preto', preco: 299.9 };
  assert.ok(parecencaDoTitulo(original.titulo, 'JBL Tune 520BT Fone Bluetooth') >= 0.5);
  const lista = [
    { titulo: 'Capa para JBL Tune 520BT', preco: 29.9 },                 /* fora da faixa de preco */
    { titulo: 'Carcaça Fone JBL Tune 520BT', preco: 120 },               /* peca no lugar do aparelho */
    { titulo: 'Fone de Ouvido JBL Tune 520BT Bluetooth Preto', preco: 249.9 },
    { titulo: 'Fone JBL Tune 520BT Azul', preco: 239.9 },
    { titulo: 'Liquidificador Mondial', preco: 200 },                    /* titulo nada parecido */
  ];
  const e = escolherCandidatos(lista, original);
  assert.deepEqual(e.map(o => o.preco), [249.9, 239.9]);
});
