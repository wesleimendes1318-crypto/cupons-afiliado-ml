/* Escolha de elemento na pagina (padrao "indice de elementos + escolha
   fechada com certeza", o mesmo da tecnica do browser-use/Jev, sem modelo de
   linguagem e sem custo).

   1) A pagina vira uma LISTA de elementos clicaveis visiveis (texto, rotulo,
      papel, se estao num dialogo, se estao cobertos ou desligados).
   2) Cada pedido de clique e uma pergunta com OPCOES FECHADAS: padroes em
      ordem de preferencia. Cada elemento recebe uma nota de 0 a 1.
   3) So clica com CERTEZA: nota >= 0,5 e sem empate entre dois botoes de
      textos diferentes. Na duvida, nao clica (melhor nao fazer nada do que
      clicar errado na conta de afiliado).
   4) Antes do clique: traz o elemento para a vista e confere que nada esta
      por cima. Depois do clique, espera a pagina MUDAR (MutationObserver) em
      vez de um tempo fixo: segue assim que a pagina responde.

   Script classico (sem import/export): entra na aba por
   chrome.scripting.executeScript({ files }) e deixa tudo em
   globalThis.__meEscolha. Os testes rodam o mesmo arquivo num vm do Node. */
(function (g) {
  if (g.__meEscolha && g.__meEscolha.versao === 1) return;

  const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();
  const semAcento = s => limpar(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /* Nota de cada elemento. elementos: [{ texto, rotulo, papel, emDialogo,
     desligado, coberto }]. alvo: { padroes: [string|{re, flags}], soDialogo }.
     O 1o padrao vale 1, o 2o 0,85, o 3o 0,72... (preferencia). */
  function pontuar(elementos, alvo) {
    const padroes = (alvo && alvo.padroes || []).map(p => {
      const fonte = typeof p === 'string' ? p : p.re;
      const flags = (typeof p === 'object' && p.flags) || 'i';
      try { return new RegExp(fonte, flags); } catch (e) { return null; }
    }).filter(Boolean);
    const notas = [];
    elementos.forEach((el, i) => {
      if (!el || el.desligado || el.coberto) return;
      if (alvo && alvo.soDialogo && !el.emDialogo) return;
      const texto = limpar(el.texto);
      const rotulo = limpar(el.rotulo);
      const vistos = [texto, rotulo, limpar(texto + ' ' + rotulo)].filter(t => t && t.length < 160);
      if (!vistos.length) return;
      let melhor = 0;
      padroes.forEach((re, k) => {
        const peso = Math.pow(0.85, k);
        for (const t of vistos) {
          if (!re.test(t)) continue;
          /* Texto curto e direto vale mais que um bloco grande que contem a palavra. */
          const curto = t.length <= 40 ? 1 : t.length <= 80 ? 0.9 : 0.75;
          melhor = Math.max(melhor, peso * curto);
        }
      });
      if (!melhor) return;
      if (el.emDialogo) melhor = Math.min(1, melhor + 0.1);
      notas.push({ indice: i, nota: Math.round(melhor * 1000) / 1000, chave: semAcento(texto || rotulo) });
    });
    notas.sort((a, b) => b.nota - a.nota || a.indice - b.indice);
    return notas;
  }

  /* Decisao final com certeza. Empate entre textos DIFERENTES = ambiguo.
     Mesmo texto repetido (botao do celular + do PC) = o primeiro. */
  function decidir(notas, minimo) {
    const corte = minimo == null ? 0.5 : minimo;
    if (!notas.length) return { decisao: 'nenhum', confianca: 0 };
    const top = notas[0];
    if (top.nota < corte) return { decisao: 'nenhum', confianca: top.nota };
    const rival = notas.find(n => n.chave !== top.chave);
    const margem = rival ? Math.round((top.nota - rival.nota) * 1000) / 1000 : top.nota;
    if (rival && margem < 0.05) return { decisao: 'ambiguo', confianca: top.nota, margem, opcoes: [top.chave, rival.chave] };
    const confianca = Math.round(Math.min(1, top.nota * (rival ? 0.7 + Math.min(0.3, margem) : 1)) * 1000) / 1000;
    return { decisao: 'clicar', indice: top.indice, confianca, margem };
  }

  /* ---- so com DOM ---- */
  const SELETOR = 'button, a[href], [role="button"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="radio"], [role="checkbox"], [role="tab"], input[type="radio"], input[type="checkbox"], input[type="submit"], label, li[tabindex]';
  const DIALOGO = '[role="dialog"], [aria-modal="true"], .andes-modal, dialog[open]';

  function visivel(el) {
    if (!el || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  }

  function coberto(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; // fora da vista: decide depois de rolar
    const p = document.elementFromPoint(x, y);
    return !!(p && p !== el && !el.contains(p) && !p.contains(el));
  }

  function indexar(soDialogo) {
    const dialogos = [...document.querySelectorAll(DIALOGO)].filter(visivel);
    const nos = [];
    const vistos = new Set();
    const juntar = (raiz, emDialogo) => {
      for (const el of raiz.querySelectorAll(SELETOR)) {
        if (vistos.has(el) || !visivel(el)) continue;
        vistos.add(el);
        nos.push({ el, emDialogo });
        if (nos.length >= 400) return;
      }
    };
    dialogos.forEach(d => juntar(d, true));
    if (!soDialogo) juntar(document, false);
    const elementos = nos.map(({ el, emDialogo }) => ({
      texto: (el.innerText || el.value || '').slice(0, 200),
      rotulo: el.getAttribute('aria-label') || el.getAttribute('title') || '',
      papel: el.getAttribute('role') || el.tagName.toLowerCase(),
      emDialogo,
      desligado: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      coberto: coberto(el)
    }));
    return { nos: nos.map(n => n.el), elementos, dialogos: dialogos.length };
  }

  function clicar(alvo) {
    const t0 = performance.now();
    const { nos, elementos, dialogos } = indexar(!!(alvo && alvo.soDialogo));
    const d = decidir(pontuar(elementos, alvo), alvo && alvo.minimo);
    const base = { total: elementos.length, dialogos, confianca: d.confianca, margem: d.margem };
    if (d.decisao !== 'clicar') return { ...base, clicou: false, motivo: d.decisao, opcoes: d.opcoes, ms: Math.round(performance.now() - t0) };
    const el = nos[d.indice];
    if (!el.isConnected) return { ...base, clicou: false, motivo: 'sumiu', ms: Math.round(performance.now() - t0) };
    try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch (e) { el.scrollIntoView(); }
    if (coberto(el)) return { ...base, clicou: false, motivo: 'coberto', texto: limpar(el.innerText).slice(0, 80), ms: Math.round(performance.now() - t0) };
    el.click();
    return { ...base, clicou: true, texto: limpar(el.innerText || el.getAttribute('aria-label')).slice(0, 80), ms: Math.round(performance.now() - t0) };
  }

  /* Espera a pagina mudar (ate ms). Volta assim que algo muda e fica
     150 ms quieto, ou no prazo. */
  function esperarMudanca(ms) {
    const t0 = performance.now();
    return new Promise(resolver => {
      let mudou = false, quieto = null;
      const fim = r => { obs.disconnect(); clearTimeout(prazo); clearTimeout(quieto); resolver({ mudou: r, ms: Math.round(performance.now() - t0) }); };
      const obs = new MutationObserver(() => { mudou = true; clearTimeout(quieto); quieto = setTimeout(() => fim(true), 150); });
      obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      const prazo = setTimeout(() => fim(mudou), ms || 1500);
    });
  }

  g.__meEscolha = { versao: 1, pontuar, decidir, indexar, clicar, esperarMudanca };
})(globalThis);
