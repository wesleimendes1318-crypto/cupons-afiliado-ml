/* node --test extensao/testes/comparador.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  palavrasDoTitulo, pareceMesmoProduto, ofertasDaBusca, ofertasDoCatalogo,
  precoDoCartao, itemDoUrl, escolherAlternativas, ehCaptcha, urlDeBusca
} from '../comparador.js';

test('palavras do titulo mantem os espacos', () => {
  assert.deepEqual(
    palavrasDoTitulo('Capa Case Anti-Impacto para Motorola G84'),
    ['capa', 'case', 'anti', 'impacto', 'motorola', 'g', '84'].filter(w => w.length >= 3 || /^\d+$/.test(w))
  );
});

test('mesmo produto com titulo escrito diferente', () => {
  assert.ok(pareceMesmoProduto(
    'Kit Wella Oil Reflections Shampoo 250ml + Condicionador 200ml',
    'Wella Professionals Oil Reflections Kit Shampoo 250ml Condicionador 200ml'));
});

test('capacidade diferente nao e o mesmo produto', () => {
  assert.equal(pareceMesmoProduto(
    'Smartphone Motorola Moto G84 5G 256GB 8GB RAM Grafite',
    'Smartphone Motorola Moto G84 5G 128GB 8GB RAM Grafite'), false);
});

const cartao = ({ href, titulo, antigo, fracao, centavos }) => `
<li class="ui-search-layout__item"><div class="poly-card">
  <h3 class="poly-component__title-wrapper"><a href="${href}" class="poly-component__title">${titulo}</a></h3>
  <div class="poly-price__current">
   ${antigo ? `<s class="andes-money-amount andes-money-amount--previous"><span class="andes-money-amount__fraction" aria-hidden="true">${antigo}</span></s>` : ''}
   <span class="andes-money-amount andes-money-amount--cents-superscript" role="img" aria-label="${fracao} reais">
     <span class="andes-money-amount__fraction" aria-hidden="true">${fracao}</span>
     ${centavos ? `<span class="andes-money-amount__cents">${centavos}</span>` : ''}
   </span>
  </div>
</div></li>`;

test('busca: titulo dentro do <a>, preco riscado ignorado, catalogo x anuncio', () => {
  const html = '<ol>' + [
    cartao({ href: 'https://www.mercadolivre.com.br/p/MLB19486347?pdp_filters=item_id%3AMLB5111111111#wid=MLB5111111111&amp;sid=search',
             titulo: 'Kit Wella Oil Reflections Shampoo 250ml Condicionador 200ml', antigo: '499', fracao: '291', centavos: '95' }),
    cartao({ href: 'https://produto.mercadolivre.com.br/MLB-4222222222-kit-wella-_JM',
             titulo: 'Wella Oil Reflections Kit Shampoo 250ml e Condicionador 200ml', fracao: '1.310' }),
    cartao({ href: 'https://produto.mercadolivre.com.br/MLB-4333333333-escova-_JM',
             titulo: 'Escova Secadora Rotativa 1200w', fracao: '300' }),
  ].join('') + '</ol>';

  const r = ofertasDaBusca(html, 'Kit Wella Oil Reflections Shampoo 250ml + Condicionador 200ml', null);
  assert.equal(r.length, 2);
  assert.equal(r[0].item, 'MLB5111111111');
  assert.equal(r[0].catalogo, 'MLB19486347');
  assert.equal(r[0].url, 'https://www.mercadolivre.com.br/p/MLB19486347?pdp_filters=item_id%3AMLB5111111111');
  assert.equal(r[0].preco, 291.95);
  assert.equal(r[1].item, 'MLB4222222222');
  assert.equal(r[1].preco, 1310);
  assert.equal(r[1].url, 'https://produto.mercadolivre.com.br/MLB-4222222222');

  // Faixa de preco: 1.310 contra referencia de 300 cai fora.
  assert.equal(ofertasDaBusca(html, 'Kit Wella Oil Reflections Shampoo 250ml Condicionador 200ml', 300).length, 1);
});

test('preco do cartao: aria-label com centavos', () => {
  assert.equal(precoDoCartao('<span aria-label="Agora: 1.299 reais com 90 centavos">'), 1299.9);
});

test('catalogo: formato conhecido e formato tolerante', () => {
  const conhecido = '"buy_box_offers":{"offers":[{"selected":true,"type":"BUY_BOX","item_id":"MLB5365421378","price":{"currency":"BRL","value":2300.54}},'
    + '{"selected":false,"type":"OFFER","item_id":"MLB6444702764","price":{"value":2434.34}}]}';
  assert.deepEqual(ofertasDoCatalogo(conhecido), [
    { item: 'MLB5365421378', preco: 2300.54 }, { item: 'MLB6444702764', preco: 2434.34 }]);

  const mudou = '"buy_box_offers":{"offers":[{"item_id":"MLB1000000001","seller":{"id":1},"price":{"value":99.9}},'
    + '{"item_id":"MLB1000000002","price":{"value":89.5}}]}';
  assert.deepEqual(ofertasDoCatalogo(mudou), [
    { item: 'MLB1000000001', preco: 99.9 }, { item: 'MLB1000000002', preco: 89.5 }]);

  assert.deepEqual(ofertasDoCatalogo('<html>sem bloco</html>'), []);
});

test('id do anuncio a partir do link colado', () => {
  assert.equal(itemDoUrl('https://www.mercadolivre.com.br/p/MLB19486347?pdp_filters=item_id%3AMLB5365421378'), 'MLB5365421378');
  assert.equal(itemDoUrl('https://produto.mercadolivre.com.br/MLB-4436662487-capa-_JM'), 'MLB4436662487');
  assert.equal(itemDoUrl('https://www.mercadolivre.com.br/p/MLB19486347'), null);
});

test('captcha', () => {
  assert.ok(ehCaptcha('', 'https://www.mercadolivre.com.br/captcha/wall/logged?go_url=x'));
  assert.ok(ehCaptcha('<title>Por segurança, complete esta etapa</title>', ''));
  assert.equal(ehCaptcha('<html>produto</html>', 'https://www.mercadolivre.com.br/p/MLB1'), false);
});

test('url de busca sem acento nem simbolo', () => {
  assert.equal(urlDeBusca('Capa Anti-Impacto p/ Motorola G84 (Preta)'),
    'https://lista.mercadolivre.com.br/capa-anti-impacto-p-motorola-g-84-preta'.replace('g-84', 'g84'));
});

const alt = (o) => ({ item: 'MLB' + o.v, url: 'u' + o.v, preco: o.p, vendedor: o.v,
  cupom: o.c ? { id: 1, titulo: '10% OFF' } : null, economia: o.e || 0, final: o.p - (o.e || 0) });

test('escolha: a loja do cliente sem cupom, concorrente com cupom no mesmo preco final', () => {
  const r = escolherAlternativas([alt({ v: 'LojaB', p: 101, e: 1, c: true })],
    { finalAtual: 100, temCupomAqui: false, vendedorAtual: 'LojaA' });
  assert.equal(r.length, 1);
  assert.equal(r[0].motivo, 'tem_cupom');
});

test('escolha: concorrente com cupom mas mais cara fica fora', () => {
  const r = escolherAlternativas([alt({ v: 'LojaB', p: 150, e: 10, c: true })],
    { finalAtual: 100, temCupomAqui: false });
  assert.equal(r.length, 0);
});

test('escolha: menor custo primeiro, sem a propria loja, maximo 3', () => {
  const r = escolherAlternativas([
    alt({ v: 'LojaA', p: 50 }),                  // a propria loja do cliente
    alt({ v: 'LojaB', p: 90 }),
    alt({ v: 'LojaC', p: 80, e: 5, c: true }),
    alt({ v: 'LojaD', p: 99 }),                  // ganho de R$ 1: nao vale a troca
    alt({ v: 'LojaE', p: 70 }),
    alt({ v: 'LojaF', p: 60 }),
  ], { finalAtual: 100, temCupomAqui: true, vendedorAtual: 'loja a' });
  assert.deepEqual(r.map(x => x.vendedor), ['LojaF', 'LojaE', 'LojaC']);
  assert.ok(r.every(x => x.motivo === 'mais_barata'));
  assert.equal(r[0].ganho, 40);
});

test('escolha: sem preco da loja do cliente nao compara', () => {
  assert.deepEqual(escolherAlternativas([alt({ v: 'X', p: 1 })], { finalAtual: null }), []);
});

import { primeiroAnuncioDaLista, lojaDoAnuncio } from '../comparador.js';

test('lista da campanha: primeiro anuncio', () => {
  const html = '<ol>' + cartao({ href: 'https://produto.mercadolivre.com.br/MLB-4999999999-chaleira-_JM#polycard',
    titulo: 'Chaleira Eletrica Fressa 1,8 L', fracao: '349', centavos: '90' }) + '</ol>';
  assert.equal(primeiroAnuncioDaLista(html).url, 'https://produto.mercadolivre.com.br/MLB-4999999999');
});

test('loja do anuncio: pagina e _CustId_', () => {
  const html = '<a href="https://www.mercadolivre.com.br/pagina/pezzia?item_id=MLB1">PEZZIA</a>'
    + '<a href="https://lista.mercadolivre.com.br/_CustId_2615738264">Ver mais produtos</a>';
  assert.deepEqual(lojaDoAnuncio(html), [
    'https://lista.mercadolivre.com.br/pagina/pezzia/',
    'https://lista.mercadolivre.com.br/_CustId_2615738264']);
  assert.deepEqual(lojaDoAnuncio('{"url":"\\u002Fpagina\\u002Fk4p5vnd2","seller_id":1788447429}'), [
    'https://lista.mercadolivre.com.br/pagina/k4p5vnd2/',
    'https://lista.mercadolivre.com.br/_CustId_1788447429']);
});

import { produtoDoPerfilSocial } from '../comparador.js';

test('perfil social: produto no parametro do endereco', () => {
  assert.equal(produtoDoPerfilSocial(
    'https://www.mercadolivre.com.br/social/wesleimendes?matt_tool=1&ref=https%3A%2F%2Fwww.mercadolivre.com.br%2Fp%2FMLB19486347%3Fpdp_filters%3Ditem_id%3AMLB5365421378', ''),
    'https://www.mercadolivre.com.br/p/MLB19486347?pdp_filters=item_id%3AMLB5365421378');
});

test('perfil social: produto em base64 no endereco', () => {
  const b = Buffer.from('https://produto.mercadolivre.com.br/MLB-4739054961-capa').toString('base64');
  assert.equal(produtoDoPerfilSocial('https://www.mercadolivre.com.br/social/x?ref=' + encodeURIComponent(b), ''),
    'https://produto.mercadolivre.com.br/MLB-4739054961');
});

test('perfil social: pagina com varios produtos nao chuta', () => {
  assert.equal(produtoDoPerfilSocial('https://www.mercadolivre.com.br/social/x', 'MLB1234567890 MLB2234567890'), null);
  assert.equal(produtoDoPerfilSocial('https://www.mercadolivre.com.br/social/x', 'so o MLB1234567890 aqui'),
    'https://produto.mercadolivre.com.br/MLB-1234567890');
});

import { gtinValido, identificadoresDoAnuncio } from '../comparador.js';

test('GTIN: digito verificador', () => {
  assert.ok(gtinValido('7891000315507'));   // EAN-13 valido
  assert.ok(gtinValido('96385074'));        // EAN-8 valido
  assert.equal(gtinValido('7891000315508'), false);
  assert.equal(gtinValido('0000000000000'), false);
  assert.equal(gtinValido('12345'), false);
});

test('identidade do anuncio: GTIN, marca, modelo e catalogo', () => {
  const html = '{"attributes":[{"id":"BRAND","name":"Marca","value_name":"Kevira"},'
    + '{"id":"MODEL","name":"Modelo","value_name":"Banco Mesa 180"},'
    + '{"id":"GTIN","name":"Código universal de produto","value_name":"7891000315507"}],'
    + '"catalog_product_id":"MLB19486347"}';
  assert.deepEqual(identificadoresDoAnuncio(html),
    { gtin: '7891000315507', marca: 'Kevira', modelo: 'Banco Mesa 180', catalogoPagina: 'MLB19486347' });
});

test('identidade do anuncio: GTIN invalido e descartado, ficha em texto', () => {
  const html = '<tr><th>Código universal de produto</th><td>7891000315508</td></tr>';
  assert.equal(identificadoresDoAnuncio(html).gtin, null);
  const ok = '<tr><th>Código universal de produto</th><td><span>7891000315507</span></td></tr>';
  assert.equal(identificadoresDoAnuncio(ok).gtin, '7891000315507');
});
