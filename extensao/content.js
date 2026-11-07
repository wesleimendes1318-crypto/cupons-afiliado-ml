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

  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SITE = 'https://melhorescolha.io/?link=';

  /* Floating glass island (1.181.0). Only facts already known here: the
     seller's coupon from the local index. No price verdict on its own: that
     would read other stores on every product page opened and risk his ML
     account; "Comparar ofertas" sends the product to the site instead. */
  async function marcarProduto() {
    if (document.getElementById('caml-selo')) return;
    const { seloAtivo } = await chrome.storage.local.get('seloAtivo').catch(() => ({}));
    if (seloAtivo === false) return;
    const nome = nomeVendedor();
    if (!nome) return;
    const r = await pedir({ tipo: 'vendedor', nome });
    if (!r.ok) return;

    const c = r.cupom;
    const selo = document.createElement('div');
    selo.id = 'caml-selo';
    selo.className = 'me-flutuante';
    selo.setAttribute('role', 'complementary');
    selo.setAttribute('aria-label', 'Melhor Escolha');
    selo.innerHTML = `
      <div class="me-topo">
        <button class="me-marca" type="button" data-a="abrir"><span class="me-ponto ${c ? 'ok' : ''}"></span>Melhor Escolha</button>
        <button class="me-icone" type="button" data-a="min" aria-label="Minimizar" title="Minimizar">–</button>
      </div>
      <div class="me-corpo">
        ${c
          ? `<span class="me-badge verde">Cupom de ${esc(c.titulo)} nesta loja</span>
             <div class="me-sub">${esc(c.vendedor)} · orçamento ${brl(c.orcamento)} · vence ${dataBR(c.vence)}
               · <a href="https://www.mercadolivre.com.br/afiliados/coupons#hub" target="_blank" rel="noopener">gerar código</a></div>`
          : `<span class="me-badge neutro">Sem cupom de afiliado nesta loja</span>
             <div class="me-sub">${esc(nome)} não tem campanha ativa. A comissão do link continua valendo.</div>`}
        <div class="me-acoes">
          <button class="me-bt pri" type="button" data-a="comparar">Comparar ofertas</button>
          <button class="me-bt sec" type="button" data-a="acompanhar">Acompanhar preço</button>
          <button class="me-bt sec me-copiar" type="button" data-a="copiar" aria-label="Copiar link de afiliado (meli.la)" title="Copiar link de afiliado (meli.la)">⧉</button>
        </div>
        <input class="me-link" type="text" readonly hidden aria-label="Seu link de afiliado">
        <div class="me-sub me-aviso" hidden></div>
      </div>`;
    document.body.appendChild(selo);

    const minimizar = sim => selo.classList.toggle('me-min', sim);
    let base = scrollY;
    addEventListener('scroll', () => {
      if (!selo.classList.contains('me-min') && scrollY - base > 320) minimizar(true);
    }, { passive: true });

    selo.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const acao = a.dataset.a;
      if (acao === 'min') { minimizar(true); return; }
      if (acao === 'abrir') { if (selo.classList.contains('me-min')) { base = scrollY; minimizar(false); } return; }
      if (acao === 'comparar' || acao === 'acompanhar') { window.open(SITE + encodeURIComponent(location.href), '_blank', 'noopener'); return; }
      if (acao === 'copiar') {
        const campo = selo.querySelector('.me-link');
        const aviso = selo.querySelector('.me-aviso');
        a.disabled = true; a.textContent = '…'; aviso.hidden = true;
        /* linkDe = his ML generator (meli.la), with the search-page guard. */
        const g = await pedir({ tipo: 'linkDe', url: location.href });
        a.disabled = false;
        if (!g.ok || !g.link) {
          a.textContent = '⧉';
          aviso.hidden = false;
          aviso.textContent = 'Não gerei o link agora: ' + String(g.erro || 'sem resposta').slice(0, 140);
          return;
        }
        campo.hidden = false; campo.value = g.link;
        try { await navigator.clipboard.writeText(g.link); a.textContent = '✓'; a.classList.add('feito'); }
        catch (err) { campo.select(); a.textContent = '⧉'; aviso.hidden = false; aviso.textContent = 'Link pronto: use Ctrl+C para copiar.'; }
        setTimeout(() => { a.textContent = '⧉'; a.classList.remove('feito'); }, 1800);
      }
    });
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
