import test from 'node:test';
import assert from 'node:assert/strict';
import { lojaDaAba, urlComparacaoNoSite, tituloLimpo } from '../aba-atual.js';

test('Mercado Livre: product yes, search page never', () => {
  assert.deepEqual(lojaDaAba('https://www.mercadolivre.com.br/fone-qcy/p/MLB123456?pdp_filters=x'),
    { loja: 'mercadolivre', produto: true, busca: false });
  assert.equal(lojaDaAba('https://produto.mercadolivre.com.br/MLB-3456789-fone-_JM').produto, true);
  const busca = lojaDaAba('https://lista.mercadolivre.com.br/qcy-t29-ailybuds-lite');
  assert.equal(busca.produto, false);
  assert.equal(busca.busca, true);
  assert.equal(lojaDaAba('https://www.mercadolivre.com.br/ofertas').produto, false);
});

test('Amazon: link always carries his tag, never naked', () => {
  const a = lojaDaAba('https://www.amazon.com.br/Echo-Dot/dp/B09B8XJDW5/ref=sr_1_1?tag=outro-20');
  assert.equal(a.produto, true);
  assert.equal(a.linkPronto, 'https://www.amazon.com.br/dp/B09B8XJDW5?tag=melhoresc0fff-20');
  assert.equal(lojaDaAba('https://www.amazon.com.br/s?k=echo').produto, false);
});

test('Shopee: product by -i.shop.item, search is not', () => {
  assert.equal(lojaDaAba('https://shopee.com.br/Fone-i.123456.987654321').produto, true);
  assert.equal(lojaDaAba('https://shopee.com.br/search?keyword=fone').produto, false);
});

test('other sites and junk are not stores', () => {
  assert.equal(lojaDaAba('https://melhorescolha.io/'), null);
  assert.equal(lojaDaAba('chrome://extensions'), null);
  assert.equal(lojaDaAba(''), null);
  assert.equal(lojaDaAba('https://amazon.com.br.golpe.com/dp/B09B8XJDW5'), null);
});

test('site comparison and clean title', () => {
  assert.equal(urlComparacaoNoSite('https://x.com/a?b=1'), 'https://melhorescolha.io/?link=https%3A%2F%2Fx.com%2Fa%3Fb%3D1');
  assert.equal(tituloLimpo('Fone Qcy T29 | Mercado Livre'), 'Fone Qcy T29');
  assert.equal(tituloLimpo('Amazon.com.br : Echo Dot 5'), 'Echo Dot 5');
});

test('right-click viral finds: selection, link and page', async () => {
  const { urlGarimpoNoSite } = await import('../aba-atual.js');
  const q = u => new URL(u).searchParams;
  assert.equal(q(urlGarimpoNoSite({ selectionText: ' Pratos  de torrada ', pageUrl: 'https://www.facebook.com/' })).get('link'), 'Pratos de torrada');
  const l = q(urlGarimpoNoSite({ linkUrl: 'https://l.facebook.com/l.php?u=x', pageUrl: 'https://www.facebook.com/', titulo: 'Facebook' }));
  assert.equal(l.get('link'), 'https://l.facebook.com/l.php?u=x');
  assert.equal(l.get('title'), null);
  const p = q(urlGarimpoNoSite({ pageUrl: 'https://www.temu.com/br/x-g-601.html', titulo: 'Conjunto de Louça Limão - Temu' }));
  assert.equal(p.get('title'), 'Conjunto de Louça Limão - Temu');
  assert.equal(p.get('link'), 'https://www.temu.com/br/x-g-601.html');
  assert.equal(urlGarimpoNoSite({ pageUrl: 'chrome://extensions' }), null);
});
