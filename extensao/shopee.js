/* SHOPEE PELA SESSAO (Weslei, 09/10: sem credenciais da Open API).
   - Busca: a API de busca da Shopee (api/v4/search/search_items) recusa
     chamada que nao venha do proprio site deles (erro 90309999,
     anti-robo, conferido em 09/10). Entao a extensao abre a pagina de
     busca numa aba de fundo, com a sessao logada, e le os cartoes da TELA,
     como a pessoa ve (o mesmo plano B do Mercado Livre).
   - Link de afiliado: a pagina "Link personalizado" do painel de afiliados
     (affiliate.shopee.com.br), numa aba de fundo, como a extensao ja faz
     com o gerador do Mercado Livre. So vale link NOVO (que nao estava na
     tela antes do clique) e que, aberto, leva ao MESMO produto (o numero
     do item aparece no destino). Qualquer duvida: descarta o link.
   - Login pedido, verificacao de seguranca ou captcha: PARA por 6 h.
   Nada aqui segura o Mercado Livre: tudo com prazo e sem lancar erro. */

const BUSCA_SHOPEE = 'https://shopee.com.br/search?keyword=';
const PAINEL_LINK = 'https://affiliate.shopee.com.br/offer/custom_link';
const FREIO_SHOPEE_MS = 6 * 60 * 60 * 1000;
const TTL_LINK_MS = 7 * 24 * 60 * 60 * 1000;
const RE_LINK_SHOPEE = /^https:\/\/(s\.shopee\.com\.br|shope\.ee)\/[A-Za-z0-9]+$/;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Mesma trava do site (src/lib/afiliado.ts). */
export function ehLinkAfiliadoShopee(link) {
  return RE_LINK_SHOPEE.test(String(link || '').trim());
}

/** shopid e itemid de um endereco de produto da Shopee. */
export function idsDoProdutoShopee(url) {
  const s = String(url || '');
  const m = s.match(/-i\.(\d{3,15})\.(\d{3,15})/) || s.match(/\/product\/(\d{3,15})\/(\d{3,15})/);
  return m ? { shop: m[1], item: m[2] } : null;
}

export const urlCanonicaShopee = ids => `https://shopee.com.br/product/${ids.shop}/${ids.item}`;

/* RODA NA PAGINA DE BUSCA DA SHOPEE (precisa ser autocontida). Le os
   cartoes pelo endereco do produto (-i.<loja>.<item>), sem depender das
   classes, que mudam. */
export function cartoesShopeeNaPagina() {
  const RE_ID = /-i\.(\d{3,15})\.(\d{3,15})/;
  const preco = s => {
    const m = String(s || '').match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/);
    return m ? Number(m[1].replace(/\./g, '') + '.' + (m[2] || '0')) : null;
  };
  /* Rola um pouco a cada leitura: a Shopee so desenha os cartoes que
     aparecem na tela (09/10: "4 na tela"). */
  try { window.scrollBy(0, Math.round(window.innerHeight * 0.9)); } catch (e) { /* sem rolagem */ }
  const vistos = new Set();
  const cartoes = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    const m = href.match(RE_ID);
    if (!m || vistos.has(m[2])) continue;
    const linhas = String(a.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
    const img = a.querySelector('img[src*="susercontent"], img[src*="shopee"]') || a.querySelector('img');
    let imagem = img ? (img.currentSrc || img.src || '') : '';
    if (!/^https:\/\//.test(imagem)) imagem = '';
    imagem = imagem.replace(/_tn(\.webp)?$/, '');
    const titulo = ((img && img.alt && img.alt.length > 8) ? img.alt
      : linhas.find(l => l.length > 12 && !/^R\$|^-?\d+%|vendid|^Indicado|^Patrocinad/i.test(l))) || '';
    /* O preco vem quebrado em linhas ("R$" / "29" / ",90", 09/10: nenhum
       preco lido): junta tudo antes de ler. */
    const textoPrecos = linhas.join(' ').replace(/R\$\s+/g, 'R$ ').replace(/(\d)\s*,\s*(\d{2})\b/g, '$1,$2');
    const valores = [...textoPrecos.matchAll(/R\$\s?([\d.]+(?:,\d{1,2})?)/g)].map(x => preco(x[1])).filter(n => n > 0);
    vistos.add(m[2]);
    cartoes.push({
      shop: m[1], item: m[2],
      titulo: titulo.slice(0, 300),
      preco: valores.length ? valores[0] : null,
      /* "R$ 10,00 - R$ 20,00": o preco depende da variacao (ambiguo). */
      faixa: /R\$\s?[\d.,]+\s*[-–]\s*R\$/.test(textoPrecos),
      patrocinado: /Patrocinad|\bAn[uú]ncio\b/i.test(linhas.join(' ')),
      imagem: imagem || null,
      /* So para o diagnostico quando nenhum preco e lido. */
      texto: linhas.join(' | ').slice(0, 160)
    });
    if (cartoes.length >= 30) break;
  }
  const url = location.href;
  return {
    cartoes, url,
    login: /\/buyer\/login|account\.shopee/i.test(url),
    verificacao: /\/verify\/|captcha|antibot/i.test(url) || /verifica[cç][aã]o de seguran/i.test(document.title || '')
  };
}

async function freioShopee() {
  const { freio_shopee: ate } = await chrome.storage.local.get('freio_shopee');
  return Number(ate) > Date.now();
}
async function puxarFreioShopee() {
  await chrome.storage.local.set({ freio_shopee: Date.now() + FREIO_SHOPEE_MS });
}

async function esperarAba(tabId, limiteMs) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    try {
      const t = await chrome.tabs.get(tabId);
      if (t && t.status === 'complete') return true;
    } catch (e) { return false; }
    await sleep(300);
  }
  return false;
}

/** Busca na Shopee pela TELA, numa aba de fundo (prazo curto). Nunca lanca
    erro: devolve { ofertas, motivo }. */
export async function buscarCandidatosShopee(termo, prazoMs = 10000) {
  if (!termo) return { ofertas: [], motivo: 'sem termo' };
  if (await freioShopee()) return { ofertas: [], motivo: 'pausada (verificacao da Shopee nas ultimas 6 h)' };
  const fim = Date.now() + prazoMs;
  let aba = null;
  try {
    aba = await chrome.tabs.create({ url: BUSCA_SHOPEE + encodeURIComponent(termo), active: false });
    await esperarAba(aba.id, Math.max(1000, fim - Date.now()));
    let ultimo = null;
    while (Date.now() < fim) {
      const [saida] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: cartoesShopeeNaPagina })
        .catch(() => [null]);
      ultimo = (saida && saida.result) || ultimo;
      if (ultimo && (ultimo.login || ultimo.verificacao)) {
        await puxarFreioShopee();
        return { ofertas: [], motivo: ultimo.login ? 'a Shopee pediu login: pausada por 6 h' : 'a Shopee pediu verificacao: pausada por 6 h' };
      }
      if (ultimo && ultimo.cartoes.filter(c => c.preco != null).length >= 6) break;
      await sleep(600);
    }
    const ofertas = ((ultimo && ultimo.cartoes) || [])
      .filter(c => c.preco != null && c.titulo && !c.patrocinado && !c.faixa);
    const semPreco = ((ultimo && ultimo.cartoes) || []).find(c => c.preco == null);
    return {
      ofertas,
      motivo: ofertas.length ? null : 'nenhum cartao com preco lido' + (ultimo ? ' (' + ultimo.cartoes.length + ' na tela)' : '')
        + (!ofertas.length && semPreco ? ' amostra: ' + semPreco.texto : '')
    };
  } catch (e) {
    return { ofertas: [], motivo: String((e && e.message) || e).slice(0, 120) };
  } finally {
    if (aba) chrome.tabs.remove(aba.id).catch(() => {});
  }
}

/* RODA NO PAINEL DE AFILIADOS DA SHOPEE (autocontida, assincrona). Preenche
   o "Link personalizado", clica em gerar e pega o link NOVO (da resposta da
   propria pagina ou da tela). */
export async function gerarLinkShopeeNaPagina(urlProduto) {
  const RE = /https:\/\/(?:s\.shopee\.com\.br|shope\.ee)\/[A-Za-z0-9]+/g;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const naTela = () => {
    const campos = [...document.querySelectorAll('textarea, input')].map(e => e.value || '').join(' ');
    return (campos + ' ' + ((document.body && document.body.innerText) || '')).match(RE) || [];
  };
  if (/login|account\.shopee/i.test(location.href)) return { erro: 'sessao de afiliado expirada (pediu login)', login: true };
  let campo = null;
  for (let i = 0; i < 24 && !campo; i++) {
    campo = document.querySelector('textarea');
    if (!campo) await espera(500);
  }
  if (!campo) return { erro: 'formulario do link personalizado nao apareceu', titulo: String(document.title || '').slice(0, 80) };
  const antes = new Set(naTela());
  const daRede = [];
  const fetchOriginal = window.fetch;
  window.fetch = async function (...args) {
    const r = await fetchOriginal.apply(this, args);
    try { r.clone().text().then(t => { for (const m of String(t).match(RE) || []) daRede.push(m); }).catch(() => {}); } catch (e) { /* so escuta */ }
    return r;
  };
  const enviarOriginal = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      try { for (const m of String(this.responseText || '').match(RE) || []) daRede.push(m); } catch (e) { /* binario */ }
    });
    return enviarOriginal.apply(this, args);
  };
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(campo, urlProduto);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    await espera(400);
    const botoes = [...document.querySelectorAll('button')];
    /* Do mais especifico para o mais geral ("Obter link" e o do painel). */
    const botao = [/obter link/i, /gerar link/i, /get link/i, /converter/i, /^\s*gerar\s*$/i]
      .map(re => botoes.find(b => re.test(b.innerText || ''))).find(Boolean);
    if (!botao) return { erro: 'botao de gerar nao encontrado', botoes: botoes.map(b => String(b.innerText || '').trim().slice(0, 30)).filter(Boolean).slice(0, 12) };
    botao.click();
    for (let i = 0; i < 28; i++) {
      await espera(500);
      const novoRede = daRede.find(l => !antes.has(l));
      if (novoRede) return { link: novoRede, como: 'rede' };
      const novoTela = naTela().find(l => !antes.has(l));
      if (novoTela) return { link: novoTela, como: 'tela' };
    }
    return { erro: 'o painel nao devolveu um link novo', botao: String(botao.innerText || '').trim().slice(0, 30) };
  } finally {
    window.fetch = fetchOriginal;
    XMLHttpRequest.prototype.send = enviarOriginal;
  }
}

/** O link curto leva ao mesmo produto? (o numero do item aparece no
    destino). Sem resposta = nao confirmado = descarta. */
export async function linkLevaAoProduto(link, item, prazoMs = 8000) {
  const ctrl = new AbortController();
  const corta = setTimeout(() => ctrl.abort(), prazoMs);
  try {
    const r = await fetch(link, { signal: ctrl.signal, redirect: 'follow', credentials: 'omit', cache: 'no-store' });
    const destino = decodeURIComponent(String(r.url || ''));
    if (destino.includes(String(item))) return true;
    const corpo = decodeURIComponent((await r.text()).slice(0, 20000).replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
    return corpo.includes(String(item));
  } catch (e) {
    return false;
  } finally {
    clearTimeout(corta);
  }
}

/** Link de afiliado da Shopee para o produto (cache de 7 dias). Nunca lanca
    erro: devolve { link } ou { erro }. */
export async function gerarLinkAfiliadoShopee(urlShopee, prazoMs = 25000) {
  const ids = idsDoProdutoShopee(urlShopee);
  if (!ids) return { erro: 'endereco da Shopee sem numero do produto' };
  const chave = 'shopeeLink:' + ids.item;
  const guardado = (await chrome.storage.local.get(chave))[chave];
  if (guardado && ehLinkAfiliadoShopee(guardado.link) && Date.now() - guardado.em < TTL_LINK_MS) return { link: guardado.link, cache: true };
  const { freio_shopee_link: ate } = await chrome.storage.local.get('freio_shopee_link');
  if (Number(ate) > Date.now()) return { erro: 'gerador da Shopee pausado (sessao ou verificacao nas ultimas 6 h)' };
  let aba = null;
  try {
    aba = await chrome.tabs.create({ url: PAINEL_LINK, active: false });
    await esperarAba(aba.id, Math.min(15000, prazoMs));
    const [saida] = await Promise.race([
      chrome.scripting.executeScript({ target: { tabId: aba.id }, world: 'MAIN', func: gerarLinkShopeeNaPagina, args: [urlCanonicaShopee(ids)] }),
      sleep(prazoMs).then(() => [{ result: { erro: 'tempo esgotado no painel da Shopee' } }])
    ]).catch(e => [{ result: { erro: String((e && e.message) || e).slice(0, 120) } }]);
    const r = (saida && saida.result) || { erro: 'painel sem resposta' };
    if (r.login) await chrome.storage.local.set({ freio_shopee_link: Date.now() + FREIO_SHOPEE_MS });
    if (!r.link) return { erro: r.erro || 'sem link', diag: r };
    const link = String(r.link).trim();
    if (!ehLinkAfiliadoShopee(link)) return { erro: 'link fora do padrao de afiliado', diag: { link } };
    if (!(await linkLevaAoProduto(link, ids.item))) return { erro: 'o link gerado nao leva ao mesmo produto', diag: { link, como: r.como } };
    await chrome.storage.local.set({ [chave]: { link, em: Date.now() } });
    return { link, como: r.como };
  } catch (e) {
    return { erro: String((e && e.message) || e).slice(0, 120) };
  } finally {
    if (aba) chrome.tabs.remove(aba.id).catch(() => {});
  }
}

/** Oferta no formato do site (LojaExterna). Frete da Shopee depende do CEP
    e do cupom de frete: sempre "confira no anuncio". */
export function ofertaShopeeParaSite(o, link) {
  if (!ehLinkAfiliadoShopee(link)) return null;
  return {
    marketplace: 'shopee',
    id: String(o.item),
    titulo: o.titulo,
    preco: o.preco,
    link,
    imagem: o.imagem && /^https:\/\/([a-z0-9-]+\.)*susercontent\.com\//.test(o.imagem) ? o.imagem : null,
    loja: null,
    freteGratis: null,
    custoFrete: null,
    notaFrete: 'Frete: confira no anúncio',
    selos: []
  };
}
