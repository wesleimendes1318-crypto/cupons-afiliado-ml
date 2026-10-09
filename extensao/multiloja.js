/* OUTROS MARKETPLACES PELA EXTENSAO (Weslei, 09/10). Roda EM PARALELO com
   o atendimento do Mercado Livre, sem segurar a fila (nao e aguardado):
     1. o banco libera (multiloja_vale: so pedido de cliente, ainda sem
        resultado, marketplace ligada);
     2. Amazon e Shopee buscam juntas (Promise.allSettled, prazo curto);
     3. os 2 melhores de cada passam pela MESMA conferencia pela foto do
        servidor (igual = "Mesmo produto"; parecido = "Parecido" com o que
        muda; reprovado ou sem conferencia = fora); peca no lugar do
        aparelho fica fora antes;
     4. links: Amazon com a tag do Weslei; Shopee pelo painel de afiliados
        (so link conferido); sem link de afiliado, a oferta nao entra;
     5. grava em multiloja_resultados; o site (OutrosMarketplaces) mostra.
   Mesmas regras do servidor (src/lib/coletor-multiloja.ts). */
import { buscarCandidatosAmazon, ofertaAmazonParaSite } from './amazon.js';
import { buscarCandidatosShopee, gerarLinkAfiliadoShopee, ofertaShopeeParaSite, urlCanonicaShopee } from './shopee.js';
import { conferirNoServidor, gravarDiagnostico, gravarMultiloja, multilojaVale } from './sincronia.js';
import { pecaNoLugarDoAparelho } from './comparador.js';

const RUIDO =
  /\b(original|originais|lacrad[oa]s?|novo|nova|lan[cç]amento|promo[cç][aã]o|oferta|frete gr[aá]tis|envio (imediato|r[aá]pido)|pronta entrega|nota fiscal|com nf|nf|garantia|12x|sem juros|super|top|premium|melhor pre[cç]o|barato)\b/gi;

/** Titulo do anuncio em termo de busca limpo (ate 8 palavras). */
export function termoDeBuscaExterna(titulo) {
  return String(titulo || '')
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

/** Os n mais parecidos pelo titulo, na faixa de preco e sem peca no lugar
    do aparelho. */
export function escolherCandidatos(lista, original, n = 2) {
  return (lista || [])
    .filter(o => o && o.titulo && o.preco != null)
    .filter(o => !pecaNoLugarDoAparelho(original.titulo, o.titulo))
    .filter(o => original.preco == null || (o.preco >= original.preco * 0.3 && o.preco <= original.preco * 3))
    .map(o => ({ o, nota: parecencaDoTitulo(original.titulo, o.titulo) }))
    .filter(x => x.nota >= 0.25)
    .sort((a, b) => b.nota - a.nota || a.o.preco - b.o.preco)
    .slice(0, n)
    .map(x => x.o);
}

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

    const candidatos = [
      ...escolherCandidatos(amazon.ofertas, original).map(o => ({ mk: 'amazon', o, chave: 'amazon:' + o.asin })),
      ...escolherCandidatos(shopee.ofertas, original).map(o => ({ mk: 'shopee', o, chave: 'shopee:' + o.item }))
    ].filter(c => c.o.imagem);
    if (!candidatos.length) {
      diag.motivo = 'nenhum candidato parecido';
      await gravarMultiloja(token, pedido, { ativo: true, lojas: [], via: 'extensao', em: new Date().toISOString() });
      return;
    }

    /* Conferencia pela foto: a mesma do Mercado Livre (servidor). */
    const sv = await conferirNoServidor(token, {
      tipo: 'conferir',
      original: { titulo: original.titulo, imagem: original.imagem, preco: original.preco ?? null,
                  chave: original.item || null, categoria: original.categoria || null, fatos: original.fatos || null },
      candidatos: candidatos.map(c => ({ titulo: c.o.titulo, imagem: c.o.imagem, preco: c.o.preco, chave: c.chave }))
    });
    if (!sv || !sv.ok || !Array.isArray(sv.avaliacao)) {
      diag.conferencia = { ok: false, erro: String((sv && sv.erro) || 'sem resposta').slice(0, 120) };
      /* Sem conferencia, nada entra; grava vazio para o site parar de esperar. */
      await gravarMultiloja(token, pedido, { ativo: true, lojas: [], via: 'extensao', incompleto: true, em: new Date().toISOString() });
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
        qualidade: (av && av.qualidade) || null
      });
    }
    lojas.sort((a, b) => (a.relacao === 'mesmo' ? 0 : 1) - (b.relacao === 'mesmo' ? 0 : 1) || a.preco - b.preco);
    diag.aprovados = lojas.length;
    await gravarMultiloja(token, pedido, { ativo: true, lojas, via: 'extensao', em: new Date().toISOString() });
  } catch (e) {
    diag.erro = String((e && e.message) || e).slice(0, 160);
  } finally {
    clearInterval(vivo);
    diag.segundos = Math.round((Date.now() - t0) / 100) / 10;
    gravarDiagnostico(token, 'multiloja', diag).catch(() => {});
  }
}
