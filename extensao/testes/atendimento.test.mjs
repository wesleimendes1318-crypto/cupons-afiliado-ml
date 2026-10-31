/* node --test extensao/testes/atendimento.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverEncurtado } from '../atendimento.js';

const comFetch = (final, fn) => async () => {
  const antes = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (url, opts) => { chamadas.push(opts); return { url: final }; };
  try { await fn(chamadas); } finally { globalThis.fetch = antes; }
};

test('meli.la de terceiro vira o produto limpo, sem cookie', comFetch(
  'https://produto.mercadolivre.com.br/MLB-123456789-fone-_JM?matt_tool=99&matt_word=fulano#reco',
  async (chamadas) => {
    const u = await resolverEncurtado('https://meli.la/2abcXYZ');
    assert.equal(u, 'https://produto.mercadolivre.com.br/MLB-123456789-fone-_JM');
    assert.equal(chamadas[0].credentials, 'omit');
  }));

test('/sec/ de terceiro tambem e resolvido', comFetch(
  'https://www.mercadolivre.com.br/fone/p/MLB123456?pdp_filters=item_id%3AMLB987654&matt_word=fulano',
  async () => {
    const u = await resolverEncurtado('https://mercadolivre.com.br/sec/1aBcD2e');
    assert.equal(u, 'https://www.mercadolivre.com.br/fone/p/MLB123456?pdp_filters=item_id%3AMLB987654');
  }));

test('encurtado que nao abre nunca e gerado em cima', comFetch(
  'https://meli.la/2abcXYZ',
  async () => { await assert.rejects(resolverEncurtado('https://meli.la/2abcXYZ')); }));

test('endereco de produto passa direto, sem rede', comFetch('x', async (chamadas) => {
  const u = 'https://produto.mercadolivre.com.br/MLB-1-x';
  assert.equal(await resolverEncurtado(u), u);
  assert.equal(chamadas.length, 0);
}));
