/* GARIMPO NO PLAYER DE ORIGEM (Weslei, 11/10, prompt mestre):
     - link da Amazon: garimpa na Amazon; link da Shopee: na Shopee;
     - link de loja sem afiliacao (Magalu, KaBuM!...): no campeao do
       segmento quando ele e a Amazon ou a Shopee (o Mercado Livre e a busca
       do catalogo, no servidor).
   O site grava o pedido (pedir_garimpo); a extensao pega a fila
   (garimpos_pendentes), um por vez, e:
     1. le o produto de origem: na propria busca (mesmo ASIN / mesmo item)
        ou, na Amazon, na pagina do produto; de outra loja, o que o servidor
        leu (titulo, preco e foto);
     2. busca no player pelo termo limpo e escolhe ate 5 candidatos (mesma
        regra da comparacao dos 3: titulo parecido, faixa de preco, sem usado
        nem peca no lugar do aparelho);
     3. confere pela foto no servidor (igual = "Mesmo produto"; parecido com
        o que muda, qualidade e desvantagens; reprovado = fora). Sem foto do
        produto de origem nao ha conferencia: as ofertas voltam como
        "encontrado pela busca" (a tela nunca diz que e o mesmo produto);
     4. SO OFERTA COM O LINK DE AFILIADO DO WESLEI (regra n. 1): Amazon com a
        tag, Shopee pelo painel de afiliados (link conferido). O produto de
        origem tambem volta com o link dele;
     5. grava (gravar_garimpo); o site mostra.
   A conferencia espera as do Mercado Livre em andamento (cliente primeiro
   na cota). */
import { buscarCandidatosAmazon, gerarLinkAfiliadoAmazon, lerProdutoAmazon, ofertaAmazonParaSite } from './amazon.js';
import { buscarCandidatosShopee, gerarLinkAfiliadoShopee, idsDoProdutoShopee, ofertaShopeeParaSite,
         urlCanonicaShopee } from './shopee.js';
import { conferirNoServidor, gravarDiagnostico, gravarGarimpo } from './sincronia.js';
import { escolherCandidatos, esperarBuscasMl, parecencaDoTitulo, termoDeBuscaExterna } from './multiloja.js';

const esperar = ms => new Promise(ok => setTimeout(ok, ms));
const RE_ASIN = /^[A-Z0-9]{10}$/;

/** ASIN do pedido (id_origem ou o endereco /dp/<ASIN>). */
export function asinDoPedido(p) {
  const id = String((p && p.id_origem) || '').toUpperCase();
  if (RE_ASIN.test(id)) return id;
  const m = String((p && p.url) || '').match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?#]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

/** shop.item da Shopee (id_origem "loja.item" ou o endereco). */
export function itemShopeeDoPedido(p) {
  const id = String((p && p.id_origem) || '');
  const m = id.match(/^(\d{3,15})\.(\d{3,15})$/);
  if (m) return { shop: m[1], item: m[2] };
  return idsDoProdutoShopee((p && p.url) || '');
}

/** Ofertas sem a do produto de origem, para a escolha dos candidatos. */
export function semAOrigem(ofertas, player, origem) {
  return (ofertas || []).filter(o => player === 'amazon'
    ? !(origem && origem.asin && o.asin === origem.asin)
    : !(origem && origem.item && String(o.item) === String(origem.item)));
}

/** Melhor oferta do mesmo produto: a mais barata entre as conferidas. */
export function melhorDoMesmo(ofertas) {
  return (ofertas || []).filter(o => o.relacao === 'mesmo' && o.preco > 0)
    .sort((a, b) => a.preco - b.preco)[0] || null;
}

async function linkDaOferta(player, o, diag) {
  if (player === 'amazon') return ofertaAmazonParaSite(o);
  const g = await gerarLinkAfiliadoShopee(urlCanonicaShopee({ shop: o.shop, item: o.item }));
  diag.links.push({ item: o.item, ok: !!g.link, erro: g.erro || null });
  return g.link ? ofertaShopeeParaSite(o, g.link) : null;
}

/** Atende um pedido de garimpo. Nunca lanca erro. */
export async function garimparNoPlayer(token, p) {
  const t0 = Date.now();
  const diag = { garimpo: p && p.id, player: p && p.player, origem: p && p.origem, termo: null, lidas: 0,
                 candidatos: 0, conferencia: null, links: [], aprovados: 0 };
  const vivo = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch (e) { /* ok */ } }, 20000);
  try {
    if (!p || !p.id || !['amazon', 'shopee'].includes(p.player)) { diag.motivo = 'pedido invalido'; return; }
    const player = p.player;
    const doMesmoPlayer = p.origem === player;
    const termo = termoDeBuscaExterna(p.termo);
    diag.termo = termo;

    /* 1. Busca no player. */
    const busca = player === 'amazon' ? await buscarCandidatosAmazon(termo, 9000) : await buscarCandidatosShopee(termo, 12000);
    const ofertas = (busca && busca.ofertas) || [];
    diag.lidas = ofertas.length;

    /* 2. Produto de origem. */
    let origem = { titulo: p.termo, preco: p.preco_origem != null ? Number(p.preco_origem) : null,
                   imagem: p.imagem_origem || null, link: null, loja: p.loja_origem || null, fonte: 'site' };
    if (doMesmoPlayer && player === 'amazon') {
      const asin = asinDoPedido(p);
      origem.asin = asin;
      const naBusca = asin ? ofertas.find(o => o.asin === asin) : null;
      if (naBusca) origem = { ...origem, titulo: naBusca.titulo, preco: naBusca.preco, imagem: naBusca.imagem, fonte: 'busca' };
      else if (asin) {
        const lido = await lerProdutoAmazon(asin, 8000);
        diag.paginaOrigem = lido.motivo || 'ok';
        if (lido.produto) origem = { ...origem, titulo: lido.produto.titulo, preco: lido.produto.preco,
                                     imagem: lido.produto.imagem, fonte: 'pagina' };
      }
      origem.link = asin ? gerarLinkAfiliadoAmazon(asin) : null;
      if (naBusca && naBusca.prime) origem.selos = ['Prime'];
    } else if (doMesmoPlayer && player === 'shopee') {
      const ids = itemShopeeDoPedido(p);
      origem.item = ids ? ids.item : null;
      const naBusca = ids ? ofertas.find(o => String(o.item) === String(ids.item)) : null;
      if (naBusca) origem = { ...origem, titulo: naBusca.titulo, preco: naBusca.preco, imagem: naBusca.imagem, fonte: 'busca' };
      if (ids) {
        const g = await gerarLinkAfiliadoShopee(urlCanonicaShopee(ids));
        diag.links.push({ item: ids.item, origem: true, ok: !!g.link, erro: g.erro || null });
        origem.link = g.link || null;
      }
    }

    /* 3. Candidatos (sem a propria origem). */
    const candidatos = escolherCandidatos(semAOrigem(ofertas, player, origem).filter(o => o.imagem),
      { titulo: origem.titulo, preco: origem.preco }, 5);
    diag.candidatos = candidatos.length;
    const resultado = {
      player, origem: p.origem, termo,
      original: { titulo: origem.titulo, preco: origem.preco, imagem: origem.imagem, link: origem.link,
                  loja: origem.loja, fonte: origem.fonte, selos: origem.selos || [] },
      ofertas: [], lidas: ofertas.length, conferidas: 0,
      conferencia: null, motivo: (busca && busca.motivo) || null, em: null
    };

    if (candidatos.length && origem.imagem) {
      diag.esperouMl = await esperarBuscasMl(180000, null);
      const conferir = () => conferirNoServidor(token, {
        tipo: 'conferir',
        original: { titulo: origem.titulo, imagem: origem.imagem, preco: origem.preco ?? null,
                    chave: origem.asin ? 'amazon:' + origem.asin : (origem.item ? 'shopee:' + origem.item : null) },
        candidatos: candidatos.map(o => ({ titulo: o.titulo, imagem: o.imagem, preco: o.preco,
                                           chave: player === 'amazon' ? 'amazon:' + o.asin : 'shopee:' + o.item }))
      });
      let sv = await conferir();
      const faltou = r => !r || !r.ok || !Array.isArray(r.avaliacao)
        || candidatos.some((_, i) => !r.avaliacao.some(a => a.indice === i));
      if (faltou(sv)) {
        await esperar(60000);
        await esperarBuscasMl(180000, null);
        const sv2 = await conferir();
        if (sv2 && sv2.ok && Array.isArray(sv2.avaliacao)
            && (!sv || !sv.ok || !Array.isArray(sv.avaliacao) || sv2.avaliacao.length >= sv.avaliacao.length)) sv = sv2;
      }
      if (!sv || !sv.ok || !Array.isArray(sv.avaliacao)) {
        resultado.conferencia = 'falhou';
        diag.conferencia = { ok: false, erro: String((sv && sv.erro) || 'sem resposta').slice(0, 120) };
      } else {
        resultado.conferencia = 'ok';
        resultado.conferidas = candidatos.length;
        diag.conferencia = { ok: true, modelo: sv.modelo || null, iguais: sv.iguais || [] };
        for (let i = 0; i < candidatos.length; i++) {
          const o = candidatos[i];
          const av = sv.avaliacao.find(a => a.indice === i) || null;
          const mesmo = Array.isArray(sv.iguais) && sv.iguais.includes(i);
          if (!mesmo && !(av && av.parecido === true)) continue;
          const oferta = await linkDaOferta(player, o, diag);
          if (!oferta) continue;
          resultado.ofertas.push({
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
      }
    } else if (candidatos.length) {
      /* Sem a foto da origem nao da para conferir: so os bem parecidos pelo
         titulo, marcados como encontrados pela busca. */
      resultado.conferencia = 'sem_foto';
      for (const o of candidatos.filter(c => parecencaDoTitulo(origem.titulo, c.titulo) >= 0.5).slice(0, 4)) {
        const oferta = await linkDaOferta(player, o, diag);
        if (oferta) resultado.ofertas.push({ ...oferta, relacao: 'busca', muda: null, semelhanca: null,
                                             qualidade: null, qualidadeMotivo: null, desvantagens: null, mesmaFoto: false });
      }
    }
    const ordem = { mesmo: 0, parecido: 1, busca: 2 };
    resultado.ofertas.sort((a, b) => (ordem[a.relacao] - ordem[b.relacao]) || a.preco - b.preco);
    resultado.em = new Date().toISOString();
    diag.aprovados = resultado.ofertas.length;
    await gravarGarimpo(token, p.id, resultado, null);
  } catch (e) {
    diag.erro = String((e && e.message) || e).slice(0, 160);
    await gravarGarimpo(token, p && p.id, null, diag.erro).catch(() => {});
  } finally {
    clearInterval(vivo);
    diag.segundos = Math.round((Date.now() - t0) / 100) / 10;
    gravarDiagnostico(token, 'garimpo', diag).catch(() => {});
  }
}
