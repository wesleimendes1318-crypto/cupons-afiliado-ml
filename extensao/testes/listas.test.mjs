import assert from 'node:assert/strict';
import test from 'node:test';

import { listasDoJson, listasDoDom, casarListas, itensDoTexto, modeloDaRequisicao, montarRequisicao,
         modeloServe, escolherCapturada, idDaResposta, normalizarNome } from '../listas.js';

test('listas no JSON da pagina: id, nome, quantidade e privacidade', () => {
  const estado = { page: { lists: [
    { id: 'abc1', name: 'Minhas recomendações', items_count: 300, privacy: 'PUBLIC' },
    { id: 'abc2', name: 'produtos de beleza', items_count: 5, privacy: 'private' },
    { id: 7, title: 'Sem sinal de lista' }
  ] } };
  assert.deepEqual(listasDoJson(estado), [
    { id: 'abc1', nome: 'Minhas recomendações', qtd: 300, publica: true },
    { id: 'abc2', nome: 'produtos de beleza', qtd: 5, publica: false }
  ]);
});

test('listas pelos links: nome, quantidade e Publica/Privada', () => {
  const l = listasDoDom([
    { href: 'https://myaccount.mercadolivre.com.br/bookmarks/list/XyZ9?x=1', texto: 'Casa organizada\n12 produtos\nPública' },
    { href: 'https://myaccount.mercadolivre.com.br/bookmarks/list?tab=list', texto: 'Listas' }
  ]);
  assert.equal(l.length, 1);
  assert.equal(l[0].id, 'XyZ9');
  assert.equal(l[0].nome, 'Casa organizada');
  assert.equal(l[0].qtd, 12);
  assert.equal(l[0].publica, true);
});

test('casar so por id gravado ou nome igual (sem acento), nunca por parecido', () => {
  const ml = [{ id: 'A', nome: 'Achadinhos ate R$ 100' }, { id: 'B', nome: 'Casa' }];
  const c = casarListas([
    { slug: 'achadinhos-ate-100', nome: 'Achadinhos até R$ 100' },
    { slug: 'casa-organizada', nome: 'Casa organizada' },
    { slug: 'x', nome: 'Outra', ml_lista_id: 'B' }
  ], ml);
  assert.equal(c[0].ml.id, 'A');
  assert.equal(c[1].ml, null);
  assert.equal(c[2].ml.id, 'B');
  assert.equal(normalizarNome('Cozinha  Inteligente & Eletro'), 'cozinha inteligente eletro');
});

test('itens: codigo do anuncio sim, produto de catalogo sem item_id nao', () => {
  const t = 'https://produto.mercadolivre.com.br/MLB-1234567890-air-fryer _JM '
    + 'https://www.mercadolivre.com.br/x/p/MLB19876543 '
    + 'https://www.mercadolivre.com.br/y/p/MLB222?pdp_filters=item_id%3AMLB5555555555 '
    + '{"item_id":"MLB7777777777"}';
  assert.deepEqual(itensDoTexto(t).sort(), ['MLB1234567890', 'MLB5555555555', 'MLB7777777777']);
});

test('modelo do pedido: troca nome/produto/lista por marcadores e tira cookie', () => {
  const req = {
    url: 'https://myaccount.mercadolivre.com.br/bookmarks/api/lists/L42/items',
    metodo: 'POST', corpo: '{"item_id":"MLB1234567890"}',
    cabecalhos: { 'content-type': 'application/json', cookie: 'segredo', 'x-csrf-token': 't' }
  };
  const m = modeloDaRequisicao(req, { LISTA: 'L42', ITEM: 'MLB1234567890', ITEM_NUM: '1234567890' });
  assert.equal(m.url, 'https://myaccount.mercadolivre.com.br/bookmarks/api/lists/{{LISTA}}/items');
  assert.equal(m.corpo, '{"item_id":"{{ITEM}}"}');
  assert.equal(m.cabecalhos.cookie, undefined);
  assert.equal(m.cabecalhos['x-csrf-token'], 't');
  assert.ok(modeloServe('adicionar', m));
  const r = montarRequisicao(m, { LISTA: 'L9', ITEM: 'MLB111111111', ITEM_NUM: '111111111' });
  assert.equal(r.url, 'https://myaccount.mercadolivre.com.br/bookmarks/api/lists/L9/items');
  assert.equal(r.corpo, '{"item_id":"MLB111111111"}');
});

test('pedido sem nenhum valor conhecido nao vira modelo; GET nunca', () => {
  assert.equal(modeloDaRequisicao({ url: 'https://x/track', metodo: 'POST', corpo: '{}' }, { NOME: 'Casa organizada' }), null);
  assert.equal(modeloDaRequisicao({ url: 'https://x/Casa', metodo: 'GET' }, { NOME: 'Casa' }), null);
  assert.equal(modeloServe('criar', { usa: ['ITEM'] }), false);
  assert.equal(modeloServe('adicionar', { usa: ['ITEM'] }), false);
});

test('pedido escolhido: o que leva o valor e deu certo', () => {
  const caps = [
    { url: 'https://x/metrics', metodo: 'POST', corpo: 'Casa organizada', status: 204 },
    { url: 'https://x/bookmarks/lists', metodo: 'POST', corpo: '{"name":"Casa organizada"}', status: 201 },
    { url: 'https://x/bookmarks/lists', metodo: 'POST', corpo: '{"name":"Casa organizada"}', status: 500 }
  ];
  assert.equal(escolherCapturada(caps, 'Casa organizada').status, 201);
  assert.equal(idDaResposta('{"id":"L77","name":"Casa organizada"}', 'Casa organizada'), 'L77');
  assert.equal(idDaResposta('nao e json', 'x'), null);
});
