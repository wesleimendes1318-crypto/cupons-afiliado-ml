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

import { itensDasTabelas, maiorOpcao } from '../espelho.js';

test('vendas por produto: valor, %, direta/indireta, status e datas', () => {
  const itens = itensDasTabelas([{
    cab: ['Produto', 'Data da venda', 'Tipo de venda', 'Valor da venda', 'Comissão (%)', 'Comissão', 'Status', 'Liberação'],
    linhas: [
      ['Fone Bluetooth X', '05/11/2026', 'Venda direta', 'R$ 199,90', '8%', 'R$ 15,99', 'Pendente', '05/12/2026'],
      ['Capa de celular', '04/11/2026', 'Venda indireta', 'R$ 30,00', '4%', 'R$ 1,20', 'Liberado', '-'],
      ['', '', '', '', '', '', '', '']
    ]
  }], 'Métricas');
  assert.equal(itens.length, 2);
  assert.deepEqual(
    { ...itens[0], bruto: undefined },
    { produto: 'Fone Bluetooth X', valor_centavos: 19990, comissao_centavos: 1599, comissao_pct: 8, tipo: 'direta',
      status: 'Pendente', data: '05/11/2026', liberacao: '05/12/2026', quantidade: null, pagina: 'Métricas', bruto: undefined });
  assert.equal(itens[1].tipo, 'indireta');
  assert.equal(itens[0].bruto['Comissão (%)'], '8%');
});

test('receita (descricao no lugar do produto); tabela sem dinheiro nao entra', () => {
  const itens = itensDasTabelas([
    { cab: ['Data', 'Descrição', 'Valor a receber', 'Situação'], linhas: [['10/12/2026', 'Comissões de novembro', 'R$ 42,10', 'A liberar']] },
    { cab: ['Produto', 'Cliques'], linhas: [['Fone', '12']] }
  ]);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].produto, 'Comissões de novembro');
  assert.equal(itens[0].comissao_centavos, 4210);
  assert.equal(itens[0].status, 'A liberar');
});

test('maior opcao de itens por pagina', () => {
  assert.equal(maiorOpcao(['10', '25 itens', '50', '100 por página']), 100);
  assert.equal(maiorOpcao(['Todos', 'Mais vendidos']), null);
});

import { lerReceitaML } from '../espelho.js';

test('Minha receita do hub (print de 07/11)', () => {
  const r = lerReceitaML(['Minha receita', 'Saldo pendente', 'R$ 468,68', 'Ir para Métricas', 'Em revisão', 'R$ 192,24',
    'Em processo de pagamento', 'R$ 276,44', 'A pagar em 12/nov', 'R$ 276,45', 'Histórico da receita',
    'Outubro', 'Período atual', 'R$ 192,24', 'Em revisão até o fim de dezembro',
    'Maio a setembro', 'R$ 276,45', 'Em processo de pagamento']);
  assert.equal(r.saldo_pendente_centavos, 46868);
  assert.equal(r.em_revisao_centavos, 19224);
  assert.equal(r.em_pagamento_centavos, 27644);
  assert.deepEqual(r.a_pagar, [{ data: '12/nov', centavos: 27645 }]);
  assert.deepEqual(r.historico, [
    { periodo: 'Outubro', atual: true, status: 'Em revisão até o fim de dezembro', centavos: 19224 },
    { periodo: 'Maio a setembro', atual: false, status: 'Em processo de pagamento', centavos: 27645 }
  ]);
});

test('Minha receita com valor na mesma linha', () => {
  const r = lerReceitaML(['Saldo pendente R$ 10,00', 'A pagar em 12/nov R$ 5,00']);
  assert.equal(r.saldo_pendente_centavos, 1000);
  assert.deepEqual(r.a_pagar, [{ data: '12/nov', centavos: 500 }]);
});

test('Minha receita no PC (lido em 07/11 13:49): valor quebrado e Processando', () => {
  const r = lerReceitaML(['Saldo pendente', 'R$', '468', ',', '68', 'Ir para Métricas', 'Em revisão R$192,24', 'Processando R$276,44',
    'Histórico da receita', 'Outubro Período atual Em revisão até o fim de dezembro R$ 192 , 24',
    'Maio a setembro Em processo de pagamento R$ 276 , 45']);
  assert.equal(r.saldo_pendente_centavos, 46868);
  assert.equal(r.em_revisao_centavos, 19224);
  assert.equal(r.em_pagamento_centavos, 27644);
  assert.deepEqual(r.historico, [
    { periodo: 'Outubro', atual: true, status: 'Em revisão até o fim de dezembro', centavos: 19224 },
    { periodo: 'Maio a setembro', atual: false, status: 'Em processo de pagamento', centavos: 27645 }
  ]);
});
