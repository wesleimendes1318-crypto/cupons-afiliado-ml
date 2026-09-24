/* Comparador: mesmo produto, outra loja
   =====================================
   Tudo aqui e texto puro: recebe HTML e numeros, devolve listas. Nao chama
   rede nem chrome.*, entao da para testar fora do navegador (node --test).

   v1.39 - tres defeitos que faziam a comparacao NUNCA achar nada (0 de 127
   pedidos com alternativa):

   1. palavrasDoTitulo usava o norm() do indice, que APAGA os espacos. O titulo
      inteiro virava uma palavra so ("capacaseantiimpacto..."), e dois titulos
      so "batiam" se fossem identicos letra por letra.
   2. O titulo do cartao da busca mora dentro de um <a> dentro do <h3>
      (poly-card). A regex exigia texto direto no <h3> e nao achava titulo em
      cartao nenhum.
   3. O primeiro preco do cartao e o preco ANTIGO, riscado (<s>). Quando havia
      promocao, a comparacao usava o preco errado.
*/

export const normPalavra = s => (s ?? '').toString().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

const norm = s => normPalavra(s).replace(/ /g, '');

const ENT = { '&quot;': '"', '&amp;': '&', '&#39;': "'", '&#039;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
export const desescapar = s => String(s || '')
  .replace(/&(?:quot|amp|#0?39|apos|lt|gt|nbsp);/g, m => ENT[m] || m)
  .replace(/\\u002F/g, '/');

/* Palavras que nao ajudam a dizer se e o mesmo produto. */
const VAZIAS = new Set(['com', 'para', 'sem', 'por', 'the', 'and', 'dos', 'das', 'que', 'kit', 'novo', 'nova',
  'original', 'promocao', 'oferta', 'frete', 'gratis', 'envio', 'imediato', 'pronta', 'entrega']);

export function palavrasDoTitulo(t) {
  return normPalavra(t)
    .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
    .split(' ')
    .filter(w => (w.length >= 3 || /^\d+$/.test(w)) && !VAZIAS.has(w));
}

/* Dois titulos falam do mesmo produto? Cada vendedor escreve do seu jeito,
   entao nao da para exigir igualdade. Exige-se:
     - 60% das palavras do titulo original no candidato;
     - TODOS os numeros do original presentes (modelo, capacidade, voltagem):
       "128 GB" e "256 GB" nao sao o mesmo produto, por mais que o resto bata. */
export function pareceMesmoProduto(original, candidato) {
  const a = [...new Set(palavrasDoTitulo(original))];
  const b = new Set(palavrasDoTitulo(candidato));
  if (a.length < 3) return false;
  const iguais = a.filter(w => b.has(w)).length;
  if (iguais / a.length < 0.6) return false;
  const numeros = a.filter(w => /^\d+$/.test(w));
  return numeros.every(n => b.has(n));
}

export function urlDeBusca(titulo) {
  const termo = normPalavra(titulo).split(' ').slice(0, 12).join(' ').slice(0, 90);
  return 'https://lista.mercadolivre.com.br/' + encodeURIComponent(termo).replace(/%20/g, '-');
}

export function urlDaOferta(catalogo, item) {
  return `https://www.mercadolivre.com.br/p/${catalogo}?pdp_filters=item_id%3A${item}`;
}

/* Id do ANUNCIO (nao do catalogo) que a pessoa estava vendo. */
export function itemDoUrl(u) {
  const s = desescapar(decodeURIComponentSeguro(String(u || '')));
  const f = /item_id[:=](MLB\d{6,})/i.exec(s) || /[?&#]wid=(MLB\d{6,})/i.exec(s);
  if (f) return f[1].toUpperCase();
  const b = /\/MLB-(\d{6,})/i.exec(s);
  return b ? 'MLB' + b[1] : null;
}

function decodeURIComponentSeguro(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

export function ehCaptcha(html, url) {
  return /\/captcha\/wall/i.test(String(url || ''))
      || /Por seguran.a, complete esta etapa/i.test(String(html || '').slice(0, 30000));
}

/* Preco atual de um pedaco de HTML de cartao. Tira o preco riscado antes. */
export function precoDoCartao(pedaco) {
  const sem = String(pedaco).replace(/<s\b[\s\S]*?<\/s>/gi, ' ');

  const aria = /aria-label="(?:Agora|Now):?\s*([\d.]+)\s*reais(?:\s*(?:com|e)\s*(\d{1,2})\s*centavos)?/i.exec(sem);
  if (aria) return num(aria[1], aria[2]);

  const fr = /andes-money-amount__fraction[^>]*>([\d.]{1,12})</.exec(sem);
  if (fr) {
    const depois = sem.slice(fr.index, fr.index + 400);
    const ct = /andes-money-amount__cents[^>]*>(\d{1,2})</.exec(depois);
    return num(fr[1], ct && ct[1]);
  }
  const js = /"amount"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/.exec(sem);
  if (js) { const n = parseFloat(js[1]); return n > 0 && n < 1e7 ? n : null; }
  return null;
}

function num(inteiro, centavos) {
  const n = parseFloat(String(inteiro).replace(/\./g, '')) + (centavos ? Number(centavos) / 100 : 0);
  return n > 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
}

function tituloDoCartao(pedaco) {
  const tentativas = [
    /class="[^"]*(?:poly-component__title|ui-search-item__title)[^"]*"[^>]*>([\s\S]{5,400}?)<\/(?:a|h2|h3)>/i,
    /<h[23][^>]*>([\s\S]{5,400}?)<\/h[23]>/i,
    /"title"\s*:\s*"([^"]{10,200})"/
  ];
  for (const re of tentativas) {
    const m = re.exec(pedaco);
    if (!m) continue;
    const t = desescapar(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t.length >= 10) return t;
  }
  return null;
}

/* Endereco do anuncio dentro do cartao. Cartao de catalogo aponta para
   /p/MLB<catalogo> e leva o id do anuncio em wid= ou item_id:; cartao comum
   aponta para produto.mercadolivre.com.br/MLB-<anuncio>. O numero do catalogo
   NAO e anuncio: usar ele como anuncio leva a pagina errada. */
function enderecoDoCartao(pedaco) {
  const hrefs = [...String(pedaco).matchAll(/href="(https:\/\/[^"]*mercadolivre\.com\.br[^"]*)"/gi)]
    .map(m => desescapar(m[1]));
  for (const h of hrefs) {
    const cat = (/\/p\/(MLB\d{6,})/i.exec(h) || [])[1];
    const item = itemDoUrl(h);
    if (cat && item) return { item, catalogo: cat.toUpperCase(), url: urlDaOferta(cat.toUpperCase(), item) };
    if (!cat && item) return { item, catalogo: null, url: 'https://produto.mercadolivre.com.br/' + item.replace(/^MLB/, 'MLB-') };
  }
  return null;
}

export const MAX_CANDIDATOS_BUSCA = 6;

/* Resultados da busca que parecem o MESMO produto. Cada um vira
   { item, catalogo, url, preco, titulo }. */
export function ofertasDaBusca(html, tituloOriginal, precoRef) {
  const blocos = String(html).split(/ui-search-layout__item/);
  const vistos = new Set();
  const saida = [];

  for (const b of blocos.slice(1)) {
    const pedaco = b.slice(0, 12000);
    const end = enderecoDoCartao(pedaco);
    if (!end || vistos.has(end.item)) continue;

    const tit = tituloDoCartao(pedaco);
    if (!tit || !pareceMesmoProduto(tituloOriginal, tit)) continue;

    const preco = precoDoCartao(pedaco);
    if (preco == null) continue;

    /* Preco absurdo em relacao ao que a pessoa esta vendo quase sempre e outro
       produto: acessorio, kit, unidade avulsa. Fora. */
    if (precoRef != null && (preco < precoRef * 0.4 || preco > precoRef * 1.6)) continue;

    vistos.add(end.item);
    saida.push({ ...end, preco, titulo: tit });
    if (saida.length >= MAX_CANDIDATOS_BUSCA) break;
  }
  return saida;
}

/* Ofertas do MESMO produto de catalogo (bloco buy_box_offers da pagina /p/).
   Primeiro o formato conhecido; se o Mercado Livre mudar a ordem dos campos,
   cai numa leitura mais tolerante: cada item_id do bloco com o primeiro preco
   que aparece antes do proximo item_id. */
export function ofertasDoCatalogo(html) {
  const i = String(html).indexOf('"buy_box_offers":{');
  if (i < 0) return [];
  const bloco = html.slice(i, i + 300000);

  const estrita = /"selected"\s*:\s*(?:true|false)\s*,\s*"type"\s*:\s*"([A-Z_]+)"\s*,\s*"item_id"\s*:\s*"(MLB\d+)"/g;
  let marcas = [...bloco.matchAll(estrita)].map(m => ({ index: m.index, item: m[2] }));
  if (marcas.length < 2) {
    marcas = [...bloco.matchAll(/"item_id"\s*:\s*"(MLB\d{6,})"/g)].map(m => ({ index: m.index, item: m[1] }));
  }

  const saida = [];
  const vistos = new Set();
  for (let k = 0; k < marcas.length; k++) {
    const ini = marcas[k].index;
    const fim = k + 1 < marcas.length ? marcas[k + 1].index : ini + 8000;
    const jan = bloco.slice(ini, fim);
    const p = /"price"\s*:\s*\{[^}]{0,400}?"value"\s*:\s*([\d.]+)/.exec(jan)
           || /"price"\s*:\s*([\d.]+)\s*[,}]/.exec(jan);
    const item = marcas[k].item;
    if (vistos.has(item)) continue;
    vistos.add(item);
    const preco = p ? Number(p[1]) : null;
    saida.push({ item, preco: preco > 0 && preco < 1e7 ? preco : null });
  }
  return saida;
}

/* DECISAO: o que mostrar ao cliente.

   Pedido do Weslei, 23/09: "buscar o mesmo produto em outra loja caso a do
   cliente nao tenha cupom e a concorrente sim, ou entao indicar a loja com
   menor custo".

   Entra na lista:
     - toda loja em que o preco FINAL (preco - cupom) sai mais barato que o
       final da loja do cliente por pelo menos R$ 2 (menos que isso nao vale
       a troca de loja);
     - quando a loja do cliente NAO tem cupom: loja concorrente COM cupom que
       nao saia mais cara (final <= final daqui).
   Nunca entra a propria loja do cliente, nem oferta sem preco.

   Ordem: menor preco final primeiro; empate, quem tem cupom. Maximo 3.
   Cada item leva `motivo`: 'mais_barata' ou 'tem_cupom'. */
export function escolherAlternativas(achados, { finalAtual, temCupomAqui, vendedorAtual, itemAtual } = {}) {
  if (finalAtual == null || !Number.isFinite(finalAtual)) return [];
  const meu = norm(vendedorAtual);

  const validos = (achados || []).filter(a =>
    a && a.final != null && Number.isFinite(a.final) && a.preco != null
    && (!itemAtual || a.item !== itemAtual)
    && (!meu || !a.vendedor || norm(a.vendedor) !== meu));

  /* A mesma loja pode aparecer em dois anuncios: fica o mais barato. */
  const porLoja = new Map();
  for (const a of validos) {
    const k = a.vendedor ? norm(a.vendedor) : 'item:' + a.item;
    const atual = porLoja.get(k);
    if (!atual || a.final < atual.final) porLoja.set(k, a);
  }

  const escolhidos = [];
  for (const a of porLoja.values()) {
    const ganho = Math.round((finalAtual - a.final) * 100) / 100;
    if (ganho >= 2) escolhidos.push({ ...a, ganho, finalAtual, motivo: 'mais_barata' });
    else if (!temCupomAqui && a.cupom && a.final <= finalAtual) {
      escolhidos.push({ ...a, ganho: Math.max(ganho, 0), finalAtual, motivo: 'tem_cupom' });
    }
  }

  escolhidos.sort((x, y) => (x.final - y.final) || ((y.cupom ? 1 : 0) - (x.cupom ? 1 : 0)));
  return escolhidos.slice(0, 3);
}

/* ------------------------------------------ pagina da loja a partir de anuncio

   Pedido do Weslei: quem clica no cupom quer ver a LOJA, com todos os produtos,
   e nao um produto nem a lista da campanha (que as vezes tem um item so). Sem
   o numero do vendedor, o caminho e o de uma pessoa: abrir um anuncio dele e
   seguir o link da loja. */

/* Primeiro anuncio de uma lista (campanha _Container_, busca, _CustId_). */
export function primeiroAnuncioDaLista(html) {
  const blocos = String(html).split(/ui-search-layout__item/);
  for (const b of blocos.slice(1)) {
    const end = enderecoDoCartao(b.slice(0, 12000));
    if (end) return end;
  }
  /* Lista sem cartao reconhecivel: qualquer link de anuncio da pagina. */
  const m = /https:\/\/produto\.mercadolivre\.com\.br\/MLB-(\d{6,})/i.exec(String(html));
  return m ? { item: 'MLB' + m[1], catalogo: null, url: 'https://produto.mercadolivre.com.br/MLB-' + m[1] } : null;
}

/* Enderecos candidatos da loja dona do anuncio, do mais confiavel ao menos.
   Na pagina do anuncio o link "Ver mais produtos do vendedor" e _CustId_<id> e
   o nome leva a /pagina/<apelido>. Os dois pertencem ao vendedor do anuncio. */
export function lojaDoAnuncio(html) {
  const t = desescapar(String(html));
  const saida = [];
  const pagina = /https?:\/\/(?:www|lista)\.mercadolivre\.com\.br\/pagina\/([A-Za-z0-9._%-]{2,60})/i.exec(t)
              || /"\/pagina\/([A-Za-z0-9._%-]{2,60})/i.exec(t);
  if (pagina) saida.push('https://lista.mercadolivre.com.br/pagina/' + pagina[1] + '/');
  const cust = /_CustId_(\d{4,})/i.exec(t)
            || /"seller_id"\s*:\s*"?(\d{4,})/i.exec(t)
            || /"sellerId"\s*:\s*"?(\d{4,})/i.exec(t);
  if (cust) saida.push('https://lista.mercadolivre.com.br/_CustId_' + cust[1]);
  return saida;
}

/* ------------------------------------ link de compartilhamento de afiliado

   O "Compartilhar" do programa de afiliados gera um meli.la que, aberto, cai
   no PERFIL SOCIAL do afiliado (/social/<apelido>?...), com o produto em
   destaque. Colar esse link no site dava "isso e um perfil, nao um produto".
   Aqui se tenta achar O produto compartilhado, sem chutar:
     1. no proprio endereco (parametros, inclusive codificados em base64);
     2. na pagina, SO se ela citar um unico anuncio (sem ambiguidade).
   Nao achou com certeza: devolve null, e o site pede o link do produto. */
function base64Seguro(s) {
  try {
    const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/=]{16,}$/.test(t)) return '';
    return typeof atob === 'function' ? atob(t) : Buffer.from(t, 'base64').toString('utf8');
  } catch (e) { return ''; }
}

function produtoNoTexto(t) {
  const s = desescapar(decodeURIComponentSeguro(String(t || '')));
  const cat = /\/p\/(MLB\d{5,})/i.exec(s);
  const item = itemDoUrl(s);
  if (cat) return urlDaOferta(cat[1].toUpperCase(), item || '').replace(/\?pdp_filters=item_id%3A$/, '');
  if (item) return 'https://produto.mercadolivre.com.br/' + item.replace(/^MLB/, 'MLB-');
  const solto = /\bMLB-?(\d{8,})\b/i.exec(s);
  return solto ? 'https://produto.mercadolivre.com.br/MLB-' + solto[1] : null;
}

export function produtoDoPerfilSocial(urlFinal, html) {
  let u;
  try { u = new URL(urlFinal); } catch (e) { return null; }
  for (const [, v] of u.searchParams) {
    const achado = produtoNoTexto(v) || produtoNoTexto(base64Seguro(v));
    if (achado) return achado;
  }
  const ids = new Set([...String(html || '').matchAll(/\bMLB-?(\d{8,})\b/gi)].map(m => m[1]));
  if (ids.size === 1) return 'https://produto.mercadolivre.com.br/MLB-' + [...ids][0];
  return null;
}
