import test from 'node:test';
import assert from 'node:assert/strict';
import { lerResumoDoPainel, deveRodarSozinha } from '../espelho.js';

test('le valores na linha seguinte e com R$ quebrado', () => {
  const r = lerResumoDoPainel([
    'Resumo do mês', 'Ganhos totais', 'R$', '1.234', ',', '56',
    'Cliques', '3.210', 'Itens pedidos', '87'
  ]);
  assert.equal(r.comissao_centavos, 123456);
  assert.equal(r.cliques, 3210);
  assert.equal(r.pedidos, 87);
  assert.equal(r.achados.length, 3);
});

test('valor na mesma linha e taxa % nao vira comissao', () => {
  const r = lerResumoDoPainel(['Ganhos 10%', 'Comissão estimada R$ 45,9', 'Pedidos: 3']);
  assert.equal(r.comissao_centavos, 4590);
  assert.equal(r.pedidos, 3);
  assert.equal(r.cliques, null);
});

test('sem numero nao chuta e nao atravessa outro rotulo', () => {
  const r = lerResumoDoPainel(['Ganhos', 'Cliques', '—']);
  assert.equal(r.comissao_centavos, null);
  assert.equal(r.cliques, null);
  assert.deepEqual(r.achados, []);
});

test('rodada automatica a cada 12 h', () => {
  assert.equal(deveRodarSozinha(null), true);
  assert.equal(deveRodarSozinha(Date.now() - 3600e3), false);
  assert.equal(deveRodarSozinha(Date.now() - 13 * 3600e3), true);
});
