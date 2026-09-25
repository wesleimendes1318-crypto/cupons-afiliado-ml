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

/* Quantos anuncios da busca sao abertos para ler a loja: os MAIS BARATOS entre
   os que parecem o mesmo produto (cada um e uma leitura de pagina). */
export const MAX_CANDIDATOS_BUSCA = 4;

/* Resultados da busca que parecem o MESMO produto. Cada um vira
   { item, catalogo, url, preco, titulo }. */
export function ofertasDaBusca(html, tituloOriginal, precoRef, diag = null) {
  const texto = String(html || '');
  const vistos = new Set();
  const saida = [];
  const d = diag || {};
  d.bytes = texto.length;
  d.cartoes = 0; d.comEndereco = 0; d.comTitulo = 0; d.comPreco = 0; d.parecidos = 0; d.naFaixa = 0;

  const aceitar = (end, tit, preco) => {
    if (!end || vistos.has(end.item)) return;
    d.comEndereco++;
    if (!tit) return;
    d.comTitulo++;
    if (preco == null) return;
    d.comPreco++;
    if (!pareceMesmoProduto(tituloOriginal, tit)) return;
    d.parecidos++;
    /* Preco absurdo em relacao ao que a pessoa esta vendo quase sempre e outro
       produto: acessorio, kit, unidade avulsa. Fora. */
    if (precoRef != null && (preco < precoRef * 0.4 || preco > precoRef * 1.6)) return;
    d.naFaixa++;
    vistos.add(end.item);
    saida.push({ ...end, preco, titulo: tit });
  };

  /* 1. Cartoes em HTML. O Mercado Livre ja mudou o nome do bloco mais de uma
        vez: tenta os conhecidos, do mais antigo ao atual. */
  let blocos = texto.split(/ui-search-layout__item/);
  if (blocos.length <= 1) blocos = texto.split(/class="[^"]*poly-card[\s"]/);
  if (blocos.length <= 1) blocos = texto.split(/ui-search-result__wrapper/);
  d.cartoes = Math.max(0, blocos.length - 1);
  for (const b of blocos.slice(1)) {
    if (saida.length >= 30) break;
    const pedaco = b.slice(0, 12000);
    aceitar(enderecoDoCartao(pedaco), tituloDoCartao(pedaco), precoDoCartao(pedaco));
  }

  /* 2. Dados da pagina (JSON dos polycards), quando o HTML nao trouxe nada.
        Medido em 24/09 (travesseiro, 894 KB, 47 anuncios): os dados vem como
        JSON DENTRO de uma string, com as aspas escapadas (\\") e as barras
        como \\u002F. Sem desfazer isso nenhum padrao casa. */
  if (!saida.length) {
    const limpo = texto.replace(/\\u002F/gi, '/').replace(/\\"/g, '"');
    d.bytesDados = limpo.length;

    /* 2a. Cartoes "polycard" (formato medido em 24/09): o link do cartao
           costuma ser de rastreio (click1...) e o numero do anuncio fica em
           metadata.id. Monta o endereco pelo numero do anuncio. */
    const cards = polycards(limpo);
    d.polycards = cards.length;
    for (const c of cards) {
      if (saida.length >= 30) break;
      aceitar({ item: c.item, catalogo: c.catalogo, url: c.url, imagem: c.imagem }, c.titulo, c.preco);
    }
  }
  if (!saida.length) {
    const limpo = texto.replace(/\\u002F/gi, '/').replace(/\\"/g, '"');
    const reCard = /"metadata"\s*:\s*\{[^{}]*?"url"\s*:\s*"([^"]+)"[\s\S]{0,4000}?"title"\s*:\s*\{\s*"text"\s*:\s*"([^"]{8,250})"[\s\S]{0,4000}?"current_price"\s*:\s*\{[^{}]*?"value"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/g;
    let m, n = 0;
    while ((m = reCard.exec(limpo)) && n < 60) {
      n++;
      let url = desescapar(m[1]);
      if (!/^https?:/i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
      aceitar(enderecoDoCartao('href="' + url + '"'), desescapar(m[2]), parseFloat(m[3]));
    }
    d.cartoesJson = n;

    /* 2b. Sem o bloco metadata na ordem esperada: parte de cada titulo e
           procura o anuncio (MLB...) antes dele e o preco depois. */
    if (!saida.length) {
      const reTit = /"title"\s*:\s*\{\s*"text"\s*:\s*"([^"]{8,250})"/g;
      let t, k = 0;
      while ((t = reTit.exec(limpo)) && k < 80) {
        k++;
        const antes = limpo.slice(Math.max(0, t.index - 4000), t.index);
        const depois = limpo.slice(t.index, t.index + 4000);
        const urls = [...antes.matchAll(/"url"\s*:\s*"([^"]*mercadolivre\.com\.br[^"]*)"/g)];
        const ids = [...antes.matchAll(/"id"\s*:\s*"(MLB\d{8,})"/g)];
        let url = urls.length ? desescapar(urls[urls.length - 1][1]) : null;
        if (url && !/^https?:/i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
        if (!url && ids.length) url = 'https://produto.mercadolivre.com.br/' + ids[ids.length - 1][1].replace(/^MLB/, 'MLB-');
        const pr = /"current_price"\s*:\s*\{[^{}]*?"value"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/.exec(depois)
                || /"price"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/.exec(depois);
        if (!url || !pr) continue;
        aceitar(enderecoDoCartao('href="' + url + '"'), desescapar(t[1]), parseFloat(pr[1]));
      }
      d.titulosJson = k;
    }
  }

  /* A busca vem por relevancia; o que interessa ao cliente e o preco. */
  return saida.sort((a, b) => a.preco - b.preco).slice(0, MAX_CANDIDATOS_BUSCA);
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

/* ------------------------------------------- identidade do produto anunciado

   Para comparar o MESMO produto em outras lojas, o que importa e o que o
   produto E, nao o tipo de link que o cliente colou. A pagina do anuncio (a
   que o proprio cliente pediu) traz na ficha tecnica:
     - GTIN / EAN (codigo de barras): identidade exata do produto;
     - marca e modelo;
     - as vezes, o produto de catalogo ao qual o anuncio esta ligado.
   O servidor usa isso na API oficial (/products/search?product_identifier=).
   Nada e chutado: GTIN so vale com digito verificador correto. */

/** Digito verificador de GTIN-8/12/13/14 (padrao GS1). */
export function gtinValido(codigo) {
  const s = String(codigo || '');
  if (!/^\d{8}$|^\d{12,14}$/.test(s)) return false;
  if (/^0+$/.test(s)) return false;
  const d = s.split('').map(Number);
  const verificador = d.pop();
  let soma = 0;
  for (let i = d.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) soma += d[i] * peso;
  return (10 - (soma % 10)) % 10 === verificador;
}

function atributo(t, id) {
  const re = new RegExp('"id"\\s*:\\s*"' + id + '"[\\s\\S]{0,400}?"(?:value_name|text)"\\s*:\\s*"([^"]{1,80})"', 'i');
  const m = re.exec(t);
  return m ? desescapar(m[1]).trim() : null;
}

export function identificadoresDoAnuncio(html) {
  const t = desescapar(String(html || '').slice(0, 3000000));
  let gtin = atributo(t, 'GTIN');
  if (!gtin) {
    const m = /(?:C[oó]digo universal de produto|GTIN|EAN)[^0-9]{0,200}?(\d{8,14})\b/i.exec(t);
    gtin = m ? m[1] : null;
  }
  gtin = gtin ? String(gtin).replace(/\D/g, '') : null;
  if (!gtinValido(gtin)) gtin = null;

  const marca = atributo(t, 'BRAND');
  const modelo = atributo(t, 'MODEL');
  const cat = /"catalog_product_id"\s*:\s*"(MLB\d{5,})"/i.exec(t);
  return { gtin, marca, modelo, catalogoPagina: cat ? cat[1].toUpperCase() : null };
}

/* ------------------------------------------- variacao escolhida no anuncio

   Anuncio com variacao (capinha "para Motorola" com o modelo escolhido, roupa
   com tamanho, aparelho com voltagem): o link do cliente ja abre com a opcao
   marcada ("Modelo do Celular: Edge 70"). Sem ela, o titulo sozinho nao diz
   qual produto e, e a busca nao pode chutar (capa do Edge 70 nao serve no
   Moto G35). Caso visto em 24/09.

   Cor nao entra: a ficha de catalogo costuma juntar as cores, e "Preto" no
   nome da busca so atrapalha. */
const CORES = new Set(['preto', 'preta', 'branco', 'branca', 'azul', 'vermelho', 'vermelha', 'rosa', 'verde',
  'amarelo', 'amarela', 'roxo', 'roxa', 'cinza', 'dourado', 'dourada', 'prata', 'prateado', 'transparente',
  'marrom', 'bege', 'laranja', 'lilas', 'nude', 'grafite', 'vinho', 'creme', 'off white', 'colorido', 'estampado']);

function ehCor(txt) {
  const n = String(txt || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return CORES.has(n) || /^(preto|branco|azul|verde|rosa|cinza)\b/.test(n) && n.split(/\s+/).length <= 2;
}

export function variacaoEscolhida(html) {
  const t = desescapar(String(html || '').slice(0, 3000000));
  const achados = [];
  const junta = (rotulo, valor) => {
    const v = String(valor || '').replace(/\s+/g, ' ').trim();
    if (!v || v.length > 40) return;
    if (/^cor\b/i.test(String(rotulo || '').trim()) || ehCor(v)) return;
    if (!achados.includes(v)) achados.push(v);
  };
  /* Rotulo visivel do seletor: "Modelo do Celular: <span>Edge 70</span>". */
  const reRot = /ui-pdp-variations__label[^>]*>([\s\S]{0,300}?)<\/p>/gi;
  let m;
  while ((m = reRot.exec(t)) && achados.length < 3) {
    const txt = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const i = txt.indexOf(':');
    if (i > 0) junta(txt.slice(0, i), txt.slice(i + 1));
  }
  /* Dados da pagina: cada seletor traz a opcao marcada. */
  if (!achados.length) {
    const reSel = /"label"\s*:\s*\{\s*"text"\s*:\s*"([^"]{1,40})"[\s\S]{0,600}?"selected_option"\s*:\s*\{[^{}]{0,400}?"text"\s*:\s*"([^"]{1,40})"/g;
    while ((m = reSel.exec(t)) && achados.length < 3) junta(m[1].replace(/:\s*$/, ''), m[2]);
  }
  return achados.length ? achados.join(' ') : null;
}

/* Cartoes lidos NA TELA (aba de verdade), ja como { href, titulo, preco }.
   Mesmas regras da leitura do HTML: mesmo produto pelo titulo, preco numa
   faixa razoavel, os mais baratos primeiro. */
export function candidatosDeCartoes(cartoes, tituloOriginal, precoRef, diag = null) {
  const d = diag || {};
  d.cartoesTela = (cartoes || []).length;
  d.parecidosTela = 0;
  const vistos = new Set();
  const saida = [];
  for (const c of cartoes || []) {
    const end = enderecoDoCartao('href="' + String(c.href || '') + '"');
    if (!end || vistos.has(end.item) || !c.titulo || c.preco == null) continue;
    if (!pareceMesmoProduto(tituloOriginal, c.titulo)) continue;
    d.parecidosTela++;
    if (precoRef != null && (c.preco < precoRef * 0.4 || c.preco > precoRef * 1.6)) continue;
    vistos.add(end.item);
    saida.push({ ...end, preco: c.preco, titulo: c.titulo });
  }
  return saida.sort((a, b) => a.preco - b.preco).slice(0, MAX_CANDIDATOS_BUSCA);
}

/* Cada cartao "polycard" dos dados da pagina de busca, ja desescapados.
   Devolve { item, catalogo, url, titulo, preco, imagem }. */
export function polycards(limpo) {
  const saida = [];
  const partes = String(limpo || '').split(/"polycard"\s*:\s*\{/);
  for (const p of partes.slice(1)) {
    const bloco = p.slice(0, 15000);
    /* metadata tem sub-blocos (tracks...), entao nao da para casar ate o
       "}" dele: le os primeiros campos a partir do inicio do bloco. */
    const mi = bloco.search(/"metadata"\s*:\s*\{/);
    if (mi < 0) continue;
    const metaTxt = bloco.slice(mi, mi + 4000);
    const id = (/"id"\s*:\s*"(MLB\d{6,})"/.exec(metaTxt) || [])[1];
    if (!id) continue;
    const urlMeta = (/"url"\s*:\s*"([^"]*)"/.exec(metaTxt) || [])[1] || '';
    const cat = (/\/p\/(MLB\d{5,})/i.exec(urlMeta) || [])[1] || null;
    const titulo = (/"title"\s*:\s*\{\s*"text"\s*:\s*"([^"]{6,300})"/.exec(bloco) || [])[1];
    const preco = (/"current_price"\s*:\s*\{[^{}]*?"value"\s*:\s*(\d{1,7}(?:\.\d{1,2})?)/.exec(bloco) || [])[1];
    if (!titulo || !preco) continue;
    const foto = (/"pictures"\s*:\s*\{[\s\S]{0,200}?"id"\s*:\s*"([0-9]+-[A-Z]{3}[0-9]+_[0-9]+)"/.exec(bloco) || [])[1];
    const url = cat ? urlDaOferta(cat.toUpperCase(), id) : 'https://produto.mercadolivre.com.br/' + id.replace(/^MLB/, 'MLB-');
    saida.push({
      item: id, catalogo: cat ? cat.toUpperCase() : null, url,
      titulo: desescapar(titulo), preco: parseFloat(preco),
      imagem: foto ? 'https://http2.mlstatic.com/D_NQ_NP_' + foto + '-O.webp' : null
    });
  }
  return saida;
}
