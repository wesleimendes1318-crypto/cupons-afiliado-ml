import test from 'node:test';
import assert from 'node:assert/strict';
import { lerResumoDoPainel, juntarLeituras, deveRodarSozinha } from '../espelho.js';

test('le valores na linha seguinte e com R$ quebrado', () => {
  const r = lerResumoDoPainel([
    'Resumo do mês', 'Ganhos totais', 'R$', '1.234', ',', '56',
    'Cliques', '3.210', 'Itens pedidos', '87'
  ]);
  assert.equal(r.comissao_centavos, 123456);
  assert.equal(r.cliques, 3210);
  assert.equal(r.pedidos, 87);
});

test('hub do ML (lido em 06/11): EXTRAS 18% R$ 349 nao e ganho', () => {
  const r = lerResumoDoPainel(['Cliques', '0', 'Pedidos', '0', 'Ganho estimado', 'R$ 0', 'GANHOS', 'EXTRAS', '18%', 'R$ 349']);
  assert.equal(r.comissao_centavos, 0);
  assert.equal(r.cliques, 0);
  assert.equal(r.pedidos, 0);
});

test('Amazon (lido em 06/11): ponto decimal e eixo do grafico', () => {
  const r = lerResumoDoPainel(['Cliques', '06Oct', '09', '12', 'Visão geral dos Ganhos (nos últimos 30 dias)',
    'Total de comissões', 'R$0.41', 'Total de produtos pedidos: 0']);
  assert.equal(r.comissao_centavos, 41);
  assert.equal(r.cliques, null);
  assert.equal(r.pedidos, 0);
});

test('aprovada, pendente, faturamento e conversao', () => {
  const r = lerResumoDoPainel(['Ganhos disponíveis', 'R$ 120,50', 'Ganhos pendentes', 'R$ 30,00',
    'Valor das vendas', 'R$ 2.500,00', 'Taxa de conversão', '3,4%']);
  assert.equal(r.aprovada_centavos, 12050);
  assert.equal(r.pendente_centavos, 3000);
  assert.equal(r.faturamento_centavos, 250000);
  assert.equal(r.conversao_pct, 3.4);
});

test('sem numero nao chuta; juntar so preenche o que faltou', () => {
  const r = lerResumoDoPainel(['Ganhos', 'Cliques', '—']);
  assert.equal(r.comissao_centavos, null);
  assert.equal(r.cliques, null);
  const j = juntarLeituras({ cliques: 5, pedidos: null, achados: [] }, { cliques: 9, pedidos: 2, achados: [] });
  assert.equal(j.cliques, 5);
  assert.equal(j.pedidos, 2);
});

test('rodada automatica a cada 12 h', () => {
  assert.equal(deveRodarSozinha(null), true);
  assert.equal(deveRodarSozinha(Date.now() - 3600e3), false);
  assert.equal(deveRodarSozinha(Date.now() - 13 * 3600e3), true);
});
