import { sincronizarComSite, completarCondicoes, condicoesDe,
         pedidosPendentes, marcarPedido, melhorCupom,
         condicoesPendentes, salvarCondicoes, iniciarPedido,
         linksPendentes, salvarLinks,
         etiquetasPendentes, salvarEtiquetas,
         vitrinesParaConferir, salvarVitrines } from './sincronia.js';
import { criarAtendimento, lerResposta, limparUrl, avaliar, avaliarCupom,
         PAGINA_GERADOR, ROTA_CRIAR, TAG_PADRAO } from './atendimento.js';

/* Cupons Afiliado ML - service worker (v1.1, otimizado)

   Otimizacoes desta versao, todas medidas em pagina real:
     - le o HTML do anuncio em streaming e ABORTA assim que acha o vendedor.
       O bloco "seller_link" fica a ~11% do arquivo, entao o download cai de
       628 KB para ~330 KB por anuncio.
     - usa a URL canonica do proprio card da busca, evitando o redirecionamento
       produto.mercadolivre.com.br -> www (economiza um salto por anuncio).
     - 14 requisicoes simultaneas em vez de 4.
     - cache por anuncio de 7 dias, em memoria e em disco.
   Medido: 3 anuncios em paralelo em 946 ms (~315 ms cada).
*/

const API   = 'https://www.mercadolivre.com.br/affiliate-program/api/affiliates/coupons';
const PER   = 14;
const CONC  = 12;    // paginas do indice de cupons em paralelo
const CONC_VEND = 14; // anuncios em paralelo
const MAX_BYTES = 420000;
const TTL_MS   = 6 * 60 * 60 * 1000;
const TTL_VEND = 7 * 24 * 60 * 60 * 1000;

const norm = s => (s ?? '').toString().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* --------------------------------------------------------- indice cupons */

async function getPagina(p, tentativa = 0) {
  try {
    const r = await fetch(`${API}?items_per_page=${PER}&page=${p}`, {
      headers: { accept: 'application/json' }, credentials: 'include'
    });
    if (r.status === 401 || r.status === 403) throw new Error('NAO_LOGADO');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    if (e.message === 'NAO_LOGADO') throw e;
    if (tentativa < 2) { await sleep(400 * (tentativa + 1)); return getPagina(p, tentativa + 1); }
    return null;
  }
}

async function baixarIndice() {
  const primeira = await getPagina(1);
  if (!primeira) throw new Error('A API de cupons nao respondeu. Entre na sua conta do Mercado Livre.');

  const total   = primeira.total_items || 0;
  const paginas = Math.max(1, Math.ceil(total / PER));
  const cupons  = [...(primeira.coupons || [])];
  let falhas = 0;

  for (let i0 = 2; i0 <= paginas; i0 += CONC) {
    const lote = [];
    for (let i = 0; i < CONC && i0 + i <= paginas; i++) lote.push(getPagina(i0 + i));
    (await Promise.all(lote)).forEach(j => {
      if (j && j.coupons) cupons.push(...j.coupons); else falhas++;
    });
  }

  const mapa = {};
  cupons.forEach(c => {
    const k = norm(c.seller || c.container_name);
    if (!k) return;
    const atual = mapa[k];
    if (!atual || (c.remaining_budget || 0) > (atual.orcamento || 0)) {
      mapa[k] = {
        vendedor: c.seller || c.container_name,
        titulo: c.title,
        orcamento: c.remaining_budget,
        vence: c.expiration_date,
        id: c.id
      };
    }
  });

  const dados = {
    mapa,
    lista: cupons.map(c => ({
      v: c.seller || c.container_name || '', t: c.title, o: c.remaining_budget,
      x: c.expiration_date, u: !!c.in_use, i: c.id
    })),
    total, falhas, atualizadoEm: Date.now()
  };

  await chrome.storage.local.set({ indice: dados });
  MAPA_MEM = dados.mapa;

  // v1.3 - manda a lista para o site, se o token estiver configurado
  try {
    const { sincToken, sincAuto } = await chrome.storage.local.get(['sincToken', 'sincAuto']);
    if (sincToken && sincAuto !== false) {
      const res = await sincronizarComSite(dados.lista, true);
      console.log('[sincronia]', res);
    }
  } catch (e) {
    console.warn('[sincronia] falhou:', e.message);
    await chrome.storage.local.set({ ultimaSincronia: { quando: Date.now(), erro: e.message } });
  }

  return dados;
}

let MAPA_MEM = null;

async function obterIndice(forcar = false) {
  const { indice } = await chrome.storage.local.get('indice');
  if (!forcar && indice && (Date.now() - indice.atualizadoEm) < TTL_MS) {
    MAPA_MEM = indice.mapa;
    return indice;
  }
  try { return await baixarIndice(); }
  catch (e) { if (indice) { MAPA_MEM = indice.mapa; return indice; } throw e; }
}

/* ------------------------------------------- vendedor do anuncio (rapido) */

/* O HTML do anuncio traz, a ~11% do arquivo:
     "sold_by":{"text":"Vendido por",...},"seller_link":{"target":".../pagina/<slug>",
                ...,"label":{"text":"<NOME DA LOJA>",...
   Lemos em streaming e paramos assim que o nome aparece. */
const RE_LABEL = /"seller_link"[\s\S]{0,600}?"label"\s*:\s*\{\s*"text"\s*:\s*"([^"]{2,60})"/;
const RE_SLUG  = /\\u002F(?:pagina|perfil)\\u002F([A-Za-z0-9._%-]{2,60})|\/(?:pagina|perfil)\/([A-Za-z0-9._%-]{2,60})/;

/* Versoes globais das duas de cima: o anuncio cita a loja mais de uma vez e
   cada citacao usa um nome diferente (fantasia, slug da pagina, apelido do
   perfil). Precisamos de todos, nao do primeiro. */
const RE_LABEL_G = /"seller_link"[\s\S]{0,600}?"label"\s*:\s*\{\s*"text"\s*:\s*"([^"]{2,60})"/g;
const RE_SLUG_G  = /\\u002F(?:pagina|perfil)\\u002F([A-Za-z0-9._%-]{2,60})|\/(?:pagina|perfil)\/([A-Za-z0-9._%-]{2,60})|"(?:nickname|seller_name)"\s*:\s*"([A-Za-z0-9._-]{2,60})"|\\u002Fperfil\\u002F([A-Za-z0-9._%-]{2,60})/g;

async function lerParcial(url) {
  const ctrl = new AbortController();
  const r = await fetch(url, { credentials: 'include', redirect: 'follow', signal: ctrl.signal });
  if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);

  const leitor = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', bytes = 0;

  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      bytes += value.length;
      buf += dec.decode(value, { stream: true });
      if (RE_LABEL.test(buf)) { ctrl.abort(); break; }   // achou: para tudo
      if (bytes > MAX_BYTES) { ctrl.abort(); break; }
    }
  } catch (e) { /* abort gera excecao, esperado */ }

  return buf;
}

/* Junta TODOS os nomes que o anuncio revela, nao so o primeiro.

   Motivo (bug real, loja "vertex brasil farma"): o hub de cupons lista o
   vendedor pelo apelido, "Vertex_brasil_farmaceutica". Ja a pagina do anuncio
   mostra o nome de fantasia da loja, "VERTEX BRASIL FARMA", e o link
   /pagina/vertex-brasil-farma. Normalizados, "vertexbrasilfarma" e
   "vertexbrasilfarmaceutica" nao batem, e a varredura dizia que nenhum dos 48
   anuncios tinha cupom - numa loja que tem tres cupons ativos.

   O apelido de verdade aparece no link /perfil/<apelido>, que antes era
   descartado porque a gente parava no primeiro achado. Agora pega todos. */
function nomesDoHtml(buf) {
  const nomes = [];

  for (const m of buf.matchAll(RE_LABEL_G)) if (m[1]) nomes.push(m[1]);

  for (const m of buf.matchAll(RE_SLUG_G)) {
    const bruto = m[1] || m[2] || m[3] || m[4];
    if (!bruto) continue;
    // O slug vem com hifen no lugar do espaco; o apelido vem com sublinhado.
    // A normalizacao tira os dois, entao guardamos como veio.
    try { nomes.push(decodeURIComponent(bruto)); } catch { nomes.push(bruto); }
  }

  const vistos = new Set();
  return nomes.filter(n => {
    if (!n) return false;
    const k = norm(n);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

const cacheMem = new Map();

async function resolverVendedor(id, url) {
  const m = cacheMem.get(id);
  if (m && Date.now() - m.ts < TTL_VEND) return m.nomes;

  // v2: o cache antigo guardava so o primeiro nome do anuncio. Trocar o prefixo
  // invalida aquilo sem precisar limpar o storage na mao.
  const chave = 'v2_' + id;
  const g = (await chrome.storage.local.get(chave))[chave];
  if (g && Date.now() - g.ts < TTL_VEND) { cacheMem.set(id, g); return g.nomes; }

  let nomes = [];
  try {
    nomes = nomesDoHtml(await lerParcial(url || `https://produto.mercadolivre.com.br/${id.replace(/^MLB/, 'MLB-')}`));
  } catch (e) { nomes = []; }

  const reg = { nomes, ts: Date.now() };
  if (nomes.length) { cacheMem.set(id, reg); chrome.storage.local.set({ [chave]: reg }); }
  return nomes;
}

/* Acha o cupom da loja a partir dos nomes que o anuncio revelou.

   Primeiro tenta igualdade exata do nome normalizado. Se nao bater, tenta
   prefixo: "vertexbrasilfarma" (nome de fantasia) contra
   "vertexbrasilfarmaceutica" (apelido do hub de cupons).

   Tres travas para o prefixo nao inventar cupom onde nao ha:
     - o pedaco em comum precisa ter no minimo 12 caracteres, senao "casa"
       casaria com "casadastintas";
     - precisa ser prefixo de verdade, nao "contem no meio";
     - se mais de uma loja do indice bater, nao escolhe nenhuma. Mostrar o cupom
       da loja errada faz a pessoa tentar aplicar e o Mercado Livre recusar, que
       e exatamente a quebra de confianca que este site existe para evitar. */
const MIN_PREFIXO = 12;

function acharCupom(mapa, chaves, nomes) {
  for (const n of nomes) {
    const k = norm(n);
    if (k && mapa[k]) return mapa[k];
  }

  for (const n of nomes) {
    const k = norm(n);
    if (!k || k.length < MIN_PREFIXO) continue;
    const candidatos = chaves.filter(c => c.startsWith(k) || k.startsWith(c));
    if (candidatos.length === 1 && candidatos[0]) return mapa[candidatos[0]];
  }
  return null;
}

/* itens: [{id, url}] -> {id: {cupom|null, nome}} */
async function casarItens(itens) {
  const indice = await obterIndice();
  const mapa = indice.mapa;
  const chaves = Object.keys(mapa);
  const saida = {};

  for (let i = 0; i < itens.length; i += CONC_VEND) {
    const lote = itens.slice(i, i + CONC_VEND);
    await Promise.all(lote.map(async ({ id, url }) => {
      const nomes = await resolverVendedor(id, url);
      const achado = acharCupom(mapa, chaves, nomes);
      saida[id] = { cupom: achado, nome: nomes[0] || null };
    }));
  }
  return saida;
}


/* ================================================================
   v1.2 - CACADOR: dado um termo, acha produtos cujo vendedor tem cupom
   ================================================================ */

const BUSCA = t =>
  `https://lista.mercadolivre.com.br/${encodeURIComponent(t).replace(/%20/g,'-')}` +
  `_Frete_Full_FullFilter_True_NoIndex_True`;

/* O HTML da busca traz as URLs escapadas com /. Desescapamos e
   extraimos os permalinks de catalogo (/p/MLB...) e de anuncio (-_JM). */
function linksDaBusca(html) {
  const d = html.replace(/\\u002F/g, '/').replace(/\\"/g, '"');
  const cat = [...d.matchAll(/https:\/\/www\.mercadolivre\.com\.br\/[a-z0-9\-]{5,120}\/p\/MLB\d+/g)].map(m => m[0]);
  const jm  = [...d.matchAll(/https:\/\/(?:produto|www)\.mercadolivre\.com\.br\/MLB-\d+-[a-z0-9\-]{5,120}-_JM/g)].map(m => m[0]);
  return [...new Set([...cat, ...jm])];
}

async function cacar(termo, soFull = true) {
  const indice = await obterIndice();
  let url = BUSCA(termo);
  if (!soFull) url = url.replace('_Frete_Full_FullFilter_True_NoIndex_True', '');

  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('Busca falhou (HTTP ' + r.status + ')');
  const links = linksDaBusca(await r.text()).slice(0, 60);
  if (!links.length) return { termo, total: 0, achados: [], links: 0 };

  const achados = [];
  for (let i = 0; i < links.length; i += CONC_VEND) {
    const lote = links.slice(i, i + CONC_VEND);
    await Promise.all(lote.map(async link => {
      const id = (/MLB-?\d+/.exec(link) || [''])[0].replace('-', '');
      const nomes = await resolverVendedor(id, link);
      for (const n of nomes) {
        const k = norm(n);
        if (k && indice.mapa[k]) { achados.push({ link, id, vendedor: n, cupom: indice.mapa[k] }); break; }
      }
    }));
  }
  return { termo, total: links.length, achados, links: links.length };
}

/* ================================================================
   v1.2 - RADAR DA LOJA: produtos de entrega rapida de um vendedor
   ================================================================ */
async function radar(nickname) {
  const perfil = `https://www.mercadolivre.com.br/perfil/${encodeURIComponent(nickname)}`;
  const r = await fetch(perfil, { credentials: 'include', redirect: 'follow' });
  if (!r.ok) throw new Error('Perfil nao abriu (HTTP ' + r.status + ')');
  const destino = new URL(r.url);
  const base = destino.origin + destino.pathname.replace(/\/$/, '');
  const r2 = await fetch(base + '_Frete_Full', { credentials: 'include' });
  const html = r2.ok ? await r2.text() : await r.text();
  return { nickname, produtos: linksDaBusca(html).slice(0, 40) };
}

/* ================================================================
   v1.2 - GEMINI (opcional): texto de venda a partir de um produto
   A chave fica em chrome.storage, nunca no codigo.
   ================================================================ */
async function gerarTexto(titulo, preco, cupom, canal) {
  const { geminiKey, geminiModel } = await chrome.storage.local.get(['geminiKey', 'geminiModel']);
  if (!geminiKey) throw new Error('Configure sua chave do Gemini nas opcoes da extensao.');
  const modelo = geminiModel || 'gemini-flash-latest';

  const prompt = `Escreva uma mensagem curta de venda para ${canal || 'WhatsApp'}, em portugues do Brasil, `
    + `tom direto e honesto, sem exagero e sem emoji em excesso (no maximo 2).\n`
    + `Produto: ${titulo}\nPreco: ${preco}\nCupom disponivel: ${cupom}\n`
    + `Regras: no maximo 4 linhas, nao invente caracteristicas do produto, `
    + `nao prometa prazo de entrega, termine convidando a pessoa a abrir o link.`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': geminiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });

  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || ('HTTP ' + r.status));
  const txt = j?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n');
  if (!txt) throw new Error('A Gemini nao devolveu texto.');
  return txt.trim();
}

/* ================================================================
   v1.4 - ATENDIMENTO: link do cliente entra, MEU link sai
   ================================================================ */

/* ---------------------------------------------- geracao do link de afiliado

   O Mercado Livre recusa o POST quando ele sai do service worker da extensao,
   porque a origem vira chrome-extension://. Entao abrimos (ou reaproveitamos)
   uma aba do proprio gerador, em segundo plano, e rodamos a chamada la dentro,
   no contexto da pagina. Assim a origem, a Referer e o token do formulario sao
   todos legitimos, exatamente como quando voce clica no botao do site.
*/

function esperarCarregar(tabId, limiteMs = 25000) {
  return new Promise((ok, falha) => {
    const relogio = setTimeout(() => { chrome.tabs.onUpdated.removeListener(ouvir); falha(new Error('a pagina do gerador demorou demais')); }, limiteMs);
    function ouvir(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(relogio); chrome.tabs.onUpdated.removeListener(ouvir); ok();
      }
    }
    chrome.tabs.onUpdated.addListener(ouvir);
    chrome.tabs.get(tabId).then(t => {
      if (t && t.status === 'complete') { clearTimeout(relogio); chrome.tabs.onUpdated.removeListener(ouvir); ok(); }
    }).catch(() => {});
  });
}

/* roda no contexto da pagina do Mercado Livre */
function chamadaNaPagina(rota, url, tag) {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (!meta || !meta.content) return { falha: 'deslogado' };
  return fetch(rota, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-csrf-token': meta.content },
    body: JSON.stringify({ urls: [url], tag })
  }).then(r => r.text().then(t => ({ status: r.status, txt: t.slice(0, 1500) })))
    .catch(e => ({ falha: String(e && e.message || e) }));
}

/* Vitrine do cupom, lida de dentro da pagina do Mercado Livre.
   E o mesmo endpoint que o botao "Ver produtos" do hub de afiliados usa.
   Devolve a lista exata dos produtos que aquele cupom cobre, em uma das duas
   formas: _Container_<campanha> ou _CustId_<vendedor>. */
function vitrineNaPagina(id) {
  return fetch('/affiliate-program/api/affiliates/coupon-search-url?coupon_id=' + id, {
    credentials: 'include', headers: { accept: 'application/json' }
  })
    .then(function (r) { return r.text().then(function (t) { return { st: r.status, t: t }; }); })
    .then(function (d) {
      if (d.st >= 400) return { falha: 'HTTP ' + d.st };
      var m = /"coupons_product_url"\s*:\s*"([^"]+)"/.exec(d.t);
      if (!m) return { falha: 'sem url na resposta' };
      return { url: m[1].replace(/\\u002F/g, '/') };
    })
    .catch(function (e) { return { falha: String((e && e.message) || e) }; });
}

/* Cria a etiqueta do cupom de dentro da pagina do Mercado Livre.
   Mesma rota que o botao "Gerar codigo" do hub usa. */
function etiquetaNaPagina(id, sufixo) {
  return fetch('/affiliate-program/api/affiliates/create-code', {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ couponId: id, code: sufixo })
  })
    .then(function (r) { return r.text().then(function (t) { return { st: r.status, t: t }; }); })
    .then(function (d) {
      var m = /"alias"\s*:\s*"([^"]+)"/.exec(d.t);
      if (m) return { alias: m[1] };
      return { falha: 'HTTP ' + d.st, st: d.st };
    })
    .catch(function (e) { return { falha: String((e && e.message) || e) }; });
}

/* Le o anuncio de dentro de uma pagina do Mercado Livre.
   Do service worker isso nao funciona: a origem vira chrome-extension:// e o
   site devolve outra coisa. Aqui a origem, a Referer e a sessao sao legitimas,
   e o redirecionamento do meli.la tambem e seguido. */
function analiseNaPagina(url) {
  return fetch(url, { credentials: 'include', redirect: 'follow' })
    .then(function (r) { return r.text().then(function (t) { return { u: r.url, st: r.status, t: t }; }); })
    .then(function (d) {
      var t = d.t;
      function limpo(x) {
        return x == null ? null : x
          .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'")
          .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      }
      var lab  = /"seller_link"[\s\S]{0,600}?"label"\s*:\s*\{\s*"text"\s*:\s*"([^"]{2,60})"/.exec(t);
      var slug = /\\u002F(?:pagina|perfil)\\u002F([A-Za-z0-9._%-]{2,60})|\/(?:pagina|perfil)\/([A-Za-z0-9._%-]{2,60})/.exec(t);
      var h1   = /<h1[^>]*>([^<]{5,200})<\/h1>/i.exec(t);
      var og   = /property="og:title"\s+content="([^"]{5,200})"/i.exec(t);
      var tg   = /<title[^>]*>([\s\S]{5,250}?)<\/title>/i.exec(t);

      var titulo = limpo(h1 && h1[1]) || limpo(og && og[1]) || limpo(tg && tg[1]);
      if (titulo) {
        titulo = titulo.replace(/\s*\|\s*(Parcelamento|Mercado\s*Livre)[\s\S]*$/i, '')
                       .replace(/\s*-\s*R\$\s*[\d.,]+\s*$/, '').trim();
      }

      var preco = null;
      var pm = /"price"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)\s*[,}]/.exec(t);
      if (pm) { var n = parseFloat(pm[1]); if (n > 0 && n < 1e7) preco = n; }

      var nomes = [];
      if (lab) nomes.push(lab[1]);
      if (slug) {
        var x = slug[1] || slug[2];
        try { nomes.push(decodeURIComponent(x)); } catch (e) { nomes.push(x); }
      }
      /* URL canonica do anuncio.

         Descoberto na pratica: o gerador de links de afiliado NAO aceita a
         forma /up/MLBU... (pagina de catalogo). Ele devolve 200 e um meli.la,
         mas esse link joga o comprador no perfil social em vez do produto.
         As formas que funcionam sao /p/MLB... e a url direta do anuncio.
         Entao a gente le o canonical da propria pagina e gera o link por ele. */
      var can = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(t)
             || /property="og:url"\s+content="([^"]+)"/i.exec(t);
      var canonica = can ? limpo(can[1]) : null;
      if (canonica && !/^https?:\/\//i.test(canonica)) canonica = null;

      return { ok: true, finalUrl: d.u, status: d.st, nomes: nomes, titulo: titulo,
               preco: preco, canonica: canonica };
    })
    .catch(function (e) { return { ok: false, falha: String((e && e.message) || e) }; });
}

/* Aba onde o codigo do gerador roda.

   Bug real que isso conserta: "Cannot access contents of the page. Extension
   manifest must request permission to access the respective host."

   Vinha de reaproveitar uma aba de afiliados que, no instante do
   executeScript, ja nao estava mais numa pagina do mercadolivre.com.br -
   porque o Mercado Livre redirecionou para a tela de login, porque a aba ainda
   estava em about:blank, ou porque a pessoa navegou para outro site nela. A
   extensao so tem permissao em *.mercadolivre.com.br, entao o Chrome recusa, e
   o site do cliente so mostrava "fora do ar".

   Agora a aba e conferida antes de usar, e o erro, quando existe, diz o que
   realmente aconteceu. */

const HOST_OK = /^https:\/\/([a-z0-9-]+\.)*mercadolivre\.com\.br\//i;

async function urlDaAba(tabId) {
  try { const t = await chrome.tabs.get(tabId); return (t && t.url) || ''; }
  catch (e) { return ''; }
}

async function abaDoGerador() {
  const abertas = await chrome.tabs.query({ url: 'https://www.mercadolivre.com.br/afiliados/*' });
  for (const aba of (abertas || [])) {
    if (aba.status === 'complete' && HOST_OK.test(aba.url || '')) {
      return { tabId: aba.id, nossa: false };
    }
  }

  const t = await chrome.tabs.create({ url: PAGINA_GERADOR, active: false });
  await esperarCarregar(t.id);

  const url = await urlDaAba(t.id);
  if (!HOST_OK.test(url)) {
    try { await chrome.tabs.remove(t.id); } catch (e) {}
    // O destino mais comum fora do dominio e a tela de login/conta.
    if (/mercadolibre\.com|accounts?\./i.test(url)) {
      throw new Error('Voce esta deslogado do Mercado Livre neste navegador. Entre na conta de afiliado e tente de novo.');
    }
    throw new Error('A pagina do Mercado Livre nao abriu (' + (url || 'sem url') + ').');
  }

  return { tabId: t.id, nossa: true };
}

/* Abre (ou reaproveita) UMA aba e roda a tarefa inteira nela.
   Antes abria uma aba por link gerado, o que piscava na tela do usuario. */
async function comAbaML(tarefa) {
  const { tabId, nossa } = await abaDoGerador();
  try {
    // Confere de novo na hora de usar: entre a escolha e o executeScript a aba
    // pode ter saido do dominio, e ai o Chrome devolve aquele erro de permissao
    // que nao diz nada para quem esta esperando do outro lado.
    if (!HOST_OK.test(await urlDaAba(tabId))) {
      throw new Error('A aba do Mercado Livre saiu do ar no meio do caminho. Tente de novo.');
    }
    return await tarefa(tabId);
  } finally {
    if (nossa) { try { await chrome.tabs.remove(tabId); } catch (e) {} }
  }
}

async function vitrineDoCupom(tabId, id) {
  const [saida] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: vitrineNaPagina, args: [id]
  });
  const r = saida && saida.result;
  if (!r || r.falha || !r.url) return null;
  // So aceita uma lista do proprio Mercado Livre, nunca uma url qualquer.
  return /^https:\/\/lista\.mercadolivre\.com\.br\//.test(r.url) ? r.url : null;
}

async function gerarNaAba(tabId, url, tag = TAG_PADRAO) {
  const [saida] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: chamadaNaPagina, args: [ROTA_CRIAR, url, tag]
  });
  {
    const r = saida && saida.result;
    if (!r) throw new Error('nao consegui executar a chamada na pagina do Mercado Livre.');
    if (r.falha === 'deslogado')
      throw new Error('Voce esta deslogado do Mercado Livre neste navegador. Entre na conta de afiliado e tente de novo.');
    if (r.falha) throw new Error('A chamada falhou na pagina: ' + r.falha);
    if (r.status >= 400)
      throw new Error(`O gerador de links respondeu HTTP ${r.status}. ${String(r.txt || '').slice(0, 160)}`);
    const { curto, codigo } = lerResposta(r.txt || '');
    if (!curto) throw new Error('O link foi criado mas nao consegui ler a resposta.');
    return { link: curto, codigo };
  }
}

async function gerarLinkViaPagina(url, tag = TAG_PADRAO) {
  return comAbaML(tabId => gerarNaAba(tabId, url, tag));
}

async function gerarLinkAvulso(url, tag) {
  const r = await gerarLinkViaPagina(limparUrl(url), tag || undefined);
  return r.link;
}

const atenderLink = criarAtendimento({
  obterIndice, lerParcial, nomesDoHtml, norm, condicoesDe, cacar,
  gerarLink: gerarLinkViaPagina
});

/* ------------------------------------------ conferencia das condicoes reais

   Um cupom de "40% OFF" com teto de R$ 4 nao vale nada, e so da para saber
   isso abrindo as condicoes daquele cupom especifico. Sao milhares, e o
   Mercado Livre limita quem pede rapido demais. Entao vai aos poucos: a fila
   vem do BANCO (nao do indice local, que nunca teve esse campo), cada
   resultado e gravado na hora, e o que ja foi conferido sai da fila de vez.
*/

let conferindo = false;

async function conferirCondicoes(limite = 150) {
  if (conferindo) return { pulou: true };
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };

  conferindo = true;
  try {
    const ids = await condicoesPendentes(sincToken, limite);
    if (!ids.length) return { nada: true };
    const res = await completarCondicoes(ids, limite);
    if (!res.length) return { nada: true };
    const r = await salvarCondicoes(sincToken, res);
    console.log('[condicoes]', JSON.stringify(r));
    return r;
  } finally { conferindo = false; }
}

/* ------------------------------------------ links da vitrine de cada cupom

   Quem chega pelo nome da loja nao tem link de produto para colar, entao o
   botao do card precisa levar a algum lugar util. Aqui a extensao gera, uma
   vez por cupom, o link de afiliado da vitrine daquele cupom e guarda no
   banco. Depois disso o site serve o link na hora, mesmo com este computador
   desligado. Sao duas chamadas por cupom, em lotes pequenos, so para os
   cupons que o site realmente mostra. */

/* RELIGADA em 22/09, com o motivo registrado para nao virar vaivem.

   Eu tinha desligado isto porque o link de vitrine parecia nao funcionar: ele
   jogava a pessoa no perfil social do afiliado em vez dos produtos da loja.
   Estava errado, e o erro foi de metodo: todos os testes foram feitos com o
   Weslei logado na propria conta de afiliado, e nessa situacao o Mercado Livre
   desvia o proprio afiliado em vez de creditar a comissao.

   Teste em janela anonima, 22/09: meli.la/2N1uZTQ (Arrudestufas) abriu os
   produtos da loja normalmente. O link de vitrine funciona.

   O caso que falhou no mesmo teste, meli.la/1APi92n, era vitrine sem produto
   no ar marcada como cheia - bug do vitrineTemProduto, que conferia logado.
   Corrigido acima com credentials: 'omit'.

   Comentario antigo, mantido porque a parte sobre /up/MLBU continua valendo: */
/* O QUE REALMENTE NAO FUNCIONA:
   o gerador de links do Mercado Livre so preserva URL de PRODUTO. Dando a ele
   a URL de uma listagem (vitrine do cupom ou pagina da loja), ele devolve um
   meli.la que joga a pessoa no perfil social do afiliado, com recomendacoes de
   lojas variadas - nao nos produtos do cupom. Testado em varios cupons.
   Nao ha link de loja que mostre os produtos certos E pague comissao, entao o
   site nao promete isso e a extensao nao gasta chamada gerando esses links. */
let gerandoLinks = false;

async function gerarLinksDeCupons(limite = 60) {
  if (gerandoLinks) return { pulou: true };
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };

  gerandoLinks = true;
  try {
    const ids = await linksPendentes(sincToken, limite);
    if (!ids.length) return { nada: true };

    const prontos = await comAbaML(async tabId => {
      const saida = [];
      for (const id of ids) {
        let link = null;
        try {
          const vitrine = await vitrineDoCupom(tabId, id);
          if (vitrine) link = (await gerarNaAba(tabId, vitrine)).link || null;
        } catch (e) {
          console.warn('[links]', id, e.message);
          // Deslogado: parar o lote inteiro em vez de queimar tentativa de todos.
          if (/deslogad/i.test(e.message || '')) break;
        }
        saida.push({ id, link });
        await sleep(700);
      }
      return saida;
    });

    if (!prontos.length) return { nada: true };
    const r = await salvarLinks(sincToken, prontos);
    console.log('[links]', JSON.stringify(r));
    return r;
  } finally { gerandoLinks = false; }
}

/* ------------------------------------------------------- vitrines vazias

   Descoberto testando: o hub lista cupons cuja vitrine nao tem nenhum produto
   no ar. O link cai numa lista vazia do perfil e o codigo nao aplica em nada,
   porque nao ha item participante. Mostrar esses cupons e prometer o que nao
   existe, entao eles sao marcados e somem da vitrine do site. */

/* Roda no service worker, nao na aba: a vitrine mora em lista.mercadolivre.com.br
   e uma aba de www.mercadolivre.com.br nao consegue ler outra origem. Aqui o
   manifest ja autoriza o dominio inteiro e nao ha CORS. */
/* credentials: 'omit' de proposito, e esse detalhe e o bug que eu tinha aqui.

   Com a sessao do Weslei junto, o Mercado Livre devolve a pagina que ELE ve:
   recomendacoes, historico, itens que o cliente deslogado nao recebe. A
   vitrine era marcada como cheia e o cliente caia numa lista vazia. Foi
   exatamente o que aconteceu com o cupom da Vertex_brasil_farmaceutica, que
   estava marcado como ok e nao funcionou no teste em janela anonima.

   Deslogado aqui significa: conferir o que o comprador vai ver. */
async function vitrineTemProduto(url) {
  try {
    const r = await fetch(url, { credentials: 'omit', redirect: 'follow' });
    if (/\/social\/[^/]+\/lists/.test(r.url)) return { ok: false, motivo: 'lista vazia' };
    const t = await r.text();
    if (/n.o encontramos|sem resultados/i.test(t)) return { ok: false, motivo: 'sem resultados' };
    const precos = (t.match(/"price"\s*:\s*\d/g) || []).length;
    return { ok: precos >= 3, motivo: 'precos=' + precos };
  } catch (e) {
    return { ok: null, motivo: String((e && e.message) || e) };
  }
}

let conferindoVitrines = false;

async function conferirVitrines(limite = 40) {
  if (conferindoVitrines) return { pulou: true };
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };

  conferindoVitrines = true;
  try {
    const fila = await vitrinesParaConferir(sincToken, limite);
    if (!fila.length) return { nada: true };

    const saida = await comAbaML(async tabId => {
      const res = [];
      for (const linha of fila) {
        let origem = linha.link_origem;
        try {
          if (!origem) origem = await vitrineDoCupom(tabId, linha.id);
          if (!origem) { res.push({ id: linha.id, ok: false, origem: null }); continue; }
          const v = await vitrineTemProduto(origem);
          // ok === null e erro de rede: nao conclui nada, tenta outro dia.
          if (v.ok !== null) res.push({ id: linha.id, ok: !!v.ok, origem });
        } catch (e) {
          console.warn('[vitrines]', linha.id, e.message);
          if (/deslogad/i.test(e.message || '')) break;
        }
        await sleep(900);
      }
      return res;
    });

    if (!saida.length) return { nada: true };
    const r = await salvarVitrines(sincToken, saida);
    console.log('[vitrines]', JSON.stringify(r));
    return r;
  } finally { conferindoVitrines = false; }
}

/* ------------------------------------------------------ etiquetas de cupom

   O codigo do cupom e o que da ao cliente a certeza de que o desconto veio do
   Weslei: ele cola no carrinho e ve o valor cair.

   O cuidado que manda aqui: o Mercado Livre NAO deixa apagar um codigo depois
   de criado e nao publica limite de quantos podem existir. Entao a regra e
   nunca criar por impulso da extensao:

     - quem diz quantas podem nascer e o banco (teto total e teto por dia);
     - so entram cupons que o site realmente mostra, ja com vitrine gerada e
       com pelo menos 2 dias de validade, para nao queimar codigo permanente
       num cupom que morre amanha;
     - qualquer resposta 403 ou 429 para o lote inteiro na hora, porque e o
       sinal classico de que o servidor quer que a gente pare;
     - uma chamada a cada 2 segundos, ritmo de gente, nao de robo. */

const SUFIXO_MAX = 9;

/* Sufixo legivel e unico: desconto + final do id do cupom.
   "18% OFF" no cupom 13588207 vira 18OFF8207. O id no fim garante que dois
   cupons da mesma loja com o mesmo desconto nao colidam. */
function sufixoDaEtiqueta(id, desconto) {
  const num = String(desconto || '').replace(/[^\d]/g, '').slice(0, 3) || '0';
  const base = num + 'OFF';
  const cabe = SUFIXO_MAX - base.length;
  const cauda = String(id).slice(-Math.max(cabe, 0));
  return (base + cauda).slice(0, SUFIXO_MAX).toUpperCase();
}

/* So gera agora quem foi pedido por alguem no site. O resto espera a rotina
   diaria. Assim o visitante e atendido em ate um minuto sem que isso vire um
   jeito de furar os tetos: a fila continua sendo cortada pelo banco. */
async function atenderPedidosDeEtiqueta() {
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };
  const fila = await etiquetasPendentes(sincToken, 3);
  const pedidos = fila.filter(x => x.pedido);
  if (!pedidos.length) return { nada: true };
  return gerarEtiquetas(3, pedidos);
}

let gerandoEtiquetas = false;

async function gerarEtiquetas(limite = 20, filaPronta = null) {
  if (gerandoEtiquetas) return { pulou: true };
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };

  gerandoEtiquetas = true;
  try {
    const fila = filaPronta || await etiquetasPendentes(sincToken, limite);
    if (!fila.length) return { nada: true };

    const prontas = await comAbaML(async tabId => {
      const saida = [];
      for (const linha of fila) {
        const sufixo = sufixoDaEtiqueta(linha.id, linha.desconto);
        let codigo = null;
        try {
          const [r] = await chrome.scripting.executeScript({
            target: { tabId }, world: 'MAIN', func: etiquetaNaPagina, args: [linha.id, sufixo]
          });
          const res = r && r.result;
          if (res && res.alias) codigo = res.alias;
          else if (res && (res.st === 403 || res.st === 429)) {
            console.warn('[etiquetas] o Mercado Livre pediu para parar:', res.st);
            break;                       // nao insiste: para o lote inteiro
          }
        } catch (e) {
          console.warn('[etiquetas]', linha.id, e.message);
          if (/deslogad/i.test(e.message || '')) break;
        }
        saida.push({ id: linha.id, codigo });
        await sleep(2000);
      }
      return saida;
    });

    if (!prontas.length) return { nada: true };
    const r = await salvarEtiquetas(sincToken, prontas);
    console.log('[etiquetas]', JSON.stringify(r));
    return r;
  } finally { gerandoEtiquetas = false; }
}

/* ============================================================
   MESMO PRODUTO, OUTRA LOJA COM CUPOM
   ============================================================

   A regra do Weslei: so pode indicar o cupom de outra loja se a loja vender
   EXATAMENTE o mesmo produto. Busca por palavra-chave nao serve, porque acha
   parecido e o cliente descobre no carrinho.

   O que funciona, verificado na pagina real de catalogo MLB2089077370:

   Toda pagina /p/MLB<id> carrega no estado inicial o componente
   "buy_box_offers", que e a lista de ofertas do MESMO produto de catalogo
   feitas por vendedores diferentes. Cada oferta traz o item_id do anuncio e o
   preco. Nesse teste vieram tres: MLB5365421378 a R$ 2.300,54,
   MLB6444702764 a R$ 2.434,34 e MLB4267460841 a R$ 2.373,00.

   O nome do vendedor que aparece dentro do buy_box_offers NAO e confiavel
   (nesse mesmo teste o bloco dizia BONARACE e a pagina do anuncio dizia AZUMA
   PNEUS), entao o vendedor de cada oferta e sempre lido do anuncio, com o
   resolverVendedor que ja existe.

   O endereco de cada oferta e /p/<catalogo>?pdp_filters=item_id:<anuncio>.
   Confirmado: abrir o permalink do anuncio redireciona exatamente para essa
   forma. E URL de produto, que e a unica que o gerador de link de afiliado
   preserva. */

const RE_CATALOGO = /\/p\/(MLB\d+)/i;
const MAX_CATALOGO = 900000;

/* O leitor normal aborta cedo, assim que acha o vendedor. Aqui a gente precisa
   ir mais fundo, ate o bloco das ofertas, entao ele tem limite proprio. */
async function lerCatalogo(url) {
  const ctrl = new AbortController();
  const r = await fetch(url, { credentials: 'include', redirect: 'follow', signal: ctrl.signal });
  if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);

  const leitor = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', bytes = 0;

  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      bytes += value.length;
      buf += dec.decode(value, { stream: true });
      if (bytes > MAX_CATALOGO) { ctrl.abort(); break; }
    }
  } catch (e) { /* abort gera excecao, esperado */ }

  return buf;
}

function ofertasDoCatalogo(html) {
  const i = html.indexOf('"buy_box_offers":{');
  if (i < 0) return [];
  const bloco = html.slice(i, i + 300000);

  const RE = /"selected"\s*:\s*(?:true|false)\s*,\s*"type"\s*:\s*"([A-Z_]+)"\s*,\s*"item_id"\s*:\s*"(MLB\d+)"/g;
  const marcas = [...bloco.matchAll(RE)];

  const saida = [];
  const vistos = new Set();
  for (let k = 0; k < marcas.length; k++) {
    const ini = marcas[k].index;
    const fim = k + 1 < marcas.length ? marcas[k + 1].index : ini + 8000;
    const jan = bloco.slice(ini, fim);
    const p = /"price"\s*:\s*\{[^}]{0,400}?"value"\s*:\s*([\d.]+)/.exec(jan);
    const item = marcas[k][2];
    if (vistos.has(item)) continue;
    vistos.add(item);
    saida.push({ item, preco: p ? Number(p[1]) : null });
  }
  return saida;
}

function urlDaOferta(pagina, item) {
  return `${pagina}?pdp_filters=item_id%3A${item}`;
}

/* Preco e titulo direto do html do anuncio, para os candidatos que vem da
   busca (a busca nao traz preco confiavel ligado a cada link). */
function precoDoHtml(html) {
  if (!html) return null;
  const m = /"price"\s*:\s*([\d.]+)/.exec(html)
         || /itemprop="price"[^>]*content="([\d.]+)"/.exec(html);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n < 1e7 ? n : null;
}

function tituloDoHtml(html) {
  if (!html) return '';
  const m = /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i.exec(html)
         || /<title>([^<]+)<\/title>/i.exec(html);
  return m ? m[1] : '';
}

function palavras(t) {
  return norm(String(t || '').replace(/[^\p{L}\p{N}]+/gu, ' '))
    ? String(t || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/).filter(p => p.length > 2)
    : [];
}

/* O candidato so conta como "o mesmo produto" quando a maior parte das
   palavras do titulo original aparece nele. Sem essa trava a busca devolve
   acessorio parecido e o site indicaria outra coisa. */
function mesmoTitulo(original, candidato) {
  const a = palavras(original);
  const b = new Set(palavras(candidato));
  if (a.length < 3) return false;
  const iguais = a.filter(p => b.has(p)).length;
  return iguais / a.length >= 0.6;
}

const RE_UP = /\/up\/(MLBU?\d+)/i;

/* Devolve a melhor oferta do MESMO produto numa loja com cupom, ou null.

   Null quando: nao achamos o produto em outra loja, nenhum vendedor tem cupom
   que preste, ou a alternativa nao sai mais barata que o que a pessoa ja
   estava vendo. Nesse ultimo caso mandar a pessoa trocar de loja seria dar
   trabalho a ela para economizar nada. */
/* Por que a troca de loja nao aconteceu. Sem isso "nao achei" e uma caixa
   preta. */
let motivoOutra = null;

/* Avalia uma lista de candidatos [{item, url, preco?}] e devolve os que tem
   cupom valendo para aquele preco. */
async function avaliarCandidatos(candidatos, itemAtual, tituloOriginal) {
  const indice = await obterIndice();
  const chaves = Object.keys(indice.mapa);

  let comCupom = 0;
  const achados = [];

  for (const o of candidatos) {
    if (itemAtual && o.item === itemAtual) continue;

    let html = null;
    let nomes = [];
    let preco = o.preco ?? null;

    if (preco == null || tituloOriginal) {
      try { html = await lerParcial(o.url); } catch (e) { html = null; }
      if (preco == null) preco = precoDoHtml(html);
      if (tituloOriginal && !mesmoTitulo(tituloOriginal, tituloDoHtml(html))) { await sleep(300); continue; }
      nomes = nomesDoHtml(html || '');
    }
    if (!nomes.length) {
      try { nomes = await resolverVendedor(o.item, o.url); } catch (e) { nomes = []; }
    }

    const cupom = acharCupom(indice.mapa, chaves, nomes);
    if (!cupom) { await sleep(400); continue; }
    comCupom++;

    let cond = null;
    try { cond = await condicoesDe(cupom.i); } catch (e) { cond = null; }
    const aval = avaliar(cupom, cond, preco);
    await sleep(400);
    if (!aval || !aval.vale) continue;

    achados.push({
      item: o.item,
      url: o.url,
      preco,
      vendedor: nomes[0] || null,
      cupom: { id: cupom.i, titulo: cupom.t, vence: cupom.x },
      economia: aval.economia,
      minimo: aval.minimo,
      teto: aval.teto,
      final: preco != null && aval.economia != null ? preco - aval.economia : null
    });
  }

  return { achados, comCupom };
}

/* Fallback para anuncio que nao e de catalogo: procura o mesmo titulo na
   busca do Mercado Livre e testa os primeiros resultados. */
async function candidatosPorBusca(titulo) {
  const termo = palavras(titulo).slice(0, 8).join(' ');
  if (!termo) return [];
  const url = BUSCA(termo).replace('_Frete_Full_FullFilter_True_NoIndex_True', '_NoIndex_True');
  let html = '';
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return [];
    html = await r.text();
  } catch (e) { return []; }

  return linksDaBusca(html).slice(0, 10).map(link => ({
    item: (/MLB-?\d+/.exec(link) || [''])[0].replace('-', ''),
    url: link,
    preco: null
  })).filter(c => c.item);
}

async function mesmoProdutoComCupom(urlProduto, precoAtual, itemAtual, titulo) {
  motivoOutra = null;

  let pagina = null;
  let html = null;

  const mc = RE_CATALOGO.exec(urlProduto);
  const mu = RE_UP.exec(urlProduto);
  if (mc) pagina = `https://www.mercadolivre.com.br/p/${mc[1]}`;
  else if (mu) pagina = `https://www.mercadolivre.com.br/up/${mu[1]}`;

  if (!pagina) {
    try { html = await lerCatalogo(urlProduto); } catch (e) { html = null; }
    const can = html && /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html);
    const alvo = can ? can[1] : '';
    const c2 = RE_CATALOGO.exec(alvo) || (html ? RE_CATALOGO.exec(html) : null);
    const u2 = RE_UP.exec(alvo) || (html ? RE_UP.exec(html) : null);
    if (c2) pagina = `https://www.mercadolivre.com.br/p/${c2[1]}`;
    else if (u2) pagina = `https://www.mercadolivre.com.br/up/${u2[1]}`;
    if (html && !html.includes('"buy_box_offers":{')) html = null;
  }

  let ofertas = [];
  if (pagina) {
    if (!html) { try { html = await lerCatalogo(pagina); } catch (e) { html = null; } }
    ofertas = html ? ofertasDoCatalogo(html) : [];
  }

  let resultado = { achados: [], comCupom: 0 };
  if (ofertas.length >= 2) {
    resultado = await avaliarCandidatos(
      ofertas.map(o => ({ item: o.item, url: urlDaOferta(pagina, o.item), preco: o.preco })),
      itemAtual, null);
  }

  // Sem outras ofertas na pagina do produto: tenta achar o mesmo item na busca.
  if (!resultado.achados.length && titulo) {
    const busca = await candidatosPorBusca(titulo);
    if (busca.length) {
      const r2 = await avaliarCandidatos(busca, itemAtual, titulo);
      resultado = { achados: resultado.achados.concat(r2.achados),
                    comCupom: resultado.comCupom + r2.comCupom };
    }
  }

  if (!resultado.achados.length) {
    motivoOutra = resultado.comCupom
      ? 'as outras lojas tem cupom, mas nenhum vale para este preco'
      : (ofertas.length >= 2
          ? 'nenhuma outra loja deste produto tem cupom'
          : 'nao achei este mesmo produto em outra loja com cupom');
    return null;
  }

  resultado.achados.sort((a, b) =>
    (a.final == null ? Infinity : a.final) - (b.final == null ? Infinity : b.final));
  const melhor = resultado.achados[0];

  if (precoAtual != null && melhor.final != null && melhor.final >= precoAtual) {
    motivoOutra = 'a outra loja com cupom nao sai mais barata';
    return null;
  }
  return melhor;
}

/* ------------------------------------------- fila continua de conferencia

   O gargalo nunca foi o Mercado Livre: era a agenda. A conferencia so
   acontecia quando o alarme diario disparava, e se o Chrome estivesse fechado
   naquele minuto o dia inteiro passava em branco. Numero real medido no banco
   hoje: 9.151 cupons no ar, 306 conferidos, ultimo lote parado ha mais de um
   dia.

   Agora a conferencia anda sozinha em lotes pequenos a cada 10 minutos,
   enquanto o Chrome estiver aberto, ate bater o teto do dia.

   Tres cuidados que nao podem sair daqui:

     - teto diario de verdade, contado no storage e zerado na virada do dia em
       Sao Paulo. Sem teto isso vira um robo batendo no Mercado Livre o dia
       inteiro, que e exatamente o jeito de levar bloqueio;
     - um lote por rodada, curto. Service worker do Chrome morre em tarefa
       longa, entao 200 de uma vez nao terminaria;
     - vitrine na frente de condicao. A fila de vitrine e curta (so cupons ja
       classificados como bons) e e ela que decide o que o site mostra: cupom
       de loja sem produto no ar e promessa que nao da para cumprir. A fila de
       condicao tem milhares e engoliria todas as rodadas. */

const TETO_DIA_CONDICOES = 600;
const TETO_DIA_VITRINES = 250;
/* Link de vitrine e criacao permanente no Mercado Livre, igual a etiqueta.
   Teto mais baixo de proposito. */
const TETO_DIA_LINKS = 120;
const LOTE_CONDICOES = 40;
const LOTE_VITRINES = 15;
const LOTE_LINKS = 10;

function diaSP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

async function gastoDoDia() {
  const { gastoFila } = await chrome.storage.local.get('gastoFila');
  const dia = diaSP();
  if (!gastoFila || gastoFila.dia !== dia) return { dia, condicoes: 0, vitrines: 0, links: 0 };
  if (gastoFila.links == null) gastoFila.links = 0;
  return gastoFila;
}

async function anotarGasto(campo, quanto) {
  const g = await gastoDoDia();
  g[campo] = (g[campo] || 0) + quanto;
  await chrome.storage.local.set({ gastoFila: g });
}

let andandoFila = false;

async function andarFila() {
  if (andandoFila) return { pulou: true };
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };

  andandoFila = true;
  try {
    const g = await gastoDoDia();

    if (g.vitrines < TETO_DIA_VITRINES) {
      const quanto = Math.min(LOTE_VITRINES, TETO_DIA_VITRINES - g.vitrines);
      const r = await conferirVitrines(quanto);
      if (r && !r.nada && !r.pulou && !r.semToken) {
        await anotarGasto('vitrines', quanto);
        return { vitrines: r };
      }
    }

    /* Link da vitrine depois da conferencia da vitrine: so gera link para
       cupom de loja que comprovadamente tem produto no ar. Link de afiliado
       para vitrine vazia e promessa que nao da para cumprir. */
    if (g.links < TETO_DIA_LINKS) {
      const quanto = Math.min(LOTE_LINKS, TETO_DIA_LINKS - g.links);
      const r = await gerarLinksDeCupons(quanto);
      if (r && !r.nada && !r.pulou && !r.semToken) {
        await anotarGasto('links', quanto);
        return { links: r };
      }
    }

    if (g.condicoes < TETO_DIA_CONDICOES) {
      const quanto = Math.min(LOTE_CONDICOES, TETO_DIA_CONDICOES - g.condicoes);
      const r = await conferirCondicoes(quanto);
      if (r && !r.nada && !r.pulou && !r.semToken) {
        await anotarGasto('condicoes', quanto);
        return { condicoes: r };
      }
    }

    return { nada: true };
  } finally { andandoFila = false; }
}

/* ------------------------------------------------- fila de pedidos do site */

let atendendo = false;
/* Se um pedido novo chega no meio de uma rodada, o site fica esperando ate o
   proximo alarme (1 min). Esse sinal faz a rodada seguinte comecar sozinha
   assim que a atual termina. */
let chegouPedidoNovo = false;

async function atenderPedidos() {
  if (atendendo) { chegouPedidoNovo = true; return { atendidos: 0, pulou: true }; }
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { atendidos: 0, semToken: true };

  atendendo = true;
  let ok = 0, falhou = 0, pendentes = [];
  try {
    pendentes = await pedidosPendentes(sincToken);
    if (!pendentes.length) return { atendidos: 0, pendentes: 0 };

    await comAbaML(async (tabId) => {
      for (const p of pendentes.slice(0, 6)) {
        if (!p.url_alvo) {
          await marcarPedido(sincToken, p.id, null, null, 'pedido sem link');
          falhou++; continue;
        }
        try {
          // Marca que pegou: o site troca "na fila" por "lendo o anuncio".
          iniciarPedido(sincToken, p.id).catch(() => {});
          const url = limparUrl(p.url_alvo);

          // 1. le o anuncio de dentro da pagina do Mercado Livre
          const [saida] = await chrome.scripting.executeScript({
            target: { tabId }, world: 'MAIN', func: analiseNaPagina, args: [url]
          });
          const a = (saida && saida.result) || { ok: false, falha: 'a pagina nao respondeu' };

          // 2. procura o cupom da loja NO BANCO (tem teto e compra minima)
          let cupom = null, vendedor = null;
          for (const nome of (a.nomes || [])) {
            if (!vendedor) vendedor = nome;
            try {
              const c = await melhorCupom(sincToken, nome);
              if (c) { cupom = c; vendedor = c.vendedor; break; }
            } catch (e) { /* segue tentando o proximo nome */ }
          }

          const aval = avaliarCupom(cupom, a.preco ?? null);

          // 3. o SEU link sai sempre, com ou sem cupom
          const r = await gerarNaAba(tabId, url, TAG_PADRAO);

          /* PRIORIDADE: se a loja do link nao tem cupom que preste, procurar o
             MESMO produto de catalogo numa loja que tenha cupom valendo para
             ESTE preco (compra minima atendida e desconto de verdade), gerar o
             link de afiliado DAQUELA oferta e devolver as duas coisas. O site
             mostra a troca com o preco final dos dois lados.

             procurouOutra registra que a busca aconteceu: sem isso o site nao
             sabe diferenciar "nao procurei" de "procurei e nao achou", e a
             honestidade do texto depende dessa diferenca. */
          let outra = null;
          let procurouOutra = false;
          if (!(cupom && aval && aval.vale)) {
            procurouOutra = true;
            try {
              const itemAtual =
                (/item_id(?:%3A|:)(MLB\d+)/i.exec(url) || [])[1] ||
                (/MLB-?(\d{6,})/i.exec(url) ? 'MLB' + /MLB-?(\d{6,})/i.exec(url)[1] : null);
              const alt = await mesmoProdutoComCupom(url, a.preco ?? null, itemAtual);
              if (alt) {
                const la = await gerarNaAba(tabId, alt.url);
                outra = {
                  vendedor: alt.vendedor,
                  preco: alt.preco,
                  economia: alt.economia,
                  minimo: alt.minimo,
                  teto: alt.teto,
                  final: alt.final,
                  cupomTitulo: alt.cupom.titulo,
                  vence: alt.cupom.vence,
                  link: la.link,
                  codigo: la.codigo
                };
              }
            } catch (e) {
              console.warn('[mesmo produto]', e.message);
            }
          }

          await marcarPedido(sincToken, p.id, r.link, r.codigo, null, {
            titulo: a.titulo ?? null,
            preco: a.preco ?? null,
            vendedor: vendedor ?? null,
            outraLoja: outra,
            procurouOutra,
            motivoOutra: procurouOutra ? motivoOutra : null,
            temCupom: !!(cupom && aval && aval.vale),
            cupom: cupom ? {
              id: cupom.id,
              titulo: cupom.desconto, vence: cupom.vence,
              teto: aval ? aval.teto : null, minimo: aval ? aval.minimo : null,
              economia: aval ? aval.economia : null,
              bloqueado: aval ? aval.bloqueado : null
            } : null,
            lojaLida: !!(a.nomes && a.nomes.length),
            diagnostico: a.ok ? null : (a.falha || 'nao consegui ler o anuncio')
          });
          ok++;
        } catch (e) {
          await marcarPedido(sincToken, p.id, null, null, e.message || String(e), null);
          falhou++;
        }
        await sleep(600); // um pedido por vez, sem pressa
      }
    });

    if (ok || falhou) console.log(`[pedidos] ${ok} atendidos, ${falhou} falharam`);
    return { atendidos: ok, falharam: falhou, pendentes: pendentes.length };
  } finally {
    atendendo = false;
    if (chegouPedidoNovo) {
      chegouPedidoNovo = false;
      setTimeout(() => atenderPedidos().catch(() => {}), 400);
    }
  }
}

/* ------------------------------------------------------------ mensagens */

chrome.runtime.onMessage.addListener((msg, _s, responder) => {
  (async () => {
    try {
      if (msg.tipo === 'indice') {
        responder({ ok: true, dados: await obterIndice(msg.forcar) });
      } else if (msg.tipo === 'vendedor') {
        const indice = await obterIndice();
        const nomes = Array.isArray(msg.nomes) && msg.nomes.length ? msg.nomes : [msg.nome];
        responder({
          ok: true,
          cupom: acharCupom(indice.mapa, Object.keys(indice.mapa), nomes),
          atualizadoEm: indice.atualizadoEm
        });
      } else if (msg.tipo === 'itens') {
        responder({ ok: true, resultado: await casarItens(msg.itens || []) });
      } else if (msg.tipo === 'cacar') {
        responder({ ok: true, dados: await cacar(msg.termo, msg.soFull !== false) });
      } else if (msg.tipo === 'radar') {
        responder({ ok: true, dados: await radar(msg.nickname) });
      } else if (msg.tipo === 'texto') {
        responder({ ok: true, texto: await gerarTexto(msg.titulo, msg.preco, msg.cupom, msg.canal) });
      } else if (msg.tipo === 'atender') {
        responder({ ok: true, dados: await atenderLink(msg.url, { tag: msg.tag, buscarAlternativa: msg.alternativas !== false }) });
      } else if (msg.tipo === 'linkDe') {
        responder({ ok: true, link: await gerarLinkAvulso(msg.url, msg.tag) });
      } else if (msg.tipo === 'sincronizar') {
        const indice = await obterIndice(true);
        responder({ ok: true, res: await sincronizarComSite(indice.lista, true) });
      } else if (msg.tipo === 'conferir') {
        responder({ ok: true, res: await conferirCondicoes(msg.limite || 150) });
      } else if (msg.tipo === 'atenderPedidos') {
        responder({ ok: true, res: await atenderPedidos() });
      } else if (msg.tipo === 'statusSincronia') {
        const { ultimaSincronia, sincToken } = await chrome.storage.local.get(['ultimaSincronia', 'sincToken']);
        responder({ ok: true, ultima: ultimaSincronia || null, configurado: !!sincToken });
      } else if (msg.tipo === 'atenderAgora') {
        // Veio da ponte no site: alguem acabou de pedir um link e esta
        // esperando na tela. Nao responde o resultado, so dispara.
        atenderPedidos().catch(e => console.warn('[pedidos]', e.message));
        responder({ ok: true });
      } else if (msg.tipo === 'andarFila') {
        responder({ ok: true, res: await andarFila() });
      } else if (msg.tipo === 'gastoDoDia') {
        responder({
          ok: true,
          gasto: await gastoDoDia(),
          tetos: { condicoes: TETO_DIA_CONDICOES, vitrines: TETO_DIA_VITRINES }
        });
      } else if (msg.tipo === 'conferirVitrines') {
        responder({ ok: true, res: await conferirVitrines(msg.limite || 60) });
      } else if (msg.tipo === 'gerarEtiquetas') {
        responder({ ok: true, res: await gerarEtiquetas(msg.limite || 20) });
      } else if (msg.tipo === 'gerarLinksCupons') {
        responder({ ok: true, res: await gerarLinksDeCupons(msg.limite || 60) });
      } else if (msg.tipo === 'aquecer') {
        obterIndice().catch(() => {});
        responder({ ok: true });
      } else responder({ ok: false, erro: 'tipo desconhecido' });
    } catch (e) { responder({ ok: false, erro: e.message || String(e) }); }
  })();
  return true;
});

/* Pegada no Mercado Livre
   ------------------------
   A varredura completa da lista de cupons custa ~665 requisicoes. Rodando a
   cada 3 horas dava mais de 5.000 chamadas por dia saindo da conta de afiliado
   do Weslei, o que e o tipo de padrao que derruba conta. Agora a lista e
   recarregada 2x por dia e a conferencia de condicoes anda em lotes menores.
   O alarme 'pedidos' bate no Supabase dele, nao no Mercado Livre, entao pode
   continuar de minuto em minuto: e ele que faz o site responder na hora. */
const ALARMES = {
  refresh: 720,   // 2x por dia: recarrega a lista completa de cupons
  diario: 1440,   // 1x por dia: etiquetas (codigos permanentes, sem pressa)
  fila: 10,       // conferencia continua, com teto diario
  pedidos: 1,     // Supabase, nao ML: pedidos vindos do site
};

function armarAlarmes() {
  for (const [nome, periodInMinutes] of Object.entries(ALARMES)) {
    chrome.alarms.create(nome, { periodInMinutes });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  armarAlarmes();
  obterIndice(true).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  armarAlarmes();
  obterIndice().catch(() => {});
  atenderPedidos().catch(() => {});
  // Abrir o Chrome ja adianta uma rodada: nao espera os 10 minutos do alarme.
  setTimeout(() => andarFila().catch(() => {}), 20000);
});
chrome.alarms.onAlarm.addListener(async a => {
  if (a.name === 'pedidos') {
    atenderPedidos().catch(e => console.warn('[pedidos]', e.message));
    // Quem clicou "Gerar o codigo deste cupom" no site esta esperando na tela.
    // Lote de 3 para nao virar porta dos fundos dos tetos diarios.
    atenderPedidosDeEtiqueta().catch(e => console.warn('[etiquetas]', e.message));
    return;
  }
  if (a.name === 'fila') {
    andarFila().catch(e => console.warn('[fila]', e.message));
    return;
  }
  if (a.name === 'refresh') {
    obterIndice(true).catch(() => {});
    return;
  }
  if (a.name === 'diario') {
    // Etiqueta e codigo permanente: 1x por dia, depois que a fila ja separou
    // quais cupons prestam e quais lojas tem produto no ar.
    try { await gerarEtiquetas(20); } catch (e) { console.warn('[etiquetas]', e.message); }
  }
});
