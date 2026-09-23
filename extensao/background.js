import { sincronizarComSite, completarCondicoes, condicoesDe,
         pedidosPendentes, marcarPedido, melhorCupom,
         condicoesPendentes, salvarCondicoes, iniciarPedido,
         linksPendentes, salvarLinks,
         etiquetasPendentes, salvarEtiquetas,
         vitrinesParaConferir, salvarVitrines,
         lojasParaResolver, salvarPaginaLoja, marcarLojaSemPagina,
         anotarEstadoRobo } from './sincronia.js';
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
    /* 20000, nao 1500.

       Com 1500 a resposta chegava cortada no meio do JSON, o JSON.parse
       falhava e o link saia como "criado mas nao consegui ler a resposta".
       Aconteceu 18 vezes em tres horas, ou seja, 18 links criados de verdade
       no Mercado Livre e 18 pessoas sem resposta na tela.

       Medido na resposta real: 1075 bytes para uma URL curta. Cada item traz
       long_url, origin_url, regex, list_url e deeplink_list_url, entao uma URL
       longa (as que o aplicativo gera, com pdp_filters e rastreio) multiplica
       isso e passa fácil dos 1500. */
  }).then(r => r.text().then(t => ({ status: r.status, txt: t.slice(0, 20000) })))
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
/* ------------------------------------------------- leitura do anuncio

   CAUSA RAIZ, encontrada em 23/09 medindo os 108 pedidos ja feitos.

   A leitura do anuncio rodava DENTRO da pagina do Mercado Livre, via
   executeScript com world MAIN. Ali nao existe privilegio de extensao: vale
   CORS de navegador comum. Entao a aba estava em www.mercadolivre.com.br e
   qualquer endereco de outra origem era bloqueado antes de sair:

     /p/MLB...      mesma origem  -> 20 de 24 leram
     /up/MLBU...    mesma origem  -> 25 de 40 leram
     produto.mercadolivre.com.br  -> 0 de 4  leram  (subdominio != origem)
     lista.mercadolivre.com.br    -> 0 de 35 leram
     meli.la                      -> 0 de 5  leram

   Todo "Failed to fetch" do banco e isso. Nao era permissao no manifest: a
   permissao nem chegava a ser consultada, porque a requisicao nao partia da
   extensao.

   A correcao e buscar no service worker, que tem host_permissions e nao passa
   por CORS, e so entao extrair. A extracao e texto puro e nao precisa de
   pagina nenhuma. A leitura na pagina fica como plano B. */

const MAX_ANUNCIO = 3_000_000;

function extrairAnuncio(t, finalUrl, status) {
  function limpo(x) {
    return x == null ? null : x
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const lab  = /"seller_link"[\s\S]{0,600}?"label"\s*:\s*\{\s*"text"\s*:\s*"([^"]{2,60})"/.exec(t);
  const slug = /\\u002F(?:pagina|perfil)\\u002F([A-Za-z0-9._%-]{2,60})|\/(?:pagina|perfil)\/([A-Za-z0-9._%-]{2,60})/.exec(t);
  const h1   = /<h1[^>]*>([^<]{5,200})<\/h1>/i.exec(t);
  const og   = /property="og:title"\s+content="([^"]{5,200})"/i.exec(t);
  const tg   = /<title[^>]*>([\s\S]{5,250}?)<\/title>/i.exec(t);

  let titulo = limpo(h1 && h1[1]) || limpo(og && og[1]) || limpo(tg && tg[1]);
  if (titulo) {
    titulo = titulo.replace(/\s*\|\s*(Parcelamento|Mercado\s*Livre)[\s\S]*$/i, '')
                   .replace(/\s*-\s*R\$\s*[\d.,]+\s*$/, '').trim();
  }

  let preco = null;
  const pm = /"price"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)\s*[,}]/.exec(t);
  if (pm) { const n = parseFloat(pm[1]); if (n > 0 && n < 1e7) preco = n; }

  const nomes = [];
  if (lab) nomes.push(lab[1]);
  if (slug) {
    const x = slug[1] || slug[2];
    try { nomes.push(decodeURIComponent(x)); } catch (e) { nomes.push(x); }
  }

  let can = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(t)
         || /property="og:url"\s+content="([^"]+)"/i.exec(t);
  let canonica = can ? limpo(can[1]) : null;
  if (canonica && !/^https?:\/\//i.test(canonica)) canonica = null;

  return { ok: true, finalUrl: finalUrl, status: status, nomes: nomes,
           titulo: titulo, preco: preco, canonica: canonica };
}

/* Le o anuncio a partir do service worker. Segue redirecionamento, entao um
   meli.la chega aqui e sai como a url final do produto. */
async function lerAnuncioNoWorker(url) {
  const ctrl = new AbortController();
  const corta = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { credentials: 'include', redirect: 'follow', signal: ctrl.signal });
    if (!r.ok || !r.body) return { ok: false, falha: 'HTTP ' + r.status };

    const leitor = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', bytes = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      bytes += value.length;
      buf += dec.decode(value, { stream: true });
      if (bytes > MAX_ANUNCIO) { try { ctrl.abort(); } catch (e) {} break; }
    }
    if (!buf) return { ok: false, falha: 'pagina veio vazia' };

    /* Alguns links curtos de compartilhamento nao levam a um produto: caem no
       PERFIL SOCIAL do afiliado, com varios produtos. Foi o caso do
       meli.la/2tKW17F, que termina em /social/wesleimendes. Dali dava para
       arrancar o titulo e o preco do primeiro item, e era o que acontecia: o
       site mostrava produto e preco de um anuncio que ninguem escolheu, sem
       loja nenhuma. Melhor dizer a verdade e pedir o link do produto. */
    /* MURO DE CAPTCHA.

       O Mercado Livre desafia a sessao quando acha que do outro lado tem robo.
       Visto de verdade em 23/09: a leitura voltou com titulo "Por seguranca,
       complete esta etapa" e o gerador respondeu com origin_url apontando para
       /captcha/wall/logged.

       Isso e a plataforma pedindo para PARAR. Insistir e o caminho curto para
       a conta ser marcada, entao aqui se puxa o freio do dia inteiro e nao se
       tenta contornar o desafio de jeito nenhum. Quem resolve captcha e o
       Weslei, na mao, no navegador dele. */
    if (/\/captcha\/wall/i.test(r.url) || /Por seguran.a, complete esta etapa/i.test(buf.slice(0, 20000))) {
      await puxarFreio('o Mercado Livre pediu verificacao de seguranca ao ler um anuncio', 'leitura');
      return { ok: false, captcha: true,
               falha: 'o Mercado Livre pediu uma verificacao de seguranca nesta sessao' };
    }

    if (/\/social\/[^/?#]+/i.test(r.url)) {
      return { ok: false, perfilSocial: true,
               falha: 'esse link abre um perfil do Mercado Livre, nao um produto' };
    }

    return extrairAnuncio(buf, r.url, r.status);
  } catch (e) {
    return { ok: false, falha: String((e && e.message) || e) };
  } finally {
    clearTimeout(corta);
  }
}

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
  /* SO a pagina do proprio gerador serve.

     Antes servia qualquer aba em /afiliados/*, e isso quebrou de verdade: o
     Weslei tinha uma aba do /afiliados/hub aberta mostrando a pagina de erro
     do Mercado Livre (XMEHV37590). Aquela pagina tem csrf-token, entao a
     chamada saia dali, voltava sem link nenhum e o pedido morria com "o link
     foi criado mas nao consegui ler a resposta". O gerador estava bem; a aba e
     que era a errada. */
  const abertas = await chrome.tabs.query({ url: PAGINA_GERADOR + '*' });
  for (const aba of (abertas || [])) {
    if (aba.status === 'complete' && HOST_OK.test(aba.url || '')
        && (aba.url || '').startsWith(PAGINA_GERADOR)) {
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
    if (!curto) {
      /* Sem o inicio da resposta, este erro nao dizia nada e custou horas de
         investigacao. Agora ele carrega a prova junto. */
      const bruto = String(r.txt || '');
      if (/captcha\/wall/i.test(bruto)) {
        await puxarFreio('o Mercado Livre pediu verificacao de seguranca no gerador de links', 'link');
        throw new Error('o Mercado Livre pediu uma verificacao de seguranca nesta sessao');
      }
      const amostra = bruto.replace(/\s+/g, ' ').slice(0, 180);
      throw new Error('O gerador respondeu sem link. Resposta: ' + (amostra || '(vazia)'));
    }
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
/* Como saber se a vitrine de um cupom tem produto de verdade.

   Historico desta funcao, para nao repetir nenhum dos dois erros:

   1. A primeira versao contava ocorrencias de "price" e exigia 3 ou mais.
      Marcava como cheia vitrine que nao estava, e marcava como vazia loja com
      um ou dois produtos, que e vitrine legitima.

   2. Eu "consertei" trocando para credentials: 'omit', achando que assim veria
      o que o comprador deslogado ve. Resultado medido depois: 423 conferencias,
      423 marcadas como vazias, zero cheias. Deslogado o Mercado Livre devolve
      uma casca de 9 KB sem nenhum preco, nao a lista real. A regra virou 100%
      falso negativo, e com isso o site parou de mostrar o botao novo e a
      geracao de link de vitrine ficou sem fila.

   Medicao real numa vitrine com 3 produtos:
     deslogado: 9 KB,   0 precos, nenhuma contagem de resultados
     logado:  425 KB,  30 precos, "3 resultados"

   Entao: logado (e o unico jeito de ver a lista real) e a decisao sai da
   contagem que a propria pagina publica, "N resultados". Um produto ja basta.

   O teste de texto "nao encontramos" saiu: essa frase aparece tambem em
   paginas que TEM resultado, numa secao de sugestao, e era fonte de falso
   negativo. */
async function vitrineTemProduto(url) {
  try {
    const r = await fetch(url, { credentials: 'include', redirect: 'follow' });
    // Caiu no perfil social: o Mercado Livre nao achou a vitrine.
    if (/\/social\/[^/]+\/lists/.test(r.url)) return { ok: false, motivo: 'perfil social' };

    const t = await r.text();

    // Casca sem conteudo: nao da para concluir nada, tenta outro dia.
    if (t.length < 50000) return { ok: null, motivo: 'pagina incompleta (' + t.length + ')' };

    const m = /(\d+)\s+resultados?/i.exec(t);
    if (m && m[1] != null) {
      const n = Number(m[1]);
      return { ok: n >= 1, motivo: n + ' resultados' };
    }

    // Sem a contagem: cai para os precos, agora com limite honesto de 1.
    const precos = (t.match(/"price"\s*:\s*\d/g) || []).length;
    return { ok: precos >= 1, motivo: 'precos=' + precos };
  } catch (e) {
    return { ok: null, motivo: String((e && e.message) || e) };
  }
}

/* --------------------------------------------- endereco da vitrine da loja */

/* O QUE ESTE BLOCO RESOLVE.

   O botao "Ver itens da loja" precisa cair na prateleira de quem oferece o
   cupom. Ate agora ele so tinha para onde ir quando havia link de afiliado
   guardado - 113 de 972 cupons. Nos outros, o site pedia para a pessoa colar o
   link de um anuncio que ela ainda nem tinha escolhido.

   NAO DA PARA ADIVINHAR O ENDERECO. Conferi em lojas reais do banco:

     vendedor no banco            endereco real da vitrine
     Augustusmobiliario     ->    /pagina/augustusmvrc/
     Sied20240106044007     ->    /pagina/k4p5vnd2/
     Jcarvalhoimport2_      ->    /pagina/jcarvalhoimport2_/
     Ireplacegroup          ->    /pagina/ireplacegroup/

   Metade bate com o nome, metade nao tem nada a ver. Montar o endereco a
   partir do nome erraria em uma loja a cada duas, e o erro nao aparece como
   erro: o Mercado Livre cai numa BUSCA por aquele texto, com produtos de
   outras lojas no meio. O cliente clicaria achando que esta na loja do cupom.

   ENTAO O ENDERECO E LIDO, NAO CHUTADO. Dois caminhos, nessa ordem:

     1. /_CustId_<numero do vendedor>  - o numero ja vem escrito no link da
        campanha do cupom, em duas formas: _CustId_2615738264 e
        _Container_Queima-de-Estoque-seller-1789666895. O Mercado Livre
        redireciona sozinho para a vitrine da loja.

     2. /perfil/<APELIDO>  - para as lojas cujo cupom veio sem link de campanha.
        O apelido e o proprio nome do vendedor no banco.

   Em qualquer um dos dois, o que vale e o endereco FINAL depois do
   redirecionamento, e so se a pagina tiver produto no ar. */

const RE_PAGINA_LOJA = /^https:\/\/(www|lista)\.mercadolivre\.com\.br\/pagina\/[A-Za-z0-9._%-]{2,60}\/?$/;

/* Le a pagina no service worker (e nao numa aba) porque aqui o fetch usa as
   host_permissions da extensao: nao ha CORS e o redirecionamento chega inteiro
   em r.url. Foi essa diferenca que quebrou a leitura antes, quando o codigo
   rodava no mundo MAIN da pagina. */
async function lerVitrine(url) {
  const r = await fetch(url, { credentials: 'include', redirect: 'follow' });
  const finalUrl = (r.url || url).split('#')[0];

  /* O Mercado Livre pediu verificacao de seguranca. Freia e sai: insistir
     depois desse sinal e o que leva a conta a bloqueio. */
  if (/\/captcha\/wall/.test(finalUrl)) { await puxarFreio('verificacao de seguranca ao abrir a vitrine de uma loja', 'leitura'); return { freio: true }; }

  const t = await r.text();

  /* Caiu no perfil social - vitrine de varias lojas, nao serve. */
  if (/\/social\/[^/]+/.test(finalUrl)) return { ok: false, motivo: 'perfil social' };

  const canon = (t.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [])[1] || null;
  const alvo = (canon && RE_PAGINA_LOJA.test(canon.split('?')[0])) ? canon.split('?')[0] : finalUrl.split('?')[0];

  /* Tem produto no ar? Sem produto, o endereco existe mas a prateleira esta
     vazia, e mandar o cliente para la e pior do que nao ter botao. */
  const porContagem = /(\d+)\s+resultados?/i.exec(t);
  const itens = porContagem ? Number(porContagem[1]) : (t.match(/ui-search-layout__item/g) || []).length;
  const precos = (t.match(/"price"\s*:\s*\d/g) || []).length;
  const temProduto = itens >= 1 || precos >= 1;

  return { ok: temProduto, alvo, itens, precos, ehPaginaDeLoja: RE_PAGINA_LOJA.test(alvo), status: r.status };
}

/* Descobre o endereco da vitrine de UMA loja. Devolve o endereco ou null.
   Faz no maximo duas leituras, e para na primeira que der certo. */
async function resolverVitrineDaLoja(vendedor, sellerId) {
  const tentativas = [];
  if (sellerId) tentativas.push('https://lista.mercadolivre.com.br/_CustId_' + sellerId);
  /* /perfil/ so faz sentido quando o nome do vendedor e mesmo um apelido:
     nome com espaco ("Cordilheira Mix") nao e endereco. */
  if (vendedor && !/\s/.test(vendedor)) {
    tentativas.push('https://www.mercadolivre.com.br/perfil/' + encodeURIComponent(vendedor.toUpperCase()));
  }

  for (const url of tentativas) {
    let r;
    try { r = await lerVitrine(url); } catch (e) { continue; }
    if (r.freio) return { freio: true };
    if (!r.ok) continue;

    /* Endereco proprio de loja: e o melhor destino, tem nome e marca dela. */
    if (r.ehPaginaDeLoja) return { url: r.alvo, itens: r.itens };

    /* Sem pagina propria, mas a lista de anuncios do vendedor tem produto:
       serve, e e exatamente "a lista de produtos daquela loja". */
    if (/_CustId_\d+/.test(url)) return { url: url, itens: r.itens };
  }
  return { url: null };
}

let resolvendoLojas = false;

async function resolverPaginasDeLoja(limite = LOTE_LOJAS) {
  if (resolvendoLojas) return { pulou: true };
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };

  resolvendoLojas = true;
  try {
    const lojas = await lojasParaResolver(sincToken, limite);
    if (!lojas.length) return { nada: true };

    let achadas = 0, vazias = 0, cupons = 0;
    for (const loja of lojas) {
      if (await freioLigado('leitura')) return { freio: true, achadas, vazias };

      const r = await resolverVitrineDaLoja(loja.vendedor, loja.seller_id);
      if (r.freio) return { freio: true, achadas, vazias };

      if (r.url) {
        const n = await salvarPaginaLoja(sincToken, loja.vendedor, r.url).catch(() => null);
        achadas++;
        cupons += Number(loja.cupons) || 0;
      } else {
        await marcarLojaSemPagina(sincToken, loja.vendedor).catch(() => null);
        vazias++;
      }

      /* Ritmo de gente lendo, nao de robo varrendo: 6 a 11 segundos entre
         lojas. Com 8 lojas por rodada e uma rodada por minuto, da cerca de
         uma leitura a cada 8 segundos no pior caso - longe de rajada. */
      await sleep(6000 + Math.floor(Math.random() * 5000));
    }
    return { achadas, vazias, cupons, lojas: lojas.length };
  } finally { resolvendoLojas = false; }
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
          /* Nao descobrir a URL da vitrine NAO e prova de que a loja esta
             vazia. Marcar ok:false aqui foi o que encheu o banco de "sem
             produto no ar": o cupom saia da lista do site por uma falha de
             leitura, nao por falta de produto. Sem URL, nao se conclui nada e
             o cupom volta para a fila. */
          if (!origem) continue;
          const v = await vitrineTemProduto(origem);
          // ok === null e erro de rede: nao conclui nada, tenta outro dia.
          if (v.ok !== null) res.push({ id: linha.id, ok: !!v.ok, origem, motivo: v.motivo || null });
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

/* --------------------------------------------- freio de seguranca por area

   O QUE ESTAVA ERRADO. A versao anterior parava TUDO ate a virada do dia no
   segundo sinal. Hoje isso custou o dia: um captcha lendo um anuncio as 12:25 e
   a maquina ficou cinco horas sem gerar uma unica etiqueta, com gente esperando
   na tela do site. Parar de criar etiqueta por causa de um captcha numa pagina
   de produto e fechar a loja porque a campainha tocou.

   DUAS CORRECOES.

   1. O freio vale por AREA. Captcha lendo pagina publica trava a LEITURA.
      Etiqueta so trava quando o proprio gerador de etiqueta responde 403 ou
      429, que e o unico sinal que fala sobre etiqueta. Cada area conta sozinha.

   2. A pausa CRESCE mas sempre termina: 5, 15 e 60 minutos, e fica em 60 daí em
      diante. Nunca mais "parado ate amanha". Recuar ate uma hora ja e recuo de
      sobra para qualquer limite de ritmo; uma hora custa uma hora, nao um dia.

   O QUE NAO MUDOU: o sinal continua sendo respeitado na hora em que chega, e
   continua sem nenhuma tentativa de resolver captcha. */
const PAUSAS_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];

function chaveFreio(area) { return 'freio_' + (area || 'leitura'); }

async function puxarFreio(motivo, area = 'leitura') {
  const k = chaveFreio(area);
  const hoje = diaSP();
  const st = await chrome.storage.local.get(k);
  const atual = st[k] || {};
  const vezes = (atual.dia === hoje ? (atual.vezes || 0) : 0) + 1;
  const espera = PAUSAS_MS[Math.min(vezes, PAUSAS_MS.length) - 1];
  const ate = Date.now() + espera;

  await chrome.storage.local.set({ [k]: { dia: hoje, vezes, ate, motivo: String(motivo) } });
  console.warn('[freio:' + area + ']', Math.round(espera / 60000) + ' min:', motivo);

  try {
    const { sincToken } = await chrome.storage.local.get('sincToken');
    await anotarEstadoRobo(sincToken, 'freio_motivo', String(motivo));
    await anotarEstadoRobo(sincToken, 'freio_ate', new Date(ate).toISOString());
  } catch (e) { /* o freio vale mesmo se o aviso nao sair */ }
}

/* Texto do freio quando a area esta pausada, null quando esta liberada. */
async function freioLigado(area = 'leitura') {
  const k = chaveFreio(area);
  const st = await chrome.storage.local.get(k);
  const f = st[k];
  if (!f || !f.ate || Date.now() >= f.ate) { void avisarQueEstouLivre(area); return null; }
  const min = Math.max(1, Math.ceil((f.ate - Date.now()) / 60000));
  return (f.motivo || 'sem motivo registrado') + ' (volta em ' + min + ' min)';
}

let avisouLivre = {};

/* Limpa o aviso no site quando NENHUMA area esta parada, para o cartao nao
   continuar mostrando pausa que ja passou. */
async function avisarQueEstouLivre(area) {
  const marca = (area || 'leitura') + ':' + Math.floor(Date.now() / 600000);
  if (avisouLivre[marca]) return;
  for (const a of ['leitura', 'etiqueta', 'link']) {
    const st = await chrome.storage.local.get(chaveFreio(a));
    const f = st[chaveFreio(a)];
    if (f && f.ate && Date.now() < f.ate) return;
  }
  avisouLivre = { [marca]: true };
  try {
    const { sincToken } = await chrome.storage.local.get('sincToken');
    await anotarEstadoRobo(sincToken, 'freio_motivo', '');
    await anotarEstadoRobo(sincToken, 'freio_ate', '');
    await anotarEstadoRobo(sincToken, 'visto_em', new Date().toISOString());
  } catch (e) { /* silencioso de proposito */ }
}

/* O estado antigo podia deixar a maquina parada ate a virada do dia. Some com
   ele assim que esta versao carrega, senao atualizar nao destrava nada. */
chrome.storage.local.remove(['freioDia', 'freioAte', 'freioVezes', 'freioMotivo']);

async function gerarEtiquetas(limite = 20, filaPronta = null) {
  if (gerandoEtiquetas) return { pulou: true };
  /* SO o freio de etiqueta. Captcha lendo pagina de produto nao tem nada a ver
     com criar codigo no hub de afiliados, e era isso que estava derrubando a
     geracao o dia inteiro. */
  const travado = await freioLigado('etiqueta');
  if (travado) return { freio: travado };
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
            /* Para o lote E o dia. Ver puxarFreio acima. */
            await puxarFreio('o Mercado Livre respondeu ' + res.st + ' ao criar o codigo', 'etiqueta');
            break;
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

function urlDaOferta(catalogo, item) {
  return `https://www.mercadolivre.com.br/p/${catalogo}?pdp_filters=item_id%3A${item}`;
}

/* Devolve a melhor oferta do MESMO produto, ou null.

   MUDANCA IMPORTANTE, 23/09. Antes isto so aceitava loja que tivesse cupom no
   indice do Weslei. Caso real que mostrou o erro: Kit Wella Oil Reflections,
   R$ 428,90 na Amobeleza com cupom de 15% (final R$ 364,56), e o MESMO produto
   a R$ 291,95 no iSalao, que nao tem cupom nenhum. A versao antiga jogava o
   iSalao fora por nao ter cupom e nao mostrava nada, escondendo R$ 72,61 de
   economia real do cliente. Em 107 links colados, nenhuma alternativa foi
   devolvida uma unica vez.

   Quem decide agora e o PRECO FINAL: preco da oferta menos o desconto do cupom
   daquela loja, quando existir. Loja sem cupom entra na disputa com desconto
   zero e ganha se ainda assim sair mais barata. O link de afiliado sai do
   mesmo jeito nos dois casos, entao mostrar a opcao mais barata nao custa
   comissao ao Weslei, e esconder custa a confianca do cliente.

   Null quando: nao e produto de catalogo, so existe um vendedor, ou nenhuma
   alternativa bate o que a pessoa ja estava vendo por uma margem que valha o
   trabalho de trocar de loja. */
/* ------------------------------- procurar o mesmo produto na busca do ML

   O buy_box so existe em produto de catalogo. Anuncio solto nao tem, e ate
   agora o site simplesmente desistia: "essa loja nao tem cupom" e ponto, sem
   nunca olhar se o mesmo produto estava mais barato ou com cupom em outro
   vendedor. Era metade da promessa do site nao sendo cumprida.

   Aqui a extensao faz o que uma pessoa faria: abre a busca do Mercado Livre
   pelo titulo do produto e olha os primeiros resultados.

   Ritmo de gente, de proposito. Uma busca, no maximo seis candidatos, com a
   mesma pausa entre leituras que o resto do codigo usa. Depois do captcha de
   hoje, volume e a ultima coisa que esta operacao precisa. */
const MAX_CANDIDATOS_BUSCA = 6;

function palavrasDoTitulo(t) {
  return norm(t || '').replace(/([a-z])(\d)/g, '$1 $2')
    .split(/\s+/).filter(w => w.length >= 3);
}

/* Dois titulos falam do mesmo produto? Nao da para exigir igualdade: cada
   vendedor escreve do seu jeito. Exige-se que a maior parte das palavras do
   titulo original apareca no candidato. */
function pareceMesmoProduto(original, candidato) {
  const a = palavrasDoTitulo(original);
  const b = new Set(palavrasDoTitulo(candidato));
  if (a.length < 3) return false;
  const iguais = a.filter(w => b.has(w)).length;
  return iguais / a.length >= 0.6;
}

function urlDeBusca(titulo) {
  const termo = String(titulo || '').trim().slice(0, 90);
  return 'https://lista.mercadolivre.com.br/' + encodeURIComponent(termo).replace(/%20/g, '-');
}

/* Le os resultados da busca. Cada cartao vira { item, preco, titulo }. */
function ofertasDaBusca(html, tituloOriginal, precoRef) {
  const blocos = String(html).split('ui-search-layout__item');
  const vistos = new Set();
  const saida = [];

  for (const b of blocos.slice(1)) {
    const pedaco = b.slice(0, 4000);
    /* O id aparece de duas formas na pagina: MLB4436662488 dentro do JSON e
       MLB-4436662488 nos enderecos. Aceita as duas e guarda sem o hifen. */
    const cru = (/\bMLB-?(\d{8,})\b/.exec(pedaco) || [])[1];
    const id = cru ? 'MLB' + cru : null;
    if (!id || vistos.has(id)) continue;

    const tit = (/<h[23][^>]*>([^<]{10,200})<\/h[23]>/i.exec(pedaco)
              || /"title"\s*:\s*"([^"]{10,200})"/.exec(pedaco) || [])[1];
    if (!tit || !pareceMesmoProduto(tituloOriginal, tit)) continue;

    const pm = /"amount"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/.exec(pedaco)
            || /andes-money-amount__fraction[^>]*>([\d.]{1,12})</.exec(pedaco);
    let preco = null;
    if (pm) {
      const n = parseFloat(String(pm[1]).replace(/\./g, ''));
      if (n > 0 && n < 1e7) preco = n;
    }
    if (preco == null) continue;

    /* Preco absurdo em relacao ao que a pessoa esta vendo quase sempre e outro
       produto: acessorio, kit, unidade avulsa. Fora. */
    if (precoRef != null && (preco < precoRef * 0.4 || preco > precoRef * 1.6)) continue;

    vistos.add(id);
    saida.push({ item: id, preco, titulo: tit });
    if (saida.length >= MAX_CANDIDATOS_BUSCA) break;
  }
  return saida;
}

/* Procura o mesmo produto na busca e devolve a melhor alternativa, na mesma
   forma que mesmoProdutoComCupom devolve. Cupom e bonus, nao requisito: loja
   mais barata sem cupom tambem ganha, porque a comissao do Weslei sai do
   clique no link de afiliado de qualquer jeito. */
async function mesmoProdutoNaBusca(titulo, finalAtual, itemAtual) {
  let html;
  try { html = await lerCatalogo(urlDeBusca(titulo)); }
  catch (e) { console.warn('[busca]', e.message); return null; }

  const precoRef = finalAtual != null ? finalAtual : null;
  const candidatos = ofertasDaBusca(html, titulo, precoRef);
  if (!candidatos.length) return null;

  const indice = await obterIndice();
  const chaves = Object.keys(indice.mapa);
  const achados = [];

  for (const c of candidatos) {
    if (itemAtual && c.item === itemAtual) continue;
    const url = 'https://produto.mercadolivre.com.br/' + c.item.replace(/^MLB/, 'MLB-');

    let nomes = [];
    try { nomes = await resolverVendedor(c.item, url); } catch (e) { nomes = []; }

    const cupom = acharCupom(indice.mapa, chaves, nomes);
    let aval = null;
    if (cupom) {
      let cond = null;
      try { cond = await condicoesDe(cupom.i); } catch (e) { cond = null; }
      aval = avaliar(cupom, cond, c.preco);
    }
    await sleep(400);

    const vale = Boolean(aval && aval.vale);
    const economia = vale && aval.economia != null ? aval.economia : 0;

    achados.push({
      item: c.item, url, preco: c.preco, vendedor: nomes[0] || null,
      cupom: vale ? { id: cupom.i, titulo: cupom.t, vence: cupom.x } : null,
      economia,
      minimo: vale ? aval.minimo : null,
      teto: vale ? aval.teto : null,
      final: c.preco - economia,
      achadoNaBusca: true
    });
  }

  if (!achados.length) return null;
  achados.sort((a, b) => {
    if (a.final !== b.final) return a.final - b.final;
    return (b.cupom ? 1 : 0) - (a.cupom ? 1 : 0);
  });

  const melhor = achados[0];
  if (finalAtual == null || melhor.final == null) return null;
  const ganho = finalAtual - melhor.final;
  if (ganho < 5 || ganho / finalAtual < 0.03) return null;

  melhor.ganho = ganho;
  melhor.finalAtual = finalAtual;
  return melhor;
}

async function mesmoProdutoComCupom(urlProduto, finalAtual, itemAtual) {
  let cat = (RE_CATALOGO.exec(urlProduto) || [])[1] || null;
  let html = null;

  if (!cat) {
    html = await lerCatalogo(urlProduto);
    const can = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html);
    cat = (RE_CATALOGO.exec(can ? can[1] : '') || [])[1]
       || (RE_CATALOGO.exec(html) || [])[1] || null;
    /* Sem catalogo nao existe buy_box. Em vez de desistir, procura o mesmo
       produto na busca do Mercado Livre, como uma pessoa faria. */
    if (!cat) {
      const tit = (/<h1[^>]*>([^<]{5,200})<\/h1>/i.exec(html)
                || /property="og:title"\s+content="([^"]{5,200})"/i.exec(html) || [])[1];
      if (!tit) return null;
      return await mesmoProdutoNaBusca(tit, finalAtual, itemAtual);
    }
    // O html que temos e o do anuncio, nao o do catalogo: busca o certo.
    if (!html.includes('"buy_box_offers":{')) html = null;
  }

  if (!html) html = await lerCatalogo(`https://www.mercadolivre.com.br/p/${cat}`);

  const ofertas = ofertasDoCatalogo(html);
  if (ofertas.length < 2) {
    /* Produto de catalogo com um vendedor so: a busca ainda pode achar o mesmo
       item anunciado fora do catalogo por outra loja. */
    const tit = (/<h1[^>]*>([^<]{5,200})<\/h1>/i.exec(html) || [])[1];
    return tit ? await mesmoProdutoNaBusca(tit, finalAtual, itemAtual) : null;
  }

  const indice = await obterIndice();
  const chaves = Object.keys(indice.mapa);

  const achados = [];
  for (const o of ofertas) {
    if (itemAtual && o.item === itemAtual) continue;
    const url = urlDaOferta(cat, o.item);

    /* Sem preco nao da para comparar nada, entao nao entra. */
    if (o.preco == null) { await sleep(200); continue; }

    let nomes = [];
    try { nomes = await resolverVendedor(o.item, url); } catch (e) { nomes = []; }

    /* Cupom e um BONUS, nao um requisito. Loja sem cupom entra com zero. */
    const cupom = acharCupom(indice.mapa, chaves, nomes);
    let aval = null;
    if (cupom) {
      let cond = null;
      try { cond = await condicoesDe(cupom.i); } catch (e) { cond = null; }
      aval = avaliar(cupom, cond, o.preco);
    }
    await sleep(400);

    const vale = Boolean(aval && aval.vale);
    const economia = vale && aval.economia != null ? aval.economia : 0;

    achados.push({
      item: o.item,
      url,
      preco: o.preco,
      vendedor: nomes[0] || null,
      cupom: vale ? { id: cupom.i, titulo: cupom.t, vence: cupom.x } : null,
      economia,
      minimo: vale ? aval.minimo : null,
      teto: vale ? aval.teto : null,
      final: o.preco - economia
    });
  }

  if (!achados.length) return null;

  achados.sort((a, b) => {
    const fa = a.final == null ? Infinity : a.final;
    const fb = b.final == null ? Infinity : b.final;
    if (fa !== fb) return fa - fb;
    /* Empate no preco final: a loja COM cupom ganha. Vale mais para o cliente,
       que leva o desconto no carrinho, e para o Weslei, que alem da comissao
       do clique fica com a atribuicao do cupom dele. */
    return (b.cupom ? 1 : 0) - (a.cupom ? 1 : 0);
  });
  const melhor = achados[0];

  /* So vale mandar a pessoa trocar de loja por uma diferenca que ela sinta.
     Menos de R$ 5 ou menos de 3% e trabalho para nao economizar nada. */
  if (finalAtual == null || melhor.final == null) return null;
  const ganho = finalAtual - melhor.final;
  if (ganho < 5 || ganho / finalAtual < 0.03) return null;

  melhor.ganho = ganho;
  melhor.finalAtual = finalAtual;
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
/* Endereco de vitrine e a tarefa mais barata da fila: uma leitura por LOJA, e
   o resultado vale para todos os cupons dela. Mesmo assim vai devagar, porque
   e leitura de pagina publica do Mercado Livre e o que derruba a conta e
   rajada, nao volume espalhado. */
const TETO_DIA_LOJAS = 200;
const LOTE_LOJAS = 8;

function diaSP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/* ------------------------------------------------- janelas de atualizacao

   Quatro horarios de Brasilia escolhidos pelo Weslei: 01:00, 11:00, 17:30 e
   21:00. Em cada um a extensao faz a rodada forte: recarrega a lista inteira
   de cupons do hub e gera ate 150 etiquetas.

   Por que janela e nao alarme cravado no horario: alarme de horario exato
   morre junto com o service worker e nao volta sozinho se a maquina estiver
   ocupada naquele minuto. Aqui o alarme curto so pergunta "ja passei por esta
   janela hoje?". Basta o servidor estar de pe em qualquer momento dentro da
   janela para a rodada acontecer, e se ele ficou fora do ar a proxima janela
   recupera.

   Cada janela fica marcada no storage, entao roda uma vez e nao repete a cada
   10 minutos. */
const JANELAS = ['01:00', '11:00', '17:30', '21:00'];
const JANELA_DURACAO_MIN = 90;
const ETIQUETAS_POR_JANELA = 150;

function minutosAgoraSP() {
  const hm = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function janelaAgora() {
  const agora = minutosAgoraSP();
  for (const j of JANELAS) {
    const [h, m] = j.split(':').map(Number);
    const ini = h * 60 + m;
    if (agora >= ini && agora < ini + JANELA_DURACAO_MIN) return j;
  }
  return null;
}

/* A rodada forte da janela: lista completa de cupons, depois etiquetas.

   "Gerou cupom, gera a etiqueta": o refresh do indice entra primeiro, entao os
   cupons novos ja estao no banco quando as etiquetas sao pedidas em seguida. */
async function rodadaDaJanela(janela) {
  const marca = diaSP() + ' ' + janela;
  const { janelaFeita } = await chrome.storage.local.get('janelaFeita');
  if (janelaFeita === marca) return { jaFeita: true };

  /* Marca ANTES de comecar. Se a rodada quebrar no meio, a proxima janela
     recupera; repetir a rodada inteira a cada 10 minutos seria pior. */
  await chrome.storage.local.set({ janelaFeita: marca });

  const saida = { janela };
  try { await obterIndice(true); saida.indice = 'ok'; }
  catch (e) { saida.indice = 'falhou: ' + e.message; }

  try { saida.etiquetas = await gerarEtiquetas(ETIQUETAS_POR_JANELA); }
  catch (e) { saida.etiquetas = 'falhou: ' + e.message; }

  console.log('[janela]', JSON.stringify(saida));
  return saida;
}

async function gastoDoDia() {
  const { gastoFila } = await chrome.storage.local.get('gastoFila');
  const dia = diaSP();
  if (!gastoFila || gastoFila.dia !== dia) return { dia, condicoes: 0, vitrines: 0, links: 0, lojas: 0 };
  if (gastoFila.links == null) gastoFila.links = 0;
  if (gastoFila.lojas == null) gastoFila.lojas = 0;
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
    /* Freio puxado hoje: nada de trabalho automatico. Os pedidos de cliente
       continuam sendo tentados mais abaixo, porque sao poucos e no ritmo de
       quem esta esperando na tela; o que nao pode continuar e o robo varrendo
       o Mercado Livre depois de ele ter pedido verificacao. */
    const travado = await freioLigado('leitura');
    if (travado) {
      const pedidos = await atenderPedidos().catch(() => null);
      return { freio: travado, pedidos };
    }

    /* Janela de atualizacao tem prioridade sobre a conferencia de fundo:
       e nela que a lista cresce e as etiquetas nascem. */
    const janela = janelaAgora();
    if (janela) {
      const r = await rodadaDaJanela(janela);
      if (!r.jaFeita) return r;
    }

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

    /* POR ULTIMO, DE PROPOSITO. Eu tinha posto isto em primeiro lugar, e estava
       errado: sao 219 lojas a resolver, 8 por rodada, e como cada rodada
       termina assim que faz algum trabalho, a fila ficaria semanas presa aqui
       sem conferir condicao nem gerar link. Endereco de vitrine e melhoria;
       condicao de cupom e o que o cliente le na tela. Melhoria vai depois. */
    if (g.lojas < TETO_DIA_LOJAS) {
      const quanto = Math.min(LOTE_LOJAS, TETO_DIA_LOJAS - g.lojas);
      const r = await resolverPaginasDeLoja(quanto);
      if (r && !r.nada && !r.pulou && !r.semToken) {
        await anotarGasto('lojas', quanto);
        return { lojas: r };
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

    /* Quantas pessoas estao esperando agora. Com fila curta da para fazer o
       trabalho completo em cada pedido, incluindo a busca do mesmo produto em
       outra loja, que custa varias leituras. Com fila cheia isso vira egoismo:
       a quarta pessoa da fila esperaria a busca das tres anteriores. Entao,
       sob carga, todo mundo recebe o link rapido e a busca da alternativa fica
       para a proxima rodada, que comeca em seguida. */
    const filaCheia = pendentes.length > 4;

    await comAbaML(async (tabId) => {
      for (const p of pendentes) {
        if (!p.url_alvo) {
          await marcarPedido(sincToken, p.id, null, null, 'pedido sem link');
          falhou++; continue;
        }
        try {
          /* O banco ja reservou este pedido para esta instancia, de forma
             atomica, na propria consulta da fila. Esta chamada continua aqui
             so para versoes antigas do banco: onde a reserva ja aconteceu ela
             nao faz nada. */
          iniciarPedido(sincToken, p.id).catch(() => {});
          const url = limparUrl(p.url_alvo);

          /* 1. le o anuncio. Primeiro pelo service worker, que enxerga
                qualquer subdominio e resolve link curto. Se falhar, tenta pela
                pagina, que so funciona quando a origem bate mas as vezes ve
                conteudo que o worker nao ve. */
          let a = await lerAnuncioNoWorker(url);
          if (!a.ok || !(a.nomes && a.nomes.length)) {
            const [saida] = await chrome.scripting.executeScript({
              target: { tabId }, world: 'MAIN', func: analiseNaPagina, args: [url]
            });
            const b = (saida && saida.result) || null;
            if (b && b.ok && b.nomes && b.nomes.length) a = b;
            else if (!a.ok && b && b.ok) a = b;
          }
          if (!a) a = { ok: false, falha: 'a pagina nao respondeu' };

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

          /* 3. o SEU link sai sempre, com ou sem cupom.

             Gerado a partir da URL CANONICA lida na propria pagina, nao do que
             a pessoa colou. A canonica ja era extraida para isso e nunca era
             usada: link curto colado virava pedido de link de afiliado em cima
             de um meli.la, que nao e endereco de produto. Ordem: canonica, url
             final depois dos redirecionamentos, e por ultimo o que foi colado. */
          const alvoDoLink = a.canonica || a.finalUrl || url;

          /* A geracao do link nao pode derrubar a analise inteira.

             Antes ela ficava dentro do try grande: se o gerador falhasse, o
             catch marcava o pedido como erro e gravava analise NULA. O cliente
             perdia tudo, inclusive produto, preco, loja e cupom que ja estavam
             lidos e corretos. Agora o que foi conferido e salvo de qualquer
             jeito, e a falha do link vira um aviso proprio. */
          let r = { link: null, codigo: null };
          let linkFalhou = null;
          try {
            r = await gerarNaAba(tabId, alvoDoLink, TAG_PADRAO);
          } catch (e) {
            linkFalhou = e.message || String(e);
            console.warn('[link]', linkFalhou);
          }

          /* Procura o MESMO produto de catalogo em outra loja e compara PRECO
             FINAL com o da loja do link.

             Isto rodava so quando a loja do link nao tinha cupom, o que e a
             pergunta errada. O cliente quer saber se existe negocio melhor,
             tendo cupom ou nao. No caso do Kit Wella, a loja do link tinha
             cupom de 15% e mesmo assim saia R$ 72,61 mais cara que a mesma
             caixa em outra loja sem cupom nenhum, e o site nao dizia nada. */
          let outra = null;
          let outraFalhou = null;
          /* O SITE PRECISA SABER SE EU PROCUREI.

             Sem este sinal, "nao achei loja melhor" e "nem cheguei a olhar"
             chegavam iguais na tela, e o texto exibido era o de quem nao
             procurou. Foi isso que o Weslei viu na capa da Motorola: a busca
             tinha condicoes de rodar e a tela dizia so "esta loja nao tem
             cupom", sem uma palavra sobre as outras lojas. */
          let procurouOutra = false;
          let motivoNaoProcurou = null;
          if (filaCheia) motivoNaoProcurou = 'fila cheia: outros clientes esperando';
          if (!filaCheia) {
            procurouOutra = true;
            let alt = null;
            try {
              const economiaAqui = (cupom && aval && aval.vale && aval.economia != null)
                ? aval.economia : 0;
              const finalAqui = a.preco != null ? a.preco - economiaAqui : null;
              alt = await mesmoProdutoComCupom(url, finalAqui, null);
            } catch (e) {
              procurouOutra = false;
              motivoNaoProcurou = 'a busca no Mercado Livre falhou: ' + e.message;
              console.warn('[mesmo produto] busca falhou:', e.message);
            }

            /* O link de afiliado sai numa etapa separada de proposito. Se ele
               falhar, o achado NAO vai para a tela: mandar o cliente para uma
               oferta mais barata por um endereco sem etiqueta seria entregar a
               venda de graca. Melhor nao mostrar e registrar o motivo. */
            try {
              if (alt) {
                const la = await gerarNaAba(tabId, alt.url);
                outra = {
                  cupomId: alt.cupom ? alt.cupom.id : null,
                  vendedor: alt.vendedor,
                  preco: alt.preco,
                  economia: alt.economia,
                  minimo: alt.minimo,
                  teto: alt.teto,
                  final: alt.final,
                  ganho: alt.ganho,
                  finalAtual: alt.finalAtual,
                  /* true quando veio da busca por titulo, nao da pagina de
                     catalogo. Catalogo e o mesmo produto por definicao; busca
                     e um palpite forte. O site precisa dizer a diferenca. */
                  achadoNaBusca: !!alt.achadoNaBusca,
                  cupomTitulo: alt.cupom ? alt.cupom.titulo : null,
                  vence: alt.cupom ? alt.cupom.vence : null,
                  link: la.link,
                  codigo: la.codigo
                };
              }
            } catch (e) {
              outraFalhou = 'achei a oferta mais barata mas nao consegui gerar o link de afiliado: '
                          + e.message;
              console.warn('[mesmo produto] link falhou:', e.message);
            }
          }

          await marcarPedido(sincToken, p.id, r.link, r.codigo, null, {
            titulo: a.titulo ?? null,
            preco: a.preco ?? null,
            vendedor: vendedor ?? null,
            outraLoja: outra,
            /* true = procurei o mesmo produto nas outras lojas. Com outraLoja
               null, isso quer dizer "procurei e esta e a melhor". Sem isso, a
               tela mentia por omissao. */
            procurouOutra: procurouOutra,
            motivoNaoProcurou: motivoNaoProcurou,
            /* Preenchido quando o produto foi lido mas o SEU link nao saiu.
               O site usa isso para nao mostrar botao de compra sem etiqueta. */
            linkFalhou: linkFalhou,
            /* Fica gravado quando existiu oferta melhor mas o link de afiliado
               nao saiu. Sem isto, "nao apareceu alternativa" some no meio de
               "nao existe alternativa", e sao problemas diferentes. */
            outraFalhou: outraFalhou,
            temCupom: !!(cupom && aval && aval.vale),
            cupom: cupom ? {
              id: cupom.id, titulo: cupom.desconto, vence: cupom.vence,
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
        // Ritmo entre pedidos: calmo quando ninguem espera, apertado quando
        // tem gente na fila. Nunca zero: rajada e o que chama atencao.
        await sleep(filaCheia ? 250 : 600);
      }
    });

    if (ok || falhou) console.log(`[pedidos] ${ok} atendidos, ${falhou} falharam`);
    /* Rodada cheia significa que provavelmente sobrou gente esperando: o banco
       entrega no maximo 12 por vez. Emenda a proxima rodada em vez de esperar
       o alarme de 1 minuto. */
    if (pendentes.length >= 12) chegouPedidoNovo = true;
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
/* O 'refresh' e o 'diario' sairam: a lista completa e as etiquetas agora
   acontecem nas quatro janelas (01:00, 11:00, 17:30 e 21:00 de Brasilia), que
   o alarme 'fila' verifica de 10 em 10 minutos. Alarme cravado em horario nao
   sobrevive ao service worker dormir; janela sobrevive. */
const ALARMES = {
  fila: 10,       // janelas de atualizacao + conferencia continua
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
  /* 'refresh' e 'diario' nao existem mais: viraram as janelas, tratadas
     dentro de andarFila. Alarmes antigos ainda registrados no navegador do
     Weslei chegam aqui e sao descartados de proposito. */
  if (a.name === 'refresh' || a.name === 'diario') {
    try { await chrome.alarms.clear(a.name); } catch (e) {}
  }
});
