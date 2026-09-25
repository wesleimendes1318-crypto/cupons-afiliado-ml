/* Cupons Afiliado ML - sincronia automatica com o site
   =====================================================
   O problema: a API de cupons do Mercado Livre so responde com a SESSAO
   do afiliado logado. Nenhum servidor consegue fazer esse login sozinho.
   Por isso a atualizacao tem que nascer aqui, no navegador.

   O caminho:
     1. baixa o indice completo do hub (a sessao ja esta no cookie)
     2. busca a chave publicavel no proprio site publicado
     3. chama a funcao sincronizar_cupons no banco, protegida por token

   A funcao no banco NAO sobrescreve teto, compra_min, sem_teto, qualidade
   nem categoria. Esses campos vem do endpoint de condicoes, que e lento e
   limita a taxa, entao sao preenchidos aos poucos, em lotes pequenos.
*/

/* O site pode estar em mais de um endereco (dominio proprio e o do Lovable,
   que o Weslei pode renomear). A extensao usa o primeiro que responder e
   guarda por 1 hora. Se todos ficarem fora, tenta de novo na proxima vez. */
const SITES = [
  'https://melhorescolha.io',
  'https://cupons-afiliado-ml.lovable.app',
  'https://https-cupons-afiliado-ml.lovable.app',
  'https://www.melhorescolha.io'
];
let SITE = SITES[1];
let SITE_TS = 0;

async function siteVivo() {
  if (SITE_TS && Date.now() - SITE_TS < 3600e3) return SITE;
  for (const s of SITES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(s + '/api/public/mesmo-produto', { cache: 'no-store', credentials: 'omit', signal: ctrl.signal });
      clearTimeout(t);
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.versao) { SITE = s; SITE_TS = Date.now(); return s; }
    } catch (e) { /* tenta o proximo */ }
  }
  return SITE;
}
const SUPABASE = 'https://rjevaqtnlldhnwsidbbn.supabase.co';
const RPC      = SUPABASE + '/rest/v1/rpc/sincronizar_cupons';

/* A chave publicavel do Supabase e publica por definicao: ela ja vai no
   javascript do site. Buscamos de la em vez de fixar aqui, assim se voce
   trocar a chave a extensao acompanha sozinha. */
let CHAVE_CACHE = { valor: null, ts: 0 };

/* Chave publicavel do banco (e publica: vai no javascript do site). Fica aqui
   como reserva: em 24/09 o endereco do site mudou na configuracao do dominio
   e a extensao parou de ler a fila porque dependia do site para achar a
   chave. Com a reserva, ela nunca mais para por causa de endereco. */
const CHAVE_RESERVA = 'sb_publishable_WYvqQiuyMhALUhvTBXR3ug_5tazN9Lm';

async function chavePublicavel() {
  if (CHAVE_CACHE.valor && Date.now() - CHAVE_CACHE.ts < 6 * 3600e3) return CHAVE_CACHE.valor;
  try {
    return await chaveDoSite();
  } catch (e) {
    CHAVE_CACHE = { valor: CHAVE_RESERVA, ts: Date.now() };
    return CHAVE_RESERVA;
  }
}

async function chaveDoSite() {
  await siteVivo();
  const html = await (await fetch(SITE, { cache: 'no-store' })).text();
  const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m =>
    m[1].startsWith('http') ? m[1] : SITE + (m[1].startsWith('/') ? '' : '/') + m[1]);
  for (const s of srcs) {
    try {
      const t = await (await fetch(s)).text();
      const m = t.match(/sb_publishable_[A-Za-z0-9_-]{10,}/);
      if (m) { CHAVE_CACHE = { valor: m[0], ts: Date.now() }; return m[0]; }
    } catch (e) { /* tenta o proximo */ }
  }
  throw new Error('Nao achei a chave publicavel no site. O site mudou de endereco?');
}

/* ------------------------------------------------------------ sincronia */

export async function sincronizarComSite(cupons, completo = true) {
  const { sincToken } = await chrome.storage.local.get('sincToken');
  if (!sincToken) throw new Error('Configure o token de sincronia nas opcoes da extensao.');

  const payload = cupons.map(c => ({
    id: c.i ?? c.id,
    vendedor: c.v ?? c.seller ?? '',
    desconto: c.t ?? c.title ?? '',
    orcamento: c.o ?? c.remaining_budget ?? null,
    vence: (c.x ?? c.expiration_date ?? '').slice(0, 10) || null
  })).filter(c => c.id && c.vendedor);

  if (!payload.length) throw new Error('Lista vazia, sincronia cancelada.');

  const chave = await chavePublicavel();
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: chave, Authorization: 'Bearer ' + chave },
    body: JSON.stringify({ p_token: sincToken, p_cupons: payload, p_completo: completo })
  });

  const txt = await r.text();
  if (!r.ok) throw new Error('Sincronia recusada: ' + txt.slice(0, 160));

  const res = JSON.parse(txt);
  await chrome.storage.local.set({ ultimaSincronia: { quando: Date.now(), ...res } });
  return res;
}

/* Preenche as condicoes (teto, compra minima) de poucos cupons por vez.
   Limite baixo de proposito: esse endpoint derruba a taxa se for forcado. */
const TERMOS = 'https://www.mercadolivre.com.br/affiliate-program/api/affiliates/coupon-terms?coupon_id=';

export async function condicoesDe(id) {
  try {
    const r = await fetch(TERMOS + id, { headers: { accept: 'application/json' }, credentials: 'include' });
    if (!r.ok) return { id, achou: false, motivo: 'http ' + r.status };
    const j = await r.json();
    const texto = typeof j === 'string' ? j : Object.values(j).join('');
    if (!texto || texto.length < 50) return { id, achou: false, motivo: 'resposta vazia' };
    const num = s => (s ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : null);
    return {
      id, achou: true,
      compra_min: num((/igual ou superior a R\$\s*([\d.,]+)/i.exec(texto) || [])[1]),
      teto: num((/M[aá]ximo de desconto de R\$\s*([\d.,]+)/i.exec(texto) || [])[1])
    };
  } catch (e) { return { id, achou: false, motivo: 'erro de rede' }; }
}

/* Lote pausado, com freio automatico.
   Quando o Mercado Livre comeca a limitar, ele nao responde erro: devolve
   corpo vazio. Entao usamos isso como sinal. A cada lote muito vazio a gente
   diminui o ritmo, e depois de tres lotes ruins seguidos para de vez e deixa
   o resto para a proxima rodada. Foi assim que eu ja derrubei a coleta antes. */
export async function completarCondicoes(ids, limite = 150) {
  const alvo = ids.slice(0, limite);
  const saida = [];
  let porVez = 4, pausa = 500, ruins = 0;

  for (let i = 0; i < alvo.length; i += porVez) {
    const lote = alvo.slice(i, i + porVez);
    const res = await Promise.all(lote.map(condicoesDe));
    saida.push(...res);

    const vazios = res.filter(r => !r.achou).length;
    if (vazios / res.length > 0.6) {
      ruins++;
      porVez = Math.max(2, porVez - 1);
      pausa = Math.min(4000, pausa * 2);
      if (ruins >= 3) { console.warn('[condicoes] o Mercado Livre esta limitando, parando em', saida.length); break; }
    } else if (ruins > 0) { ruins = 0; }

    await new Promise(r => setTimeout(r, pausa));
  }
  return saida;
}


/* ================================================================
   Fila de pedidos vindos do site
   ================================================================
   O site nao consegue gerar link de afiliado: falta a sessao do
   Mercado Livre e o POST precisa nascer dentro de uma pagina do
   proprio site deles. Entao o site so registra o pedido no banco e
   quem atende e esta extensao, aqui no seu navegador. */

const RPC_PENDENTES = SUPABASE + '/rest/v1/rpc/pedidos_pendentes';
const RPC_ATENDER   = SUPABASE + '/rest/v1/rpc/atender_pedido';

async function chamarRpc(url, corpo) {
  const chave = await chavePublicavel();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: chave, Authorization: 'Bearer ' + chave },
    body: JSON.stringify(corpo)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`RPC ${r.status}: ${txt.slice(0, 160)}`);
  return txt ? JSON.parse(txt) : null;
}

export async function pedidosPendentes(token) {
  if (!token) return [];
  const lista = await chamarRpc(RPC_PENDENTES, { p_token: token });
  return Array.isArray(lista) ? lista : [];
}

const RPC_INICIAR = SUPABASE + '/rest/v1/rpc/iniciar_pedido';

/* Avisa que a extensao PEGOU o pedido. E so para o site poder mostrar
   progresso de verdade em vez de etapa inventada por temporizador. */
export async function iniciarPedido(token, id) {
  if (!token) return null;
  return chamarRpc(RPC_INICIAR, { p_token: token, p_id: id });
}

export async function marcarPedido(token, id, link, codigo, erro, analise) {
  return chamarRpc(RPC_ATENDER, {
    p_token: token, p_id: id, p_link: link || null,
    p_codigo: codigo || null, p_erro: erro ? String(erro).slice(0, 200) : null,
    p_analise: analise || null
  });
}

/* Etapa real do atendimento, que o site mostra ao cliente enquanto espera.
   Nunca derruba o atendimento: se falhar, o cliente so ve a etapa anterior. */
export async function marcarEtapa(token, id, etapa) {
  try {
    await chamarRpc(SUPABASE + '/rest/v1/rpc/marcar_etapa', { p_token: token, p_id: id, p_etapa: etapa });
  } catch (e) { /* so visual */ }
}

const RPC_COND_PEND = SUPABASE + '/rest/v1/rpc/condicoes_pendentes';
const RPC_COND_SALVAR = SUPABASE + '/rest/v1/rpc/salvar_condicoes';

export async function condicoesPendentes(token, limite = 150) {
  if (!token) return [];
  const l = await chamarRpc(RPC_COND_PEND, { p_token: token, p_limite: limite });
  return Array.isArray(l) ? l.map(x => x.id) : [];
}

export async function salvarCondicoes(token, lista) {
  if (!token || !lista.length) return null;
  return chamarRpc(RPC_COND_SALVAR, {
    p_token: token,
    p_cond: lista.map(c => ({ id: c.id, teto: c.teto ?? null, compra_min: c.compra_min ?? null, achou: !!c.achou }))
  });
}

const RPC_MELHOR = SUPABASE + '/rest/v1/rpc/melhor_cupom';

/* O cupom da loja vem do BANCO, nao do indice local.
   O indice do hub nao tem teto nem compra minima, e a mesma loja costuma
   aparecer em mais de uma linha. A funcao no banco resolve isso: devolve a
   linha ja conferida quando existe, e ignora cupom vencido. */
export async function melhorCupom(token, vendedor) {
  if (!token || !vendedor) return null;
  const r = await chamarRpc(RPC_MELHOR, { p_token: token, p_vendedor: vendedor });
  return Array.isArray(r) && r.length ? r[0] : null;
}

const RPC_LINKS_PEND   = SUPABASE + '/rest/v1/rpc/links_pendentes';
const RPC_LINKS_SALVAR = SUPABASE + '/rest/v1/rpc/salvar_links';

/* Vitrine do cupom
   ----------------
   Quem chega pelo nome da loja nao tem produto escolhido, entao nao ha o que
   converter. O proprio hub de afiliados tem um "Ver produtos" que devolve a
   lista exata dos itens que o cupom cobre; gerando o link de afiliado dessa
   lista, o visitante navega so pelo que o cupom pega e a comissao continua
   sendo do Weslei. O link e gerado uma vez e guardado no banco, entao o site
   responde na hora mesmo com o computador dele desligado. */
export async function linksPendentes(token, limite = 60) {
  if (!token) return [];
  const l = await chamarRpc(RPC_LINKS_PEND, { p_token: token, p_limite: limite });
  return Array.isArray(l) ? l.map(x => x.id) : [];
}

export async function salvarLinks(token, lista) {
  if (!token || !lista.length) return null;
  return chamarRpc(RPC_LINKS_SALVAR, {
    p_token: token,
    p_links: lista.map(x => ({ id: x.id, link: x.link || null }))
  });
}

const RPC_ETQ_PEND   = SUPABASE + '/rest/v1/rpc/etiquetas_pendentes';
const RPC_ETQ_SALVAR = SUPABASE + '/rest/v1/rpc/salvar_etiquetas';

/* Etiquetas (codigos de cupom)
   ----------------------------
   Quem decide QUANTAS etiquetas podem nascer e o banco, nao esta extensao.
   A funcao etiquetas_pendentes ja devolve a lista cortada por dois tetos: o
   total de etiquetas na conta e quantas nasceram hoje. Se a extensao tiver um
   defeito e chamar em laco, ela recebe lista vazia em vez de criar codigo sem
   parar. Isso importa porque codigo de cupom e PERMANENTE: o Mercado Livre nao
   deixa apagar depois de criado. */
export async function etiquetasPendentes(token, limite = 20) {
  if (!token) return [];
  const l = await chamarRpc(RPC_ETQ_PEND, { p_token: token, p_limite: limite });
  return Array.isArray(l) ? l : [];
}

export async function salvarEtiquetas(token, lista) {
  if (!token || !lista.length) return null;
  return chamarRpc(RPC_ETQ_SALVAR, {
    p_token: token,
    p_lista: lista.map(x => ({ id: x.id, codigo: x.codigo || null }))
  });
}


/* Pagina da loja no Mercado Livre, descoberta lendo um anuncio do vendedor.

   E o destino do botao do cartao quando nao existe link de afiliado: a lista
   de produtos daquela loja, que e onde o cliente escolhe o que comprar antes
   de aplicar o cupom. O slug do endereco nem sempre e igual ao nome de
   exibicao, entao chutar leva a pagina inexistente: tem que ser lido. */
const RPC_PAGINA_LOJA = SUPABASE + '/rest/v1/rpc/salvar_pagina_loja';

export async function salvarPaginaLoja(token, vendedor, url) {
  if (!token || !vendedor || !url) return null;
  return chamarRpc(RPC_PAGINA_LOJA, { p_token: token, p_vendedor: vendedor, p_url: url });
}

const RPC_LOJAS_PEND = SUPABASE + '/rest/v1/rpc/lojas_para_resolver';
const RPC_LOJA_SEM   = SUPABASE + '/rest/v1/rpc/marcar_loja_sem_pagina';

/* Uma linha por LOJA que ainda nao tem endereco de vitrine guardado, com o
   numero do vendedor quando ele ja aparece no link da campanha. Loja, e nao
   cupom: o endereco vale para todos os cupons da mesma loja, entao uma visita
   ao Mercado Livre resolve dez cartoes de uma vez. */
export async function lojasParaResolver(token, limite = 20) {
  if (!token) return [];
  const r = await chamarRpc(RPC_LOJAS_PEND, { p_token: token, p_limite: limite });
  return Array.isArray(r) ? r : [];
}

/* Tentamos e o Mercado Livre nao tem pagina para essa loja. Anota a tentativa
   para a fila nao voltar aqui amanha. O cupom continua no ar: o codigo aplica
   no carrinho mesmo sem vitrine para mostrar. */
export async function marcarLojaSemPagina(token, vendedor) {
  if (!token || !vendedor) return null;
  return chamarRpc(RPC_LOJA_SEM, { p_token: token, p_vendedor: vendedor });
}

const RPC_VIT_PEND   = SUPABASE + '/rest/v1/rpc/vitrines_para_conferir';
const RPC_VIT_SALVAR = SUPABASE + '/rest/v1/rpc/salvar_vitrines';

/* Vitrine vazia
   -------------
   O hub do Mercado Livre lista cupons cuja vitrine nao tem nenhum produto no
   ar: o cupom existe e tem orcamento, mas o vendedor nao tem item elegivel.
   Nesses, o link cai numa lista vazia e o codigo nao aplica em nada. Conferir
   antes de mostrar evita prometer o que nao existe. */
export async function vitrinesParaConferir(token, limite = 40) {
  if (!token) return [];
  const l = await chamarRpc(RPC_VIT_PEND, { p_token: token, p_limite: limite });
  return Array.isArray(l) ? l : [];
}

export async function salvarVitrines(token, lista) {
  if (!token || !lista.length) return null;
  return chamarRpc(RPC_VIT_SALVAR, {
    p_token: token,
    p_lista: lista.map(x => ({ id: x.id, ok: !!x.ok, origem: x.origem || null, motivo: x.motivo || null }))
  });
}


const RPC_ESTADO_ROBO = SUPABASE + '/rest/v1/rpc/anotar_estado_robo';

/* Conta ao site o que esta acontecendo aqui dentro.

   Sem isto, freio puxado parecia site quebrado: o visitante clicava, o botao
   girava 88 segundos e desistia sem explicar nada. Agora o site le este estado
   e diz a verdade, que e "estou em pausa de seguranca, volto mais tarde". */
export async function anotarEstadoRobo(token, chave, valor) {
  if (!token || !chave) return null;
  try { return await chamarRpc(RPC_ESTADO_ROBO, { p_token: token, p_chave: chave, p_valor: valor == null ? '' : String(valor) }); }
  catch (e) { return null; }
}


const RPC_ORIGEM = SUPABASE + '/rest/v1/rpc/salvar_origem_cupom';

/* Endereco da vitrine de UM cupom (a lista de produtos que ele cobre), lido do
   hub de afiliados. So preenche quando o banco ainda nao tem: nunca troca um
   endereco que ja foi conferido. */
export async function salvarOrigemCupom(token, id, url) {
  if (!token || !id || !url) return null;
  try { return await chamarRpc(RPC_ORIGEM, { p_token: token, p_id: id, p_url: url }); }
  catch (e) { return null; }
}

const RPC_LOJAS_PEDIDAS = SUPABASE + '/rest/v1/rpc/lojas_pedidas';

/* Lojas cuja pagina alguem pediu no site na ultima hora (botao "ver os
   produtos da loja"). Poucas por vez: e gente esperando, nao varredura. */
export async function lojasPedidas(token) {
  if (!token) return [];
  try {
    const r = await chamarRpc(RPC_LOJAS_PEDIDAS, { p_token: token });
    return Array.isArray(r) ? r : [];
  } catch (e) { return []; }
}


/* ================================================================
   Cadastro de geracoes
   ================================================================
   Tudo que a extensao cria no Mercado Livre (link de afiliado, etiqueta,
   link de vitrine) passa por aqui ANTES. O banco responde:
     existe     -> ja foi gerado: reaproveita, nao chama o Mercado Livre
     reservado  -> pode criar
     bloqueado  -> pausa geral, teto do dia ou tentativa anterior sem resposta
   Sem banco (erro de rede), a resposta e 'bloqueado': na duvida, nao cria. */
const RPC_RESERVAR = SUPABASE + '/rest/v1/rpc/reservar_geracao';
const RPC_CONCLUIR = SUPABASE + '/rest/v1/rpc/concluir_geracao';

export async function reservarGeracao(token, tipo, chave) {
  if (!token) return { status: 'bloqueado', motivo: 'sem token de sincronia' };
  try {
    const r = await chamarRpc(RPC_RESERVAR, { p_token: token, p_tipo: tipo, p_chave: String(chave) });
    return r && r.status ? r : { status: 'bloqueado', motivo: 'resposta vazia do banco' };
  } catch (e) {
    return { status: 'bloqueado', motivo: 'cadastro indisponivel: ' + e.message };
  }
}

export async function concluirGeracao(token, tipo, chave, resultado, erro, meta) {
  if (!token) return null;
  try {
    return await chamarRpc(RPC_CONCLUIR, {
      p_token: token, p_tipo: tipo, p_chave: String(chave),
      p_resultado: resultado || null, p_erro: erro ? String(erro).slice(0, 300) : null,
      p_meta: meta || null
    });
  } catch (e) { return null; }
}


/* Comparacao "mesmo produto em outras lojas" feita pelo SERVIDOR do site, com
   a API oficial do Mercado Livre. A sessao de afiliado nao le pagina nenhuma
   para isso; ela so gera o link das opcoes escolhidas. */
export async function compararNoServidor(token, url, dica = {}) {
  if (!token) return { procurou: false, motivo: 'sem token de sincronia', opcoes: [] };
  try {
    /* Sem cookie do site: o navegador do Weslei guardava a versao antiga do
       servidor presa a sessao (24/09: a versao nova ja estava no ar e a
       extensao seguia recebendo a anterior). */
    await siteVivo();
    const r = await fetch(SITE + '/api/public/mesmo-produto', {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-sinc-token': token },
      body: JSON.stringify({ url, ...dica })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return { procurou: false, motivo: (j && j.erro) || ('servidor respondeu ' + r.status), opcoes: [] };
    return j;
  } catch (e) {
    return { procurou: false, motivo: 'servidor do site fora do ar', opcoes: [] };
  }
}

/* Gemini do SERVIDOR do site (chave nos secrets do Lovable): confere pela foto
   se os candidatos sao o mesmo produto, ou escreve a busca. Plano B de quando
   a chave da extensao falha (cota, modelo indisponivel). */
export async function conferirNoServidor(token, corpo) {
  if (!token) return { ok: false, erro: 'sem token de sincronia' };
  try {
    await siteVivo();
    const ctrl = new AbortController();
    const corta = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(SITE + '/api/public/conferir-produto', {
      signal: ctrl.signal,
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-sinc-token': token },
      body: JSON.stringify(corpo)
    });
    const j = await r.json().catch(() => null);
    clearTimeout(corta);
    if (!j) return { ok: false, erro: 'servidor respondeu ' + r.status };
    return j;
  } catch (e) {
    return { ok: false, erro: 'servidor do site fora do ar' };
  }
}

/* Diagnostico para o desenvolvedor (tabela diagnosticos, 7 dias). Nunca
   derruba nada: se falhar, so nao grava. */
export async function gravarDiagnostico(token, tipo, dados) {
  if (!token) return;
  try {
    await chamarRpc(SUPABASE + '/rest/v1/rpc/gravar_diagnostico', { p_token: token, p_tipo: tipo, p_dados: dados });
  } catch (e) { /* so diagnostico */ }
}

/* Vitrine: produtos antigos sem foto (a extensao completa aos poucos). */
export async function vitrineSemFoto(token, limite = 5) {
  if (!token) return [];
  try {
    const l = await chamarRpc(SUPABASE + '/rest/v1/rpc/vitrine_sem_foto', { p_token: token, p_limite: limite });
    return Array.isArray(l) ? l : [];
  } catch (e) { return []; }
}

export async function vitrineCompletar(token, chave, imagem, categoria) {
  if (!token) return;
  try {
    await chamarRpc(SUPABASE + '/rest/v1/rpc/vitrine_completar',
      { p_token: token, p_chave: chave, p_imagem: imagem || '', p_categoria: categoria || '' });
  } catch (e) { /* tenta na proxima rodada */ }
}
