/* Cupons Afiliado ML - content script (v1.1, progressivo)

   Mudancas de velocidade:
     - marca os anuncios em blocos, na ordem de quem esta mais perto do topo
       da tela, entao a primeira tela acende em 1 ou 2 segundos
     - passa a URL canonica do card para o worker (sem redirecionamento)
     - barra de status com contador vivo, da para acompanhar e parar
*/

(() => {
  'use strict';

  const LOTE = 14;

  const brl = n => Number(n || 0).toLocaleString('pt-BR',
    { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  const dataBR = iso => { const d = new Date(iso); return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR'); };

  const pedir = msg => new Promise(res => {
    try { chrome.runtime.sendMessage(msg, r => res(r || { ok: false, erro: 'sem resposta' })); }
    catch (e) { res({ ok: false, erro: String(e.message || e) }); }
  });

  let cancelado = false;

  /* -------------------------------------------------------------- status */

  function barra() {
    let b = document.getElementById('caml-barra');
    if (!b) {
      b = document.createElement('div');
      b.id = 'caml-barra';
      b.className = 'caml-barra';
      b.innerHTML = '<span class="caml-txt"></span><button class="caml-stop">parar</button>';
      document.body.appendChild(b);
      b.querySelector('.caml-stop').addEventListener('click', () => {
        cancelado = true;
        b.querySelector('.caml-txt').textContent = 'Cupons: parado';
      });
    }
    return b;
  }

  function status(texto, estado, mostrarStop) {
    const b = barra();
    b.querySelector('.caml-txt').textContent = texto;
    b.dataset.estado = estado || '';
    b.querySelector('.caml-stop').style.display = mostrarStop ? '' : 'none';
  }

  /* ------------------------------------------------------ pagina produto */

  function nomeVendedor() {
    const t = document.body.innerText || '';
    const m = /Vendido por\s+([^\n]{2,60})/i.exec(t);
    if (m) return m[1].split('  ')[0].trim();
    const a = document.querySelector('a[href*="/pagina/"], a[href*="/perfil/"]');
    if (a) { try { return decodeURIComponent(new URL(a.href).pathname.split('/').filter(Boolean).pop()); } catch { } }
    return null;
  }

  async function marcarProduto() {
    if (document.getElementById('caml-selo')) return;
    const nome = nomeVendedor();
    if (!nome) return;
    const r = await pedir({ tipo: 'vendedor', nome });
    if (!r.ok) return;

    const selo = document.createElement('div');
    selo.id = 'caml-selo';
    selo.className = 'caml-selo ' + (r.cupom ? 'caml-sim' : 'caml-nao');
    selo.innerHTML = r.cupom
      ? `<b>CUPOM DISPONIVEL</b> ${r.cupom.titulo}
         <span>${r.cupom.vendedor} &middot; orcamento ${brl(r.cupom.orcamento)} &middot; vence ${dataBR(r.cupom.vence)}</span>
         <a href="https://www.mercadolivre.com.br/afiliados/coupons#hub" target="_blank">gerar codigo</a>`
      : `<b>SEM CUPOM DE AFILIADO</b>
         <span>${nome} nao tem campanha ativa. A comissao do link continua valendo.</span>`;
    document.body.appendChild(selo);
    setTimeout(() => selo.classList.add('caml-min'), 9000);
    selo.addEventListener('click', () => selo.classList.toggle('caml-min'));
  }

  /* -------------------------------------------------------- pagina busca */

  function cartoes() {
    const lista = [];
    const vistos = new Set();
    document.querySelectorAll('li.ui-search-layout__item, div.ui-search-result__wrapper').forEach(c => {
      if (c.dataset.camlOk) return;
      const a = c.querySelector('a[href*="MLB"]');
      if (!a) return;
      const m = /MLB-?\d+/.exec(a.href);
      if (!m) return;
      const id = m[0].replace('-', '');
      if (vistos.has(id)) return;
      vistos.add(id);
      lista.push({ el: c, id, url: a.href, y: c.getBoundingClientRect().top });
    });
    // quem esta mais perto do topo da tela primeiro
    return lista.sort((a, b) => Math.abs(a.y) - Math.abs(b.y));
  }

  function pintar(item, res) {
    item.el.dataset.camlOk = '1';
    if (res && res.cupom) {
      item.el.classList.add('caml-hit');
      const tag = document.createElement('div');
      tag.className = 'caml-tag';
      tag.innerHTML = `<b>${res.cupom.titulo}</b> cupom &middot; ${res.cupom.vendedor}
        <span>orcamento ${brl(res.cupom.orcamento)} &middot; vence ${dataBR(res.cupom.vence)}</span>`;
      item.el.prepend(tag);
      return true;
    }
    item.el.classList.add('caml-miss');
    return false;
  }

  let rodando = false;

  /* PAGINA QUE JA E DE CUPOM NAO PRECISA DESTE AVISO.

     O Weslei mandou o print: o cliente clica num cupom no site, cai na lista de
     produtos daquele cupom e o balao da extensao anuncia "nenhum dos 1 anuncios
     tem cupom". A pessoa acabou de chegar ali POR CAUSA do cupom. O aviso
     contradiz o proprio site e queima a confianca na hora.

     Por que dava isso: a varredura pergunta "este vendedor tem cupom no meu
     indice?" olhando o nome do vendedor no cartao. Numa pagina de campanha
     (_Container_) o cartao nem sempre traz o vendedor, entao a resposta vinha
     vazia. Ausencia de resposta nao e prova de ausencia de cupom.

     Nestes enderecos o cupom e um fato dado, entao o balao nao opina sobre ele.
     Continua marcando os cartoes que casam com outros cupons do indice, que e
     informacao nova e util, mas nao anuncia "nao tem cupom". */
  function paginaDeCupom() {
    const u = location.href;
    return /_Container_|_CustId_|\/pagina\/|coupon_campaign_id/i.test(u);
  }

  async function varrer() {
    if (rodando) return;
    const fila = cartoes();
    if (!fila.length) return;

    rodando = true;
    cancelado = false;
    const t0 = performance.now();
    let feitos = 0, achados = 0;

    status(`Cupons: 0 de ${fila.length}...`, 'carregando', true);

    for (let i = 0; i < fila.length; i += LOTE) {
      if (cancelado) break;
      const lote = fila.slice(i, i + LOTE);
      const r = await pedir({ tipo: 'itens', itens: lote.map(x => ({ id: x.id, url: x.url })) });
      if (!r.ok) { status('Cupons: erro - ' + r.erro, 'erro', false); rodando = false; return; }

      lote.forEach(item => { if (pintar(item, r.resultado[item.id])) achados++; });
      feitos += lote.length;
      status(`Cupons: ${feitos} de ${fila.length} checados, ${achados} com cupom`, 'carregando', true);
    }

    const seg = ((performance.now() - t0) / 1000).toFixed(1);
    if (achados) {
      status(`Cupons: ${achados} de ${feitos} anuncios tem cupom (${seg}s)`, 'ok', false);
    } else if (paginaDeCupom()) {
      /* Aqui o cupom da pagina ja vale. So nao achei OUTRO cupom alem dele. */
      status('Cupons: o cupom desta pagina vale nos itens acima', 'ok', false);
    } else {
      status(`Cupons: nenhum dos ${feitos} anuncios tem cupom (${seg}s)`, 'vazio', false);
    }
    rodando = false;
  }

  /* ------------------------------------------------------------- inicio */

  function iniciar() {
    pedir({ tipo: 'aquecer' });

    if (document.querySelector('li.ui-search-layout__item, div.ui-search-result__wrapper')) {
      varrer();
      let t;
      new MutationObserver(() => {
        clearTimeout(t);
        t = setTimeout(() => { if (!rodando && cartoes().length) varrer(); }, 700);
      }).observe(document.body, { childList: true, subtree: true });
    } else if (/Vendido por/i.test(document.body.innerText || '')) {
      marcarProduto();
    }
  }

  if (document.readyState === 'complete') iniciar();
  else window.addEventListener('load', () => setTimeout(iniciar, 900));
})();
