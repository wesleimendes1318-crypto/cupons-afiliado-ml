/* LISTAS DE AFILIADO NO MERCADO LIVRE (Weslei, 02/11/2026; extensao 1.174.0).

   O banco escolhe os produtos (curar_listas_afiliado: nota lida >= 4,5 com
   20+ avaliacoes, mais vendidos, cliques no link, frete gratis, loja
   oficial). Aqui a extensao, na sessao logada, faz o trabalho na pagina
   myaccount.mercadolivre.com.br/bookmarks/list:
     1) le as listas que existem (nome, quantidade, publica/privada);
     2) cria as listas do agente que faltam, como Publicas;
     3) le os produtos de cada lista do agente;
     4) inclui o que a curadoria escolheu e tira SO o que o proprio agente
        incluiu (o banco nunca manda tirar produto posto a mao).

   O Mercado Livre nao publica API das listas. Entao a extensao faz como uma
   pessoa (clica nos botoes da pagina) e, enquanto faz, ANOTA o pedido que a
   propria pagina manda ao servidor dela. Da proxima vez repete esse mesmo
   pedido trocando so o nome, o produto ou a lista (modeloDaRequisicao), sem
   clicar. Os modelos ficam so neste navegador (chrome.storage), nunca no
   banco nem no diagnostico (la vai so metodo e caminho).

   Protecao da conta: uma rodada por hora, so com a extensao parada e sem
   freio; no maximo 2 listas novas, 12 inclusoes e 8 saidas por rodada, com
   2,5 a 4,5 s entre cada uma; verificacao/captcha, 401, 403 ou 429 = para
   tudo por 6 h. Pedido de cliente chegando no meio = para na hora. */

export const URL_LISTAS = 'https://myaccount.mercadolivre.com.br/bookmarks/list?tab=list';
const RODADA_MS = 55 * 60e3;
const PAUSA_MS = 6 * 3600e3;
const MAX_CRIAR = 2;

/* ---------------- funcoes puras (testadas) ---------------- */

export function normalizarNome(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9$]+/g, ' ').trim();
}

function publicaDe(o) {
  for (const k of ['is_public', 'public', 'isPublic']) if (typeof o[k] === 'boolean') return o[k];
  for (const k of ['is_private', 'private', 'isPrivate']) if (typeof o[k] === 'boolean') return !o[k];
  for (const k of ['privacy', 'visibility', 'privacy_type', 'type_privacy', 'status_privacy']) {
    const v = o[k];
    if (typeof v === 'string') {
      if (/public|publica|pública/i.test(v)) return true;
      if (/priv/i.test(v)) return false;
    }
  }
  return null;
}

function qtdDe(o) {
  for (const k of ['items_count', 'itemsCount', 'total_items', 'quantity', 'count', 'total', 'size', 'bookmarks_count']) {
    const v = o[k];
    if (Number.isInteger(v) && v >= 0 && v <= 5000) return v;
  }
  return null;
}

/* Listas dentro de qualquer JSON da pagina (estado inicial, respostas da
   API interna): objetos com id + nome e algum sinal de lista (quantidade ou
   privacidade). Nada inventado: campo que nao existe fica null. */
export function listasDoJson(raiz) {
  const achadas = new Map();
  const visitar = (o, prof) => {
    if (!o || typeof o !== 'object' || prof > 9) return;
    if (Array.isArray(o)) { for (const x of o.slice(0, 400)) visitar(x, prof + 1); return; }
    const id = o.id ?? o.list_id ?? o.listId;
    const nome = o.name ?? o.title ?? o.list_name ?? o.listName;
    if ((typeof id === 'string' || typeof id === 'number') && typeof nome === 'string' && nome.trim()) {
      const publica = publicaDe(o);
      const qtd = qtdDe(o);
      if (publica !== null || qtd !== null || /list/i.test(String(o.type || o.kind || ''))) {
        const chave = String(id);
        if (!achadas.has(chave)) achadas.set(chave, { id: chave, nome: nome.trim().slice(0, 120), qtd, publica });
      }
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') visitar(v, prof + 1);
  };
  visitar(raiz, 0);
  return [...achadas.values()];
}

/* Listas pelos links da pagina (reserva quando o JSON nao aparece). */
export function listasDoDom(links) {
  const out = new Map();
  for (const l of links || []) {
    const href = String(l.href || '');
    const m = /bookmarks\/list\/([A-Za-z0-9_-]{2,80})(?:[/?#]|$)/i.exec(href) || /[?&]list_id=([A-Za-z0-9_-]{2,80})/i.exec(href);
    if (!m || /^(list|lists|tab)$/i.test(m[1])) continue;
    const linhas = String(l.texto || '').split('\n').map(s => s.trim()).filter(Boolean);
    const nome = linhas.find(s => !/^\d+\s*(produtos?|itens?)?$/i.test(s) && !/^(p[uú]blica|privada)$/i.test(s));
    if (!nome) continue;
    const q = /(\d{1,4})\s*(produtos?|itens?|an[uú]ncios?)/i.exec(l.texto || '');
    const publica = /\bp[uú]blica\b/i.test(l.texto || '') ? true : /\bprivada\b/i.test(l.texto || '') ? false : null;
    if (!out.has(m[1])) out.set(m[1], { id: m[1], nome: nome.slice(0, 120), qtd: q ? Number(q[1]) : null, publica, url: href.split('#')[0] });
  }
  return [...out.values()];
}

/* Listas pelo TEXTO da tela (cartoes sem link): linha do nome seguida de
   "N produtos" e, perto, "Publica"/"Privada". Sem id real: casa so pelo nome. */
export function listasDoTexto(texto) {
  const linhas = String(texto || '').split('\n').map(s => s.trim()).filter(Boolean);
  const out = new Map();
  linhas.forEach((l, k) => {
    const q = /^(\d{1,4})\s*(produtos?|itens?|an[uú]ncios?)\b/i.exec(l);
    if (!q || k === 0) return;
    let j = k - 1;
    while (j >= 0 && /^(p[uú]blica|privada|\d+.*produtos?)$/i.test(linhas[j])) j--;
    const nome = linhas[j];
    if (!nome || nome.length > 80 || /^(listas?|favoritos|criar|nova lista)$/i.test(nome)) return;
    const perto = linhas.slice(Math.max(0, k - 2), k + 3).join(' ');
    const publica = /\bp[uú]blica\b/i.test(perto) ? true : /\bprivada\b/i.test(perto) ? false : null;
    const id = 'nome:' + normalizarNome(nome);
    if (!out.has(id)) out.set(id, { id, nome, qtd: Number(q[1]), publica, url: null });
  });
  return [...out.values()];
}

export function juntarListas(...grupos) {
  const out = new Map();
  const porNome = new Map();
  for (const g of grupos) for (const l of g || []) {
    const n = normalizarNome(l.nome);
    if (String(l.id).startsWith('nome:') && porNome.has(n)) l = { ...l, id: porNome.get(n) };
    if (!String(l.id).startsWith('nome:')) porNome.set(n, l.id);
    const atual = out.get(l.id) || {};
    out.set(l.id, {
      id: l.id, nome: atual.nome || l.nome,
      qtd: atual.qtd ?? l.qtd ?? null,
      publica: atual.publica ?? l.publica ?? null,
      url: atual.url || l.url || null
    });
  }
  return [...out.values()];
}

/* Lista do agente <-> lista no Mercado Livre: pelo id ja gravado; senao
   pelo nome (sem acento, sem maiuscula). Nunca casa por "parecido". */
export function casarListas(nossas, doMl) {
  const porId = new Map((doMl || []).map(l => [String(l.id), l]));
  const porNome = new Map((doMl || []).map(l => [normalizarNome(l.nome), l]));
  return (nossas || []).map(n => {
    const ml = (n.ml_lista_id && porId.get(String(n.ml_lista_id))) || porNome.get(normalizarNome(n.nome)) || null;
    return { ...n, ml };
  });
}

/* Codigos de ANUNCIO (MLB + numero) num texto, endereco ou JSON. Codigo de
   produto de catalogo (/p/MLB...) sem item_id nao conta: nao e o anuncio. */
export function itensDoTexto(texto) {
  const s = String(texto || '');
  const out = new Set();
  for (const m of s.matchAll(/item_id(?:%3A|%22%3A%22|=|":\s*"|:)\s*(MLB)-?(\d{6,})/gi)) out.add('MLB' + m[2]);
  const semCatalogo = s.replace(/\/p\/MLB\d+/gi, ' ');
  for (const m of semCatalogo.matchAll(/\bMLB-(\d{6,})/gi)) out.add('MLB' + m[1]);
  for (const m of semCatalogo.matchAll(/"(?:id|item_id|itemId)"\s*:\s*"(MLB)(\d{6,})"/gi)) out.add('MLB' + m[2]);
  return [...out];
}

const CABECALHOS_OK = /^(content-type|accept|x-csrf-token|x-xsrf-token|csrf-token|x-requested-with|x-newrelic-id)$/i;

/* Pedido que a pagina mandou -> modelo com {{NOME}}, {{ITEM}}, {{ITEM_NUM}},
   {{LISTA}}. So vira modelo se algum valor conhecido aparecer nele (senao
   repetir mandaria sempre a mesma coisa). Cookie e Authorization nunca. */
export function modeloDaRequisicao(req, valores) {
  if (!req || !req.url || /^get$/i.test(req.metodo || 'GET')) return null;
  const pares = Object.entries(valores || {})
    .filter(([, v]) => v != null && String(v).length >= 3)
    .sort((a, b) => String(b[1]).length - String(a[1]).length);
  let usados = new Set();
  const trocar = (s, emUrl) => {
    let out = String(s || '');
    for (const [k, v] of pares) {
      const formas = emUrl ? [encodeURIComponent(String(v)), String(v)] : [JSON.stringify(String(v)).slice(1, -1), String(v)];
      for (const f of formas) {
        if (f && out.includes(f)) { out = out.split(f).join('{{' + k + '}}'); usados.add(k); }
      }
    }
    return out;
  };
  const url = trocar(req.url, true);
  const corpo = req.corpo == null ? null : trocar(req.corpo, false);
  if (!usados.size) return null;
  const cabecalhos = {};
  for (const [k, v] of Object.entries(req.cabecalhos || {})) if (CABECALHOS_OK.test(k)) cabecalhos[k] = String(v).slice(0, 400);
  return { url, metodo: String(req.metodo || 'POST').toUpperCase(), corpo, cabecalhos, usa: [...usados].sort() };
}

export function montarRequisicao(modelo, valores) {
  const troca = (s, emUrl) => String(s).replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => {
    const v = valores && valores[k] != null ? String(valores[k]) : '';
    return emUrl ? encodeURIComponent(v) : JSON.stringify(v).slice(1, -1);
  });
  return {
    url: troca(modelo.url, true), metodo: modelo.metodo,
    corpo: modelo.corpo == null ? null : troca(modelo.corpo, false),
    cabecalhos: { ...(modelo.cabecalhos || {}) }
  };
}

/* Modelo so serve se tiver o que muda de um uso para outro. */
export function modeloServe(tipo, modelo) {
  if (!modelo || !Array.isArray(modelo.usa)) return false;
  if (tipo === 'criar') return modelo.usa.includes('NOME');
  return (modelo.usa.includes('ITEM') || modelo.usa.includes('ITEM_NUM')) && (modelo.usa.includes('LISTA') || modelo.usa.includes('NOME'));
}

/* Entre os pedidos anotados, o que fez a acao: nao-GET, deu certo e leva o
   valor-chave (nome da lista ao criar; numero do produto ao incluir/tirar). */
export function escolherCapturada(capturas, chave) {
  const c = String(chave || '');
  if (!c) return null;
  const cands = (capturas || []).filter(r => r && !/^get$/i.test(r.metodo || 'GET') && (r.status == null || (r.status >= 200 && r.status < 300))
    && (String(r.url).includes(c) || String(r.url).includes(encodeURIComponent(c)) || String(r.corpo || '').includes(c)));
  const peso = r => (/^post$/i.test(r.metodo) ? 2 : /^put|patch$/i.test(r.metodo) ? 1 : 0) + (/bookmark|list|favorit/i.test(r.url) ? 2 : 0);
  return cands.sort((a, b) => peso(b) - peso(a))[0] || null;
}

/* Id da lista criada na resposta do servidor. */
export function idDaResposta(texto, nome) {
  let j;
  try { j = JSON.parse(texto); } catch (e) { return null; }
  const listas = listasDoJson(j);
  const alvo = normalizarNome(nome);
  const certa = listas.find(l => normalizarNome(l.nome) === alvo);
  if (certa) return certa.id;
  const id = j && (j.id ?? j.list_id ?? (j.data && (j.data.id ?? j.data.list_id)));
  return (typeof id === 'string' || typeof id === 'number') ? String(id) : null;
}

/* ---------------- funcoes que rodam DENTRO da pagina ---------------- */

/* Anota fetch e XHR da pagina (so nesta aba, ate 60 pedidos). */
function paginaEscutar() {
  if (window.__meEscuta) return true;
  window.__meEscuta = true;
  window.__meReqs = [];
  const guardar = r => { if (window.__meReqs.length < 60) window.__meReqs.push(r); };
  const corte = s => (typeof s === 'string' ? s.slice(0, 6000) : null);
  const cab = h => {
    const o = {};
    try {
      if (!h) return o;
      if (h instanceof Headers) h.forEach((v, k) => { o[k] = v; });
      else if (Array.isArray(h)) h.forEach(([k, v]) => { o[k] = v; });
      else Object.assign(o, h);
    } catch (e) { /* sem cabecalho */ }
    return o;
  };
  const f0 = window.fetch;
  window.fetch = async function (entrada, init) {
    const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
    const metodo = (init && init.method) || (entrada && entrada.method) || 'GET';
    const corpo = init && typeof init.body === 'string' ? init.body : null;
    const resp = await f0.apply(this, arguments);
    try {
      const txt = /json|text/i.test(resp.headers.get('content-type') || '') ? await resp.clone().text() : '';
      guardar({ url: new URL(url, location.href).href, metodo, corpo: corte(corpo), cabecalhos: cab(init && init.headers), status: resp.status, resposta: corte(txt) });
    } catch (e) { /* so anotacao */ }
    return resp;
  };
  const abrir = XMLHttpRequest.prototype.open;
  const enviar = XMLHttpRequest.prototype.send;
  const porCab = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, u) { this.__me = { metodo: m, url: new URL(u, location.href).href, cabecalhos: {} }; return abrir.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { if (this.__me) this.__me.cabecalhos[k] = v; return porCab.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) {
    const x = this;
    if (x.__me) {
      x.__me.corpo = typeof b === 'string' ? corte(b) : null;
      x.addEventListener('loadend', () => {
        try { guardar({ ...x.__me, status: x.status, resposta: corte(typeof x.responseText === 'string' ? x.responseText : '') }); } catch (e) { /* so anotacao */ }
      });
    }
    return enviar.apply(this, arguments);
  };
  return true;
}

function paginaLer() {
  const links = [...document.querySelectorAll('a[href]')].slice(0, 600).map(a => ({ href: a.href, texto: (a.innerText || a.getAttribute('aria-label') || '').slice(0, 300) }));
  const estados = [];
  for (const k of Object.keys(window)) {
    if (!/state|initial|preload|__NEXT_DATA__|__PRELOADED/i.test(k)) continue;
    try { const s = JSON.stringify(window[k]); if (s && s.length < 600000) estados.push(s); } catch (e) { /* circular */ }
  }
  for (const s of document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__')) {
    if (s.textContent && s.textContent.length < 600000) estados.push(s.textContent);
  }
  const capturas = (window.__meReqs || []).map(r => ({ url: r.url, metodo: r.metodo, status: r.status, resposta: r.resposta }));
  return {
    url: location.href, titulo: document.title,
    links, estados: estados.slice(0, 12), capturas,
    texto: (document.body && document.body.innerText || '').slice(0, 12000),
    botoes: [...document.querySelectorAll('button, [role="button"], a[href]')]
      .filter(b => b.getClientRects().length)
      .map(b => ((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim())
      .filter(t => t && t.length < 60).slice(0, 60)
  };
}

/* Clica no primeiro elemento VISIVEL cujo texto ou aria-label casa com o
   padrao. Dentro de um dialogo aberto primeiro, quando houver. */
function paginaClicar(padrao, flags, soDialogo) {
  const re = new RegExp(padrao, flags || 'i');
  const visivel = el => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const dialogos = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .andes-modal, dialog[open]')].filter(visivel);
  const escopos = dialogos.length ? dialogos : (soDialogo ? [] : [document]);
  if (!soDialogo && dialogos.length) escopos.push(document);
  for (const esc of escopos) {
    const els = esc.querySelectorAll('button, a, [role="button"], [role="option"], [role="menuitem"], [role="radio"], label, li');
    for (const el of els) {
      if (!visivel(el)) continue;
      const t = ((el.innerText || '') + ' ' + (el.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim();
      if (t && t.length < 160 && re.test(t)) { el.click(); return t.slice(0, 80); }
    }
  }
  return null;
}

function paginaPreencher(valor) {
  const visivel = el => !!(el && el.getClientRects().length);
  const dialogos = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .andes-modal, dialog[open]')].filter(visivel);
  const escopo = dialogos[0] || document;
  const campo = [...escopo.querySelectorAll('input[type="text"], input:not([type]), textarea')].find(visivel);
  if (!campo) return false;
  const proto = campo.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(campo, valor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  campo.focus();
  return true;
}

/* Botao de favoritar/salvar do anuncio. Ja salvo (aria-pressed ou "remover"
   no rotulo) nao e clicado: clicar tiraria dos favoritos. */
function paginaFavoritar() {
  const visivel = el => !!(el && el.getClientRects().length);
  const sel = '[aria-label*="favorit" i], [aria-label*="lista" i], [data-testid*="bookmark" i], button[class*="bookmark" i], [class*="bookmark" i] button';
  for (const el of document.querySelectorAll(sel)) {
    if (!visivel(el)) continue;
    const r = (el.getAttribute('aria-label') || el.innerText || '').trim();
    if (el.getAttribute('aria-pressed') === 'true' || /remover|excluir|tirar/i.test(r)) return { jaSalvo: true, rotulo: r.slice(0, 60) };
    el.click();
    return { clicou: true, rotulo: r.slice(0, 60) };
  }
  return { nada: true };
}

/* Botao de tirar o produto de dentro do cartao dele na pagina da lista. */
function paginaRemoverDaLista(itemNum) {
  const visivel = el => !!(el && el.getClientRects().length);
  const link = [...document.querySelectorAll('a[href]')].find(a => a.href.includes(itemNum) || a.href.includes('MLB-' + itemNum));
  if (!link) return { semCartao: true };
  let card = link;
  for (let n = 0; n < 7 && card; n++) {
    card = card.parentElement;
    const b = card && [...card.querySelectorAll('button, [role="button"]')].find(x => visivel(x) && /remover|excluir|tirar|eliminar|deletar/i.test((x.getAttribute('aria-label') || '') + ' ' + (x.innerText || '')));
    if (b) { b.click(); return { clicou: true }; }
  }
  return { semBotao: true };
}

function paginaCapturas() {
  const r = window.__meReqs || [];
  window.__meReqs = [];
  return r;
}

/* Repete o pedido anotado, com a sessao da propria pagina. O token de
   seguranca vem fresco da pagina quando ela o expoe. */
async function paginaRepetir(req) {
  const cab = { ...(req.cabecalhos || {}) };
  const meta = document.querySelector('meta[name="csrf-token"], meta[name="_csrf"], meta[name="x-csrf-token"]');
  for (const k of Object.keys(cab)) if (/csrf|xsrf/i.test(k) && meta && meta.content) cab[k] = meta.content;
  try {
    const r = await fetch(req.url, { method: req.metodo, headers: cab, body: req.corpo == null ? undefined : req.corpo, credentials: 'include' });
    const t = await r.text();
    return { status: r.status, texto: t.slice(0, 6000) };
  } catch (e) { return { status: 0, texto: String(e && e.message || e).slice(0, 200) }; }
}

/* ---------------- a rodada ---------------- */

let rodando = false;

/* d = { token, versao, sleep, esperarCarregar, ehCaptcha, freioLigado,
         listasTarefas, gravarListas, gravarDiagnostico, ocupado } */
export async function sincronizarListas(d) {
  if (rodando || !d.token || d.ocupado()) return;
  const st = await chrome.storage.local.get(['listasUltima', 'listasPausaAte', 'listasApi']);
  if (st.listasUltima && Date.now() - st.listasUltima < RODADA_MS) return;
  if (st.listasPausaAte && Date.now() < st.listasPausaAte) return;
  if (await d.freioLigado('leitura')) return;
  let tarefas;
  try { tarefas = await d.listasTarefas(d.token); } catch (e) { return; }
  if (!tarefas || !tarefas.ativo) return;
  rodando = true;
  await chrome.storage.local.set({ listasUltima: Date.now() });
  const api = st.listasApi || {};
  const diag = { versao: d.versao, modo: tarefas.modo, criadas: [], erros: [], acoes: 0, modelos: {} };
  const acoes = [];
  const lidos = {};
  let listasMl = [];
  let aba = null;
  let parar = null;
  const espera = () => d.sleep(2500 + Math.floor(Math.random() * 2000));

  const rodar = async (func, args = [], world = 'MAIN') => {
    const [s] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, world, func, args });
    return s ? s.result : null;
  };
  const ir = async url => {
    await chrome.tabs.update(aba.id, { url });
    await d.sleep(800);
    await d.esperarCarregar(aba.id, 30000);
    await d.sleep(2500);
    const fim = (await chrome.tabs.get(aba.id)).url || '';
    if (d.ehCaptcha('', fim)) { parar = 'verificacao do Mercado Livre'; return false; }
    if (/\/jms\/|\/login|lgz/i.test(fim)) { parar = 'deslogado do Mercado Livre'; return false; }
    await rodar(paginaEscutar);
    for (let k = 0; k < 12; k++) {
      const pronto = await rodar(() => (document.body && document.body.innerText || '').length > 400);
      if (pronto) break;
      await d.sleep(1000);
    }
    return true;
  };
  const conferirStatus = s => { if ([401, 403, 429].includes(s)) parar = 'Mercado Livre respondeu ' + s; };
  const lerListas = async () => {
    const r = await rodar(paginaLer);
    if (!r) return [];
    const dosJson = [];
    for (const s of [...(r.estados || []), ...(r.capturas || []).map(c => c.resposta)]) {
      try { dosJson.push(...listasDoJson(JSON.parse(s))); } catch (e) { /* nao e JSON */ }
    }
    ultimaLeitura = r;
    return juntarListas(dosJson, listasDoDom(r.links), listasDoTexto(r.texto));
  };
  let ultimaLeitura = null;
  const valoresDe = (lista, item) => ({
    NOME: lista && lista.nome, LISTA: lista && lista.ml && !String(lista.ml.id).startsWith('nome:') ? lista.ml.id : null,
    ITEM: item, ITEM_NUM: item ? String(item).replace(/^MLB/i, '') : null
  });

  try {
    aba = await chrome.tabs.create({ url: 'about:blank', active: false });
    if (!(await ir(URL_LISTAS))) throw new Error(parar);
    listasMl = await lerListas();
    let casadas = casarListas(tarefas.listas, listasMl);
    diag.listasNoMl = listasMl.slice(0, 30).map(l => ({ nome: l.nome, qtd: l.qtd, publica: l.publica, comId: !String(l.id).startsWith('nome:') }));
    if (ultimaLeitura) diag.pagina = {
      url: String(ultimaLeitura.url || '').split('?')[0], titulo: ultimaLeitura.titulo,
      botoes: ultimaLeitura.botoes, texto: String(ultimaLeitura.texto || '').slice(0, 1500),
      linksListas: (ultimaLeitura.links || []).map(x => x.href).filter(h => /bookmark|lista/i.test(h)).slice(0, 15),
      pedidos: (ultimaLeitura.capturas || []).map(c => c.metodo + ' ' + String(c.url).split('?')[0]).slice(0, 20),
      estados: (ultimaLeitura.estados || []).length
    };

    /* 2) criar as que faltam (Publicas) */
    if (tarefas.modo !== 'ler') {
      for (const l of casadas.filter(x => !x.ml).slice(0, MAX_CRIAR)) {
        if (parar || d.ocupado()) break;
        let id = null;
        if (modeloServe('criar', api.criar)) {
          const r = await rodar(paginaRepetir, [montarRequisicao(api.criar, valoresDe(l))]);
          conferirStatus(r && r.status);
          if (r && r.status >= 200 && r.status < 300) id = idDaResposta(r.texto, l.nome) || 'criada';
          else if (r && r.status >= 400 && r.status < 500 && !parar) { api.criar = null; diag.erros.push('modelo de criar descartado: ' + r.status); }
        }
        if (!id && !parar) {
          await rodar(paginaCapturas);
          const abriu = await rodar(paginaClicar, ['^\\+?\\s*(criar|nova)( nova| uma)?( lista)?$|criar (uma |nova )?lista|nova lista|adicionar lista', 'i', false]);
          await d.sleep(1500);
          const preencheu = abriu && await rodar(paginaPreencher, [l.nome]);
          if (preencheu) {
            await d.sleep(600);
            await rodar(paginaClicar, ['^p[uú]blica', 'i', true]);
            await d.sleep(500);
            await rodar(paginaClicar, ['^(criar|criar lista|salvar|confirmar|pronto)$', 'i', true]);
            await d.sleep(3000);
            const caps = await rodar(paginaCapturas);
            const req = escolherCapturada(caps, l.nome);
            if (req) {
              conferirStatus(req.status);
              const m = modeloDaRequisicao(req, valoresDe(l));
              if (m && modeloServe('criar', m)) { api.criar = m; diag.modelos.criar = m.metodo + ' ' + m.url.split('?')[0]; }
              id = idDaResposta(req.resposta, l.nome) || 'criada';
            } else diag.erros.push('criar "' + l.nome + '": a pagina nao confirmou');
          } else diag.erros.push('criar "' + l.nome + '": botao ou campo nao encontrado');
        }
        if (id) diag.criadas.push(l.nome);
        await espera();
      }
      if (diag.criadas.length && !parar) {
        await ir(URL_LISTAS);
        listasMl = await lerListas();
        casadas = casarListas(tarefas.listas, listasMl);
      }
    }

    /* 3) produtos de cada lista do agente (ate 3 por rodada) */
    for (const l of casadas.filter(x => x.ml && x.ml.url).slice(0, 3)) {
      if (parar || d.ocupado()) break;
      if (!(await ir(l.ml.url))) break;
      const r = await rodar(paginaLer);
      const texto = [...(r.links || []).map(x => x.href), ...(r.estados || []), ...(r.capturas || []).map(c => c.resposta || '')].join('\n');
      lidos[l.slug] = itensDoTexto(texto);
      await espera();
    }

    /* 4) incluir e tirar */
    const porSlug = new Map(casadas.map(l => [l.slug, l]));
    let naPaginaDeListas = false;
    for (const t of tarefas.entrar || []) {
      if (parar || d.ocupado()) break;
      const l = porSlug.get(t.lista);
      /* Lista ainda nao criada: espera a proxima rodada sem gastar tentativa. */
      if (!l || !l.ml) continue;
      if ((lidos[l.slug] || []).includes(t.item)) { acoes.push({ lista: t.lista, item: t.item, acao: 'entrar', ok: true }); continue; }
      let ok = false, erro = null;
      if (modeloServe('adicionar', api.adicionar)) {
        if (!naPaginaDeListas) { if (!(await ir(URL_LISTAS))) break; naPaginaDeListas = true; }
        const r = await rodar(paginaRepetir, [montarRequisicao(api.adicionar, valoresDe(l, t.item))]);
        conferirStatus(r && r.status);
        ok = !!(r && r.status >= 200 && r.status < 300);
        if (!ok) erro = 'pedido repetido respondeu ' + (r && r.status);
        if (!ok && r && r.status >= 400 && r.status < 500 && !parar) api.adicionar = null;
      } else {
        naPaginaDeListas = false;
        const url = 'https://produto.mercadolivre.com.br/MLB-' + t.item.replace(/^MLB/i, '');
        if (!(await ir(url))) break;
        await rodar(paginaCapturas);
        const fav = await rodar(paginaFavoritar);
        await d.sleep(2000);
        let escolheu = await rodar(paginaClicar, ['^' + l.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i', false]);
        if (!escolheu) {
          await rodar(paginaClicar, ['(adicionar|salvar|mover) (a|em|para) (uma )?lista|escolher lista|ver listas', 'i', false]);
          await d.sleep(1500);
          escolheu = await rodar(paginaClicar, ['^' + l.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i', false]);
        }
        if (escolheu) {
          await d.sleep(800);
          await rodar(paginaClicar, ['^(salvar|confirmar|pronto|concluir|adicionar)$', 'i', true]);
          await d.sleep(2500);
          const caps = await rodar(paginaCapturas);
          const req = escolherCapturada(caps, t.item.replace(/^MLB/i, ''));
          if (req) {
            conferirStatus(req.status);
            ok = req.status >= 200 && req.status < 300;
            const m = modeloDaRequisicao(req, valoresDe(l, t.item));
            if (ok && m && modeloServe('adicionar', m)) { api.adicionar = m; diag.modelos.adicionar = m.metodo + ' ' + m.url.split('?')[0]; }
          } else erro = 'a pagina nao confirmou a inclusao';
        } else erro = fav && fav.nada ? 'botao de salvar nao encontrado' : 'lista nao apareceu no menu de salvar';
      }
      acoes.push({ lista: t.lista, item: t.item, acao: 'entrar', ok, erro });
      await espera();
    }

    for (const t of tarefas.sair || []) {
      if (parar || d.ocupado()) break;
      const l = porSlug.get(t.lista);
      if (!l || !l.ml) continue;
      if (lidos[l.slug] && !lidos[l.slug].includes(t.item)) { acoes.push({ lista: t.lista, item: t.item, acao: 'sair', ok: true }); continue; }
      let ok = false, erro = null;
      if (modeloServe('remover', api.remover)) {
        if (!(await ir(URL_LISTAS))) break;
        const r = await rodar(paginaRepetir, [montarRequisicao(api.remover, valoresDe(l, t.item))]);
        conferirStatus(r && r.status);
        ok = !!(r && r.status >= 200 && r.status < 300);
        if (!ok) erro = 'pedido repetido respondeu ' + (r && r.status);
        if (!ok && r && r.status >= 400 && r.status < 500 && !parar) api.remover = null;
      } else if (l.ml.url) {
        if (!(await ir(l.ml.url))) break;
        await rodar(paginaCapturas);
        const c = await rodar(paginaRemoverDaLista, [t.item.replace(/^MLB/i, '')]);
        if (c && c.clicou) {
          await d.sleep(1200);
          await rodar(paginaClicar, ['^(remover|excluir|sim|confirmar|eliminar)', 'i', true]);
          await d.sleep(2500);
          const req = escolherCapturada(await rodar(paginaCapturas), t.item.replace(/^MLB/i, ''));
          if (req) {
            conferirStatus(req.status);
            ok = req.status >= 200 && req.status < 300;
            const m = modeloDaRequisicao(req, valoresDe(l, t.item));
            if (ok && m && modeloServe('remover', m)) { api.remover = m; diag.modelos.remover = m.metodo + ' ' + m.url.split('?')[0]; }
          } else erro = 'a pagina nao confirmou a saida';
        } else erro = c && c.semCartao ? 'produto nao esta na pagina da lista' : 'botao de remover nao encontrado';
      }
      acoes.push({ lista: t.lista, item: t.item, acao: 'sair', ok, erro });
      await espera();
    }

    const listas = casarListas(tarefas.listas, listasMl).filter(l => l.ml).map(l => ({
      slug: l.slug, ml_lista_id: /^[A-Za-z0-9_-]+$/.test(l.ml.id) ? l.ml.id : null,
      ml_url: l.ml.url, publica: l.ml.publica, qtd: l.ml.qtd
    }));
    diag.banco = await d.gravarListas(d.token, { listas, lidos, acoes }).catch(e => ({ erro: String(e.message).slice(0, 120) }));
    diag.acoes = acoes.length;
    diag.incluidos = acoes.filter(a => a.acao === 'entrar' && a.ok).length;
    diag.tirados = acoes.filter(a => a.acao === 'sair' && a.ok).length;
    diag.falhas = acoes.filter(a => !a.ok).slice(0, 6).map(a => a.acao + ' ' + a.item + ': ' + a.erro);
    diag.privadas = listas.filter(l => l.publica === false).map(l => l.slug);
  } catch (e) {
    diag.erros.push(String((e && e.message) || e).slice(0, 160));
  } finally {
    if (!parar && !listasMl.length) {
      /* Nada lido: tenta de novo em 10 min (no maximo 3 vezes seguidas). */
      const { listasRepeticoes = 0 } = await chrome.storage.local.get('listasRepeticoes');
      if (listasRepeticoes < 3) await chrome.storage.local.set({ listasUltima: Date.now() - RODADA_MS + 10 * 60e3, listasRepeticoes: listasRepeticoes + 1 });
    } else await chrome.storage.local.set({ listasRepeticoes: 0 });
    if (parar) {
      diag.parou = parar;
      await chrome.storage.local.set({ listasPausaAte: Date.now() + PAUSA_MS });
    }
    await chrome.storage.local.set({ listasApi: api });
    try { await d.gravarDiagnostico(d.token, 'listas-afiliado', diag); } catch (e) { /* so diagnostico */ }
    if (aba) { try { await chrome.tabs.remove(aba.id); } catch (e) { /* ja fechada */ } }
    rodando = false;
  }
}
