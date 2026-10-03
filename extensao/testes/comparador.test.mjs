/* node --test extensao/testes/comparador.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  palavrasDoTitulo, pareceMesmoProduto, ofertasDaBusca, ofertasDoCatalogo,
  precoDoCartao, itemDoUrl, escolherAlternativas, ehCaptcha, urlDeBusca, pecaNoLugarDoAparelho
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

test('escolha: menor custo primeiro, maximo 3; propria loja so com outro anuncio mais barato', () => {
  const r = escolherAlternativas([
    alt({ v: 'LojaA', p: 50 }),                  // a propria loja do cliente, OUTRO anuncio mais barato
    alt({ v: 'LojaB', p: 90 }),
    alt({ v: 'LojaC', p: 80, e: 5, c: true }),
    alt({ v: 'LojaD', p: 99 }),                  // ganho de R$ 1: nao vale a troca
    alt({ v: 'LojaE', p: 70 }),
    alt({ v: 'LojaF', p: 60 }),
  ], { finalAtual: 100, temCupomAqui: true, vendedorAtual: 'loja a' });
  assert.deepEqual(r.map(x => x.vendedor), ['LojaA', 'LojaF', 'LojaE']);
  assert.ok(r.every(x => x.motivo === 'mais_barata'));
  assert.equal(r[0].mesmaLoja, true);
  assert.equal(r[1].ganho, 40);
});

test('escolha: propria loja com o mesmo preco (o proprio anuncio) fica fora', () => {
  const r = escolherAlternativas([alt({ v: 'LojaA', p: 100 }), alt({ v: 'LojaB', p: 90 })],
    { finalAtual: 100, vendedorAtual: 'loja a' });
  assert.deepEqual(r.map(x => x.vendedor), ['LojaB']);
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

import { variacaoEscolhida } from '../comparador.js';

test('variacao escolhida: modelo do celular entra, cor nao', () => {
  const html = '<p class="ui-pdp-variations__label">Cor e Padrão: <span class="ui-pdp-variations__selected-label">Preto</span></p>'
    + '<p class="ui-pdp-variations__label">Modelo do Celular: <span class="ui-pdp-variations__selected-label">Edge 70</span></p>';
  assert.equal(variacaoEscolhida(html), 'Edge 70');
});

test('variacao escolhida: pelos dados da pagina', () => {
  const html = '{"pickers":[{"id":"COLOR","label":{"text":"Cor: "},"selected_option":{"id":"1","text":"Preto"}},'
    + '{"id":"MODEL","label":{"text":"Modelo do Celular: "},"selected_option":{"id":"2","text":"Moto G35"}}]}';
  assert.equal(variacaoEscolhida(html), 'Moto G35');
});

test('variacao escolhida: anuncio sem variacao', () => {
  assert.equal(variacaoEscolhida('<h1>Óleo Wella 100ml</h1>'), null);
});

test('busca: cai para os dados da pagina quando nao ha cartao em HTML', () => {
  const html = '<script>{"results":[{"polycard":{"metadata":{"id":"MLB5555555555","url":"produto.mercadolivre.com.br/MLB-5555555555-escorredor-_JM#wid=MLB5555555555"},'
    + '"components":[{"type":"title","title":{"text":"Escorredor De Louça Suspenso Preto 65 Cm Em Aço Carbono"}},'
    + '{"type":"price","price":{"current_price":{"value":139.65,"currency":"BRL"}}}]}}]}</script>';
  const diag = {};
  const r = ofertasDaBusca(html, 'Escorredor Louca Suspenso Preto 65 Cm Em Aço Carbono', 135, diag);
  assert.equal(r.length, 1);
  assert.equal(r[0].item, 'MLB5555555555');
  assert.equal(r[0].preco, 139.65);
  assert.equal(diag.cartoes, 0);
});

import { candidatosDeCartoes } from '../comparador.js';

test('cartoes lidos na tela: mesmo produto, mais baratos primeiro', () => {
  const cartoes = [
    { href: 'https://produto.mercadolivre.com.br/MLB-5555555555-travesseiro-_JM', titulo: 'Travesseiro Cervical Ortopédico Viscoelástico Nasa', preco: 119.9 },
    { href: 'https://www.mercadolivre.com.br/travesseiro/p/MLB22222222?pdp_filters=item_id%3AMLB6666666666', titulo: 'Travesseiro Cervical Ortopédico Viscoelástico', preco: 99.9 },
    { href: 'https://produto.mercadolivre.com.br/MLB-7777777777-fronha-_JM', titulo: 'Fronha Para Travesseiro Cervical', preco: 29.9 },
  ];
  const diag = {};
  const r = candidatosDeCartoes(cartoes, 'Travesseiro Cervical Ortopédico Viscoelástico', 130.16, diag);
  assert.equal(r.length, 2);
  assert.equal(r[0].preco, 99.9);
  assert.equal(r[0].item, 'MLB6666666666');
  assert.equal(diag.cartoesTela, 3);
});

test('busca: dados em JSON dentro de string (aspas escapadas, \\u002F), como a pagina real de 24/09', () => {
  const card = '{"id":"POLYCARD","polycard":{"metadata":{"id":"MLB7608838296","url":"www.mercadolivre.com.br\\u002Ftravesseiro\\u002Fp\\u002FMLB74867031#wid=MLB7608838296"},'
    + '"components":[{"type":"title","title":{"text":"Travesseiro Cervical Ortopédico Viscoelástico Premium"}},'
    + '{"type":"price","price":{"current_price":{"value":74.8,"currency":"BRL"}}}]}}';
  const html = '<script>window.__DADOS__ = "' + card.replace(/"/g, '\\"') + '";</script>';
  const diag = {};
  const r = ofertasDaBusca(html, 'Travesseiro Cervical Ortopédico Viscoelástico', 130.16, diag);
  assert.equal(r.length, 1);
  assert.equal(r[0].item, 'MLB7608838296');
  assert.equal(r[0].preco, 74.8);
});

import { polycards } from '../comparador.js';

test('busca: cartao polycard real (link de rastreio, numero do anuncio em metadata.id)', () => {
  const card = '"results":[{"id":"POLYCARD","state":"VISIBLE","polycard":{"unique_id":"x","metadata":{"id":"MLB6647645240","user_product_id":"MLBU3807900795",'
    + '"url":"click1.mercadolivre.com.br/mclics/clicks/external/MLB/count","url_fragments":"#wid=MLB6647645240",'
    + '"tracks":{"melidata_track":{"type":"view","event_data":{"position":1}}},"is_ad":true},'
    + '"pictures":{"scale":"FILL","pictures":[{"id":"940186-MLB115232945436_082026"}],"square":"Q"},'
    + '"components":[{"type":"title","id":"title","title":{"text":"Travesseiro Viscoelástico Borboleta Cervical Ortopédico","long_title":false}},'
    + '{"type":"price","id":"price_v2","price":{"price_labels":[{"values":[{"price":{"value":299,"previous":true}}]}],'
    + '"current_price":{"value":159,"currency":"BRL"}}}]}}]';
  const html = '<script>x = "' + card.replace(/"/g, '\\"').replace(/\//g, '\\u002F') + '";</script>';
  const limpo = html.replace(/\\u002F/gi, '/').replace(/\\"/g, '"');
  const c = polycards(limpo);
  assert.equal(c.length, 1);
  assert.equal(c[0].item, 'MLB6647645240');
  assert.equal(c[0].preco, 159);
  assert.equal(c[0].url, 'https://produto.mercadolivre.com.br/MLB-6647645240');
  assert.equal(c[0].imagem, 'https://http2.mlstatic.com/D_NQ_NP_940186-MLB115232945436_082026-O.webp');
  const diag = {};
  const r = ofertasDaBusca(html, 'Travesseiro Cervical Ortopédico Viscoelástico', 130.16, diag);
  assert.equal(r.length, 1);
  assert.equal(diag.polycards, 1);
});

test('foto do cartao vem do bloco renderizado (lido na janela anonima)', async () => {
  const { imagemDoCartao, ofertasDaBusca } = await import('../comparador.js');
  const img = '<img class="poly-component__picture" src="https://http2.mlstatic.com/D_Q_NP_2X_727622-MLB113306582127_062026-E.webp" alt="x">';
  assert.equal(imagemDoCartao(img), 'https://http2.mlstatic.com/D_NQ_NP_727622-MLB113306582127_062026-O.webp');
  assert.equal(imagemDoCartao('<img src="data:image/gif;base64,R0lGOD">'), null);
  const cartao = t => '<li class="ui-search-layout__item"><div class="poly-card">' + img
    + '<h3 class="poly-component__title-wrapper"><a class="poly-component__title" href="https://produto.mercadolivre.com.br/MLB-1234567890-capa">'
    + t + '</a></h3><span class="andes-money-amount__fraction">39</span></div></li>';
  const html = cartao('Capa Case Anti Impacto Motorola Edge 70 Transparente Acrilico');
  const diag = {};
  const r = ofertasDaBusca(html, 'Capa Case Anti Impacto Para Motorola Transparente Acrilico Edge 70', 45, diag);
  assert.equal(r.length, 1);
  assert.equal(r[0].imagem, 'https://http2.mlstatic.com/D_NQ_NP_727622-MLB113306582127_062026-O.webp');
  assert.equal(diag.titulosVistos.length, 1);
});

test('ate 12 parecidos seguem para a Gemini conferir', async () => {
  const { ofertasDaBusca, MAX_CANDIDATOS_IA } = await import('../comparador.js');
  let html = '';
  for (let i = 0; i < 20; i++) {
    html += '<li class="ui-search-layout__item"><a class="poly-component__title" href="https://produto.mercadolivre.com.br/MLB-12345678' + String(i).padStart(2, '0')
      + '-x">Travesseiro Cervical Ortopedico Viscoelastico Nasa</a><span class="andes-money-amount__fraction">' + (50 + i) + '</span></li>';
  }
  const r = ofertasDaBusca(html, 'Travesseiro Cervical Ortopedico Viscoelastico', 60);
  assert.equal(r.length, MAX_CANDIDATOS_IA);
  assert.ok(r[0].preco <= r[1].preco);
});

test('busca: outros anuncios na faixa de preco completam a conferencia (Itan, 26/09)', () => {
  const html = '<ol>' + [
    cartao({ href: 'https://produto.mercadolivre.com.br/MLB-4111111111-itan-_JM',
             titulo: 'Barra Led Inflável Itan MLG-202 Iluminador Bastão Magnético', fracao: '150' }),
    cartao({ href: 'https://produto.mercadolivre.com.br/MLB-4222222222-tomate-_JM',
             titulo: 'Barra Led Inflável Tomate W12 Iluminador Bastão Magnético', fracao: '129', centavos: '99' }),
    cartao({ href: 'https://produto.mercadolivre.com.br/MLB-4333333333-fita-_JM',
             titulo: 'Fita Led 5 Metros Rgb Com Controle', fracao: '20' }),
  ].join('') + '</ol>';
  const r = ofertasDaBusca(html, 'Barra Led Inflável Itan MLG-202 Iluminador Bastão Magnético Estrutura Preto', 150);
  assert.equal(r.length, 1);
  assert.equal(r[0].item, 'MLB4111111111');
  // A Tomate (outro modelo) vai para a conferencia pela foto; a fita de R$ 20 fica fora da faixa.
  assert.deepEqual(r.outros.map(o => o.item), ['MLB4222222222']);
});

import { freteGratisDaBusca } from '../comparador.js';

test('frete: "gratis" no cartao vale; has_free_shipping false nao prova frete pago (Tomate W12, 26/09)', () => {
  const dados = '"polycard":{"metadata":{"id":"MLB4739507505","url":"x"},"components":[{"type":"shipping","id":"shipping","shipping":{"text":"Chegará grátis amanhã"}}]}'
    + '"polycard":{"metadata":{"id":"MLB7578359238","url":"y"},"components":[{"type":"price"}]}'
    + '{"has_free_shipping":false,"pid_extended":"a_MLB7578359238"}'
    + '{"has_free_shipping":true,"pid_extended":"a_MLB1111111111"}';
  const mapa = freteGratisDaBusca(dados);
  assert.equal(mapa.get('MLB4739507505'), true);
  assert.equal(mapa.has('MLB7578359238'), false);
  assert.equal(mapa.get('MLB1111111111'), true);

  const html = cartao({ href: 'https://produto.mercadolivre.com.br/MLB-4222222222-x-_JM', titulo: 'Barra Led', fracao: '99' })
    .replace('</li>', '<span class="poly-component__shipping">Frete gr&aacute;tis</span></li>');
  assert.equal(freteGratisDaBusca('<ol>' + html + '</ol>').get('MLB4222222222'), true);
});

test('loja oficial pelo evento do PRÓPRIO anúncio (27/09)', async () => {
  const { lojaOficialDoHtml, itemDaCompra, condicaoDoHtml } = await import('../comparador.js');
  /* Página da SHOPMASP que também traz o evento da loja oficial adidas. */
  const adidas = '"melidata_event":{"path":"/upp","event_data":{"seller_id":451403353,"seller_name":"adidas","official_store_id":3154,"compats_info":{},"item_id":"MLB6209821274"}}';
  const shop = '"melidata_event":{"path":"/upp","event_data":{"seller_id":3042004896,"seller_name":"SHOPMASP","power_seller_status":"silver","compats_info":{},"item_condition":"new","item_id":"MLB4680649229"}}';
  const compra = '"melidata_event":{"path":"/vip/buy_action","event_data":{"item_id":"MLB4680649229","item_condition":"new","seller_id":3042004896}}';
  const pagina = adidas + ',' + shop + ',' + compra;
  assert.equal(lojaOficialDoHtml(pagina, 'MLB4680649229'), false);
  assert.equal(lojaOficialDoHtml(pagina, 'MLB6209821274'), true);
  assert.equal(lojaOficialDoHtml(pagina.replace(/"/g, '\\"'), 'MLB6209821274'), true);
  assert.equal(lojaOficialDoHtml(pagina, 'MLB999999999'), null);
  assert.equal(lojaOficialDoHtml(pagina, null), null);
  assert.equal(itemDaCompra(pagina), 'MLB4680649229');
  assert.equal(condicaoDoHtml(pagina, 'MLB4680649229'), 'new');
});

test('detalhes, condicao e dominio do anuncio (27/09)', async () => {
  const { detalhesDoAnuncio, condicaoDoHtml, dominioDoHtml, fatosDoOriginal } = await import('../comparador.js');
  const html = '<table><tr><th class="andes-table__header"><div>Marca</div></th><td class="andes-table__column"><span>adidas</span></td></tr>'
    + '<tr><th>Gênero</th><td>Masculino</td></tr></table>'
    + '<ul><li class="ui-vpp-highlighted-specs__features-list-item">Tecido leve &amp; resistente</li></ul>'
    + '<p class="ui-pdp-description__content">Conjunto com jaqueta<br>e calça.</p>'
    + '"event_data":{"item_condition":"new","domain_id":"MLB-CLOTHING"}';
  const d = detalhesDoAnuncio(html);
  assert.deepEqual(d.caracteristicas, [{ nome: 'Marca', valor: 'adidas' }, { nome: 'Gênero', valor: 'Masculino' }]);
  assert.deepEqual(d.destaques, ['Tecido leve & resistente']);
  assert.equal(d.descricao, 'Conjunto com jaqueta\ne calça.');
  assert.equal(condicaoDoHtml(html), 'new');
  assert.equal(dominioDoHtml(html), 'MLB-CLOTHING');
  assert.equal(fatosDoOriginal(d, { dominio: 'MLB-CLOTHING', condicao: 'new' }), 'Tipo: clothing; Condicao: novo; Marca: adidas; Gênero: Masculino; Descricao: Conjunto com jaqueta e calça.');
  const json = '{"id":"Cor","text":"Preto"},{"id":"fae","text":"Perfeito para 100%"},{"id":"Modelo","text":"Basic 3S Woven"}';
  assert.deepEqual(detalhesDoAnuncio(json).caracteristicas, [{ nome: 'Cor', valor: 'Preto' }, { nome: 'Modelo', valor: 'Basic 3S Woven' }]);
  assert.equal(detalhesDoAnuncio('<html></html>'), null);
});

test('garimpo: mais baratos primeiro, busca de lojas oficiais antes (27/09)', async () => {
  const { escolherParaConferir } = await import('../comparador.js');
  const busca = Array.from({ length: 10 }, (_, i) => ({ item: 'MLB10' + i, preco: 430 + i * 3, nota: 0.8 }));
  const outros = [
    { item: 'MLB6209821274', preco: 353.69, nota: 0.3, titulo: 'Conjunto De Agasalho Masculino Woven 3 Listras Adidas' },
    { item: 'MLB2', preco: 300, nota: 0.2 },
  ];
  const oficiais = [{ item: 'MLB6209821274', preco: 353.69, nota: 0.3 }, { item: 'MLB3', preco: 420, nota: 0.5 }];
  const r = escolherParaConferir({ oficiais, google: [], busca, outros }, 436.91, 'MLB4680649229', 8);
  assert.equal(r.length, 8);
  /* Os achados na busca de lojas oficiais vêm na frente. */
  assert.deepEqual(r.slice(0, 2).map(c => c.origem), ['oficiais', 'oficiais']);
  assert.ok(r.slice(0, 2).some(c => c.item === 'MLB6209821274'));
  /* Todos os mais baratos que o colado entram (cabem nas vagas). */
  for (const it of ['MLB6209821274', 'MLB3', 'MLB100']) assert.ok(r.some(c => c.item === it), it);
  /* E sobram vagas para os mais caros (tabela de todas as lojas). */
  assert.ok(r.filter(c => c.preco > 436.91).length >= 4);
  /* Com 12 vagas (o normal), todos os mais baratos entram. */
  const r12 = escolherParaConferir({ oficiais, google: [], busca, outros }, 436.91, 'MLB4680649229');
  assert.equal(r12.filter(c => c.preco <= 436.41).length, 6);
});

test('sugestoes do Mercado Livre ganham vagas na conferencia (03/10, MPK Mini x M-Vave)', async () => {
  const { escolherParaConferir } = await import('../comparador.js');
  /* 12 copias do proprio Akai mais baratas, titulo quase igual. */
  const busca = Array.from({ length: 12 }, (_, i) => ({ item: 'MLB20' + i, preco: 500 + i, nota: 0.95 }));
  const caros = Array.from({ length: 6 }, (_, i) => ({ item: 'MLB30' + i, preco: 700 + i, nota: 0.9 }));
  const relacionados = [
    { item: 'MLB9001', preco: 339.69, nota: 0.4, titulo: 'Teclado Controlador MIDI M-Vave SMK-25 25 Teclas' },
    { item: 'MLB9002', preco: 495.97, nota: 0.35, titulo: 'Controlador Midi M-vave Smk-37 Pro' },
    { item: 'MLB9003', preco: 404.99, nota: 0.45, titulo: 'Kfx Mini 25 Teclado Controlador Midi' },
    { item: 'MLB9004', preco: 420, nota: 0.4, titulo: 'Outro controlador' },
  ];
  const r = escolherParaConferir({ oficiais: [], google: [], busca: [...busca, ...caros], relacionados }, 568, 'MLB1');
  assert.equal(r.length, 12);
  /* As 3 sugestoes mais baratas entram; a quarta nao. */
  for (const it of ['MLB9001', 'MLB9003', 'MLB9004']) assert.ok(r.some(c => c.item === it), it);
  assert.ok(!r.some(c => c.item === 'MLB9002'));
  /* Continuam 4 vagas para os mais caros. */
  assert.equal(r.filter(c => c.preco > 568).length, 4);
});

test('selo MercadoLider do proprio anuncio, com o nome da loja conferido (28/09)', async () => {
  const { seloDoVendedor } = await import('../comparador.js');
  const pagina = '"melidata_event":{"path":"/upp","event_data":{"seller_id":1,"seller_name":"adidas","power_seller_status":"platinum","item_id":"MLB1"}},'
    + '"melidata_event":{"path":"/upp","event_data":{"seller_id":2,"seller_name":"SHOPMASP","power_seller_status":"silver","item_id":"MLB2"}}';
  assert.deepEqual(seloDoVendedor(pagina, 'MLB2', ['SHOPMASP']), { nome: 'SHOPMASP', mercadoLider: 'silver' });
  assert.equal(seloDoVendedor(pagina, 'MLB2', ['outra loja']), null);
  assert.deepEqual(seloDoVendedor(pagina, 'MLB1'), { nome: 'adidas', mercadoLider: 'platinum' });
});

test('detalhes resumidos de cada loja encontrada (28/09)', async () => {
  const { detalhesResumidos, detalhesDoAnuncio } = await import('../comparador.js');
  assert.equal(detalhesResumidos(null), null);
  const muitas = Array.from({ length: 25 }, (_, i) => ({ nome: 'C' + i + 'x', valor: 'v' }));
  const r = detalhesResumidos({ caracteristicas: muitas, destaques: ['a', 'b', 'c', 'd', 'e', 'f'], descricao: 'x'.repeat(2000) });
  assert.equal(r.caracteristicas.length, 15);
  assert.equal(r.destaques.length, 5);
  assert.equal(r.descricao.length, 700);
  const d = detalhesResumidos(detalhesDoAnuncio('<table><tr><th>Marca</th><td>adidas</td></tr></table>'));
  assert.deepEqual(d.caracteristicas, [{ nome: 'Marca', valor: 'adidas' }]);
});

test('juntar achados nao perde os parecidos (28/09, capinha 474)', async () => {
  const { juntarAchados } = await import('../comparador.js');
  const doCatalogo = [{ item: 'MLB1' }];
  const daBusca = [{ item: 'MLB2' }];
  daBusca.parecidos = [{ item: 'MLB3', muda: 'cor' }];
  daBusca.diag = { conferidos: 12 };
  const t = juntarAchados(doCatalogo, daBusca);
  assert.deepEqual(t.map(x => x.item), ['MLB1', 'MLB2']);
  assert.equal(t.parecidos.length, 1);
  assert.equal(t.diag.conferidos, 12);
  /* Sem parecidos em lugar nenhum: nao inventa a propriedade. */
  assert.equal(juntarAchados([], []).parecidos, undefined);
  /* So a busca, vazia de iguais, com parecidos (caso real da capinha). */
  const vazio = []; vazio.parecidos = [{ item: 'MLB9' }];
  assert.equal(juntarAchados([], vazio).parecidos.length, 1);
});

test('precos a vista (Pix) e parcelado do proprio anuncio (28/09, iPhone)', async () => {
  const { precosDoItem } = await import('../comparador.js');
  const ev = (item, extra) => '"melidata_event":{"path":"/pdp","event_data":{"item_id":"' + item + '",' + extra + '}}';
  const pagina = ev('MLB2', '"price":100,"original_price":120')
    + ev('MLB1', '"price":9757.11,"original_price":12499,"credit_view_components":{"pricing":{"original_price":12499,"actual_price":9757.11,'
      + '"recommended_methods":[{"id":"visa","installments":15,"installment_amount":650.47,"installments_total":9757.05,"is_free_installment":true}]},'
      + '"campaigns":[{"id":"1","type":"PIX","price_breakdown_label":"Desconto no Pix","amount":{"index":0,"type":"price","value":975.71,"currency":{"id":"BRL"}}}]}');
  const p = precosDoItem(pagina, 'MLB1');
  assert.equal(p.cheio, 9757.11);
  assert.equal(p.pix, 8781.4);
  assert.deepEqual(p.parcelas, { vezes: 15, valor: 650.47, total: 9757.05, semJuros: true });
  /* Outro anuncio da mesma pagina nao vaza para este. */
  assert.deepEqual(precosDoItem(pagina, 'MLB2'), { cheio: 100, pix: null, parcelas: null });
  assert.equal(precosDoItem(pagina, 'MLB9'), null);
  /* Escapado dentro de JSON (como vem no HTML). */
  const esc = pagina.replace(/"/g, '\\"');
  assert.equal(precosDoItem(esc, 'MLB1').pix, 8781.4);
});

test('carcaca nunca e o mesmo produto que o aparelho (pedido 535)', () => {
  const original = 'Controle De Acesso Senha E Cartão Digiprox Sa203mf Intelbras';
  const carcaca = 'Carcaça Controle De Acesso Intelbras Senha Cartão Sa 203';
  assert.equal(pecaNoLugarDoAparelho(original, carcaca), true);
  assert.equal(pareceMesmoProduto(original, carcaca), false);
  /* o aparelho inteiro continua passando */
  assert.equal(pecaNoLugarDoAparelho(original, 'Controle De Acesso Intelbras Sa 203 Mf Senha E Cartão'), false);
  /* produto completo que cita a parte ("com tampa") nao e peca */
  assert.equal(pecaNoLugarDoAparelho('Panela Tramontina 24cm', 'Panela Tramontina 24cm Com Tampa De Vidro'), false);
  /* original que ja e peca: a regra nao se aplica */
  assert.equal(pecaNoLugarDoAparelho('Refil Purificador Electrolux', 'Refil Para Purificador Electrolux Pe11b'), false);
  assert.equal(pecaNoLugarDoAparelho('Purificador Electrolux Pe11b', 'Refil Para Purificador Electrolux Pe11b'), true);
});

test('parecido so por marca/modelo (03/10, M-Vave x Akai)', async () => {
  const { soMarcaEModelo } = await import('../comparador.js');
  assert.equal(soMarcaEModelo('Marca: Akai Professional -> M-vave; Modelo: MPK Mini MK3 -> SMK-25', 70), true);
  assert.equal(soMarcaEModelo('Marca: Akai -> X; Quantidade de teclas: 25 -> 49', 70), false);
  assert.equal(soMarcaEModelo('Marca: Akai -> X', 40), false);
  assert.equal(soMarcaEModelo('', 90), false);
});

test('sugeridos extras sem repetir marca (03/10, pedido 613)', async () => {
  const { sugeridosExtras } = await import('../comparador.js');
  const P = (t, preco, muda) => ({ titulo: t, preco, muda, sugerido: true });
  const top = [P('Kfx', 404.99, 'Marca: Akai -> Kfx'), P('AMW 530', 530.99, 'Marca: Akai -> AMW')];
  const ordem = [...top, P('AMW 321', 321.45, 'Marca: Akai -> AMW'), P('AMW 326', 326.28, 'Marca: Akai Professional -> AMW'),
    P('M-Vave', 382.1, 'Marca: Akai Professional -> M-vave; Modelo: MPK -> SMK-25'), P('Caro', 700, 'Marca: Akai -> X')];
  const r = sugeridosExtras(ordem, top, 568);
  assert.deepEqual(r.map(x => x.titulo), ['M-Vave']);
});

test('cartao sem foto pega a foto nos dados da pagina (pedido 619)', async () => {
  const { ofertasDaBusca } = await import('../comparador.js');
  const cartao = '<li class="ui-search-layout__item"><div class="poly-card"><img src="data:image/gif;base64,R0lGOD">'
    + '<h3><a class="poly-component__title" href="https://produto.mercadolivre.com.br/MLB-5555555555-teclado">'
    + 'Teclado Midi M-vave Smk-25 De 25 Teclas Bluetooth</a></h3><span class="andes-money-amount__fraction">382</span></div></li>';
  const dados = '<script>{"polycard":{"metadata":{"id":"MLB5555555555","url":"x"},"pictures":{"pictures":[{"id":"812345-MLA79394039934_092024"}]},'
    + '"title":{"text":"Teclado Midi M-vave Smk-25"},"current_price":{"value":382.1}}}</script>';
  const diag = {};
  const r = ofertasDaBusca(cartao + dados, 'Teclado Midi M-vave Smk-25 De 25 Teclas', 400, diag);
  assert.equal(r.length, 1);
  assert.equal(r[0].imagem, 'https://http2.mlstatic.com/D_NQ_NP_812345-MLA79394039934_092024-O.webp');
  assert.equal(diag.semFoto, 1);
  assert.equal(diag.fotoPelosDados, 1);
});
