/* Atendimento: cliente manda o link do anuncio -> devolvemos o MEU link.
   =====================================================================
   Regra inegociavel: qualquer link que sai daqui e gerado com a minha
   etiqueta de afiliado. Se o link que o cliente mandou for de outro
   afiliado (meli.la de terceiro), ele e resolvido ate o anuncio original
   e regerado no meu nome.

   Tudo passa pela sessao logada do navegador, que e a unica forma de
   falar com o gerador de links do Mercado Livre.
*/

export const PAGINA_GERADOR = 'https://www.mercadolivre.com.br/afiliados/linkbuilder';
export const ROTA_CRIAR = '/affiliate-program/api/v2/affiliates/createLink';
export const TAG_PADRAO = 'wesleimendes';

/* Parametros que mudam o que o cliente vai ver. Todo o resto e rastreio
   de navegacao e vai fora. O trecho depois do # nunca chega no servidor. */
/* Parametros que mudam QUAL produto/vendedor a pessoa esta vendo.
   O pdp_filters e o mais importante: numa pagina de catalogo (/p/MLB...),
   e ele que fixa a oferta da loja escolhida. Sem ele o Mercado Livre mostra
   o vendedor campeao do catalogo, que quase sempre e outro. Foi exatamente
   isso que fez o site dizer "sem cupom" para uma loja que tinha cupom. */
const MANTER = [
  'pdp_filters', 'item_id', 'attributes', 'wid',
  'searchVariation', 'variation', 'quantity'
];

/* Endereco que ja aponta para um anuncio ou produto de catalogo. */
const ehProdutoML = u => /\/p\/MLB\d+/i.test(u) || /\/MLB-?\d+/i.test(u);

/* Encurtado do Mercado Livre: exige um salto a mais e costuma carregar a
   etiqueta de quem compartilhou. */
const ehCurtoML = u => /^https?:\/\/(meli\.la|(www\.)?mercadolivre\.com\.br\/sec)\//i.test(u);

const ENTIDADES = { '&quot;': '"', '&amp;': '&', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
const desescapar = s => (s || '').replace(/&(?:quot|amp|#39|apos|lt|gt|nbsp);/g, m => ENTIDADES[m] || m);

export function limparUrl(bruta) {
  let s = String(bruta || '').trim();

  /* O texto que o aplicativo gera ao compartilhar traz DOIS enderecos do mesmo
     produto: o encurtado (meli.la) e o completo. Pegar o primeiro pegava o
     encurtado, que exige um salto a mais e carrega a etiqueta de quem
     compartilhou. Entao a escolha e por qualidade: produto primeiro,
     encurtado depois, qualquer link do Mercado Livre por ultimo.

     Copiar do aplicativo tambem emenda a mesma URL duas vezes, sem espaco no
     meio. Sem o corte o gerador recebe um endereco invalido e devolve um link
     que leva o comprador para uma pagina de erro. */
  const achados = [];
  for (const bruto of s.match(/https?:\/\/[^\s"'<>]+/gi) || []) {
    const segundo = bruto.slice(8).search(/https?:\/\//i);
    achados.push(segundo >= 0 ? bruto.slice(0, segundo + 8) : bruto);
  }
  if (achados.length) {
    s = achados.find(ehProdutoML) || achados.find(ehCurtoML) || achados[0];
  }
  let u;
  try { u = new URL(s); } catch (e) { throw new Error('Isso nao parece um link.'); }
  const host = u.hostname.toLowerCase();
  const ehML = /(^|\.)mercadolivre\.com\.br$/.test(host) || host === 'meli.la' || /(^|\.)mercadolibre\.com/.test(host);
  if (!ehML) throw new Error('So funciona com link do Mercado Livre.');
  u.hash = '';
  const p = new URLSearchParams();
  MANTER.forEach(k => { const v = u.searchParams.get(k); if (v) p.set(k, v); });
  u.search = p.toString();
  return u.toString();
}

/* Um meli.la pode ser de outro afiliado. Resolvemos SEM mandar o cookie,
   para nao registrar o clique na conta de quem gerou aquele link. */
async function resolverEncurtado(url) {
  if (new URL(url).hostname.toLowerCase() !== 'meli.la') return url;
  const r = await fetch(url, { redirect: 'follow', credentials: 'omit' });
  if (!r.url || r.url === url) throw new Error('Nao consegui abrir esse link encurtado.');
  return limparUrl(r.url);
}

export function idDoUrl(u) {
  const a = u.match(/\/p\/(MLB\d+)/i);
  if (a) return a[1].toUpperCase();
  const b = u.match(/MLB-?(\d{6,})/i);
  return b ? 'MLB' + b[1] : null;
}

const RE_TITULO = /<title>([^<]{5,250})<\/title>/i;
const RE_PRECOS = [
  /"price"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)\s*[,}]/,
  /itemprop="price"\s+content="(\d{1,7}(?:\.\d{1,2})?)"/i
];

function dadosDoHtml(buf) {
  let titulo = desescapar((RE_TITULO.exec(buf) || [])[1] || '')
    .replace(/\s*\|\s*Mercado\s*Liv?re.*$/i, '')
    .replace(/\s+/g, ' ').trim();
  let preco = null;
  for (const re of RE_PRECOS) {
    const m = re.exec(buf);
    if (m) { const n = parseFloat(m[1]); if (n > 0 && n < 1e7) { preco = n; break; } }
  }
  return { titulo: titulo || null, preco };
}

/* A geracao do link NAO acontece aqui.
   O Mercado Livre valida a origem do POST, e o service worker da extensao
   manda Origin: chrome-extension://..., que o site recusa. Quem gera e o
   background.js, executando a chamada dentro de uma aba do proprio site,
   onde a origem e a Referer sao do Mercado Livre. Isto aqui so le a resposta. */

export function lerResposta(txt) {
  let curto = null, codigo = null;
  try {
    const j = JSON.parse(txt);
    const item = (j.urls && j.urls[0]) || (Array.isArray(j) && j[0]) || j;
    if (item) {
      curto = item.short_url || item.shortUrl || item.url || null;
      const t = item.text || '';
      if (!curto) { const m = t.match(/https?:\/\/meli\.la\/[A-Za-z0-9]+/); if (m) curto = m[0]; }
      if (!curto && item.id) curto = 'https://meli.la/' + item.id;
      const c = t.match(/buscador do Mercado Livre:\s*([A-Z0-9][A-Z0-9-]{4,})/i);
      if (c) codigo = c[1];
    }
  } catch (e) { /* resposta nao e JSON: cai no resgate abaixo */ }
  /* Resgate: o gerador as vezes muda o formato da resposta. Em vez de falhar
     (e derrubar a comissao), procura o link curto e o codigo no texto cru. */
  if (!curto) {
    const m = String(txt).match(/https?:\/\/meli\.la\/[A-Za-z0-9]+/);
    if (m) curto = m[0];
  }
  if (!codigo) {
    const c = String(txt).match(/buscador do Mercado Livre:\s*([A-Z0-9][A-Z0-9-]{4,})/i);
    if (c) codigo = c[1];
  }
  return { curto, codigo };
}

const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const dataBR = iso => { const d = String(iso || '').slice(0, 10).split('-'); return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : null; };

/* Avalia se o cupom entrega beneficio de verdade para ESTE preco. */
export function avaliar(cupom, cond, preco) {
  if (!cupom) return null;
  const tipo = /%/.test(cupom.t || '') ? '%' : 'R$';
  const teto = cond?.teto ?? null;
  const minimo = cond?.compra_min ?? null;
  let economia = null;

  if (tipo === '%' && preco != null) {
    const pct = parseFloat(String(cupom.t).replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
    economia = preco * pct / 100;
    if (teto != null) economia = Math.min(economia, teto);
  } else if (tipo === 'R$') {
    economia = parseFloat(String(cupom.t).replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.')) || null;
    if (teto != null && economia != null) economia = Math.min(economia, teto);
  } else if (teto != null) {
    economia = teto;
  }

  const bloqueado = minimo != null && preco != null && preco < minimo;
  const vale = !bloqueado && economia != null && economia >= 5;
  return { tipo, teto, minimo, economia, bloqueado, vale };
}

function montarMensagem({ titulo, preco, link, codigo, cupom, aval }) {
  const L = [];
  if (titulo) L.push(titulo);
  if (preco != null) L.push(`Está ${brl(preco)} agora.`);

  if (cupom && aval?.vale) {
    L.push('');
    L.push(`Essa loja está com cupom de ${cupom.t}, dá uns ${brl(aval.economia)} de desconto.`);
    if (aval.minimo) L.push(`Vale em compras a partir de ${brl(aval.minimo)}.`);
    if (cupom.x) L.push(`O cupom vai até ${dataBR(cupom.x)}.`);
    L.push('O desconto aparece pra você no carrinho.');
  } else if (cupom && aval?.bloqueado) {
    L.push('');
    L.push(`A loja tem cupom de ${cupom.t}, mas só vale acima de ${brl(aval.minimo)}. Nesse valor não entra.`);
  } else if (cupom && aval && !aval.vale) {
    L.push('');
    L.push(`A loja tem um cupom de ${cupom.t}, mas o desconto trava em ${brl(aval.teto)}. Não muda muita coisa.`);
  }

  L.push('');
  L.push(link);
  if (codigo) {
    L.push('');
    L.push(`Se o link não abrir no app, cole este código na busca do Mercado Livre: ${codigo}`);
  }
  return L.join('\n');
}

/* deps: { obterIndice, lerParcial, nomesDoHtml, norm, condicoesDe, cacar, gerarLink } */
export function criarAtendimento(deps) {
  return async function atenderLink(bruta, opts = {}) {
    const url = await resolverEncurtado(limparUrl(bruta));
    const id = idDoUrl(url);

    let titulo = null, preco = null, nomes = [];
    try {
      const buf = await deps.lerParcial(url);
      const d = dadosDoHtml(buf);
      titulo = d.titulo; preco = d.preco;
      nomes = deps.nomesDoHtml(buf);
    } catch (e) { /* segue sem os dados do anuncio: o link ainda sai */ }

    const indice = await deps.obterIndice();
    let cupom = null, vendedor = nomes[0] || null;
    for (const n of nomes) { const k = deps.norm(n); if (k && indice.mapa[k]) { cupom = indice.mapa[k]; break; } }

    let cond = null;
    if (cupom) { try { cond = await deps.condicoesDe(cupom.i); } catch (e) { cond = null; } }
    const aval = avaliar(cupom, cond, preco);

    const { link, codigo } = await deps.gerarLink(url, opts.tag || TAG_PADRAO);

    /* Sem cupom util? procura o MESMO produto em loja que tenha cupom. */
    let alternativas = [];
    if ((!cupom || !aval?.vale) && titulo && opts.buscarAlternativa !== false) {
      const termo = titulo.split(/\s+/).slice(0, 6).join(' ');
      try {
        const r = await deps.cacar(termo, false);
        alternativas = (r.achados || []).slice(0, 3);
      } catch (e) { alternativas = []; }
    }

    return {
      id, url, link, codigo, titulo, preco, vendedor,
      cupom: cupom ? { id: cupom.i, titulo: cupom.t, vence: cupom.x, orcamento: cupom.o } : null,
      condicoes: cond, avaliacao: aval, alternativas,
      mensagem: montarMensagem({ titulo, preco, link, codigo, cupom, aval })
    };
  };
}

/* Avalia um cupom vindo do banco (com teto e compra minima ja conferidos)
   contra o preco real do produto que a pessoa quer. */
export function avaliarCupom(c, preco) {
  if (!c) return null;
  const tipo = c.tipo === '%' ? '%' : 'R$';
  const teto = c.sem_teto ? null : (c.teto == null ? null : Number(c.teto));
  const minimo = c.compra_min == null ? null : Number(c.compra_min);
  const valor = Number(c.valor) || 0;

  let economia = null;
  if (tipo === '%' && preco != null) {
    economia = (preco * valor) / 100;
    if (teto != null) economia = Math.min(economia, teto);
  } else if (tipo === 'R$') {
    economia = teto != null ? Math.min(valor, teto) : (valor || null);
  } else if (teto != null) {
    economia = teto;
  }

  const bloqueado = minimo != null && preco != null && preco < minimo;
  const vale = !bloqueado && economia != null && economia >= 5;
  return { tipo, teto, minimo, economia, bloqueado, vale, semTeto: !!c.sem_teto };
}
