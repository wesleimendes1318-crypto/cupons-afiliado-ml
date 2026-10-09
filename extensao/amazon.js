/* AMAZON PELA SESSAO (Weslei, 09/10: sem credenciais da API, "pelo MESMO
   mecanismo ja validado do Mercado Livre"). A extensao busca no
   amazon.com.br com a sessao do navegador e le os resultados do HTML.
   Link de afiliado: o link de texto padrao do programa de Associados
   (/dp/<ASIN>?tag=melhoresc0fff-20), que nao depende de API.

   Cuidados:
   - so pedido de CLIENTE (o banco libera em multiloja_vale), uma busca por
     pedido, sem rajada;
   - verificacao de robo da Amazon (captcha) = PARA por 6 h (freio proprio,
     nao insiste);
   - anuncio patrocinado, usado/recondicionado e sem preco ficam de fora;
   - frete: so "Prime" (frete gratis para assinantes) e afirmado; o resto
     sai como "confira no anuncio" (frete desconhecido nao e gratis). */

export const TAG_AMAZON = 'melhoresc0fff-20';
const BUSCA_AMAZON = 'https://www.amazon.com.br/s?k=';
const FREIO_AMAZON_MS = 6 * 60 * 60 * 1000;
const MAX_HTML = 2_500_000;

const RE_ASIN = /^[A-Z0-9]{10}$/;

/** Link de afiliado da Amazon a partir do ASIN (null se o ASIN for invalido). */
export function gerarLinkAfiliadoAmazon(asin) {
  const a = String(asin || '').trim().toUpperCase();
  return RE_ASIN.test(a) ? `https://www.amazon.com.br/dp/${a}?tag=${TAG_AMAZON}` : null;
}

/** Mesma trava do site (src/lib/afiliado.ts): tag do Weslei ou amzn.to. */
export function ehLinkAfiliadoAmazon(link) {
  let u;
  try { u = new URL(String(link || '')); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  if (u.hostname === 'amzn.to') return /^\/[A-Za-z0-9]{4,}$/.test(u.pathname);
  return /^(www\.)?amazon\.com\.br$/.test(u.hostname) && u.searchParams.get('tag') === TAG_AMAZON;
}

export function ehCaptchaAmazon(html, url) {
  return /\/errors\/validateCaptcha|captcha/i.test(String(url || ''))
    || /validateCaptcha|Digite os caracteres que voc|Type the characters you see|api-services-support@amazon\.com/i
      .test(String(html || '').slice(0, 20000));
}

const ENTIDADES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
const texto = s => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|quot|#39|lt|gt|nbsp);/g, m => ENTIDADES[m] || m)
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ')
  .trim();

/** "R$ 1.234,56" -> 1234.56 */
export function precoBr(s) {
  const m = String(s || '').replace(/&nbsp;| /g, ' ').match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '') + '.' + (m[2] || '0'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const RE_CONDICAO_RUIM = /\b(usad[oa]s?|recondicionad[oa]s?|seminov[oa]s?|renovad[oa]s?|vitrine|open ?box)\b/i;

/** Resultados da pagina de busca (HTML). Sem DOM: o service worker nao tem
    DOMParser, entao cada cartao e lido por trechos. */
export function ofertasAmazonDoHtml(html) {
  const h = String(html || '');
  const marca = 'data-component-type="s-search-result"';
  const posicoes = [];
  for (let i = h.indexOf(marca); i >= 0 && posicoes.length < 40; i = h.indexOf(marca, i + marca.length)) posicoes.push(i);
  const lista = [];
  const vistos = new Set();
  posicoes.forEach((p, k) => {
    /* O data-asin fica na mesma tag de abertura, antes ou depois do marcador. */
    const abre = h.lastIndexOf('<div', p);
    const fechaTag = h.indexOf('>', p);
    const tag = h.slice(abre, fechaTag + 1);
    const asin = (tag.match(/data-asin="([A-Z0-9]{10})"/) || [])[1];
    if (!asin || vistos.has(asin)) return;
    const bloco = h.slice(fechaTag, posicoes[k + 1] ?? Math.min(h.length, fechaTag + 60000));
    /* Patrocinado fica de fora: nao e o resultado da busca. */
    if (/\bPatrocinad[oa]\b|s-sponsored-label|AdHolder/i.test(bloco.slice(0, 6000) + tag)) return;
    const h2 = bloco.match(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/);
    let titulo = h2 ? texto((h2[1].match(/aria-label="([^"]+)"/) || [])[1] || h2[2]) : '';
    if (!titulo) {
      const span = bloco.match(/<span class="a-size-(?:base-plus|medium)[^"]*a-text-normal"[^>]*>([\s\S]*?)<\/span>/);
      titulo = span ? texto(span[1]) : '';
    }
    titulo = titulo.replace(/^(An[uú]ncio patrocinado|Patrocinado)\s*[-–:]\s*/i, '').slice(0, 300);
    if (!titulo || RE_CONDICAO_RUIM.test(titulo)) return;
    /* Preco atual: o a-price SEM a-text-price (esse e o "de", riscado). */
    const pm = bloco.match(/<span class="a-price"(?![^>]*a-text-price)[^>]*>\s*<span class="a-offscreen">([^<]+)<\/span>/);
    const preco = pm ? precoBr(pm[1]) : null;
    if (preco == null) return;
    const img = (bloco.match(/<img\b[^>]*class="s-image"[^>]*>/) || [])[0] || '';
    const src = (img.match(/\ssrc="([^"]+)"/) || [])[1] || null;
    const imagem = src && /^https:\/\/m\.media-amazon\.com\/images\//.test(src) ? src : null;
    const prime = /a-icon-prime/.test(bloco);
    const mencionaFreteGratis = /frete\s+gr[aá]tis/i.test(texto(bloco).slice(0, 4000));
    vistos.add(asin);
    lista.push({ asin, titulo, preco, imagem, prime, mencionaFreteGratis, posicao: lista.length + 1 });
  });
  return lista;
}

async function freioAmazon() {
  const { freio_amazon: ate } = await chrome.storage.local.get('freio_amazon');
  return Number(ate) > Date.now();
}

/** Busca na Amazon com a sessao do navegador (prazo curto). Nunca lanca
    erro para cima: devolve { ofertas, motivo }. */
export async function buscarCandidatosAmazon(termo, prazoMs = 8000) {
  if (!termo) return { ofertas: [], motivo: 'sem termo' };
  if (await freioAmazon()) return { ofertas: [], motivo: 'pausada (verificacao da Amazon nas ultimas 6 h)' };
  const ctrl = new AbortController();
  const corta = setTimeout(() => ctrl.abort(), prazoMs);
  try {
    const r = await fetch(BUSCA_AMAZON + encodeURIComponent(termo), {
      signal: ctrl.signal,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
    });
    const html = (await r.text()).slice(0, MAX_HTML);
    if (ehCaptchaAmazon(html, r.url)) {
      await chrome.storage.local.set({ freio_amazon: Date.now() + FREIO_AMAZON_MS });
      return { ofertas: [], motivo: 'a Amazon pediu verificacao: pausada por 6 h' };
    }
    if (!r.ok) return { ofertas: [], motivo: 'Amazon respondeu ' + r.status };
    const ofertas = ofertasAmazonDoHtml(html);
    return { ofertas, motivo: ofertas.length ? null : 'nenhum resultado lido (' + Math.round(html.length / 1024) + ' KB)' };
  } catch (e) {
    return { ofertas: [], motivo: ctrl.signal.aborted ? 'tempo esgotado' : String((e && e.message) || e).slice(0, 120) };
  } finally {
    clearTimeout(corta);
  }
}

/** Oferta no formato do site (LojaExterna, sem relacao/muda: a conferencia
    decide). */
export function ofertaAmazonParaSite(o) {
  const link = gerarLinkAfiliadoAmazon(o.asin);
  if (!link) return null;
  return {
    marketplace: 'amazon',
    id: o.asin,
    titulo: o.titulo,
    preco: o.preco,
    link,
    imagem: o.imagem,
    loja: null,
    freteGratis: null,
    custoFrete: null,
    notaFrete: o.prime ? 'Frete grátis para assinantes Prime' : 'Frete: confira no anúncio',
    selos: o.prime ? ['Prime'] : []
  };
}
