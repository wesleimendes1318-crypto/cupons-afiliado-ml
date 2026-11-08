/* Which store and product the open tab is (popup 1-Click, 07/11/2026).
   Pure: no chrome.* and no network, tested in testes/aba-atual.test.mjs.
   A Mercado Livre search/listing page is never a product: its affiliate
   link opens a profile search showcase (06/11, ehBuscaML). */

import { ehBuscaML } from './atendimento.js';
import { idsDoProdutoShopee } from './shopee.js';
import { gerarLinkAfiliadoAmazon } from './amazon.js';

const RE_ASIN_URL = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?#]|$)/i;

export const NOME_LOJA = { mercadolivre: 'Mercado Livre', amazon: 'Amazon', shopee: 'Shopee' };

/** { loja, produto, busca, asin?, linkPronto? } or null when not a store. */
export function lojaDaAba(url) {
  let u;
  try { u = new URL(String(url || '')); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();

  if (/(^|\.)(mercadolivre\.com\.br|mercadolibre\.com)$/.test(host) || host === 'meli.la') {
    const busca = ehBuscaML(u.href);
    const produto = !busca && (/\/p\/MLB\d+/i.test(u.pathname) || /\/MLB-?\d+/i.test(u.pathname) || /\/up\/MLBU\d+/i.test(u.pathname));
    return { loja: 'mercadolivre', produto, busca };
  }
  if (/(^|\.)amazon\.com\.br$/.test(host)) {
    const m = RE_ASIN_URL.exec(u.pathname);
    const asin = m ? m[1].toUpperCase() : null;
    /* Amazon's link is built locally from the ASIN, always with his tag. */
    return { loja: 'amazon', produto: !!asin, busca: !asin, asin, linkPronto: asin ? gerarLinkAfiliadoAmazon(asin) : null };
  }
  if (/(^|\.)shopee\.com\.br$/.test(host)) {
    const ids = idsDoProdutoShopee(u.href);
    return { loja: 'shopee', produto: !!ids, busca: !ids };
  }
  return null;
}

/** Comparison on the site for any store link (?link= is read on the home). */
export const urlComparacaoNoSite = url => `https://melhorescolha.io/?link=${encodeURIComponent(String(url || ''))}`;

/** Store title without the " | Mercado Livre"-style suffix. */
export function tituloLimpo(t) {
  return String(t || '')
    .replace(/\s*[|\-–]\s*(Mercado Livre|MercadoLivre|Amazon\.com\.br.*|Shopee Brasil.*|Shopee)\s*$/i, '')
    .replace(/^Amazon\.com\.br\s*:\s*/i, '')
    .replace(/\s+/g, ' ').trim().slice(0, 140);
}

/** Right-click "Procurar no Melhor Escolha" (viral finds, 08/11/2026): a
    selected text becomes a text search; a link (e.g. a Facebook ad's
    "Comprar agora") or the open page goes to the comparison. The page title
    only rides along for the page itself (a Temu tab title is the product). */
export function urlGarimpoNoSite({ selectionText, linkUrl, pageUrl, titulo } = {}) {
  const texto = String(selectionText || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const p = new URLSearchParams();
  if (texto && !/^https?:\/\//i.test(texto)) p.set('link', texto);
  else if (/^https?:\/\//i.test(String(linkUrl || ''))) p.set('link', linkUrl);
  else if (/^https?:\/\//i.test(String(pageUrl || ''))) {
    const t = String(titulo || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (t) p.set('title', t);
    p.set('link', pageUrl);
  } else return null;
  return `https://melhorescolha.io/?${p}`;
}
