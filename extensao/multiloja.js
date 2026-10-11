/* OUTROS MARKETPLACES PELA EXTENSAO (Weslei, 09/10). SOB DEMANDA (10/10:
   "para nao gastar muitas requisicoes"): so roda quando o cliente pede no
   site (atenderMultiloja no background, com o anuncio montado da analise
   guardada), nunca segura a fila do Mercado Livre:
     1. o banco libera (multiloja_vale: so pedido de cliente que o cliente
        pediu, ainda sem resultado, marketplace ligada);
     2. Amazon e Shopee buscam juntas (Promise.allSettled, prazo curto);
     3. MESMA ANALISE EM CADA MARKETPLACE (Weslei, 09/10: "deve fazer a
        mesma analise em cada player e por fim comparar os 3"): ate 4 de
        cada (os 3 mais parecidos pelo titulo e o mais barato bem parecido)
        passam pela MESMA conferencia pela foto do servidor (igual = "Mesmo
        produto"; parecido = "Parecido" com o que muda, qualidade e
        desvantagens; reprovado ou sem conferencia = fora); peca no lugar do
        aparelho e usado ficam fora antes;
     4. links: Amazon com a tag do Weslei; Shopee pelo painel de afiliados
        (so link conferido); sem link de afiliado, a oferta nao entra;
     5. grava em multiloja_resultados com o resumo (lidas/conferidas por
        marketplace); o site (ComparacaoMarketplaces) mostra a analise de
        cada um e a comparacao final dos 3.
   Mesmas regras do servidor (src/lib/coletor-multiloja.ts). */
import { buscarCandidatosAmazon, ofertaAmazonParaSite } from './amazon.js';
import { buscarCandidatosShopee, gerarLinkAfiliadoShopee, ofertaShopeeParaSite, urlCanonicaShopee } from './shopee.js';
import { conferirNoServidor, gravarDiagnostico, gravarMultiloja, multilojaVale } from './sincronia.js';
import { pecaNoLugarDoAparelho } from './comparador.js';

const RUIDO =
  /\b(original|originais|lacrad[oa]s?|novo|nova|lan[cç]amento|promo[cç][aã]o|oferta|frete gr[aá]tis|envio (imediato|r[aá]pido)|pronta entrega|nota fiscal|com nf|nf|garantia|12x|sem juros|super|top|premium|melhor pre[cç]o|barato)\b/gi;

/* 11/10 (bebedouro pet x fonte de Buda): voltagem, codigo de rastreio e
   SKU tambem saem do termo. Igual ao site (src/lib/termo-busca-externa.ts). */
const RUIDO_TECNICO = /\b(bivolt|(110|127|220) ?v|(c[oó]d(igo)?|sku)\.?\s*:?\s*[a-z0-9-]{4,}|[A-Z]{2}\d{9}[A-Z]{2})\b/gi;

/** Titulo do anuncio em termo de busca limpo (ate 8 palavras). */
export function termoDeBuscaExterna(titulo) {
  return String(titulo || '')
    .replace(RUIDO_TECNICO, ' ')
    .replace(RUIDO, ' ')
    .replace(/[^\p{L}\p{N}\s.,/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

const palavras = s => new Set(String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter(p => p.length >= 2));

export function parecencaDoTitulo(a, b) {
  const x = palavras(a), y = palavras(b);
  if (!x.size || !y.size) return 0;
  let comum = 0;
  for (const p of x) if (y.has(p)) comum += 1;
  return comum / Math.min(x.size, y.size);
}

const RE_CONDICAO_RUIM = /\b(usad[oa]s?|recondicionad[oa]s?|seminov[oa]s?|renovad[oa]s?|vitrine|open ?box|mostru[aá]rio)\b/i;

/** Candidatos de um marketplace para a conferencia pela foto: na faixa de
    preco, sem peca no lugar do aparelho nem usado, os 3 mais parecidos
    pelo titulo e, entre os bem parecidos (>= 0,5), o mais barato que ainda
    nao entrou. Igual ao servidor (escolherCandidatos em
    src/lib/coletor-multiloja.ts). */
export function escolherCandidatos(lista, original, n = 4) {
  const notas = (lista || [])
    .filter(o => o && o.titulo && o.preco != null && o.preco > 0)
    .filter(o => !RE_CONDICAO_RUIM.test(o.titulo))
    .filter(o => !pecaNoLugarDoAparelho(original.titulo, o.titulo))
    .filter(o => original.preco == null || (o.preco >= original.preco * 0.3 && o.preco <= original.preco * 3))
    .map(o => ({ o, nota: parecencaDoTitulo(original.titulo, o.titulo) }))
    .filter(x => x.nota >= 0.25)
    .sort((a, b) => b.nota - a.nota || a.o.preco - b.o.preco);
  const escolhidos = notas.slice(0, Math.max(0, n - 1));
  const barato = notas
    .filter(x => x.nota >= 0.5 && !escolhidos.includes(x))
    .sort((a, b) => a.o.preco - b.o.preco)[0];
  const ultimo = barato || notas[n - 1];
  if (ultimo && escolhidos.length < n) escolhidos.push(ultimo);
  return escolhidos.map(x => x.o);
}

/* CLIENTE PRIMEIRO NA COTA DA CONFERENCIA (10/10, pedido 1110: com a cota
   diaria da Gemini esgotada, so o Gemma confere, e ele aceita 16 mil tokens
   de entrada por minuto; a conferencia da Amazon/Shopee no mesmo minuto
   derrubou a do Mercado Livre). A busca nas outras lojas continua em
   paralelo (nao gasta cota), mas a CONFERENCIA delas espera as do Mercado
   Livre terminarem (buscaMlComecou/buscaMlTerminou, chamadas pelo
   atendimento) e a segunda volta do mesmo pedido (voltaMlPendente), por
   ate 3 min. */
const buscasMl = new Set();
export function buscaMlComecou(pedido) { buscasMl.add(pedido); }
export function buscaMlTerminou(pedido) { buscasMl.delete(pedido); }
/* Pedido com segunda volta pendente (10/10, pedido 1123: a conferencia da
   Amazon/Shopee comecou no intervalo entre a 1a passada e a segunda volta
   do MESMO pedido, e a segunda volta bateu no limite por minuto de novo). */
const voltasMl = new Set();
export function voltaMlPendente(pedido, pendente) {
  if (pendente) voltasMl.add(pedido); else voltasMl.delete(pedido);
}
const esperar = ms => new Promise(ok => setTimeout(ok, ms));
export async function esperarBuscasMl(limiteMs, pedido) {
  const ate = Date.now() + limiteMs;
  let esperou = false;
  while ((buscasMl.size || voltasMl.has(pedido)) && Date.now() < ate) { esperou = true; await esperar(1500); }
  return esperou;
}
/* Janela do limite por minuto do modelo antes de tentar de novo. */
const NOVA_TENTATIVA_MS = 60000;

const comPrazo = (promessa, ms, reserva) => Promise.race([
  promessa,
  new Promise(ok => setTimeout(() => ok(reserva), ms))
]);

/** Compara o anuncio colado com a Amazon e a Shopee e grava o resultado.
    Nunca lanca erro e nunca e aguardado pelo atendimento do Mercado Livre. */
export async function compararOutrosMarketplaces(token, pedido, original) {
  const t0 = Date.now();
  const diag = { pedido, termo: null, amazon: null, shopee: null, conferencia: null, links: [], aprovados: 0 };
  /* O service worker dorme depois de ~30 s sem chamada de extensao. */
  const vivo = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch (e) { /* ok */ } }, 20000);
  try {
    if (!original || !original.titulo || !original.imagem) { diag.motivo = 'anuncio sem titulo ou foto'; return; }
    const vale = await multilojaVale(token, pedido);
    if (!vale || !vale.ok) { diag.motivo = (vale && vale.motivo) || 'nao liberado'; return; }
    const termo = termoDeBuscaExterna(original.titulo);
    diag.termo = termo;

    const [am, sh] = await Promise.allSettled([
      vale.amazon ? comPrazo(buscarCandidatosAmazon(termo, 8000), 9000, { ofertas: [], motivo: 'tempo esgotado' })
                  : Promise.resolve({ ofertas: [], motivo: 'desligada' }),
      vale.shopee ? comPrazo(buscarCandidatosShopee(termo, 10000), 12000, { ofertas: [], motivo: 'tempo esgotado' })
                  : Promise.resolve({ ofertas: [], motivo: 'desligada' })
    ]);
    const amazon = am.status === 'fulfilled' ? am.value : { ofertas: [], motivo: String(am.reason).slice(0, 80) };
    const shopee = sh.status === 'fulfilled' ? sh.value : { ofertas: [], motivo: String(sh.reason).slice(0, 80) };
    diag.amazon = { lidas: amazon.ofertas.length, motivo: amazon.motivo || null };
    diag.shopee = { lidas: shopee.ofertas.length, motivo: shopee.motivo || null };

    /* Sem foto nao da para conferir: fica de fora ANTES da escolha (a vaga
       vai para o proximo). */
    const deAmazon = escolherCandidatos(amazon.ofertas.filter(o => o.imagem), original);
    const deShopee = escolherCandidatos(shopee.ofertas.filter(o => o.imagem), original);
    const candidatos = [
      ...deAmazon.map(o => ({ mk: 'amazon', o, chave: 'amazon:' + o.asin })),
      ...deShopee.map(o => ({ mk: 'shopee', o, chave: 'shopee:' + o.item }))
    ];
    /* O que cada marketplace leu e conferiu (so as consultadas). */
    const resumo = {};
    if (vale.amazon) resumo.amazon = { lidas: amazon.ofertas.length, conferidas: deAmazon.length, motivo: amazon.motivo || null };
    if (vale.shopee) resumo.shopee = { lidas: shopee.ofertas.length, conferidas: deShopee.length, motivo: shopee.motivo || null };
    if (!candidatos.length) {
      diag.motivo = 'nenhum candidato parecido';
      await gravarMultiloja(token, pedido, { ativo: true, lojas: [], resumo, via: 'extensao', em: new Date().toISOString() });
      return;
    }

    /* Conferencia pela foto: a mesma do Mercado Livre (servidor), depois
       das conferencias do Mercado Livre em andamento. */
    diag.esperouMl = await esperarBuscasMl(180000, pedido);
    const conferir = () => conferirNoServidor(token, {
      tipo: 'conferir',
      original: { titulo: original.titulo, imagem: original.imagem, preco: original.preco ?? null,
                  chave: original.item || null, categoria: original.categoria || null, fatos: original.fatos || null },
      candidatos: candidatos.map(c => ({ titulo: c.o.titulo, imagem: c.o.imagem, preco: c.o.preco, chave: c.chave }))
    });
    let sv = await conferir();
    /* Lote que falhou (limite por minuto, tempo) deixa candidato sem
       veredito: uma nova tentativa depois de 60 s, de novo so com o Mercado
       Livre parado. O servidor devolve guardado o que ja foi conferido e so
       confere o que faltou. */
    const semVeredito = r => !r || !r.ok || !Array.isArray(r.avaliacao)
      || candidatos.some((_, i) => !r.avaliacao.some(a => a.indice === i));
    if (semVeredito(sv)) {
      diag.novaTentativa = { faltavam: sv && Array.isArray(sv.avaliacao) ? candidatos.length - sv.avaliacao.length : candidatos.length,
                             erro: sv && !sv.ok ? String(sv.erro || '').slice(0, 120) : null };
      await esperar(NOVA_TENTATIVA_MS);
      await esperarBuscasMl(180000, pedido);
      const sv2 = await conferir();
      if (sv2 && sv2.ok && Array.isArray(sv2.avaliacao)
          && (!sv || !sv.ok || !Array.isArray(sv.avaliacao) || sv2.avaliacao.length >= sv.avaliacao.length)) sv = sv2;
      diag.novaTentativa.depois = sv && Array.isArray(sv.avaliacao) ? candidatos.length - sv.avaliacao.length : null;
    }
    if (!sv || !sv.ok || !Array.isArray(sv.avaliacao)) {
      diag.conferencia = { ok: false, erro: String((sv && sv.erro) || 'sem resposta').slice(0, 120) };
      /* Sem conferencia, nada entra; grava vazio para o site parar de esperar. */
      await gravarMultiloja(token, pedido, { ativo: true, lojas: [], resumo: {}, via: 'extensao', incompleto: true, em: new Date().toISOString() });
      return;
    }
    diag.conferencia = { ok: true, modelo: sv.modelo || null, iguais: sv.iguais || [] };

    const lojas = [];
    for (let i = 0; i < candidatos.length; i++) {
      const c = candidatos[i];
      const av = sv.avaliacao.find(a => a.indice === i) || null;
      const mesmo = Array.isArray(sv.iguais) && sv.iguais.includes(i);
      if (!mesmo && !(av && av.parecido === true)) continue;
      let oferta = null;
      if (c.mk === 'amazon') {
        oferta = ofertaAmazonParaSite(c.o);
      } else {
        const g = await gerarLinkAfiliadoShopee(urlCanonicaShopee({ shop: c.o.shop, item: c.o.item }));
        diag.links.push({ shopee: c.o.item, ok: !!g.link, erro: g.erro || null, como: g.como || (g.cache ? 'cache' : null) });
        if (g.link) oferta = ofertaShopeeParaSite(c.o, g.link);
      }
      if (!oferta) continue;
      lojas.push({
        ...oferta,
        relacao: mesmo ? 'mesmo' : 'parecido',
        muda: mesmo ? null : ((av && av.motivo) || null),
        semelhanca: (av && av.semelhanca) ?? null,
        qualidade: (av && av.qualidade) || null,
        qualidadeMotivo: mesmo ? null : ((av && av.qualidadeMotivo) || null),
        desvantagens: mesmo ? null : ((av && Array.isArray(av.desvantagens) && av.desvantagens.length) ? av.desvantagens.slice(0, 4) : null),
        mesmaFoto: !!(av && av.mesmaFoto)
      });
    }
    lojas.sort((a, b) => (a.relacao === 'mesmo' ? 0 : 1) - (b.relacao === 'mesmo' ? 0 : 1) || a.preco - b.preco);
    diag.aprovados = lojas.length;
    await gravarMultiloja(token, pedido, { ativo: true, lojas, resumo, via: 'extensao', em: new Date().toISOString() });
  } catch (e) {
    diag.erro = String((e && e.message) || e).slice(0, 160);
  } finally {
    clearInterval(vivo);
    diag.segundos = Math.round((Date.now() - t0) / 100) / 10;
    gravarDiagnostico(token, 'multiloja', diag).catch(() => {});
  }
}
