/* On-page collector for the Mercado Livre Affiliate Hub (1.185.0, 07/11/2026).
   Weslei: harvest hundreds of hub recommendations without manual friction.
   Dock on /afiliados/hub: human-paced auto scroll (450-800 ms + longer
   breaks), stops at once on any security check or "Parar", quick filters,
   per-card checkbox, sends the marked items in batches of 100 to
   registrar_hub (extension token, via background). Commission % stays
   between this page (his own logged-in hub) and the private RPC.
   No scraped text goes through innerHTML. */
(() => {
  'use strict';
  const L = globalThis.meHubLeitura;
  if (!L || window.top !== window) return;

  const pedir = msg => new Promise(res => {
    try { chrome.runtime.sendMessage(msg, r => res(r || { ok: false, erro: 'sem resposta' })); }
    catch (e) { res({ ok: false, erro: String(e.message || e) }); }
  });
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const acaso = (a, b) => a + Math.random() * (b - a);

  const dados = new Map();        // item -> { info, card }
  const marcados = new Set();
  let rolando = false;
  let enviando = false;

  function emDesafio() {
    if (/account-verification|\/gz\/|captcha|challenge/i.test(location.href)) return true;
    if (document.querySelector('iframe[src*="captcha" i], iframe[src*="challenge" i], #captcha, [class*="captcha" i]')) return true;
    return /Por seguran[cç]a, complete esta etapa|confirme que voc[eê] n[aã]o [eé] um rob[oô]/i.test(document.body.innerText.slice(0, 4000));
  }

  /* ---------------------------------------------------------------- dock */
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const bt = (cls, txt) => { const b = el('button', cls, txt); b.type = 'button'; return b; };

  let dock, cont, btRolar, btEnviar, prog, barra, txt;
  function montarDock() {
    dock = el('div', 'me-hub-dock');
    dock.id = 'me-hub-dock';
    dock.setAttribute('role', 'complementary');
    dock.setAttribute('aria-label', 'Coletor do Hub');
    const topo = el('div', 'me-hub-topo');
    const marca = el('div', 'me-hub-marca');
    marca.append(el('span', 'me-hub-dot'), el('b', null, 'Coletor do Hub'));
    cont = el('span', 'me-hub-contador');
    cont.setAttribute('aria-live', 'polite');
    topo.append(marca, cont);

    const filtros = el('div', 'me-hub-filtros');
    const filtro = (nome, teste) => {
      const b = bt('me-hub-tag', nome);
      b.addEventListener('click', () => marcarSe(teste));
      filtros.append(b);
    };
    filtro('Todos', () => true);
    filtro('Ganhos ≥ 10%', i => (i.comissao_pct || 0) >= 10);
    filtro('Mais vendidos', i => i.mais_vendido);
    filtro('Com desconto', i => (i.desconto_pct || 0) > 0);
    const limpar = bt('me-hub-tag', 'Limpar');
    limpar.addEventListener('click', () => marcarSe(() => false));
    filtros.append(limpar);

    const acoes = el('div', 'me-hub-acoes');
    btRolar = bt('me-hub-bt sec', 'Carregar +100');
    btEnviar = bt('me-hub-bt pri', 'Enviar para o site');
    btEnviar.disabled = true;
    acoes.append(btRolar, btEnviar);

    prog = el('div', 'me-hub-progresso');
    prog.hidden = true;
    const trilho = el('div', 'me-hub-prog-trilho');
    barra = el('div', 'me-hub-prog-barra');
    trilho.append(barra);
    txt = el('span', 'me-hub-prog-txt');
    txt.setAttribute('aria-live', 'polite');
    prog.append(trilho, txt);

    dock.append(topo, filtros, acoes, prog);
    document.body.appendChild(dock);
    btRolar.addEventListener('click', () => (rolando ? parar('Rolagem parada.') : rolar()));
    btEnviar.addEventListener('click', enviar);
  }

  function aviso(msg, pct) {
    prog.hidden = false;
    txt.textContent = msg;
    if (pct != null) barra.style.width = pct + '%';
  }

  function atualizar() {
    // Only write on change: every write is a mutation the observer sees.
    const c = `${dados.size} encontrados · ${marcados.size} marcados`;
    const e = marcados.size ? `Enviar ${marcados.size} produtos` : 'Enviar para o site';
    if (cont.textContent !== c) cont.textContent = c;
    if (btEnviar.textContent !== e) btEnviar.textContent = e;
    btEnviar.disabled = enviando || marcados.size === 0;
  }

  function marcar(item, sim) {
    const d = dados.get(item);
    if (!d) return;
    if (sim) marcados.add(item); else marcados.delete(item);
    d.card.classList.toggle('me-hub-card-selecionado', sim);
    d.chk.checked = sim;
  }
  function marcarSe(teste) {
    for (const [item, d] of dados) marcar(item, !!teste(d.info));
    atualizar();
  }

  /* ---------------------------------------------------------------- cards */
  function varrer() {
    let pos = dados.size;
    for (const a of document.querySelectorAll('a[href*="MLB"]')) {
      if (dock.contains(a)) continue;
      const item = L.itemDoLink(a.href);
      if (!item || dados.has(item)) continue;
      let card = a;
      for (let n = 0; n < 6 && card && !/R\$/.test(card.innerText || ''); n++) card = card.parentElement;
      if (!card || card === document.body || card.dataset.meHub) continue;
      const riscado = card.querySelector('s, del, [class*="previous"], [class*="original"]');
      const img = card.querySelector('img');
      const info = L.lerCartao({ href: a.href, texto: card.innerText, riscado: riscado && riscado.innerText, imagem: img && (img.currentSrc || img.src) });
      if (!info || info.preco == null) continue;   // price still rendering: next pass
      info.posicao = ++pos;
      card.dataset.meHub = item;

      const selo = el('label', 'me-hub-card-check');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.setAttribute('aria-label', 'Selecionar ' + (info.titulo || item));
      selo.append(chk, el('span', null, 'Selecionar'));
      // The card may sit inside the product link: never navigate on this tap.
      selo.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        marcar(item, !marcados.has(item)); atualizar();
      });
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.prepend(selo);
      dados.set(item, { info, card, chk });
    }
    atualizar();
  }

  /* --------------------------------------------------------------- scroll */
  function parar(msg) {
    rolando = false;
    btRolar.textContent = 'Carregar +100';
    btRolar.classList.remove('ativo');
    if (msg) aviso(msg);
  }

  async function rolar() {
    if (emDesafio()) { aviso('O Mercado Livre pediu uma verificação. Resolva na página e tente de novo.'); return; }
    rolando = true;
    btRolar.textContent = 'Parar';
    btRolar.classList.add('ativo');
    const meta = dados.size + 100;
    let parado = 0;
    for (let passo = 1; rolando && dados.size < meta && parado < 8; passo++) {
      const antes = dados.size;
      window.scrollBy({ top: window.innerHeight * acaso(0.8, 1.3), behavior: 'smooth' });
      await espera(acaso(450, 800));
      if (passo % 12 === 0) await espera(acaso(1500, 3200));   // reading break
      if (!rolando) break;
      if (emDesafio()) { parar('Parei: o Mercado Livre pediu uma verificação. Resolva na página antes de continuar.'); return; }
      // Some hub lists end in a "load more" button instead of infinite scroll.
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 40) {
        const mais = [...document.querySelectorAll('button, a[role="button"]')]
          .find(b => !dock.contains(b) && /^(ver|carregar|mostrar) mais/i.test((b.innerText || '').trim()));
        if (mais) { mais.click(); await espera(acaso(900, 1500)); }
      }
      varrer();
      parado = dados.size > antes ? 0 : parado + 1;
      aviso(`Rolando… ${dados.size} encontrados`, null);
    }
    if (rolando) parar(parado >= 8 ? `Fim da lista: ${dados.size} encontrados.` : `${dados.size} encontrados. Pode marcar e enviar.`);
  }

  /* ----------------------------------------------------------------- send */
  async function enviar() {
    if (enviando || !marcados.size) return;
    enviando = true; atualizar();
    const itens = [...marcados].map(i => {
      const { info, card } = dados.get(i);
      const img = card.querySelector('img');   // lazy images load after the scan
      return { ...info, imagem: info.imagem || (img && (img.currentSrc || img.src)) || null };
    });
    const lotes = L.fatiar(itens);
    let gravados = 0, fila = 0;
    for (let k = 0; k < lotes.length; k++) {
      aviso(`Enviando lote ${k + 1} de ${lotes.length}…`, Math.round((k / lotes.length) * 100));
      const r = await pedir({ tipo: 'registrarHubLote', itens: lotes[k] });
      if (!r.ok) {
        aviso(`Erro no lote ${k + 1}: ${String(r.erro || 'falha de conexão').slice(0, 120)}. Os anteriores já foram gravados; pode enviar de novo.`);
        enviando = false; atualizar();
        return;
      }
      gravados += (r.resposta && r.resposta.gravados) || 0;
      fila += (r.resposta && r.resposta.enfileirados) || 0;
      for (const x of lotes[k]) dados.get(x.item).card.classList.add('me-hub-card-enviado');
      if (k < lotes.length - 1) await espera(acaso(600, 1000));
    }
    aviso(`Pronto: ${gravados} produtos gravados, ${fila} links de afiliado na fila.`, 100);
    enviando = false; atualizar();
  }

  /* ---------------------------------------------------------------- start */
  function iniciar() {
    if (document.getElementById('me-hub-dock')) return;
    montarDock();
    varrer();
    let t;
    new MutationObserver(rs => {
      if (rs.every(r => dock.contains(r.target) || [...r.addedNodes].every(n => n.classList && n.classList.contains('me-hub-card-check')))) return;
      clearTimeout(t); t = setTimeout(varrer, 500);
    })
      .observe(document.body, { childList: true, subtree: true });
  }
  /* The daily background read opens this page in a hidden tab: no dock
     there (the checkboxes would change the cards it reads). */
  if (document.visibilityState === 'visible') iniciar();
  else document.addEventListener('visibilitychange', function v() {
    if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', v); iniciar(); }
  });
})();
