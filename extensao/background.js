import { sincronizarComSite, completarCondicoes, condicoesDe,
         pedidosPendentes, pedidosEsperando, marcarPedido, completarPedido, melhorCupom,
         condicoesPendentes, salvarCondicoes, iniciarPedido,
         linksPendentes, salvarLinks,
         etiquetasPendentes, salvarEtiquetas,
         vitrinesParaConferir, salvarVitrines,
         lojasParaResolver, salvarPaginaLoja, marcarLojaSemPagina,
         anotarEstadoRobo, salvarOrigemCupom, lojasPedidas,
         reservarGeracao, concluirGeracao, compararNoServidor, marcarEtapa, gravarDiagnostico,
         vitrineSemFoto, vitrineCompletar, conferirNoServidor } from './sincronia.js';
import { ofertasDaBusca, ofertasDoCatalogo, urlDaOferta, urlDeBusca, itemDoUrl,
         escolherAlternativas, ehCaptcha, desescapar, MAX_CANDIDATOS_BUSCA, MAX_CANDIDATOS_IA,
         primeiroAnuncioDaLista, lojaDoAnuncio, produtoDoPerfilSocial,
         identificadoresDoAnuncio, variacaoEscolhida, candidatosDeCartoes } from './comparador.js';
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
/* Era 12 em paralelo. O banco registrou 67 downloads completos da lista no dia
   22/09 e 41 no dia 23 - cada um sao ~665 chamadas ao hub de afiliados. Esse
   volume e o suspeito mais forte dos captchas, do 403 ao criar codigo e do
   sumico do menu de cupons. Agora 2 paginas por vez, com pausa, e no maximo
   um download completo a cada 3 horas (ver INTERVALO_INDICE). */
const CONC  = 2;     // paginas do indice de cupons em paralelo
const INTERVALO_INDICE = 3 * 60 * 60 * 1000;
/* Era 14. Navegar numa busca do Mercado Livre disparava ~48 leituras de
   anuncio em tres rajadas, que e o padrao que faz o site pedir captcha - e o
   captcha trava etiqueta, loja e comparacao para os clientes. Agora 3 por vez
   com pausa entre os lotes: a marcacao demora mais, a conta fica protegida. */
const CONC_VEND = 3; // anuncios em paralelo
const MAX_BYTES = 420000;
const TTL_MS   = 6 * 60 * 60 * 1000;
const TTL_VEND = 7 * 24 * 60 * 60 * 1000;

const norm = s => (s ?? '').toString().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* --------------------------------------------------------- indice cupons */

/* 401 E 403 NAO SAO A MESMA COISA, E EU TRATAVA OS DOIS COMO "NAO LOGADO".

   O Weslei viu "Erro: NAO_LOGADO" no popup enquanto a pagina do Mercado Livre
   ao lado mostrava o perfil dele, WSLMENDES, com 78 cliques nos ultimos 7 dias.
   A extensao estava dizendo uma coisa que qualquer um via ser falsa, e isso faz
   perder tempo procurando defeito no lugar errado.

   401 e "quem e voce": ai sim, entrar na conta resolve.
   403 e "sei quem voce e e mesmo assim nao deixo": conta logada, recusa do
   outro lado. Abri a mesma URL na barra de enderecos, logado, e o que voltou
   foi a pagina de erro do proprio Mercado Livre, com o texto deles:
   "Estamos um problema e ja estamos trabalhando para resolve-lo."

   Entao cada um leva o nome certo. Mandar a pessoa "entrar na conta" quando ela
   ja esta dentro e pior que nao dizer nada. */
async function getPagina(p, tentativa = 0) {
  try {
    const r = await fetch(`${API}?items_per_page=${PER}&page=${p}`, {
      headers: { accept: 'application/json' }, credentials: 'include'
    });
    if (r.status === 401) throw new Error('NAO_LOGADO');
    if (r.status === 403) throw new Error('CUPONS_RECUSADOS');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    if (e.message === 'NAO_LOGADO' || e.message === 'CUPONS_RECUSADOS') throw e;
    if (tentativa < 2) { await sleep(400 * (tentativa + 1)); return getPagina(p, tentativa + 1); }
    return null;
  }
}

async function baixarIndice() {
  const primeira = await getPagina(1);
  if (!primeira) throw new Error('A API de cupons nao respondeu agora. Tento de novo na proxima rodada.');

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
    await sleep(350 + Math.floor(Math.random() * 300));
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
  /* Nem o "forcar" passa por cima disto: recarregar a extensao, clicar em
     Atualizar ou Sincronizar varias vezes nao dispara um download novo antes
     de 3 horas do ultimo. */
  if (indice && (Date.now() - indice.atualizadoEm) < INTERVALO_INDICE) {
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

/* Anuncio de OUTRA loja: primeiro sem cookie nenhum, depois na janela
   anonima, e so por ultimo com a sessao (e nunca com o freio ligado). */
async function lerParcial(url) {
  try {
    const t = await comPrazo(lerParcialCom(url, 'omit'), 5000, '');
    if (RE_LABEL.test(t) || nomesDoHtml(t).length) return t;
  } catch (e) { /* segue para a janela anonima */ }
  const anon = await lerNaJanelaAnonima(url);
  if (anon.html) return anon.html;
  if (await freioLigado('leitura')) return '';
  return lerParcialCom(url, 'include');
}

async function lerParcialCom(url, credenciais) {
  const ctrl = new AbortController();
  const r = await fetch(url, { credentials: credenciais, redirect: 'follow', signal: ctrl.signal });
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

/* Leituras em andamento: a busca adianta a leitura das lojas enquanto a
   Gemini confere as fotos, e quem pedir o mesmo anuncio depois espera a
   mesma leitura em vez de abrir outra aba. */
const lendoVendedor = new Map();
function resolverVendedor(id, url) {
  if (lendoVendedor.has(id)) return lendoVendedor.get(id);
  const p = resolverVendedorAgora(id, url).finally(() => lendoVendedor.delete(id));
  lendoVendedor.set(id, p);
  return p;
}

async function resolverVendedorAgora(id, url) {
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
  /* Com a leitura em pausa de seguranca, nao marca nada: cada leitura a mais
     depois de um captcha e o que prolonga o bloqueio. */
  if (await freioLigado('leitura')) return {};
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
    await sleep(700 + Math.floor(Math.random() * 600));
    if (await freioLigado('leitura')) break;
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

/* Vitrine: poucos produtos antigos por rodada ganham foto e categoria, lendo
   o proprio anuncio (uma leitura por produto, so ate acabar a lista). */
let completandoVitrine = false;
let vitrineUltima = 0;
async function completarVitrine() {
  /* A cada 5 minutos, ate 6 produtos. Leitura SEM a conta: primeiro sem cookie,
     depois na janela anonima; logado so sem anonima e sem freio. Antes pulava
     sempre que havia freio ou atendimento e nunca registrou uma rodada: as
     31 fotos antigas ficaram sem preencher. */
  if (completandoVitrine || Date.now() - vitrineUltima < 5 * 60e3) return;
  if (typeof atendendo !== 'undefined' && atendendo) return;
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return;
  completandoVitrine = true;
  vitrineUltima = Date.now();
  const registro = [];
  try {
    const lista = await vitrineSemFoto(sincToken, 6);
    for (const it of lista) {
      const url = limparUrl(it.url_produto);
      let a = null, via = null;
      try {
        const r = await fetch(url, { credentials: 'omit', redirect: 'follow' });
        const t = r.ok ? await r.text() : '';
        const b = t ? extrairAnuncio(t, r.url, r.status) : null;
        if (b && b.imagem) { a = b; via = 'sem-cookie'; }
      } catch (e) { /* tenta a anonima */ }
      if (!a) {
        const anon = await lerNaJanelaAnonima(url);
        const b = anon.html ? extrairAnuncio(anon.html, anon.url || url, 200) : null;
        if (b && b.imagem) { a = b; via = 'anonima'; }
        else if (!(await anonimaPermitida()) && !(await anonimaBloqueada()) && !(await freioLigado('leitura'))) {
          try { a = await lerAnuncioNoWorker(url); via = 'logada'; } catch (e) { a = null; }
        }
      }
      registro.push({ chave: it.chave, via, foto: !!(a && a.imagem), cat: a && a.categorias ? a.categorias[0] : null });
      /* Sempre grava: sem foto, o banco marca como tentado e a fila anda. */
      await vitrineCompletar(sincToken, it.chave, (a && a.imagem) || null, (a && a.categorias && a.categorias[0]) || null);
      await sleep(1500 + Math.random() * 1500);
    }
    gravarDiagnostico(sincToken, 'vitrine-fotos', { versao: chrome.runtime.getManifest().version, pendentes: lista.length, registro }).catch(() => {});
  } catch (e) {
    gravarDiagnostico(sincToken, 'vitrine-fotos', { erro: String(e.message || e).slice(0, 200) }).catch(() => {});
  } finally { completandoVitrine = false; }
}

/* ================================================================
   v1.71 - GEMINI CONFERE SE E O MESMO PRODUTO (foto + descricao)

   Caso que motivou (24/09): a busca achou uma "capa transparente para Edge
   70" mais barata, mas a do cliente tinha borda preta. Titulo parecido nao
   basta. A Gemini recebe a foto e o titulo do anuncio original e de cada
   candidato e diz quais sao EXATAMENTE o mesmo produto. Sem chave ou se a
   Gemini falhar, devolve null e nada e descartado por ela.
   ================================================================ */
async function imagemParaGemini(url) {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { credentials: 'omit', signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 900000) return null;
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    return { inline_data: { mime_type: /^image\//.test(mime) ? mime : 'image/jpeg', data: btoa(bin) } };
  } catch (e) { return null; }
}

/* Chamada a Gemini com a chave da EXTENSAO. O modelo escolhido nas opcoes vem
   primeiro; se ele recusar (429 cota, 404 modelo que a chave nao tem, 5xx),
   tenta os Flash. Medido em 25/09: com gemini-2.5-pro escolhido, toda
   conferencia voltava "indisponivel" e o motivo nao ficava em lugar nenhum. */
async function geminiLocal(partes) {
  const { geminiKey, geminiModel } = await chrome.storage.local.get(['geminiKey', 'geminiModel']);
  if (!geminiKey) return { ok: false, status: 0, erro: 'sem chave na extensao' };
  /* Flash primeiro: responde em segundos e confere foto muito bem. O modelo
     escolhido nas opcoes (ex.: 2.5 Pro) fica como segunda tentativa. Prazo
     total de 16 s: a consulta inteira do cliente tem 1 minuto. */
  /* 2.5 Flash sem a etapa de "pensar" responde em poucos segundos (medido:
     com o pensamento ligado, 20 s e estourava o prazo). */
  /* Medido em 25/09: o Flash-Lite respondeu e julgou certo (borda roxa x
     preta, Edge 70 x 70 Fusion+); o 2.5 Flash estourou o prazo. */
  const modelos = [...new Set(['gemini-flash-lite-latest', 'gemini-2.5-flash', geminiModel].filter(Boolean))];
  const inicio = Date.now();
  let ultimo = { ok: false, status: 0, erro: 'sem resposta' };
  /* Erro de CADA modelo tentado (antes so o ultimo ficava gravado). */
  const falhas = [];
  const comFalhas = r => (r.ok ? r : { ...r, erro: falhas.concat(r.erro ? [] : []).join(' | ') || r.erro });
  for (const modelo of modelos) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      if (Date.now() - inicio > Math.min(16000, resta() - 7000)) { falhas.push('sem tempo'); return comFalhas(ultimo); }
      try {
        const ctrl = new AbortController();
        const corta = setTimeout(() => ctrl.abort(), Math.max(4000, Math.min(12000, resta() - 7000)));
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': geminiKey },
          body: JSON.stringify({ contents: [{ parts: partes }],
                                 generationConfig: { responseMimeType: 'application/json', temperature: 0,
                                   ...(/2\.5-flash/.test(modelo) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } })
        });
        clearTimeout(corta);
        const j = await r.json().catch(() => null);
        if (r.ok) {
          const texto = ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
            .filter(x => !x.thought && x.text).map(x => x.text).join('');
          if (texto) return { ok: true, texto, modelo };
          ultimo = { ok: false, status: 502, erro: 'resposta vazia', modelo };
          break;
        }
        ultimo = { ok: false, status: r.status, erro: String((j && j.error && j.error.message) || '').slice(0, 200), modelo };
        falhas.push(modelo + ' ' + r.status + ' ' + ultimo.erro.slice(0, 90));
        if (r.status === 429) break;
        if (r.status >= 500) { if (tentativa === 0) await sleep(2000); continue; }
        if (r.status === 404) break;
        return comFalhas(ultimo);
      } catch (e) {
        /* Estourou o prazo: nao repete o mesmo modelo, vai para o proximo. */
        ultimo = { ok: false, status: 504, erro: String((e && e.message) || e).slice(0, 120), modelo };
        falhas.push(modelo + ' tempo ' + Math.round((Date.now() - inicio) / 1000) + 's');
        break;
      }
    }
  }
  return comFalhas(ultimo);
}

function jsonDaIA(texto) {
  try { return JSON.parse(texto); } catch (e) { /* tenta o bloco {} */ }
  const m = /\{[\s\S]*\}/.exec(texto || '');
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

const CONFIANCA_MINIMA_IA = 80;
const PEDIDO_CONFERENCIA =
  'Voce confere anuncios para um comparador de precos. O cliente vai comprar o produto do ANUNCIO ORIGINAL '
  + 'e so pode ver outra loja se for EXATAMENTE o mesmo produto.\n'
  + 'Passo 1: descreva a FOTO do anuncio original em detalhe: tipo de produto, marca/modelo visiveis, cor, '
  + 'bordas, material, acabamento, formato, tamanho aparente, quantidade de unidades e qualquer detalhe que '
  + 'diferencie de produtos parecidos.\n'
  + 'Passo 2: para cada CANDIDATO, compare a foto dele com essa descricao e o titulo dele com o titulo '
  + 'original. E o mesmo produto so se bater: tipo, marca e modelo, versao, cor e acabamento (ex.: capinha '
  + 'transparente com borda preta NAO e igual a capinha toda transparente), tamanho/volume/capacidade, '
  + 'compatibilidade (modelo do celular, voltagem) e quantidade (kit, unidades). Anuncio que atende varios '
  + 'modelos so e igual se o titulo citar o mesmo modelo do original. Candidato sem foto: igual=false. '
  + 'Na duvida, igual=false. Ignore preco, loja e texto de propaganda.\n'
  + 'Responda so JSON: {"descricao_original":"...","candidatos":[{"indice":0,"igual":true,"confianca":0-100,'
  + '"motivo":"curto"}]}';

/* Ultima conferencia feita, para gravar no pedido: por onde passou, qual
   modelo, o que a IA viu na foto e por que reprovou cada um. */
let ultimaIA = null;

/* original: { titulo, imagem, preco }  lista: [{ titulo, imagem, preco }]
   Devolve um Set com os indices aprovados, ou null se nao deu para conferir.

   Pedido do Weslei: a Gemini decodifica a FOTO e garante que e o mesmo
   produto. Ela descreve a foto do original, compara cada candidato e so passa
   o que ela der como igual com confianca >= 80. Sem foto nao passa.
   Ordem: chave da extensao (varios modelos) e, se falhar, a do servidor. */
async function mesmoProdutoPelaGemini(original, lista) {
  if (!lista || !lista.length) return new Set();
  const itens = lista.slice(0, 12);
  const erros = [];

  /* 1. Chave do SERVIDOR (GEMINI_API_KEY nos Secrets do Lovable). Vem
     primeiro desde 25/09: a chave da extensao estourou a cota (429) e gastava
     o tempo da consulta antes de chegar aqui. */
  const { sincToken } = await chrome.storage.local.get('sincToken');
  const sv = await conferirNoServidor(sincToken, {
    tipo: 'conferir',
    /* chave = codigo do anuncio: o servidor reaproveita vereditos ja dados
       para o mesmo par (nao gasta cota da Gemini de novo). */
    original: { titulo: original.titulo || null, imagem: original.imagem || null, preco: original.preco ?? null,
                chave: original.item || null },
    candidatos: itens.map(c => ({ titulo: c.titulo || null, imagem: c.imagem || null, preco: c.preco ?? null,
                                  chave: c.item || null }))
  });
  if (sv && sv.ok && Array.isArray(sv.iguais)) {
    ultimaIA = { via: 'servidor', guardados: sv.guardados || 0, modelo: sv.modelo, descricao: sv.descricaoOriginal || null,
                 avaliacao: (sv.avaliacao || []).map(a => ({ ...a, titulo: String((itens[a.indice] || {}).titulo || '').slice(0, 70) })) };
    return new Set(sv.iguais.filter(n => Number.isInteger(n) && n >= 0 && n < itens.length));
  }
  erros.push('servidor: ' + ((sv && (sv.status ? sv.status + ' ' : '') + (sv.modelo ? sv.modelo + ' ' : '') + (sv.erro || '')) || 'sem resposta'));

  /* 2. Chave da extensao, como reserva, se ainda couber no prazo. */
  if (resta() < 10000) { erros.push('extensao: sem tempo'); ultimaIA = { indisponivel: true, erros }; return null; }
  const imgOrig = await imagemParaGemini(original.imagem);
  const fotos = await Promise.all(itens.map(c => imagemParaGemini(c.imagem)));
  if (imgOrig) {
    const partes = [{ text: PEDIDO_CONFERENCIA }, { text: 'ANUNCIO ORIGINAL: ' + (original.titulo || '') }, imgOrig];
    itens.forEach((c, i) => {
      partes.push({ text: 'CANDIDATO ' + i + ': ' + (c.titulo || '(sem titulo)') + (fotos[i] ? '' : ' (sem foto)') });
      if (fotos[i]) partes.push(fotos[i]);
    });
    const r = await geminiLocal(partes);
    const obj = r.ok ? jsonDaIA(r.texto) : null;
    if (obj && Array.isArray(obj.candidatos)) {
      const avaliacao = obj.candidatos
        .filter(c => Number.isInteger(c.indice) && c.indice >= 0 && c.indice < itens.length)
        .map(c => ({ indice: c.indice, igual: c.igual === true,
                     confianca: Math.max(0, Math.min(100, Number(c.confianca) || 0)),
                     motivo: String(c.motivo || '').slice(0, 140), semFoto: !fotos[c.indice] }));
      const iguais = avaliacao.filter(a => a.igual && a.confianca >= CONFIANCA_MINIMA_IA && !a.semFoto).map(a => a.indice);
      ultimaIA = { via: 'extensao', modelo: r.modelo, erros, descricao: String(obj.descricao_original || '').slice(0, 300),
                   avaliacao: avaliacao.map(a => ({ ...a, titulo: String(itens[a.indice].titulo || '').slice(0, 70) })) };
      return new Set(iguais);
    }
    erros.push('extensao: ' + (r.ok ? 'JSON invalido' : (r.status + ' ' + (r.modelo || '') + ' ' + (r.erro || ''))));
  } else {
    erros.push('extensao: foto do original nao baixou');
  }
  ultimaIA = { indisponivel: true, erros };
  return null;
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

/* Varios links numa chamada so: o proprio gerador aceita "1 ou mais URLs
   separadas por linha" (lembrado pelo Weslei, 25/09). Uma chamada para todas
   as lojas da tabela, em vez de uma por loja. */
function chamadaVariosNaPagina(rota, urls, tag) {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (!meta || !meta.content) return { falha: 'deslogado' };
  return fetch(rota, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-csrf-token': meta.content },
    body: JSON.stringify({ urls, tag })
  }).then(r => r.text().then(t => ({ status: r.status, txt: t.slice(0, 120000) })))
    .catch(e => ({ falha: String(e && e.message || e) }));
}

/* Endereco do ANUNCIO de uma loja (nao da ficha de catalogo): cada loja ganha
   o seu proprio link de afiliado (medido em 25/09). */
function enderecoDoAnuncio(url, item) {
  const it = item || (/item_id(?:%3A|:)(MLB-?\d{6,})/i.exec(url || '') || [])[1] || itemDoUrl(url || '');
  return it ? 'https://produto.mercadolivre.com.br/' + String(it).toUpperCase().replace(/^MLB-?/, 'MLB-') : url;
}

async function gerarVariosNaAba(tabId, urls, tag = TAG_PADRAO) {
  const mapa = {};
  if (!urls.length) return mapa;
  const [saida] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: chamadaVariosNaPagina, args: [ROTA_CRIAR, urls, tag]
  });
  const r = saida && saida.result;
  if (!r || r.falha || r.status >= 400) return mapa;
  let j = null;
  try { j = JSON.parse(r.txt || ''); } catch (e) { return mapa; }
  const lista = (j && j.urls) || (Array.isArray(j) ? j : []);
  const norm = u => String(u || '').split('#')[0].replace(/\/+$/, '').toLowerCase();
  lista.forEach((it, i) => {
    if (!it) return;
    const curto = it.short_url || it.shortUrl
      || (String(it.text || '').match(/https?:\/\/meli\.la\/[A-Za-z0-9]+/) || [])[0] || null;
    if (!curto) return;
    const origem = norm(it.origin_url || it.long_url || '');
    const k = urls.findIndex(u => norm(u) === origem);
    mapa[urls[k >= 0 ? k : i]] = curto;
  });
  return mapa;
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
/* v1.39: POR QUE AS ETIQUETAS PARARAM EM 23/09.

   A ultima etiqueta saiu as 12:26 de Brasilia, minutos depois do captcha. Dali
   em diante nenhum pedido do site foi tentado ate o fim (codigo_tentativas
   ficou 0 em todos), ou seja, a chamada morria antes de chegar a gravar. Tres
   defeitos juntos:

     1. a chamada saia SEM o x-csrf-token. O gerador de links ja exigia esse
        cabecalho; depois do captcha a sessao ficou sob vigilancia e o
        create-code passou a responder 403 para POST sem ele;
     2. 403 puxava o freio de etiqueta e o lote parava sem gravar nada, entao
        o banco nunca soube que houve tentativa, e o site girava 88s e desistia;
     3. nada disso ficava registrado fora do console da extensao.

   Agora vai o token do formulario (o mesmo que o gerador usa), a resposta e
   lida com cuidado (alias com ou sem #, captcha, amostra do corpo) e o
   resultado de cada rodada vai para o banco em 'etiqueta_ultima'. */
function etiquetaNaPagina(id, sufixo) {
  var meta = document.querySelector('meta[name="csrf-token"]');
  var cab = { accept: 'application/json', 'content-type': 'application/json' };
  if (meta && meta.content) cab['x-csrf-token'] = meta.content;
  return fetch('/affiliate-program/api/affiliates/create-code', {
    method: 'POST',
    credentials: 'include',
    headers: cab,
    body: JSON.stringify({ couponId: id, code: sufixo })
  })
    .then(function (r) { return r.text().then(function (t) { return { st: r.status, t: t, u: r.url || '' }; }); })
    .then(function (d) {
      var m = /"alias"\s*:\s*"([^"]+)"/.exec(d.t);
      if (m) {
        var a = String(m[1]).trim().toUpperCase();
        return { alias: a.charAt(0) === '#' ? a : '#' + a, st: d.st };
      }
      var captcha = /captcha\/wall|Por seguran.a, complete/i.test(d.t) || /captcha/i.test(d.u);
      return {
        falha: 'HTTP ' + d.st, st: d.st, captcha: captcha, semToken: !(meta && meta.content),
        amostra: String(d.t || '').replace(/\s+/g, ' ').slice(0, 200)
      };
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

  /* Preco: varias formas, da mais confiavel para a menos (pagina de oferta
     "deal" nao trazia a primeira e o site escondia o resultado, 25/09). */
  let preco = null;
  const formasPreco = [
    /<meta[^>]+itemprop="price"[^>]+content="(\d{1,7}(?:\.\d{1,2})?)"/i,
    /"offers"\s*:\s*\{[^{}]*?"price"\s*:\s*"?(\d{1,7}(?:\.\d{1,2})?)/,
    /"price"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)\s*[,}]/,
    /"current_price"\s*:\s*\{[^{}]*?"value"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/,
    /"price"\s*:\s*\{[^{}]*?"value"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/
  ];
  for (const re of formasPreco) {
    const pm = re.exec(t);
    if (pm) { const n = parseFloat(pm[1]); if (n > 0 && n < 1e7) { preco = n; break; } }
  }

  const nomes = [];
  if (lab) nomes.push(lab[1]);
  /* Outras formas de achar a loja (pagina de oferta, layout novo). */
  if (!lab) {
    const outras = [
      /Vendido por\s*(?:<[^>]+>\s*)*([^<>]{2,60}?)\s*</i,
      /"seller_name"\s*:\s*"([^"]{2,60})"/,
      /"official_store_name"\s*:\s*"([^"]{2,60})"/,
      /"seller"\s*:\s*\{[^{}]*?"name"\s*:\s*"([^"]{2,60})"/
    ];
    for (const re of outras) { const m = re.exec(t); if (m) { nomes.push(limpo(m[1])); break; } }
  }
  if (slug) {
    const x = slug[1] || slug[2];
    try { nomes.push(decodeURIComponent(x)); } catch (e) { nomes.push(x); }
  }

  let can = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(t)
         || /property="og:url"\s+content="([^"]+)"/i.exec(t);
  let canonica = can ? limpo(can[1]) : null;
  if (canonica && !/^https?:\/\//i.test(canonica)) canonica = null;

  /* Identidade do produto (codigo de barras, marca, modelo, catalogo): e o
     que permite comparar o MESMO produto em outras lojas, seja qual for o
     tipo de link que o cliente colou. */
  const ident = identificadoresDoAnuncio(t);

  /* Foto e categoria, para a vitrine de produtos ja pesquisados no site. */
  const img = /property="og:image"\s+content="([^"]+)"/i.exec(t) || /content="([^"]+)"\s+property="og:image"/i.exec(t);
  let imagem = img ? limpo(img[1]) : null;
  if (imagem && !/^https:\/\/[a-z0-9.-]*mlstatic\.com\//i.test(imagem)) imagem = null;
  const categorias = [...t.matchAll(/class="andes-breadcrumb__link"[^>]*>([^<]{2,80})</g)].map(m => limpo(m[1])).filter(Boolean);
  if (!categorias.length) {
    const bc = /"@type"\s*:\s*"BreadcrumbList"[\s\S]{0,4000}?\]/.exec(t);
    if (bc) for (const m of bc[0].matchAll(/"name"\s*:\s*"([^"]{2,80})"/g)) categorias.push(limpo(m[1]));
  }

  /* Faltou preco ou loja: guarda o trecho da pagina para corrigir a leitura
     com a pagina real (sem isso so da para adivinhar). */
  let faltou = null;
  if (preco == null || !nomes.length) {
    const perto = re => { const m = re.exec(t); return m ? t.slice(Math.max(0, m.index - 300), m.index + 700) : null; };
    faltou = { preco: preco == null, loja: !nomes.length, url: String(finalUrl || '').slice(0, 200), bytes: t.length,
               trechoPreco: perto(/price|preco|money-amount/i), trechoLoja: perto(/Vendido por|seller|vendedor/i) };
  }

  return { ok: true, finalUrl: finalUrl, status: status, nomes: nomes, faltou,
           titulo: titulo, preco: preco, canonica: canonica, ...ident,
           imagem: imagem, categorias: categorias.slice(0, 5),
           /* Opcao marcada no anuncio (modelo do celular, tamanho...). */
           variacao: variacaoEscolhida(t) };
}

/* Le o anuncio a partir do service worker. Segue redirecionamento, entao um
   meli.la chega aqui e sai como a url final do produto. */
async function lerAnuncioNoWorker(url, profundidade = 0) {
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
      await puxarFreio('o Mercado Livre pediu verificacao de seguranca ao ler um anuncio', 'leitura', r.url);
      return { ok: false, captcha: true,
               falha: 'o Mercado Livre pediu uma verificacao de seguranca nesta sessao' };
    }

    if (/\/social\/[^/?#]+/i.test(r.url)) {
      /* Link de "Compartilhar" do programa de afiliados: cai no perfil social
         com o produto em destaque. Se o produto aparece sem ambiguidade (no
         endereco, ou unico na pagina), segue para ele. Uma vez so. */
      const produto = profundidade === 0 ? produtoDoPerfilSocial(r.url, buf) : null;
      if (produto) return lerAnuncioNoWorker(produto, 1);
      return { ok: false, perfilSocial: true,
               falha: 'esse link abre um perfil do Mercado Livre, nao um produto (destino: '
                      + String(r.url).split('?')[0].slice(0, 120) + ')' };
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

async function gerarNaAbaSemCadastro(tabId, url, tag = TAG_PADRAO) {
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
        await puxarFreio('o Mercado Livre pediu verificacao de seguranca no gerador de links', 'link',
          ((/https:[^"\s]*captcha\/wall[^"\s]*/.exec(bruto) || [])[0] || '').replace(/\\u0026/g, '&'));
        throw new Error('o Mercado Livre pediu uma verificacao de seguranca nesta sessao');
      }
      const amostra = bruto.replace(/\s+/g, ' ').slice(0, 180);
      throw new Error('O gerador respondeu sem link. Resposta: ' + (amostra || '(vazia)'));
    }
    return { link: curto, codigo };
  }
}

/* Chave do cadastro para um link de produto: a URL limpa (sem rastreio de
   outros afiliados, sem #), para o mesmo produto sempre cair na mesma linha. */
function chaveDoLink(url) {
  try { return limparUrl(url).replace(/\/+$/, ''); } catch (e) { return String(url).split('#')[0]; }
}

/* TODA criacao de link passa por aqui. Consulta o cadastro antes: se o link
   ja existe, devolve sem chamar o Mercado Livre; se o cadastro bloquear
   (pausa geral, teto do dia, geracao em andamento), nao cria. */
async function gerarNaAba(tabId, url, tag = TAG_PADRAO, tipo = 'link', chave = null) {
  const { sincToken } = await chrome.storage.local.get('sincToken');
  const k = chave || chaveDoLink(url);
  const res = await reservarGeracao(sincToken, tipo, k);
  if (res.status === 'existe' && res.resultado) {
    return { link: res.resultado, codigo: (res.meta && res.meta.codigo) || null, reaproveitado: true };
  }
  if (res.status !== 'reservado') throw new Error('nao gerei o link: ' + (res.motivo || 'bloqueado pelo cadastro'));
  try {
    const r = await gerarNaAbaSemCadastro(tabId, url, tag);
    await concluirGeracao(sincToken, tipo, k, r.link, null, { codigo: r.codigo || null, url });
    return r;
  } catch (e) {
    await concluirGeracao(sincToken, tipo, k, null, e.message || String(e));
    throw e;
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
          if (vitrine) link = (await gerarNaAba(tabId, vitrine, TAG_PADRAO, 'link_vitrine', String(id))).link || null;
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
  if (/\/captcha\/wall/.test(finalUrl)) { await puxarFreio('verificacao de seguranca ao abrir a vitrine de uma loja', 'leitura', finalUrl); return { freio: true }; }

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

   v1.39: terceiro caminho, o do Weslei - "acessar pelo menos 1 anuncio desse
   vendedor e acessar a pagina dele". Para as lojas cujo cupom so tem link de
   campanha (_Container_), abre a campanha, pega o primeiro anuncio, le o
   endereco da loja DENTRO do anuncio e confere que a loja tem produto. O
   anuncio e so a porta de entrada: nunca vira destino do botao. */
async function resolverVitrineDaLoja(vendedor, sellerId, origem = null) {
  const tentativas = [];
  if (sellerId) tentativas.push('https://lista.mercadolivre.com.br/_CustId_' + sellerId);
  /* /perfil/ so faz sentido quando o nome do vendedor e mesmo um apelido:
     nome com espaco ("Cordilheira Mix") nao e endereco. */
  if (vendedor && !/\s/.test(vendedor)) {
    tentativas.push('https://www.mercadolivre.com.br/perfil/' + encodeURIComponent(vendedor.toUpperCase()));
  }

  const vistos = new Set();
  const testar = async (url) => {
    if (vistos.has(url)) return null;
    vistos.add(url);
    let r;
    try { r = await lerVitrine(url); } catch (e) { return null; }
    if (r.freio) return { freio: true };
    if (!r.ok) return null;
    /* Endereco proprio de loja: e o melhor destino, tem nome e marca dela. */
    if (r.ehPaginaDeLoja) return { url: r.alvo, itens: r.itens };
    /* Sem pagina propria, mas a lista de anuncios do vendedor tem produto:
       serve, e e exatamente "a lista de produtos daquela loja". */
    if (/_CustId_\d+/.test(url)) return { url: url, itens: r.itens };
    return null;
  };

  for (const url of tentativas) {
    const r = await testar(url);
    if (r) return r;
  }

  /* Porta de entrada: um anuncio da loja, achado na lista da campanha. */
  if (origem && /^https:\/\/lista\.mercadolivre\.com\.br\//.test(origem)) {
    try {
      await sleep(1500);
      const lista = await lerCatalogo(origem.split('#')[0]);
      const anuncio = primeiroAnuncioDaLista(lista);
      if (anuncio) {
        await sleep(1500);
        const html = await lerCatalogo(anuncio.url);
        for (const url of lojaDoAnuncio(html)) {
          await sleep(1200);
          const r = await testar(url);
          if (r) return r;
        }
      }
    } catch (e) {
      if (/seguranca/i.test(e.message || '')) return { freio: true };
      console.warn('[loja] porta de entrada falhou:', vendedor, e.message);
    }
  }
  return { url: null };
}

/* Pedido de pessoa esperando na tela do site: "quero ver os produtos desta
   loja". Ate 3 lojas por vez, no ritmo de quem le. Quando o cupom nem tem
   link de campanha guardado, busca no hub (mesma aba do gerador). */
let atendendoLojas = false;

async function atenderPedidosDeLoja() {
  if (atendendoLojas) return { pulou: true };
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };
  const travado = await freioLigado('leitura');
  if (travado) return { freio: travado };

  atendendoLojas = true;
  try {
    const lojas = await lojasPedidas(sincToken);
    if (!lojas.length) return { nada: true };
    let achadas = 0;
    for (const loja of lojas) {
      let origem = loja.origem || null;
      if (!origem && !loja.seller_id && loja.cupom_id) {
        try {
          origem = await comAbaML(tabId => guardarVitrineDoPedido(tabId, sincToken, loja.cupom_id));
        } catch (e) { origem = null; }
      }
      const r = await resolverVitrineDaLoja(loja.vendedor, loja.seller_id, origem);
      if (r.freio) break;
      if (r.url) { await salvarPaginaLoja(sincToken, loja.vendedor, r.url).catch(() => null); achadas++; }
      else await marcarLojaSemPagina(sincToken, loja.vendedor).catch(() => null);
      await sleep(1500);
    }
    return { achadas, lojas: lojas.length };
  } finally { atendendoLojas = false; }
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

      const r = await resolverVitrineDaLoja(loja.vendedor, loja.seller_id, loja.origem || null);
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
function sufixoDaEtiqueta(id, desconto, alternativo = false) {
  const num = String(desconto || '').replace(/[^\d]/g, '').slice(0, 3) || '0';
  /* Alternativo: "CP" no lugar de "OFF", para quando o texto padrao ja existe
     na conta. Continua legivel e continua terminando no id do cupom. */
  const base = num + (alternativo ? 'CP' : 'OFF');
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

/* Resumo da ultima rodada de etiquetas, gravado no banco. E o que permite
   saber, sem abrir o console da extensao, se o gerador esta criando codigo,
   recusando (e com qual resposta) ou pausado. */
async function anotarEtiqueta(texto) {
  try {
    const { sincToken } = await chrome.storage.local.get('sincToken');
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await anotarEstadoRobo(sincToken, 'etiqueta_ultima', (agora + ' - ' + texto).slice(0, 400));
  } catch (e) { /* diagnostico nunca derruba o trabalho */ }
}

/* Quem pede a etiqueta pelo site quer ser levado para a loja do cupom. 339
   dos 967 cupons bons nao tinham endereco nenhum de vitrine guardado, entao o
   botao virava "Conferir num produto desta loja" e a pessoa nao tinha para
   onde ir. A vitrine sai do mesmo hub de afiliados (nao e pagina publica), na
   mesma aba, junto com a etiqueta: uma chamada leve por pedido. */
async function guardarVitrineDoPedido(tabId, sincToken, id) {
  try {
    const url = await vitrineDoCupom(tabId, id);
    if (url) await salvarOrigemCupom(sincToken, id, url);
    return url;
  } catch (e) {
    console.warn('[etiquetas] vitrine', id, e.message);
    return null;
  }
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

async function puxarFreio(motivo, area = 'leitura', urlVerificacao = null) {
  /* Guarda a pagina exata do desafio: e ela que o botao "Resolver
     verificacao" do popup abre para o Weslei resolver na mao. */
  if (urlVerificacao && /captcha/i.test(urlVerificacao)) {
    await chrome.storage.local.set({ freioUrl: String(urlVerificacao) });
  }
  const k = chaveFreio(area);
  const hoje = diaSP();
  const st = await chrome.storage.local.get(k);
  const atual = st[k] || {};
  const vezes = (atual.dia === hoje ? (atual.vezes || 0) : 0) + 1;
  const espera = PAUSAS_MS[Math.min(vezes, PAUSAS_MS.length) - 1];
  const ate = Date.now() + espera;

  await chrome.storage.local.set({ [k]: { dia: hoje, vezes, ate, motivo: String(motivo) } });
  console.warn('[freio:' + area + ']', Math.round(espera / 60000) + ' min:', motivo);
  avisarWeslei(motivo, Math.round(espera / 60000)).catch(() => {});

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
  limparAviso().catch(() => {});
  try {
    const { sincToken } = await chrome.storage.local.get('sincToken');
    await anotarEstadoRobo(sincToken, 'freio_motivo', '');
    await anotarEstadoRobo(sincToken, 'freio_ate', '');
    await anotarEstadoRobo(sincToken, 'visto_em', new Date().toISOString());
  } catch (e) { /* silencioso de proposito */ }
}

/* ------------------------------------------------- avisar o Weslei na hora

   Pedido dele: "quando acontecer de novo, me avisar para destravar na hora".
   Tres avisos, do mais certo ao opcional:
     - "!" vermelho no icone da extensao, ate a pausa acabar;
     - notificacao do Chrome no computador; clicar abre a verificacao;
     - celular, pelo app gratuito ntfy, se houver topico nas opcoes.
   Um aviso por pausa: o freio ja evita rajada, entao nao ha spam. */
async function avisarWeslei(motivo, minutos) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
    await chrome.action.setBadgeText({ text: '!' });
  } catch (e) {}

  const texto = 'Pausa de ' + minutos + ' min: ' + motivo + '. Clique para resolver agora.';
  try {
    chrome.notifications.create('freio', {
      type: 'basic', iconUrl: 'icones/icone128.png', priority: 2, requireInteraction: true,
      title: 'Mercado Livre pediu verificacao', message: texto,
      buttons: [{ title: 'Resolver verificacao' }]
    });
  } catch (e) {}

  const { ntfyTopico } = await chrome.storage.local.get('ntfyTopico');
  if (ntfyTopico && /^[A-Za-z0-9_-]{4,64}$/.test(ntfyTopico)) {
    try {
      await fetch('https://ntfy.sh/' + ntfyTopico, {
        method: 'POST',
        headers: { Title: 'Cupons: verificacao do Mercado Livre', Priority: 'high', Tags: 'warning' },
        body: 'Pausa de ' + minutos + ' min: ' + motivo
            + '. No computador, clique no icone da extensao > 1. Resolver verificacao.'
      });
    } catch (e) { /* aviso no celular e bonus */ }
  }
}

async function limparAviso() {
  try { await chrome.action.setBadgeText({ text: '' }); } catch (e) {}
  try { chrome.notifications.clear('freio'); } catch (e) {}
}

chrome.notifications.onClicked.addListener(id => {
  if (id === 'freio') abrirVerificacao().catch(() => {});
});
chrome.notifications.onButtonClicked.addListener(id => {
  if (id === 'freio') abrirVerificacao().catch(() => {});
});

/* ------------------------------------------- verificacao feita pelo Weslei

   O freio espera sozinho (5, 15, 60 min). Mas quem resolve o captcha na mao
   nao precisa esperar: o popup abre a pagina do desafio, e assim que ela sai
   do captcha (ou o botao "Ja resolvi" e clicado) as pausas somem e a fila
   anda na hora. A extensao continua sem tentar resolver captcha sozinha. */
const AREAS_FREIO = ['leitura', 'etiqueta', 'link'];

async function estadoDoFreio() {
  const chaves = AREAS_FREIO.map(chaveFreio);
  const st = await chrome.storage.local.get([...chaves, 'freioUrl']);
  const ativos = [];
  for (const a of AREAS_FREIO) {
    const f = st[chaveFreio(a)];
    if (f && f.ate && Date.now() < f.ate) {
      ativos.push({ area: a, motivo: f.motivo || '', min: Math.max(1, Math.ceil((f.ate - Date.now()) / 60000)) });
    }
  }
  return { ativos, url: st.freioUrl || null };
}

async function liberarFreio() {
  await chrome.storage.local.remove([...AREAS_FREIO.map(chaveFreio), 'freioUrl']);
  avisouLivre = {};
  await limparAviso();
  try {
    const { sincToken } = await chrome.storage.local.get('sincToken');
    await anotarEstadoRobo(sincToken, 'freio_motivo', '');
    await anotarEstadoRobo(sincToken, 'freio_ate', '');
    await anotarEstadoRobo(sincToken, 'visto_em', new Date().toISOString());
  } catch (e) { /* o freio ja saiu localmente */ }
  /* Quem estava esperando na tela do site e atendido agora. */
  atenderPedidos().catch(() => {});
  atenderPedidosDeEtiqueta().catch(() => {});
  atenderPedidosDeLoja().catch(() => {});
  return estadoDoFreio();
}

let abaVerificacao = null;

async function abrirVerificacao() {
  const { freioUrl } = await chrome.storage.local.get('freioUrl');
  const url = freioUrl && /^https:\/\/([a-z0-9-]+\.)*mercadolivre\.com\.br\//i.test(freioUrl)
    ? freioUrl : 'https://www.mercadolivre.com.br/afiliados/linkbuilder';
  const aba = await chrome.tabs.create({ url, active: true });
  abaVerificacao = aba.id;
  return { aberta: true };
}

/* A aba da verificacao saiu do captcha e caiu numa pagina normal do Mercado
   Livre: o desafio foi resolvido. Libera sozinho. */
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tabId !== abaVerificacao || info.status !== 'complete') return;
  const url = (tab && tab.url) || '';
  if (/^https:\/\/([a-z0-9-]+\.)*mercadolivre\.com\.br\//i.test(url) && !/captcha/i.test(url)) {
    abaVerificacao = null;
    liberarFreio().then(() => console.log('[freio] liberado apos verificacao manual')).catch(() => {});
  }
});

/* O estado antigo podia deixar a maquina parada ate a virada do dia. Some com
   ele assim que esta versao carrega, senao atualizar nao destrava nada. */
chrome.storage.local.remove(['freioDia', 'freioAte', 'freioVezes', 'freioMotivo']);

async function gerarEtiquetas(limite = 20, filaPronta = null) {
  if (gerandoEtiquetas) return { pulou: true };
  /* SO o freio de etiqueta. Captcha lendo pagina de produto nao tem nada a ver
     com criar codigo no hub de afiliados, e era isso que estava derrubando a
     geracao o dia inteiro. */
  const travado = await freioLigado('etiqueta');
  if (travado) {
    if (filaPronta && filaPronta.length) await anotarEtiqueta('pausado: ' + travado);
    return { freio: travado };
  }
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { semToken: true };

  gerandoEtiquetas = true;
  try {
    const fila = filaPronta || await etiquetasPendentes(sincToken, limite);
    if (!fila.length) return { nada: true };

    let ultimaFalha = null;
    let recarregou = false;

    const criar = async (tabId, id, sufixo) => {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId }, world: 'MAIN', func: etiquetaNaPagina, args: [id, sufixo]
      });
      return (r && r.result) || { falha: 'a pagina nao respondeu' };
    };

    let prontas = [];
    try {
      prontas = await comAbaML(async tabId => {
        /* A aba do gerador parada no muro de captcha nao cria nada, e cada
           tentativa ali e mais um sinal ruim. Quem resolve e o Weslei, na mao. */
        if (/captcha/i.test(await urlDaAba(tabId))) {
          ultimaFalha = 'a aba do Mercado Livre esta na verificacao de seguranca: resolva o captcha no navegador';
          await puxarFreio(ultimaFalha, 'etiqueta');
          return [];
        }

        const saida = [];
        for (const linha of fila) {
          const sufixo = sufixoDaEtiqueta(linha.id, linha.desconto);
          let codigo = null;

          /* Cadastro primeiro: etiqueta ja emitida nunca e pedida de novo, e
             tentativa anterior sem resposta nao e repetida (codigo e
             permanente no Mercado Livre). */
          const reserva = await reservarGeracao(sincToken, 'etiqueta', String(linha.id));
          if (reserva.status === 'existe' && reserva.resultado) {
            saida.push({ id: linha.id, codigo: reserva.resultado });
            continue;
          }
          if (reserva.status !== 'reservado') {
            ultimaFalha = 'cadastro: ' + (reserva.motivo || 'bloqueado');
            if (/teto|pausa|indisponivel|token/i.test(reserva.motivo || '')) break;
            continue;
          }

          try {
            let res = await criar(tabId, linha.id, sufixo);

            /* 403 sem captcha costuma ser token do formulario vencido (a aba
               do gerador fica aberta por horas). Recarrega a aba UMA vez por
               rodada e tenta de novo, igual a pessoa apertando F5. */
            if (!res.alias && res.st === 403 && !res.captcha && !recarregou) {
              recarregou = true;
              try { await chrome.tabs.reload(tabId); await esperarCarregar(tabId); } catch (e) {}
              await sleep(1500);
              res = await criar(tabId, linha.id, sufixo);
            }

            /* 400/409/422: o texto do codigo ja existe na conta (criado numa
               rodada cuja resposta se perdeu, ou colisao de sufixo). Tenta um
               sufixo alternativo, uma vez so: codigo e permanente. */
            if (!res.alias && res.st >= 400 && res.st < 500 && res.st !== 403 && res.st !== 429 && !res.captcha) {
              const alt = sufixoDaEtiqueta(linha.id, linha.desconto, true);
              if (alt !== sufixo) { await sleep(1200); res = await criar(tabId, linha.id, alt); }
            }

            if (res.alias) {
              codigo = res.alias;
              await concluirGeracao(sincToken, 'etiqueta', String(linha.id), codigo, null, { sufixo });
            } else {
              /* O Mercado Livre respondeu (tem status HTTP): nada foi criado,
                 libera no cadastro. Sem status (queda de rede) a reserva fica
                 pendente e bloqueada, para nao arriscar codigo duplicado. */
              if (res.st) await concluirGeracao(sincToken, 'etiqueta', String(linha.id), null, res.falha || ('HTTP ' + res.st));
              ultimaFalha = (res.falha || 'sem resposta') + (res.semToken ? ' (pagina sem csrf-token)' : '')
                          + (res.amostra ? ': ' + res.amostra : '');
              if (res.captcha) {
                await puxarFreio('o Mercado Livre pediu verificacao de seguranca ao criar o codigo', 'etiqueta');
                break;
              }
              if (res.st === 403 || res.st === 429) {
                await puxarFreio('o Mercado Livre respondeu ' + res.st + ' ao criar o codigo', 'etiqueta');
                break;
              }
            }
          } catch (e) {
            ultimaFalha = e.message || String(e);
            console.warn('[etiquetas]', linha.id, ultimaFalha);
            if (/deslogad/i.test(ultimaFalha)) break;
          }
          saida.push({ id: linha.id, codigo });

          /* Pedido de pessoa esperando na tela: aproveita a aba e guarda o
             endereco da vitrine do cupom, para o site ter para onde levar. */
          if (linha.pedido) await guardarVitrineDoPedido(tabId, sincToken, linha.id);
          await sleep(2000);
        }
        return saida;
      });
    } catch (e) {
      ultimaFalha = e.message || String(e);
      await anotarEtiqueta('nao consegui abrir o gerador: ' + ultimaFalha);
      throw e;
    }

    const criadas = prontas.filter(x => x.codigo).length;
    await anotarEtiqueta(
      'pedidas ' + fila.length + ', criadas ' + criadas
      + (ultimaFalha ? ', ultima falha: ' + ultimaFalha : '')
    );

    if (!prontas.length) return { nada: true, falha: ultimaFalha };
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
   ir mais fundo, ate o bloco das ofertas, entao ele tem limite proprio.

   v1.39: captcha agora e ERRO, nao pagina vazia. Antes o muro de verificacao
   voltava como um HTML sem ofertas, a comparacao concluia "nenhuma loja
   melhor" e o site dizia ao cliente que tinha procurado. Nao tinha. */
async function lerCatalogo(url, limite = MAX_CATALOGO) {
  /* Primeiro na janela anonima: pagina de outra loja nao precisa da conta do
     Weslei, e o que se le ali nao fica ligado a ela. */
  const anon = await lerNaJanelaAnonima(url);
  if (anon.html) return anon.html;
  /* Com a anonima liberada, pagina de outra loja nunca e lida com a conta:
     se a anonima nao leu, a busca segue pelo leitor de cartoes da tela. */
  /* Decisao do Weslei (25/09): com a anonima bloqueada pelo Mercado Livre,
     a busca do CLIENTE usa a conta dele, uma por pedido, com freio. */
  if (await anonimaPermitida()) return '';
  /* Freio da conta ligado: nao insiste logado. So a anonima podia ler. */
  if (await freioLigado('leitura')) {
    throw new Error('leitura pausada na conta e a janela anonima nao leu (' + (anon.motivo || '?') + ')');
  }
  if (resta() < 8000) throw new Error('sem tempo para ler logado (' + (anon.motivo || '?') + ')');
  ultimaLeitura = { modo: 'logada', motivoAnonima: anon.motivo || null };
  const ctrl = new AbortController();
  const corta = setTimeout(() => ctrl.abort(), 25000);
  let r;
  try {
    r = await fetch(url, { credentials: 'include', redirect: 'follow', signal: ctrl.signal });
  } finally { clearTimeout(corta); }
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
      if (bytes > limite) { ctrl.abort(); break; }
    }
  } catch (e) { /* abort gera excecao, esperado */ }

  if (ehCaptcha(buf, r.url)) {
    await puxarFreio('o Mercado Livre pediu verificacao de seguranca ao comparar lojas', 'leitura', r.url);
    throw new Error('o Mercado Livre pediu uma verificacao de seguranca');
  }
  return buf;
}

function tituloDaPagina(html) {
  const m = /<h1[^>]*>([\s\S]{5,300}?)<\/h1>/i.exec(html)
         || /property="og:title"\s+content="([^"]{5,200})"/i.exec(html);
  if (!m) return null;
  return desescapar(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || null;
}

/* Le o vendedor de cada candidato e o cupom dele no indice. Cupom e BONUS,
   nao requisito: loja sem cupom entra com desconto zero. */
async function avaliarCandidatos(candidatos, itemAtual, extra = {}) {
  /* Cupom e BONUS, nunca requisito, e vem do BANCO do site (com teto e compra
     minima). Antes vinha do indice de cupons do Mercado Livre, e em 25/09 esse
     indice passou a responder 403 (CUPONS_RECUSADOS): a comparacao inteira
     morria por causa de um bonus. */
  const { sincToken } = await chrome.storage.local.get('sincToken');
  const achados = [];

  /* Lojas dos candidatos lidas AO MESMO TEMPO (antes era uma por vez, com
     pausa): a consulta do cliente precisa caber em 1 minuto. */
  const validos = candidatos.filter(c => !(itemAtual && c.item === itemAtual) && c.preco != null);
  const nomesDe = await Promise.all(validos.map(c =>
    comPrazo(resolverVendedor(c.item, c.url).catch(() => []), Math.max(2000, resta() - 3000), [])));
  for (let k = 0; k < validos.length; k++) {
    const c = validos[k];
    const nomes = nomesDe[k] || [];

    let cupom = null;
    for (const nome of nomes) {
      try { cupom = await melhorCupom(sincToken, nome); } catch (e) { cupom = null; }
      if (cupom) break;
    }
    const aval = cupom ? avaliarCupom(cupom, c.preco) : null;

    const vale = Boolean(aval && aval.vale);
    const economia = vale && aval.economia != null ? Math.round(aval.economia * 100) / 100 : 0;

    achados.push({
      item: c.item, url: c.url, preco: c.preco, vendedor: (cupom && cupom.vendedor) || nomes[0] || null,
      cupom: vale ? { id: cupom.id, titulo: cupom.desconto || cupom.titulo || null, vence: cupom.vence || null } : null,
      economia,
      minimo: vale ? aval.minimo : null,
      teto: vale ? aval.teto : null,
      final: Math.round((c.preco - economia) * 100) / 100,
      ...extra
    });
  }
  return achados;
}

/* Procura o mesmo produto na busca do Mercado Livre, como uma pessoa faria.
   Ritmo de gente: uma busca, no maximo seis candidatos. */
/* Roda DENTRO da pagina de busca aberta numa aba: le os cartoes como a
   pessoa ve na tela, depois que o proprio site montou a lista. */
function cartoesDaBuscaNaPagina() {
  /* Sem depender de nome de classe (o Mercado Livre troca): parte de cada
     link de anuncio, sobe ate o bloco do cartao e le titulo e preco dali. */
  const ehAnuncio = h => /(MLB-?\d{8,}|\/p\/MLB\d+|\/up\/MLBU\d+)/i.test(h) && !/\/pagina\/|click1\.|\/social\//i.test(h);
  const links = [...document.querySelectorAll('a[href]')].filter(a => ehAnuncio(a.href));
  const saida = [];
  const vistos = new Set();
  for (const a of links) {
    let bloco = a;
    for (let i = 0; i < 8 && bloco.parentElement; i++) {
      bloco = bloco.parentElement;
      if (/R\$\s*\d/.test(bloco.innerText || '') && (bloco.innerText || '').length > 20) break;
    }
    const chave = (a.href.match(/MLB-?\d{8,}|MLBU\d+|\/p\/MLB\d+/i) || [a.href])[0];
    if (vistos.has(chave)) continue;
    const titulo = ((a.getAttribute('title') || a.getAttribute('aria-label') || a.innerText || '').replace(/\s+/g, ' ').trim())
      || ((bloco.querySelector('h2, h3') || {}).innerText || '').replace(/\s+/g, ' ').trim();
    if (!titulo || titulo.length < 8) continue;
    let preco = null;
    const caixa = [...bloco.querySelectorAll('[class*="money-amount"]')]
      .find(x => !x.closest('s') && !/previous|original/i.test(x.className) && /fraction/.test(x.innerHTML));
    if (caixa) {
      const fr = (caixa.querySelector('[class*="fraction"]') || {}).innerText || '';
      const ct = (caixa.querySelector('[class*="cents"]') || {}).innerText || '';
      const n = parseFloat(fr.replace(/\./g, '')) + (ct ? Number(ct) / 100 : 0);
      if (n > 0 && n < 1e7) preco = Math.round(n * 100) / 100;
    }
    if (preco == null) {
      const m = /R\$\s*([\d.]+)(?:,(\d{2}))?/.exec(bloco.innerText || '');
      if (m) preco = parseFloat(m[1].replace(/\./g, '')) + (m[2] ? Number(m[2]) / 100 : 0);
    }
    vistos.add(chave);
    const foto = bloco.querySelector('img');
    const imagem = foto ? (foto.currentSrc || foto.src || foto.getAttribute('data-src') || '') + ' ' + (foto.getAttribute('srcset') || '') : null;
    saida.push({ href: a.href, titulo, preco, imagem });
    if (saida.length >= 48) break;
  }
  return { cartoes: saida, tituloPagina: document.title, url: location.href, itens: links.length };
}

/* ------------------------------------------------- janela anonima

   Pedido do Weslei (25/09): analisar os anuncios das outras lojas sem expor a
   conta dele. Tudo que e LEITURA de pagina de outra loja (busca, ficha de
   catalogo, anuncio candidato) abre numa janela anonima minimizada: cookies
   separados, sem login, sem ligacao com a conta de afiliado. Logado fica so o
   que precisa de login de verdade: gerar o link de afiliado.

   Por que janela e nao fetch sem cookie: medido em 22/09, a busca lida por
   fetch deslogado volta uma casca de 9 KB sem preco nenhum. A janela roda o
   JavaScript da pagina como um navegador comum e ve a lista inteira.

   Precisa de UMA permissao que so o dono do Chrome da: em
   chrome://extensions > Detalhes > "Permitir no modo anonimo". Sem ela tudo
   segue como antes (leitura logada, com freio), e o motivo fica gravado.

   Captcha na anonima NAO puxa o freio da conta: a conta nao estava ali. */
let janelaAnonima = null;
let fecharAnonima = null;

/* PRAZO DA CONSULTA (regra do Weslei: resultado em ate 1 minuto).
   Cada etapa da busca em outras lojas olha quanto tempo resta e se ajusta:
   o que nao cabe e pulado, mas o que ja foi lido nunca e jogado fora. */
let prazoConsulta = 0;
/* true = chegou cliente novo durante a segunda volta: as etapas encerram
   (resta 0) e o cliente novo e atendido primeiro. */
let interromperVolta = false;
function resta() { if (interromperVolta) return 0; return prazoConsulta ? prazoConsulta - Date.now() : 60000; }
function comPrazo(promessa, ms, reserva) {
  let t;
  return Promise.race([promessa, new Promise(ok => { t = setTimeout(() => ok(reserva), Math.max(0, ms)); })])
    .finally(() => clearTimeout(t));
}

/* Roda na aba: a pagina ja tem o que interessa? Nao espera carregar
   imagem, propaganda e rastreio (era isso que estourava o prazo). */
function prontidaoDaPagina() {
  const html = document.documentElement ? document.documentElement.outerHTML.length : 0;
  return {
    html, estado: document.readyState,
    itens: document.querySelectorAll('li.ui-search-layout__item, .poly-card').length,
    og: !!document.querySelector('meta[property="og:image"]'),
    captcha: /captcha\/wall/i.test(location.href) || /Por seguran.a, complete esta etapa/i.test(document.title || '')
  };
}

async function esperarConteudo(tabId, limiteMs) {
  const fim = Date.now() + limiteMs;
  let ultimo = null;
  while (Date.now() < fim) {
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: prontidaoDaPagina });
      ultimo = r && r.result;
      if (ultimo) {
        if (ultimo.captcha) return ultimo;
        /* Busca: cartoes na tela E os dados da pagina ja chegaram (medido:
           com 8 cartoes o HTML ainda tinha 40 KB, e caia para a leitura
           logada). Anuncio: og:image e HTML de verdade. */
        if (ultimo.itens >= 8 && ultimo.html > 300000) return ultimo;
        if (ultimo.og && ultimo.estado !== 'loading' && ultimo.html > 150000) return ultimo;
        if (ultimo.estado === 'complete') return ultimo;
      }
    } catch (e) { /* pagina ainda nao existe: tenta de novo */ }
    await sleep(500);
  }
  return ultimo;
}
let ultimaLeitura = null;

/* 25/09 14h: o Mercado Livre passou a responder as leituras anonimas com a
   pagina de "trafego suspeito" (suspicious-traffic / account-verification).
   E a protecao antirrobo deles pedindo para PARAR. Nao se tenta contornar:
   a leitura anonima fica desligada por 12 horas e a comparacao segue pela
   API oficial no servidor do site. Leitura logada de outras lojas continua
   proibida (protege a conta de afiliado). */
const PAUSA_ANONIMA_MS = 12 * 60 * 60 * 1000;
async function anonimaPermitida() {
  try {
    const { anonimaBloqueadaAte } = await chrome.storage.local.get('anonimaBloqueadaAte');
    if (anonimaBloqueadaAte && Date.now() < anonimaBloqueadaAte) return false;
    return await chrome.extension.isAllowedIncognitoAccess();
  } catch (e) { return false; }
}
async function anonimaBloqueada() {
  const { anonimaBloqueadaAte } = await chrome.storage.local.get('anonimaBloqueadaAte');
  return !!(anonimaBloqueadaAte && Date.now() < anonimaBloqueadaAte);
}
async function bloquearAnonima(url) {
  await chrome.storage.local.set({ anonimaBloqueadaAte: Date.now() + PAUSA_ANONIMA_MS });
  const { sincToken } = await chrome.storage.local.get('sincToken');
  gravarDiagnostico(sincToken, 'anonima-bloqueada', { url: String(url || '').slice(0, 200), ate: new Date(Date.now() + PAUSA_ANONIMA_MS).toISOString() }).catch(() => {});
}

let criandoAnonima = null;
async function abaAnonima(url) {
  if (fecharAnonima) { clearTimeout(fecharAnonima); fecharAnonima = null; }
  /* Duas leituras ao mesmo tempo nao podem abrir duas janelas. */
  if (criandoAnonima) { try { await criandoAnonima; } catch (e) { /* tenta de novo abaixo */ } }
  if (janelaAnonima != null) {
    try {
      const t = await chrome.tabs.create({ windowId: janelaAnonima, url, active: false });
      return t.id;
    } catch (e) { janelaAnonima = null; }
  }
  criandoAnonima = chrome.windows.create({ url, incognito: true, focused: false, state: 'minimized' });
  try {
    const w = await criandoAnonima;
    janelaAnonima = w.id;
    return w.tabs[0].id;
  } finally { criandoAnonima = null; }
}

/* Fecha a janela depois de 2 minutos parada: sessao anonima nova a cada
   rodada, sem acumular cookie nenhum. */
function agendarFecharAnonima() {
  if (fecharAnonima) clearTimeout(fecharAnonima);
  fecharAnonima = setTimeout(async () => {
    fecharAnonima = null;
    const id = janelaAnonima;
    janelaAnonima = null;
    if (id != null) { try { await chrome.windows.remove(id); } catch (e) { /* ja fechada */ } }
  }, 120000);
}

function htmlDaPagina() {
  return { html: document.documentElement.outerHTML, titulo: document.title };
}

/* Le uma pagina na janela anonima. Devolve { html } ou { motivo } (nunca
   lanca): quem chama decide o plano B. func troca o leitor (ex.: cartoes da
   busca lidos da tela). */
async function lerNaJanelaAnonima(url, func = htmlDaPagina) {
  if (!(await anonimaPermitida())) return { motivo: 'sem permissao de modo anonimo' };
  let id = null;
  try {
    id = await abaAnonima(url);
    await esperarConteudo(id, Math.max(3000, Math.min(14000, resta() - 3000)));
    const final = (await chrome.tabs.get(id)).url || '';
    const [s] = await chrome.scripting.executeScript({ target: { tabId: id }, func });
    const r = (s && s.result) || {};
    if (ehCaptcha(r.html || '', final) || (r.captcha)) { await bloquearAnonima(final); return { motivo: 'trafego suspeito na anonima (pausada 12h)' }; }
    if (func === htmlDaPagina) {
      if (!r.html || r.html.length < 5000) return { motivo: 'pagina curta (' + (r.html || '').length + ')' };
      ultimaLeitura = { modo: 'anonima' };
      return { html: r.html, url: final };
    }
    ultimaLeitura = { modo: 'anonima' };
    return { ...r, url: final };
  } catch (e) {
    return { motivo: String((e && e.message) || e).slice(0, 120) };
  } finally {
    if (id != null) { try { await chrome.tabs.remove(id); } catch (e) { /* ja fechada */ } }
    agendarFecharAnonima();
  }
}

/* Roda NA ABA do anuncio: preco e loja como aparecem na tela. */
function precoELojaDaTela() {
  const num = el => {
    if (!el) return null;
    const fr = ((el.querySelector('[class*="fraction"]') || {}).textContent || '').replace(/\D/g, '');
    const ct = ((el.querySelector('[class*="cents"]') || {}).textContent || '').replace(/\D/g, '');
    const n = parseFloat(fr) + (ct ? Number(ct) / 100 : 0);
    return n > 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
  };
  const cont = document.querySelector('.ui-pdp-price__second-line, [class*="ui-pdp-price__main"], .ui-pdp-price') || document.body;
  const caixas = [...cont.querySelectorAll('[class*="andes-money-amount"]')]
    .filter(x => !x.closest('s') && !/previous|original/i.test(x.className) && x.querySelector('[class*="fraction"]'));
  let preco = caixas.length ? num(caixas[0]) : null;
  if (preco == null) {
    const m = document.querySelector('meta[itemprop="price"]');
    if (m) preco = parseFloat(m.getAttribute('content')) || null;
  }
  let loja = null;
  const el = document.querySelector('.ui-pdp-seller__link-trigger, [class*="seller__link"], a[href*="/pagina/"], a[href*="/perfil/"]');
  if (el) loja = el.textContent.replace(/\s+/g, ' ').replace(/^Vendido por\s*/i, '').trim() || null;
  if (!loja) {
    const m = /Vendido por\s+([^\n]{2,60})/i.exec(document.body.innerText || '');
    if (m) loja = m[1].trim();
  }
  const h1 = document.querySelector('h1');
  const titulo = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() || null : null;
  const og = document.querySelector('meta[property="og:image"]');
  let imagem = og ? og.getAttribute('content') : null;
  if (!imagem) {
    const im = document.querySelector('.ui-pdp-gallery img, figure img, img[src*="mlstatic.com"]');
    imagem = im ? (im.currentSrc || im.src) : null;
  }
  if (imagem && !/^https:\/\/[a-z0-9.-]*mlstatic\.com\//i.test(imagem)) imagem = null;
  /* Aviso da pagina (anuncio sem oferta ativa): vai para o diagnostico e
     para o cliente, em vez de um preco inventado. */
  const texto = (document.querySelector('main, .ui-pdp-container, body') || document.body).innerText || '';
  const av = /(indispon[ií]vel|sem estoque|esgotad[oa]|an[uú]ncio pausado|n[aã]o est[aá] dispon[ií]vel|finalizad[oa])/i.exec(texto);
  return { preco, loja, titulo, imagem, aviso: av ? av[1] : null };
}

/* Anuncio colado aberto numa aba de fundo so para ler preco e loja da tela.
   Uma pagina por cliente (decisao do Weslei: a busca do cliente pode usar a
   conta). Anonima primeiro, se estiver liberada. */
async function lerTelaDoAnuncio(url) {
  if (await anonimaPermitida()) {
    const anon = await lerNaJanelaAnonima(url, precoELojaDaTela);
    if (anon && (anon.preco != null || anon.loja || anon.titulo)) {
      return { preco: anon.preco ?? null, loja: anon.loja || null, titulo: anon.titulo || null, imagem: anon.imagem || null,
               url: anon.url || null };
    }
  }
  if (await freioLigado('leitura')) return null;
  const aba = await chrome.tabs.create({ url, active: false });
  try {
    await esperarConteudo(aba.id, 12000);
    const [saida] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: precoELojaDaTela });
    const r = (saida && saida.result) || null;
    /* Endereco FINAL (depois do meli.la): e dele que sai o link de afiliado. */
    if (r) r.url = (await chrome.tabs.get(aba.id)).url || null;
    return r;
  } finally {
    try { await chrome.tabs.remove(aba.id); } catch (e) { /* ja fechada */ }
  }
}

/* Abre a busca numa aba de fundo, como uma pessoa abriria, espera a lista
   aparecer e le a tela. Usada quando a leitura "por baixo" veio vazia.
   Anonima primeiro; aba logada so sem a permissao e sem freio. */
async function lerBuscaNaAba(url) {
  const anon = await lerNaJanelaAnonima(url, cartoesDaBuscaNaPagina);
  if (anon.cartoes) return anon;
  if (await anonimaPermitida()) return { cartoes: [], motivo: anon.motivo || null };
  if (await freioLigado('leitura')) throw new Error('leitura pausada na conta (' + (anon.motivo || '?') + ')');
  const aba = await chrome.tabs.create({ url, active: false });
  try {
    await esperarCarregar(aba.id, 30000);
    await sleep(2500);
    const final = (await chrome.tabs.get(aba.id)).url || '';
    if (ehCaptcha('', final)) {
      await puxarFreio('o Mercado Livre pediu verificacao de seguranca ao buscar outras lojas', 'leitura', final);
      throw new Error('o Mercado Livre pediu uma verificacao de seguranca');
    }
    const [saida] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: cartoesDaBuscaNaPagina });
    return (saida && saida.result) || { cartoes: [] };
  } finally {
    try { await chrome.tabs.remove(aba.id); } catch (e) { /* ja fechada */ }
  }
}

/* Se a busca pelo titulo nao achar o mesmo produto, a Gemini olha a foto e o
   titulo do anuncio e escreve uma busca mais precisa (marca, modelo, versao,
   tamanho), e a busca roda de novo UMA vez com ela. A Gemini continua sendo
   quem confere, pela foto, se cada resultado e o mesmo produto. */
async function termoDeBuscaPelaGemini(original) {
  if (!original || !original.titulo) return null;
  const partes = [{ text:
    'Escreva a melhor busca curta (3 a 8 palavras, sem aspas, sem pontuacao) para achar EXATAMENTE este produto '
    + 'em outras lojas de um marketplace brasileiro: marca, linha/modelo, versao, cor quando for parte do produto, '
    + 'tamanho/volume/capacidade e compatibilidade quando existirem. Use a foto para confirmar o que e o produto. '
    + 'Sem palavras de marketing. Responda so JSON {"busca":"..."}.\n'
    + 'Titulo do anuncio: ' + original.titulo }];
  const img = await imagemParaGemini(original.imagem);
  if (img) partes.push(img);
  const r = await geminiLocal(partes);
  const obj = r.ok ? jsonDaIA(r.texto) : null;
  let busca = obj ? String(obj.busca || '').replace(/["']/g, '').trim() : '';
  if (busca.length < 6) {
    const { sincToken } = await chrome.storage.local.get('sincToken');
    const sv = await conferirNoServidor(sincToken, { tipo: 'busca',
      original: { titulo: original.titulo || null, imagem: original.imagem || null, preco: original.preco ?? null } });
    busca = sv && sv.ok ? String(sv.busca || '').trim() : '';
  }
  return busca.length >= 6 ? busca.slice(0, 90) : null;
}

/* Anuncios achados pelo GOOGLE (SerpApi, no servidor): nenhuma busca no
   site do Mercado Livre. Le so esses anuncios (no maximo 4, ao mesmo tempo)
   para ter preco, loja e foto; a Gemini confere pela foto; so o que ela
   aprovar vira opcao. */
async function achadosPeloGoogle(lista, precoRef, itemAtual, original, soCandidatos = false) {
  const diag = { fonte: 'google', recebidos: lista.length };
  const alvos = lista.filter(g => g.url && g.item !== itemAtual).slice(0, 4);
  const lidos = await Promise.all(alvos.map(g =>
    comPrazo(lerAnuncioNoWorker(g.url).catch(() => null), Math.max(4000, Math.min(15000, resta() - 12000)), null)));
  let candidatos = [];
  lidos.forEach((b, k) => {
    if (!b || !b.ok || b.preco == null) return;
    const item = itemDoUrl(b.finalUrl || '') || alvos[k].item;
    if (!item || item === itemAtual) return;
    if (precoRef != null && (b.preco < precoRef * 0.4 || b.preco > precoRef * 1.6)) return;
    if (b.nomes && b.nomes.length) cacheMem.set(item, { nomes: b.nomes, ts: Date.now() });
    candidatos.push({ item, url: b.canonica || b.finalUrl || alvos[k].url, preco: b.preco,
                      titulo: b.titulo || alvos[k].titulo, imagem: b.imagem || null });
  });
  diag.lidos = candidatos.length;
  if (soCandidatos) { candidatos.diag = diag; return candidatos; }
  if (!candidatos.length) { const v = []; v.diag = diag; return v; }
  ultimaIA = null;
  const ok = resta() > 9000 ? await comPrazo(mesmoProdutoPelaGemini(original, candidatos), resta() - 7000, null) : null;
  diag.ia = ok ? { conferidos: candidatos.length, iguais: ok.size, ...(ultimaIA || {}) }
               : { indisponivel: true, erros: (ultimaIA && ultimaIA.erros) || null };
  /* Mesma regra da busca: sem confirmacao pela foto, nao aparece. */
  candidatos = ok ? candidatos.filter((_, i) => ok.has(i)).map(c => ({ ...c, verificadoIA: true })) : [];
  if (!candidatos.length) { const v = []; v.diag = diag; return v; }
  const achados = await avaliarCandidatos(candidatos.slice(0, MAX_CANDIDATOS_BUSCA), itemAtual, { achadoNaBusca: true });
  for (const a of achados) {
    const c = candidatos.find(x => x.item === a.item);
    if (c) { a.imagem = c.imagem || null; a.verificadoIA = true; }
  }
  achados.diag = diag;
  return achados;
}

/* GOOGLE + BUSCA DO SITE AO MESMO TEMPO, UMA CONFERENCIA SO (25/09).
   Antes era um depois do outro, cada um com a sua conferencia pela Gemini, e
   a segunda chegava com 7 s restando ("sem tempo para a IA"): o travesseiro,
   que tinha 2 lojas iguais, voltou vazio. Agora os candidatos das duas fontes
   sao juntados (ate 8) e a Gemini confere todos de uma vez, com o tempo que
   sobra da consulta. */
async function achadosCombinados(titulo, precoRef, itemAtual, original, google) {
  const vazioCom = d => { const v = []; v.diag = d; return v; };
  const [doGoogle, daBusca] = await Promise.all([
    Array.isArray(google) && google.length && original
      ? achadosPeloGoogle(google, precoRef, itemAtual, original, true).catch(e => vazioCom({ erro: String(e.message || e).slice(0, 120) }))
      : Promise.resolve(vazioCom(null)),
    achadosNaBuscaUmaVez(titulo, precoRef, itemAtual, original, true)
      .catch(e => vazioCom({ erro: String(e.message || e).slice(0, 120) }))
  ]);
  const diag = { ...(daBusca.diag || {}), google: doGoogle.diag || null };
  const vistos = new Set();
  let candidatos = [];
  /* Alterna as fontes para as duas terem vez nos 8 conferidos. */
  const g = [...doGoogle], b = [...daBusca];
  while ((g.length || b.length) && candidatos.length < MAX_CANDIDATOS_IA) {
    for (const fonte of [g, b]) {
      const c = fonte.shift();
      if (c && c.item && c.item !== itemAtual && !vistos.has(c.item) && candidatos.length < MAX_CANDIDATOS_IA) {
        vistos.add(c.item); candidatos.push(c);
      }
    }
  }
  diag.candidatos = candidatos.length;
  if (!candidatos.length) {
    /* Nenhuma fonte trouxe nada: a Gemini escreve uma busca melhor e tenta uma
       vez (se ainda houver tempo). */
    if (original && resta() > 22000) {
      const termo = await termoDeBuscaPelaGemini(original);
      if (termo && termo.toLowerCase() !== String(titulo).toLowerCase()) {
        const segunda = await achadosNaBuscaUmaVez(termo, precoRef, itemAtual, original);
        segunda.diag = { ...(segunda.diag || {}), buscaGemini: termo, primeira: diag };
        return segunda;
      }
    }
    return vazioCom(diag);
  }
  ultimaIA = null;
  const t0 = Date.now();
  const ok = original && resta() > 6000
    ? await comPrazo(mesmoProdutoPelaGemini(original, candidatos), Math.max(6000, resta() - 3000), null)
    : null;
  diag.tempoIA = Date.now() - t0;
  if (!ok && !ultimaIA) ultimaIA = { indisponivel: true, erros: ['sem tempo para a IA (' + Math.round(resta() / 1000) + 's restando)'] };
  diag.ia = ok ? { conferidos: candidatos.length, iguais: ok.size, ...(ultimaIA || {}) }
               : { indisponivel: true, erros: (ultimaIA && ultimaIA.erros) || null };
  /* Regra: so o que a Gemini confirmou pela foto aparece. */
  const aprovados = ok ? candidatos.filter((_, i) => ok.has(i)).map(c => ({ ...c, verificadoIA: true })) : [];
  if (!aprovados.length) return vazioCom(diag);
  const achados = await avaliarCandidatos(aprovados.slice(0, MAX_CANDIDATOS_BUSCA), itemAtual, { achadoNaBusca: true });
  for (const a of achados) {
    const c = aprovados.find(x => x.item === a.item);
    if (c) { a.imagem = c.imagem || null; a.verificadoIA = true; }
  }
  achados.diag = diag;
  return achados;
}

async function achadosNaBusca(titulo, precoRef, itemAtual, original = null) {
  const primeira = await achadosNaBuscaUmaVez(titulo, precoRef, itemAtual, original);
  if (primeira.length || !original || resta() < 22000) return primeira;
  const termo = await termoDeBuscaPelaGemini(original);
  if (!termo || termo.toLowerCase() === String(titulo).toLowerCase()) return primeira;
  const segunda = await achadosNaBuscaUmaVez(termo, precoRef, itemAtual, original);
  segunda.diag = { ...(segunda.diag || {}), buscaGemini: termo, primeira: primeira.diag || null };
  return segunda;
}

async function achadosNaBuscaUmaVez(titulo, precoRef, itemAtual, original = null, soCandidatos = false) {
  /* Pagina de busca e grande (varios cartoes + dados): le ate 3 MB. */
  const html = await lerCatalogo(urlDeBusca(titulo), 3000000);
  /* Contagem de cada etapa da leitura, gravada no pedido: se a busca vier
     vazia de novo, da para saber onde parou (24/09: 0 anuncios lidos). */
  const diag = {};
  let candidatos = ofertasDaBusca(html, titulo, precoRef, diag);
  if (!candidatos.length && resta() > 12000) {
    /* 2a tentativa: a mesma busca numa aba de verdade, lida da tela. */
    try {
      const tela = await lerBuscaNaAba(urlDeBusca(titulo));
      diag.aba = { itens: tela.itens || 0, titulo: tela.tituloPagina || null };
      candidatos = candidatosDeCartoes(tela.cartoes, titulo, precoRef, diag);
    } catch (e) {
      diag.aba = { erro: String(e.message || e).slice(0, 120) };
    }
  }
  if (!candidatos.length) {
    /* Leitura vazia: guarda um retrato da pagina para eu ver o que o Mercado
       Livre devolveu (tamanho, trechos com anuncios, titulo da pagina). */
    const trechos = [];
    const re = /MLB-?\d{8,}/g;
    let m;
    while ((m = re.exec(html)) && trechos.length < 6) {
      trechos.push(html.slice(Math.max(0, m.index - 1500), m.index + 1500));
      re.lastIndex = m.index + 20000;
    }
    const { sincToken } = await chrome.storage.local.get('sincToken');
    gravarDiagnostico(sincToken, 'busca-vazia', {
      titulo, url: urlDeBusca(titulo), diag,
      tituloPagina: (/<title[^>]*>([^<]{0,200})/i.exec(html) || [])[1] || null,
      inicio: html.slice(0, 3000), trechos,
      /* Amostras ja com as aspas desescapadas, em volta de onde deveriam
         estar os anuncios (polycard e titulos). */
      amostras: (() => {
        const limpo = html.replace(/\\u002F/gi, '/').replace(/\\"/g, '"');
        const out = [];
        for (const marca of ['"polycard"', '"title":{"text"', '"components"', 'poly-card', 'ui-search']) {
          const i = limpo.indexOf(marca);
          out.push({ marca, pos: i, trecho: i >= 0 ? limpo.slice(Math.max(0, i - 800), i + 2500) : null });
        }
        return out;
      })()
    }).catch(() => {});
    const vazio = []; vazio.diag = diag; return vazio;
  }
  /* A Gemini confere foto e titulo antes de abrir cada anuncio: o que nao
     for o MESMO produto sai aqui, e ainda poupa leitura de pagina. */
  /* Ate 12 parecidos vao para a Gemini; dos aprovados, os 4 mais baratos
     seguem (cada um e uma leitura de pagina para saber a loja). */
  /* Adianta a leitura das lojas dos 6 mais baratos enquanto a Gemini
     confere (antes era uma coisa depois da outra). */
  for (const c of candidatos.slice(0, 4)) { if (c.item !== itemAtual) resolverVendedor(c.item, c.url).catch(() => {}); }
  if (soCandidatos) { candidatos.diag = diag; return candidatos; }
  if (original) {
    ultimaIA = null;
    const t0 = Date.now();
    const ok = resta() > 9000
      ? await comPrazo(mesmoProdutoPelaGemini(original, candidatos), resta() - 7000, null)
      : null;
    diag.tempoIA = Date.now() - t0;
    if (!ok && !ultimaIA) ultimaIA = { indisponivel: true, erros: ['sem tempo para a IA (' + Math.round(resta() / 1000) + 's restando)'] };
    diag.ia = ok ? { conferidos: Math.min(candidatos.length, 12), iguais: ok.size, ...(ultimaIA || {}) }
                 : { indisponivel: true, erros: (ultimaIA && ultimaIA.erros) || null };
    /* REGRA (Weslei, 25/09): loja achada pela busca so aparece se a Gemini
       confirmou pela foto que e o MESMO produto. Sem conferencia nao se mostra
       nada: produto parecido apresentado como igual e o pior erro possivel
       (pedido 201: capas "Armadura" mostradas no lugar da capa de acrilico). */
    candidatos = ok ? candidatos.filter((_, i) => ok.has(i)).map(c => ({ ...c, verificadoIA: true })) : [];
    if (!candidatos.length) { const vazio = []; vazio.diag = diag; return vazio; }
  }
  candidatos = candidatos.slice(0, MAX_CANDIDATOS_BUSCA);
  const achados = await avaliarCandidatos(candidatos, itemAtual, { achadoNaBusca: true });
  for (const a of achados) {
    const c = candidatos.find(x => x.item === a.item);
    if (c) { a.imagem = c.imagem || null; a.verificadoIA = !!c.verificadoIA; }
  }
  achados.diag = diag;
  return achados;
}

/* Devolve ATE TRES alternativas (ver escolherAlternativas em comparador.js).

   Primeiro o catalogo: pagina /p/MLB... tem o bloco buy_box_offers, que e o
   mesmo produto vendido por lojas diferentes. Sem catalogo, ou com um vendedor
   so, cai na busca pelo titulo. Se o catalogo nao der nada que valha, a busca
   ainda tenta, porque o mesmo item costuma estar anunciado fora do catalogo. */
async function mesmoProdutoEmOutrasLojas(urlProduto, ctx) {
  const { finalAtual } = ctx;
  const itemAtual = ctx.itemAtual || itemDoUrl(urlProduto);
  let cat = (RE_CATALOGO.exec(urlProduto) || [])[1] || null;
  let html = null;
  if (ctx.soBusca) {
    const titulo = ctx.titulo;
    if (!titulo) return [];
    /* Primeiro os anuncios que o Google achou (sem busca no site); a busca
       do site so se o Google nao trouxe nada aprovado e ainda houver tempo. */
    const daBusca = await achadosCombinados(titulo, finalAtual, itemAtual, ctx.original || null, ctx.google);
    const escolha = escolherAlternativas(daBusca, { ...ctx, itemAtual });
    /* Todas as lojas vistas, inclusive as mais caras: o site mostra. */
    escolha.todas = daBusca;
    escolha.diag = daBusca.diag || null;
    return escolha;
  }

  if (!cat) {
    html = await lerCatalogo(urlProduto);
    const can = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html);
    cat = (RE_CATALOGO.exec(can ? can[1] : '') || [])[1]
       || (RE_CATALOGO.exec(html) || [])[1] || null;
  }
  if (cat && !(html && html.includes('"buy_box_offers":{'))) {
    html = await lerCatalogo(`https://www.mercadolivre.com.br/p/${cat}`);
  }

  const titulo = ctx.titulo || tituloDaPagina(html || '');
  let achados = [];

  const ofertas = cat ? ofertasDoCatalogo(html) : [];
  if (ofertas.length >= 2) {
    achados = await avaliarCandidatos(
      ofertas.map(o => ({ ...o, url: urlDaOferta(cat, o.item) })), itemAtual);
  }

  let escolha = escolherAlternativas(achados, { ...ctx, itemAtual });
  let todas = achados;
  let diag = null;
  if (!escolha.length && titulo) {
    let daBusca = [];
    try { daBusca = await achadosNaBusca(titulo, finalAtual, itemAtual, ctx.original || null); }
    catch (e) { if (!achados.length) throw e; }
    diag = daBusca.diag || null;
    todas = achados.concat(daBusca);
    escolha = escolherAlternativas(todas, { ...ctx, itemAtual });
  }
  escolha.todas = todas;
  escolha.diag = diag;
  return escolha;
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
/* Tetos de leitura de pagina publica reduzidos em 23/09 (eram 250 e 200):
   o captcha do dia travou o atendimento dos clientes por horas. Tarefa de
   fundo e melhoria; cliente esperando na tela e venda. */
const TETO_DIA_VITRINES = 100;
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
const TETO_DIA_LOJAS = 60;
/* Comparacao de lojas lendo paginas com a sessao do Weslei, so quando a API
   oficial (servidor do site) nao responde. 0 = desligada: nenhuma leitura de
   pagina para comparar. Subir para poucas unidades por dia, se precisar. */
/* LIGADA em 24/09 (pedido do Weslei: a comparacao e o que o cliente espera
   sempre). So roda quando a API oficial nao achou o produto em nenhuma ficha
   de catalogo, com teto diario e com o freio de captcha de sempre: se o
   Mercado Livre pedir verificacao, para tudo e avisa. */
const LEITURA_RESERVA_POR_DIA = 120;
/* Na janela anonima a conta nao aparece: teto maior, so contra rajada. */
const LEITURA_RESERVA_ANONIMA = 400;
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
/* v1.45 (24/09): UMA carga por dia, em horario de gente.

   Eram quatro janelas (01:00, 11:00, 17:30, 21:00), cada uma baixando a lista
   inteira (~665 chamadas) e criando ate 150 etiquetas que ninguem pediu. Isso
   e o oposto de uso humano e coincidiu com captcha, 403 e o sumico do menu de
   cupons. Agora:
     - a lista de cupons carrega 1 vez por dia, a partir das 10:00; se o
       computador estava desligado, carrega assim que ligar, ate as 21:00;
     - etiqueta so nasce quando um cliente pede no site (ETIQUETAS_POR_JANELA
       = 0). Para voltar ao lote automatico, basta subir este numero. */
const JANELAS = ['10:00'];
const JANELA_DURACAO_MIN = 11 * 60;
const ETIQUETAS_POR_JANELA = 0;

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

  if (ETIQUETAS_POR_JANELA > 0) {
    try { saida.etiquetas = await gerarEtiquetas(ETIQUETAS_POR_JANELA); }
    catch (e) { saida.etiquetas = 'falhou: ' + e.message; }
  }

  console.log('[janela]', JSON.stringify(saida));
  return saida;
}

async function gastoDoDia() {
  const { gastoFila } = await chrome.storage.local.get('gastoFila');
  const dia = diaSP();
  if (!gastoFila || gastoFila.dia !== dia) return { dia, condicoes: 0, vitrines: 0, links: 0, lojas: 0, comparacoes: 0 };
  if (gastoFila.comparacoes == null) gastoFila.comparacoes = 0;
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
      /* A janela (lista do hub + etiquetas) so fala com o hub de afiliados,
         nao le pagina publica. O freio de LEITURA nao tem por que segurar a
         criacao de etiquetas: ela tem o freio proprio dela, dentro de
         gerarEtiquetas. Antes, um captcha num anuncio as 12:25 derrubava a
         janela das 17:30 junto. */
      const j = janelaAgora();
      const janela = j ? await rodadaDaJanela(j).catch(e => ({ falhou: e.message })) : null;
      return { freio: travado, pedidos, janela };
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

/* SEGUNDA VOLTA (regra do Weslei, 25/09: enquanto nao achar opcao mais barata
   ou nao tiver a analise completa, nao desapontar o cliente).
   Pedidos entregues com a comparacao incompleta (busca falhou, IA fora do ar,
   loja mais barata sem link) ficam aqui. O cliente ja ve o produto, o preco e
   o link de afiliado (resposta em ate 1 minuto) e a tela avisa que ainda estou
   comparando; a comparacao e refeita ate 2 vezes e a tela dele se atualiza
   sozinha. Nunca fica esperando para sempre: na ultima tentativa o pedido e
   fechado (final) com o melhor resultado que houve. */
const paraCompletar = [];
const MAX_VOLTAS_EXTRAS = 2;

/* Fica a que mostra mais: loja mais barata com link vale mais que tudo,
   depois mais lojas conferidas na tabela; empate, a completa (a mais nova). */
function melhorAnalise(x, y) {
  if (!x) return y;
  if (!y) return x;
  const peso = an => (an.outrasLojas || []).length * 100 + (an.referencias || []).length;
  if (peso(y) !== peso(x)) return peso(y) > peso(x) ? y : x;
  if (!!y.completa !== !!x.completa) return y.completa ? y : x;
  return y;
}

/* Cliente esperando na fila? Consulta sem reservar. O vigia da fila fica
   parado enquanto a extensao atende, entao a segunda volta olha por conta
   propria: cliente novo passa na frente (resposta em ate 1 minuto). */
async function clienteEsperando(sincToken) {
  if (chegouPedidoNovo) return true;
  return (await pedidosEsperando(sincToken).catch(() => 0)) > 0;
}

async function esperarOuCliente(sincToken, ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (await clienteEsperando(sincToken)) return true;
    await sleep(Math.min(4000, Math.max(0, fim - Date.now())));
  }
  return false;
}

async function segundaVolta(sincToken, atenderUm) {
  while (paraCompletar.length) {
    if (await clienteEsperando(sincToken)) {
      chegouPedidoNovo = false;
      const novos = await pedidosPendentes(sincToken).catch(() => []);
      for (const n of novos) { await atenderUm(n); await sleep(600); }
      /* Fila acusou cliente mas nao entregou (rede): sem laco apertado. */
      if (!novos.length) await sleep(4000);
      continue;
    }
    const c = paraCompletar.shift();
    c.cortes = c.cortes || 0;
    /* Respiro entre tentativas do mesmo pedido: IA ocupada (429/503) costuma
       voltar em segundos. */
    const espera = 12000 - (Date.now() - c.ultima);
    if (c.tentativas > 0 && espera > 0 && await esperarOuCliente(sincToken, espera)) {
      paraCompletar.unshift(c);
      continue;
    }
    /* Enquanto refaz, olha a fila a cada 4 s. Cortada 3 vezes, vai ate o fim
       (nunca fica sem terminar). */
    let olhando = true;
    const olho = c.cortes >= 3 ? null : setInterval(() => {
      clienteEsperando(sincToken).then(sim => { if (sim && olhando) interromperVolta = true; }).catch(() => {});
    }, 4000);
    let an = null;
    try { an = await c.tentar(c.tentativas + 2); }
    catch (e) { console.warn('[segunda volta]', c.id, e.message || e); }
    finally { olhando = false; if (olho) clearInterval(olho); }
    if (interromperVolta) {
      /* Tentativa cortada ao meio: nao conta e nao grava. */
      interromperVolta = false;
      c.cortes++;
      paraCompletar.unshift(c);
      continue;
    }
    c.tentativas++;
    c.ultima = Date.now();
    c.analise = melhorAnalise(c.analise, an);
    const acabou = !!(an && an.completa) || c.tentativas >= MAX_VOLTAS_EXTRAS;
    try {
      await completarPedido(sincToken, c.id, { ...c.analise, final: acabou, voltas: c.tentativas + 1 });
    } catch (e) { console.warn('[segunda volta] gravar', c.id, e.message || e); }
    if (!acabou) paraCompletar.push(c);
  }
}

async function atenderPedidos() {
  if (atendendo) { chegouPedidoNovo = true; return { atendidos: 0, pulou: true }; }
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) return { atendidos: 0, semToken: true };

  atendendo = true;
  /* O Chrome desliga o service worker depois de ~30 s sem chamada de API de
     extensao, e esperar resposta de fetch (Gemini, janela anonima) nao conta.
     Medido em 25/09 na 1.77: pedidos 195-197 morreram no meio de
     "outras_lojas" e ficaram girando na tela por mais de 10 minutos. Uma
     chamada leve a cada 20 s mantem o worker vivo enquanto ha cliente
     esperando. */
  const vivo = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch (e) {} }, 20000);
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
      /* Um pedido. Virou funcao para a segunda volta poder atender, no meio
         dela, um cliente novo que chegou (cliente novo tem prioridade). */
      const atenderUm = async (p) => {
        /* Cliente novo nunca herda o corte da segunda volta. */
        interromperVolta = false;
        if (!p.url_alvo) {
          await marcarPedido(sincToken, p.id, null, null, 'pedido sem link');
          falhou++; return;
        }
        /* Pedido so de link: o cliente clicou em "ver na loja" numa das lojas
           mais caras da comparacao, para conferir o preco. So gera o link de
           afiliado, sem ler anuncio nem comparar de novo. */
        if (p.vendedor === '(so link)') {
          try {
            const la = await gerarNaAba(tabId, p.url_alvo);
            await marcarPedido(sincToken, p.id, la.link, la.codigo, null, { soLink: true, lojaLida: true });
            ok++;
          } catch (e) {
            await marcarPedido(sincToken, p.id, null, null, String(e.message || e).slice(0, 200));
            falhou++;
          }
          return;
        }
        try {
          /* O banco ja reservou este pedido para esta instancia, de forma
             atomica, na propria consulta da fila. Esta chamada continua aqui
             so para versoes antigas do banco: onde a reserva ja aconteceu ela
             nao faz nada. */
          iniciarPedido(sincToken, p.id).catch(() => {});
          const url = limparUrl(p.url_alvo);
          marcarEtapa(sincToken, p.id, 'cupom');

          /* 1. le o anuncio. Primeiro pelo service worker, que enxerga
                qualquer subdominio e resolve link curto. Se falhar, tenta pela
                pagina, que so funciona quando a origem bate mas as vezes ve
                conteudo que o worker nao ve. */
          /* Tempo de cada etapa, gravado no pedido: e com isso que se corta o
             que estiver lento (meta: resposta em ate 1 minuto). */
          const t0p = Date.now();
          const tempos = {};
          const marcar = nome => { tempos[nome] = Math.round((Date.now() - t0p) / 100) / 10; };
          let a = await lerAnuncioNoWorker(url);
          /* Perfil social e captcha nao tem plano B: ler a pagina pela aba
             pegaria um produto qualquer da vitrine, ou insistiria no muro. */
          if (!a.perfilSocial && !a.captcha && (!a.ok || !(a.nomes && a.nomes.length))) {
            const [saida] = await chrome.scripting.executeScript({
              target: { tabId }, world: 'MAIN', func: analiseNaPagina, args: [url]
            });
            const b = (saida && saida.result) || null;
            if (b && b.ok && b.nomes && b.nomes.length) a = b;
            else if (!a.ok && b && b.ok) a = b;
          }
          if (!a) a = { ok: false, falha: 'a pagina nao respondeu' };
          /* Ultimo recurso para ler o anuncio colado: janela anonima (serve
             tambem quando a conta levou captcha). Perfil social nao: ali nao
             ha produto para ler. */
          if (!a.ok && !a.perfilSocial) {
            const anon = await lerNaJanelaAnonima(url);
            if (anon.html) {
              const b = extrairAnuncio(anon.html, anon.url || url, 200);
              if (b && b.titulo) a = { ...b, lidoAnonimo: true };
            }
          }

          /* PRECO E LOJA SEMPRE (regra do Weslei). Se o codigo da pagina nao
             trouxe (pagina de oferta "deal" e outros layouts), le o que aparece
             NA TELA, numa aba de fundo, como uma pessoa leria. */
          if (a && !a.perfilSocial && !a.captcha
              && (!a.ok || a.preco == null || !(a.nomes && a.nomes.length) || !a.titulo || !a.imagem)) {
            let tela = await lerTelaDoAnuncio((a.ok && a.finalUrl) || url).catch(() => null);
            /* Pagina de OFERTA (pdp_filters=deal) sem preco: tenta o mesmo
               produto sem o filtro da oferta (caso do monitor, 25/09). */
            if ((!tela || tela.preco == null) && /pdp_filters=deal/i.test((a.finalUrl || '') + ' ' + url)) {
              let semOferta = String((a.ok && a.finalUrl) || url);
              try {
                const u = new URL(semOferta);
                if (/^deal/i.test(u.searchParams.get('pdp_filters') || '')) u.searchParams.delete('pdp_filters');
                semOferta = u.toString();
              } catch (e) { /* endereco estranho: tenta como veio */ }
              const t2 = await lerTelaDoAnuncio(semOferta).catch(() => null);
              if (t2 && t2.preco != null) tela = { ...(tela || {}), ...t2 };
              else if (t2 && !tela) tela = t2;
            }
            if (tela && (tela.titulo || tela.preco != null)) {
              if (!a.ok) {
                /* So vale se a tela for de um anuncio (nao perfil social/lista):
                   o link de afiliado sai do endereco final, nunca do meli.la
                   colado, que pode ser de outro afiliado. */
                const fim = tela.url || '';
                if (!/mercadolivre\.com\.br\/.*MLB/i.test(fim) || /\/social\/|lista\.mercadolivre/i.test(fim)) {
                  a = { ok: false, falha: 'o link nao abre um anuncio de produto' };
                } else {
                  a = { ok: true, finalUrl: fim, canonica: fim.split('#')[0], status: 200, nomes: [], lidoPelaTela: true };
                }
              }
              if (a.ok) {
              if (a.preco == null && tela.preco != null) a.preco = tela.preco;
              if (!(a.nomes && a.nomes.length) && tela.loja) a.nomes = [tela.loja];
              if (!a.titulo && tela.titulo) a.titulo = tela.titulo;
              if (!a.imagem && tela.imagem) a.imagem = tela.imagem;
              if (tela.aviso) a.aviso = tela.aviso;
              if (a.faltou) a.faltou.tela = { preco: tela.preco, loja: tela.loja, titulo: !!tela.titulo, aviso: tela.aviso || null };
              }
            }
          }

          marcar('anuncio');
          if (a && a.faltou) gravarDiagnostico(sincToken, 'anuncio-incompleto', a.faltou).catch(() => {});
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
            /* Sem ler o anuncio nao se gera link: o "alvo" seria o proprio
               link colado, que pode ser de OUTRO afiliado (visto em 24/09 com
               um meli.la de compartilhamento). */
            /* Regra do Weslei: SEMPRE devolver o link de afiliado dele. Sem
               leitura do anuncio, so da para gerar a partir do endereco colado
               quando ele e um endereco de produto (nao um meli.la, que pode ser
               de outro afiliado); limparUrl tira rastreio de terceiros. */
            if (!a.ok && !/mercadolivre\.com\.br\/.*MLB/i.test(url)) throw new Error('nao gerei link: o anuncio nao foi lido');
            r = await gerarNaAba(tabId, a.ok ? alvoDoLink : url, TAG_PADRAO);
          } catch (e) {
            linkFalhou = e.message || String(e);
            console.warn('[link]', linkFalhou);
            /* Segunda tentativa, direto no gerador, com o endereco do anuncio
               (e nao o da ficha). Captcha/deslogado/freio nao insistem. */
            if (!/captcha|verificacao|deslogad|pausad|bloquead/i.test(linkFalhou)
                && (a.ok || /mercadolivre\.com\.br\/.*MLB/i.test(url))) {
              try {
                await sleep(1500);
                const alvo2 = enderecoDoAnuncio(alvoDoLink, itemDoUrl(url) || itemDoUrl(a.finalUrl || '') || null);
                const r2 = await gerarNaAbaSemCadastro(tabId, alvo2, TAG_PADRAO);
                if (r2 && r2.link) { r = r2; linkFalhou = null; }
              } catch (e2) { linkFalhou += ' | 2a tentativa: ' + (e2.message || e2); }
            }
          }

          /* Procura o MESMO produto de catalogo em outra loja e compara PRECO
             FINAL com o da loja do link.

             Isto rodava so quando a loja do link nao tinha cupom, o que e a
             pergunta errada. O cliente quer saber se existe negocio melhor,
             tendo cupom ou nao. No caso do Kit Wella, a loja do link tinha
             cupom de 15% e mesmo assim saia R$ 72,61 mais cara que a mesma
             caixa em outra loja sem cupom nenhum, e o site nao dizia nada. */
          let outra = null;
          let outras = [];
          let outraFalhou = null;
          /* O SITE PRECISA SABER SE EU PROCUREI.

             Sem este sinal, "nao achei loja melhor" e "nem cheguei a olhar"
             chegavam iguais na tela, e o texto exibido era o de quem nao
             procurou. Foi isso que o Weslei viu na capa da Motorola: a busca
             tinha condicoes de rodar e a tela dizia so "esta loja nao tem
             cupom", sem uma palavra sobre as outras lojas. */
          let procurouOutra = false;
          let motivoNaoProcurou = null;
          /* Outras lojas vistas, inclusive as mais caras (so exibicao). */
          let referencias = [];
          /* Registro da busca fora do catalogo, para conferir de longe. */
          let buscaFora = { rodou: false, motivo: null, vistos: 0 };
          let apiAchou = false;
          let verificacaoIA = null;
          /* 1 = atendimento normal; 2 e 3 = segunda volta (comparacao refeita
             depois que o cliente ja recebeu o resultado). */
          let volta = 1;
          const pausaLeitura = await freioLigado('leitura');
          /* Com a janela anonima liberada, a busca em outras lojas nao depende
             da conta: roda mesmo com o freio da conta ligado. */
          const anonima = await anonimaPermitida();
          ultimaLeitura = null;
          /* A comparacao pela API oficial nao depende da pausa de leitura nem
             de ter lido o anuncio: ela so precisa do link. A pausa passa a
             valer apenas para a reserva que le paginas (mais abaixo). */
          /* SEMPRE procura (regra do Weslei, 24/09): antes, com mais de 4
             pedidos na fila, a busca era pulada. A busca e do servidor, pela
             API oficial, e nao pesa na conta de afiliado. */
          const compararAgora = async () => {
          outra = null; outras = []; outraFalhou = null;
          procurouOutra = false; motivoNaoProcurou = null;
          referencias = []; buscaFora = { rodou: false, motivo: null, vistos: 0 };
          apiAchou = false; verificacaoIA = null; ultimaLeitura = null;
          {
            if (volta === 1) marcarEtapa(sincToken, p.id, 'outras_lojas');
            procurouOutra = true;
            let alts = [];
            /* 1. Servidor do site, API oficial do Mercado Livre. Nao usa a
                  sessao de afiliado para ler nada. */
            /* A API oficial nao deixa ler anuncio de outra conta (403), entao
               vai junto o que a extensao ja leu na pagina que o cliente colou. */
            const catDoAnuncio = ((a.canonica || '') + ' ' + (a.finalUrl || '') + ' ' + url).match(/\/p\/(MLB\d{5,})/i);
            marcar('antesApi');
            const api = await compararNoServidor(sincToken, a.finalUrl || url, {
              catalogo: catDoAnuncio ? catDoAnuncio[1].toUpperCase() : null,
              item: itemDoUrl(url) || itemDoUrl(a.finalUrl || '') || null,
              preco: a.preco != null ? Number(a.preco) : null,
              vendedor: vendedor || null,
              /* Para achar o produto no CATALOGO oficial pelo nome, quando o
                 anuncio nao e de catalogo (/up/MLBU...). */
              titulo: a.titulo || null,
              gtin: a.gtin || null,
              marca: a.marca || null,
              modelo: a.modelo || null,
              catalogoPagina: a.catalogoPagina || null,
              variacao: a.variacao || null
            });
            /* A reserva roda tambem quando a API olhou o catalogo e nao achou
               nada melhor: o mesmo produto costuma estar anunciado FORA da
               ficha de catalogo, mais barato. Comparacao em 100% dos links. */
            marcar('api');
            apiAchou = !!(api && api.procurou && (api.opcoes || []).length);
            if (api && Array.isArray(api.referencias)) referencias = api.referencias;
            if (apiAchou) {
              alts = (api.opcoes || []).map(o => ({
                item: o.item, url: o.url, vendedor: o.vendedor, preco: o.preco,
                economia: o.economia, final: o.final, ganho: o.ganho, finalAtual: o.finalAtual,
                motivo: o.motivo, achadoNaBusca: !!o.achadoNaBusca,
                imagem: o.imagem || null, titulo: o.nomeCatalogo || null,
                minimo: o.cupom ? o.cupom.minimo : null, teto: o.cupom ? o.cupom.teto : null,
                cupom: o.cupom ? { id: o.cupom.id, titulo: o.cupom.titulo, vence: o.cupom.vence } : null
              }));
            }
            /* REGRA (Weslei, 25/09): a busca em outras lojas roda SEMPRE, mesmo
               quando o catalogo oficial ja achou uma loja melhor. Caso real: o
               disco de freio tinha so 1 outra loja no catalogo e a comparacao
               parava ali ("a API ja achou loja melhor"). Catalogo + busca sao
               juntados e a mais barata vira a recomendacao. */
            const doCatalogo = alts;
            if (a.ok && (anonima ? (await gastoDoDia()).comparacoes < LEITURA_RESERVA_ANONIMA
                                        : (!pausaLeitura && LEITURA_RESERVA_POR_DIA > 0
                                           && (await gastoDoDia()).comparacoes < LEITURA_RESERVA_POR_DIA))) {
              /* 2. Reserva: a API nao achou o produto em ficha de catalogo.
                    Le a busca do Mercado Livre como uma pessoa faria, com
                    teto diario (LEITURA_RESERVA_POR_DIA). */
              await anotarGasto('comparacoes', 1);
              buscaFora.rodou = true;
              try {
                const temCupomAqui = !!(cupom && aval && aval.vale);
                const economiaAqui = (temCupomAqui && aval.economia != null) ? aval.economia : 0;
                const finalAqui = a.preco != null ? a.preco - economiaAqui : null;
                /* A busca inteira tem 38 s (a consulta do cliente cabe em 1
                   minuto). As etapas se ajustam ao que resta; a corrida abaixo
                   e so a rede de seguranca. */
                prazoConsulta = Date.now() + 38000;
                let prazo;
                const busca = await Promise.race([mesmoProdutoEmOutrasLojas(a.canonica || a.finalUrl || url, {
                  finalAtual: finalAqui, temCupomAqui, vendedorAtual: vendedor,
                  /* Com a variacao marcada (Edge 70, 110V...), senao a busca
                     traz o produto de outro modelo. */
                  titulo: [a.titulo, a.variacao].filter(Boolean).join(' ') || null,
                  itemAtual: itemDoUrl(url) || itemDoUrl(a.finalUrl || '') || null,
                  /* A API ja olhou o catalogo: vai direto para a busca e nao
                     gasta leitura de pagina repetindo o que ja foi visto. */
                  soBusca: !!(api && api.procurou) || !!(api && Array.isArray(api.google) && api.google.length),
                  google: (api && Array.isArray(api.google)) ? api.google : [],
                  original: { titulo: [a.titulo, a.variacao].filter(Boolean).join(' '), imagem: a.imagem || null, preco: a.preco, item: itemDoUrl(url) || itemDoUrl(a.finalUrl || '') || null }
                }),
                  new Promise((_, falha) => { prazo = setTimeout(() => falha(new Error('tempo esgotado (45s) na busca em outras lojas')), 45000); })
                ]).finally(() => { clearTimeout(prazo); prazoConsulta = 0; });
                buscaFora.vistos = Array.isArray(busca.todas) ? busca.todas.length : 0;
                buscaFora.leitura = busca.diag || null;
                buscaFora.modo = ultimaLeitura;
                /* Junta catalogo + busca: uma entrada por loja, a de menor preco
                   final primeiro, ate 3 recomendadas. */
                {
                  const porLoja = new Map();
                  for (const x of [...doCatalogo, ...busca]) {
                    const k = String(x.vendedor || x.item || '').toLowerCase();
                    const atual = porLoja.get(k);
                    if (!atual || (x.final ?? 1e12) < (atual.final ?? 1e12)) porLoja.set(k, x);
                  }
                  alts = [...porLoja.values()].sort((x, y) => (x.final ?? 1e12) - (y.final ?? 1e12)).slice(0, 3);
                }
                if (Array.isArray(busca.todas)) {
                  const vistos = new Set(referencias.map(x => (x.vendedor || '').toLowerCase()));
                  for (const t of busca.todas) {
                    if (t.final == null || vistos.has((t.vendedor || '').toLowerCase())) continue;
                    if (vendedor && (t.vendedor || '').toLowerCase() === vendedor.toLowerCase()) continue;
                    vistos.add((t.vendedor || '').toLowerCase());
                    referencias.push({ vendedor: t.vendedor || null, preco: t.preco, final: t.final, url: t.url || null,
                      imagem: t.imagem || null, verificadoIA: !!t.verificadoIA,
                      diferenca: finalAqui != null ? Math.round((t.final - finalAqui) * 100) / 100 : null,
                      cupom: t.cupom ? t.cupom.titulo : null });
                  }
                  referencias.sort((x, y) => x.final - y.final);
                  referencias = referencias.slice(0, 6);
                }
              } catch (e) {
                /* Se a API ja olhou o catalogo, a comparacao aconteceu: so a
                   busca extra falhou. O que o catalogo achou continua. */
                alts = doCatalogo;
                buscaFora.motivo = 'falhou: ' + e.message;
                if (!(api && api.procurou)) {
                  procurouOutra = false;
                  motivoNaoProcurou = 'a busca no Mercado Livre falhou: ' + e.message;
                }
              }
            } else if (!(api && api.procurou)) {
              procurouOutra = false;
              motivoNaoProcurou = (api && api.motivo) || 'comparacao indisponivel agora';
            } else {
              buscaFora.motivo = !a.ok ? 'anuncio nao lido' : 'teto do dia de buscas atingido';
            }

            /* Segunda volta interrompida por cliente novo: resultado descartado. */
            if (volta > 1 && interromperVolta) return;
            /* O link de afiliado sai numa etapa separada de proposito. Se ele
               falhar, o achado NAO vai para a tela: mandar o cliente para uma
               oferta mais barata por um endereco sem etiqueta seria entregar a
               venda de graca. Melhor nao mostrar e registrar o motivo.

               No maximo duas alternativas ganham link: cada link e uma chamada
               ao gerador, e o gerador ja respondeu 429 hoje. */
            /* Ofertas achadas pelo NOME (nao pela ficha do proprio anuncio) e
               lojas da lista passam pela Gemini: foto e titulo contra o
               anuncio original. O que ela reprovar nao aparece. */
            {
              const original = { titulo: [a.titulo, a.variacao].filter(Boolean).join(' '), imagem: a.imagem || null, preco: a.preco, item: itemDoUrl(url) || itemDoUrl(a.finalUrl || '') || null };
              const conferir = [];
              alts.forEach((x, i) => { if (x.achadoNaBusca && !x.verificadoIA) conferir.push({ tipo: 'alt', i, titulo: x.titulo, imagem: x.imagem, item: x.item || itemDoUrl(x.url || '') }); });
              referencias.forEach((x, i) => { if ((x.porNome || x.porNome == null) && !x.verificadoIA) conferir.push({ tipo: 'ref', i, titulo: x.nomeCatalogo || x.titulo || null, imagem: x.imagem, item: itemDoUrl(x.url || '') }); });
              if (conferir.length) {
                ultimaIA = null;
                let prazoIA;
                const ok = await Promise.race([
                  mesmoProdutoPelaGemini(original, conferir),
                  new Promise(r => { prazoIA = setTimeout(() => r(null), 12000); })
                ]).finally(() => clearTimeout(prazoIA));
                verificacaoIA = ok ? { conferidos: Math.min(conferir.length, 12), iguais: ok.size, ...(ultimaIA || {}) }
                                   : { indisponivel: true, erros: (ultimaIA && ultimaIA.erros) || null };
                {
                  /* Sem conferencia da IA, nada achado por nome fica na tela. */
                  const fora = new Set(conferir.filter((_, k) => !(ok && ok.has(k))).map(c => c.tipo + c.i));
                  alts = alts.filter((_, i) => !fora.has('alt' + i));
                  referencias = referencias.filter((_, i) => !fora.has('ref' + i));
                }
              }
            }
            marcar('busca');
            if (alts.length && volta === 1) marcarEtapa(sincToken, p.id, 'links');
            /* Ate 3 lojas mais baratas, todas com o link de afiliado do
               Weslei. Sem link de afiliado a oferta nao vai para a tela. */
            for (const alt of alts.slice(0, 3)) {
              try {
                /* Endereco do ANUNCIO da loja (nao da ficha de catalogo): medido em
                   25/09, assim cada loja ganha o seu proprio link de afiliado
                   (pela ficha o gerador devolvia o mesmo link para todas). */
                const alvoAlt = enderecoDoAnuncio(alt.url, alt.item);
                const la = await gerarNaAba(tabId, alvoAlt);
                /* O gerador do Mercado Livre devolve o MESMO link para todas as
                   ofertas da mesma ficha de catalogo (medido em 24/09: Celimax
                   e capinha). Entao:
                     - igual a outra alternativa ja listada: fica so a primeira
                       (a mais barata), porque o link e o mesmo;
                     - igual ao link do proprio anuncio: a loja mais barata FICA,
                       marcada mesmaPagina, e o site ensina o cliente a escolher
                       a loja em "Outras opcoes de compra". Descartar escondia a
                       economia (Celimax: R$ 8,88 a menos sumiu da tela). */
                if (!la.link || outras.some(o => o.link === la.link)) continue;
                const mesmaPagina = la.link === r.link;
                outras.push({
                  cupomId: alt.cupom ? alt.cupom.id : null,
                  vendedor: alt.vendedor,
                  preco: alt.preco,
                  economia: alt.economia,
                  minimo: alt.minimo,
                  teto: alt.teto,
                  final: alt.final,
                  ganho: alt.ganho,
                  finalAtual: alt.finalAtual,
                  /* 'mais_barata' ou 'tem_cupom' (a loja do cliente nao tem
                     cupom e esta tem, sem sair mais cara). */
                  motivo: alt.motivo,
                  /* true quando veio da busca por titulo, nao da pagina de
                     catalogo. Catalogo e o mesmo produto por definicao; busca
                     e um palpite forte. O site precisa dizer a diferenca. */
                  achadoNaBusca: !!alt.achadoNaBusca,
                  mesmaPagina: mesmaPagina,
                  imagem: alt.imagem || null,
                  verificadoIA: !!alt.verificadoIA || (verificacaoIA && !verificacaoIA.indisponivel && !!alt.achadoNaBusca),
                  cupomTitulo: alt.cupom ? alt.cupom.titulo : null,
                  vence: alt.cupom ? alt.cupom.vence : null,
                  link: la.link,
                  codigo: la.codigo
                });
              } catch (e) {
                outraFalhou = 'achei oferta melhor mas nao consegui gerar o link de afiliado: ' + e.message;
                console.warn('[mesmo produto] link falhou:', e.message);
                if (/429|seguranca|captcha/i.test(e.message || '')) break;
              }
              await sleep(600);
            }
            outra = outras[0] || null;
          }

          if (volta > 1 && interromperVolta) return;
          /* Todas as lojas da tabela com o link de afiliado ja pronto, numa
             chamada so ao gerador. Loja sem link fica com o botao que gera no
             clique (site). */
          try {
            const semLink = referencias.filter(x => !x.link && x.url);
            if (semLink.length && !(await freioLigado('link'))) {
              const alvos = semLink.map(x => enderecoDoAnuncio(x.url, null));
              const mapa = await gerarVariosNaAba(tabId, alvos);
              semLink.forEach((x, k) => { if (mapa[alvos[k]]) x.link = mapa[alvos[k]]; });
            }
          } catch (e) { console.warn('[links em lote]', e.message); }
          };
          await compararAgora();

          const montarAnalise = (nomeTempo) => ({
            titulo: a.titulo ?? null,
            /* Aviso da pagina do anuncio (ex.: indisponivel), lido da tela. */
            aviso: a.aviso || null,
            preco: a.preco ?? null,
            vendedor: vendedor ?? null,
            outraLoja: outra,
            /* Ate duas lojas, a mais barata primeiro. outraLoja continua
               existindo (e a primeira desta lista) para telas antigas. */
            outrasLojas: outras,
            /* true = procurei o mesmo produto nas outras lojas. Com outraLoja
               null, isso quer dizer "procurei e esta e a melhor". Sem isso, a
               tela mentia por omissao. */
            procurouOutra: procurouOutra,
            motivoNaoProcurou: motivoNaoProcurou,
            /* Para saber, de longe, qual versao atendeu este cliente. */
            versaoExtensao: chrome.runtime.getManifest().version,
            tempos: (marcar(nomeTempo), { ...tempos }),
            /* false = falta ligar "Permitir no modo anonimo" na extensao. */
            anonima: anonima,
            /* Para a vitrine do site. */
            imagem: a.imagem || null,
            categoria: (a.categorias && a.categorias[0]) || null,
            categorias: a.categorias || [],
            referencias: referencias,
            verificacaoIA: verificacaoIA,
            buscaFora: buscaFora.rodou ? buscaFora
              : { rodou: false, vistos: 0, motivo: !a.ok ? 'anuncio nao lido' : (pausaLeitura && !anonima) ? 'leitura pausada (freio/captcha) e modo anonimo nao permitido' : 'teto do dia atingido' },
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
          /* ANALISE COMPLETA (regra do Weslei, 25/09: enquanto nao achar opcao
             mais barata ou nao tiver a analise completa, nao desapontar o
             cliente). Completa = achou loja mais barata com link, ou a busca
             rodou inteira e a IA conferiu todos os candidatos. Busca que
             falhou, IA fora do ar ou loja mais barata sem link = incompleta:
             o cliente recebe o resultado agora (1 minuto) e a comparacao e
             refeita logo em seguida, atualizando a tela dele. */
          const analiseCompleta = () => {
            if (outras.length) return true;
            if (outraFalhou) return false;
            if (!procurouOutra) return false;
            if (buscaFora.rodou && buscaFora.motivo) return false;
            if (buscaFora.leitura && buscaFora.leitura.ia && buscaFora.leitura.ia.indisponivel) return false;
            if (verificacaoIA && verificacaoIA.indisponivel) return false;
            return true;
          };
          const analise = montarAnalise('fim');
          analise.completa = !!a.ok && analiseCompleta();
          /* final = nao vem mais nada; o site para de esperar. Sem o anuncio
             lido nao ha o que comparar de novo. */
          analise.final = analise.completa || !a.ok;
          await marcarPedido(sincToken, p.id, r.link, r.codigo, null, analise);
          if (!analise.final) {
            const temposPrimeira = analise.tempos;
            paraCompletar.push({
              id: p.id, tentativas: 0, ultima: Date.now(), analise,
              tentar: async (n) => {
                volta = n;
                const t0v = Date.now();
                await compararAgora();
                const an = montarAnalise('fim');
                an.tempos = { ...temposPrimeira, ['volta' + n]: Math.round((Date.now() - t0v) / 100) / 10 };
                an.completa = analiseCompleta();
                an.final = false;
                an.voltas = n;
                return an;
              }
            });
          }
          /* Resumo do ultimo atendimento, para o popup mostrar o estado real. */
          chrome.storage.local.set({ ultimoAtendimento: {
            quando: Date.now(), titulo: a.titulo || null, segundos: tempos.fim || null,
            lojas: (referencias || []).length + (outras || []).length,
            maisBaratas: (outras || []).length, comLink: !!r.link,
            ia: verificacaoIA && !verificacaoIA.indisponivel ? 'conferiu' : (buscaFora && buscaFora.leitura && buscaFora.leitura.ia
                  ? (buscaFora.leitura.ia.indisponivel ? 'indisponivel' : 'conferiu') : 'nao precisou')
          } }).catch(() => {});
          ok++;
        } catch (e) {
          await marcarPedido(sincToken, p.id, null, null, e.message || String(e), null);
          falhou++;
        }
      };
      for (const p of pendentes) {
        await atenderUm(p);
        // Ritmo entre pedidos: calmo quando ninguem espera, apertado quando
        // tem gente na fila. Nunca zero: rajada e o que chama atencao.
        await sleep(filaCheia ? 250 : 600);
      }
      await segundaVolta(sincToken, atenderUm);
    });

    if (ok || falhou) console.log(`[pedidos] ${ok} atendidos, ${falhou} falharam`);
    /* Rodada cheia significa que provavelmente sobrou gente esperando: o banco
       entrega no maximo 12 por vez. Emenda a proxima rodada em vez de esperar
       o alarme de 1 minuto. */
    if (pendentes.length >= 12) chegouPedidoNovo = true;
    return { atendidos: ok, falharam: falhou, pendentes: pendentes.length };
  } finally {
    atendendo = false;
    clearInterval(vivo);
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
        /* O mesmo aviso vale para o botao do cartao de cupom: sem isto o
           pedido de etiqueta esperava o alarme de 1 minuto. */
        atenderPedidosDeEtiqueta().catch(e => console.warn('[etiquetas]', e.message));
        atenderPedidosDeLoja().catch(e => console.warn('[loja]', e.message));
        responder({ ok: true });
      } else if (msg.tipo === 'estadoGeral') {
        const st = await chrome.storage.local.get(['ultimoAtendimento', 'anonimaBloqueadaAte', 'sincToken']);
        responder({ ok: true, dados: {
          versao: chrome.runtime.getManifest().version,
          anonima: await anonimaPermitida(),
          anonimaBloqueadaAte: st.anonimaBloqueadaAte || null,
          token: !!st.sincToken,
          ultimo: st.ultimoAtendimento || null,
          freio: await estadoDoFreio()
        } });
      } else if (msg.tipo === 'estadoFreio') {
        responder({ ok: true, dados: await estadoDoFreio() });
      } else if (msg.tipo === 'liberarFreio') {
        responder({ ok: true, dados: await liberarFreio() });
      } else if (msg.tipo === 'abrirVerificacao') {
        responder({ ok: true, dados: await abrirVerificacao() });
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
  versao: 15,     // arquivos novos na pasta (git pull agendado): recarrega
};

/* ATUALIZACAO SEM NINGUEM NO COMPUTADOR.

   O Weslei vai estar na Espanha. No computador de casa, uma tarefa agendada
   do Windows faz "git pull" da pasta da extensao (ferramentas/
   instalar-atualizacao-automatica.ps1). Os arquivos novos chegam ao disco, mas
   o Chrome continua rodando a versao antiga ate alguem clicar em Recarregar.

   Aqui a extensao le o manifest.json do disco a cada 15 minutos; se a versao
   la for diferente da que esta rodando, ela se recarrega sozinha. Nao recarrega
   no meio de um atendimento: espera o pedido em andamento terminar. */
async function conferirVersaoNoDisco() {
  try {
    const r = await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' });
    const noDisco = (await r.json()).version;
    const rodando = chrome.runtime.getManifest().version;
    if (!noDisco || noDisco === rodando) return { igual: rodando };
    if (atendendo || gerandoEtiquetas || andandoFila || atendendoLojas) return { esperando: noDisco };
    console.log('[versao] recarregando', rodando, '->', noDisco);
    chrome.runtime.reload();
    return { recarregou: noDisco };
  } catch (e) {
    return { falhou: e.message };
  }
}

/* Sinal de vida para o site a cada 2 minutos. Antes o visto_em so mudava
   quando o freio era liberado, ficava velho e o site dizia "pausada" com a
   extensao funcionando (25/09). Vai junto a versao que esta rodando. */
let ultimoSinal = 0;
async function sinalDeVida() {
  if (Date.now() - ultimoSinal < 2 * 60e3) return;
  ultimoSinal = Date.now();
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (sincToken) await anotarEstadoRobo(sincToken, 'visto_em', new Date().toISOString());
}

/* FILA VIGIADA. O cliente do site nao tem a extensao, entao o aviso
   instantaneo (postMessage) so vale no navegador do Weslei: os pedidos dos
   clientes esperavam o alarme de 1 minuto (medido: 31 a 38 s parados na
   fila). Agora cada alarme olha a fila a cada 4 s durante ~55 s, e o proximo
   alarme emenda: espera maxima de ~4 s. Consulta leve ao banco, nao ao
   Mercado Livre. */
let vigiando = false;
async function vigiarFila() {
  if (vigiando) return;
  vigiando = true;
  const fim = Date.now() + 55000;
  try {
    while (Date.now() < fim) {
      if (!atendendo) await atenderPedidos().catch(e => console.warn('[pedidos]', e.message));
      await sleep(4000);
    }
  } finally { vigiando = false; }
}

function armarAlarmes() {
  for (const [nome, periodInMinutes] of Object.entries(ALARMES)) {
    chrome.alarms.create(nome, { periodInMinutes });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  armarAlarmes();
  /* Sem forcar: cada "Recarregar" da extensao baixava a lista inteira. */
  obterIndice().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  armarAlarmes();
  sinalDeVida().catch(() => {});
  obterIndice().catch(() => {});
  atenderPedidos().catch(() => {});
  // Abrir o Chrome ja adianta uma rodada: nao espera os 10 minutos do alarme.
  setTimeout(() => andarFila().catch(() => {}), 20000);
});
chrome.alarms.onAlarm.addListener(async a => {
  if (a.name === 'pedidos') {
    sinalDeVida().catch(() => {});
    vigiarFila().catch(() => {});
    completarVitrine().catch(() => {});
    // Quem clicou "Gerar o codigo deste cupom" no site esta esperando na tela.
    // Lote de 3 para nao virar porta dos fundos dos tetos diarios.
    atenderPedidosDeEtiqueta().catch(e => console.warn('[etiquetas]', e.message));
    // "Ver os produtos da loja": pagina da loja pedida por quem esta no site.
    atenderPedidosDeLoja().catch(e => console.warn('[loja]', e.message));
    return;
  }
  if (a.name === 'versao') {
    conferirVersaoNoDisco().catch(() => {});
    return;
  }
  if (a.name === 'fila') {
    andarFila().catch(e => console.warn('[fila]', e.message));
    completarVitrine().catch(() => {});
    return;
  }
  /* 'refresh' e 'diario' nao existem mais: viraram as janelas, tratadas
     dentro de andarFila. Alarmes antigos ainda registrados no navegador do
     Weslei chegam aqui e sao descartados de proposito. */
  if (a.name === 'refresh' || a.name === 'diario') {
    try { await chrome.alarms.clear(a.name); } catch (e) {}
  }
});
