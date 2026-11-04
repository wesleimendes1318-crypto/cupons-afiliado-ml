import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { globalThis: {} };
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../escolha-pagina.js', import.meta.url), 'utf8'), ctx);
const { pontuar, decidir } = ctx.__meEscolha;
const escolha = (els, alvo) => decidir(pontuar(els, alvo));

test('clica no nome exato da lista, nao na que so contem o nome', () => {
  const els = [
    { texto: 'Casa organizada e bonita' },
    { texto: 'Casa organizada' },
    { texto: 'Beleza' }
  ];
  const d = escolha(els, { padroes: ['^Casa organizada$'] });
  assert.equal(d.decisao, 'clicar');
  assert.equal(d.indice, 1);
});

test('dois botoes diferentes com a mesma nota = ambiguo, nao clica', () => {
  const d = escolha([{ texto: 'Salvar' }, { texto: 'Salvar rascunho' }], { padroes: ['salvar'] });
  assert.equal(d.decisao, 'ambiguo');
});

test('mesmo botao repetido (PC e celular) nao e empate: pega o primeiro', () => {
  const d = escolha([{ texto: 'Criar lista' }, { texto: 'Criar lista' }], { padroes: ['criar lista'] });
  assert.equal(d.decisao, 'clicar');
  assert.equal(d.indice, 0);
});

test('preferencia pela ordem: o 1o padrao vence o 2o', () => {
  const d = escolha([{ texto: 'Confirmar' }, { texto: 'Salvar' }], { padroes: ['^salvar$', '^confirmar$'] });
  assert.equal(d.indice, 1);
});

test('botao coberto ou desligado nunca e escolhido', () => {
  const d = escolha([{ texto: 'Remover', coberto: true }, { texto: 'Remover', desligado: true }], { padroes: ['^remover'] });
  assert.equal(d.decisao, 'nenhum');
});

test('so dialogo: ignora o botao igual fora do dialogo aberto', () => {
  const d = escolha([{ texto: 'Pública' }, { texto: 'Pública', emDialogo: true }], { padroes: ['^p[uú]blica'], soDialogo: true });
  assert.equal(d.indice, 1);
});

test('rotulo (aria-label) tambem conta quando o botao so tem icone', () => {
  const d = escolha([{ texto: '', rotulo: 'Adicionar a uma lista' }], { padroes: ['adicionar (a|em) (uma )?lista'] });
  assert.equal(d.decisao, 'clicar');
});
