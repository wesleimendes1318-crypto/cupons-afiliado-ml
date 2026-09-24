/* Cupons Afiliado ML - popup */

const $ = id => document.getElementById(id);

const norm = s => (s ?? '').toString().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const brl = n => Number(n || 0).toLocaleString('pt-BR',
  { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const dataBR = iso => { const d = new Date(iso); return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR'); };
const dias = iso => { const d = new Date(iso); return isNaN(d) ? null : Math.ceil((d - Date.now()) / 86400000); };

const parseDesc = t => {
  const p = /([\d.,]+)\s*%/.exec(t || '');
  if (p) return { tipo: '%', valor: parseFloat(p[1].replace(',', '.')) };
  const r = /R\$\s*([\d.,]+)/.exec(t || '');
  if (r) return { tipo: 'R$', valor: parseFloat(r[1].replace(/\./g, '').replace(',', '.')) };
  return { tipo: '?', valor: 0 };
};

const pedir = msg => new Promise(res =>
  chrome.runtime.sendMessage(msg, r => res(r || { ok: false, erro: 'sem resposta' })));

let BASE = [], VISTA = [];

function preparar(indice) {
  BASE = (indice.lista || []).map(c => {
    const d = parseDesc(c.t);
    return {
      vendedor: c.v || '(sem nome)', titulo: c.t, tipo: d.tipo, desconto: d.valor,
      orcamento: c.o, vence: c.x, dias: dias(c.x), usado: c.u, id: c.i,
      busca: norm((c.v || '') + ' ' + (c.t || ''))
    };
  });
  const min = Math.round((Date.now() - indice.atualizadoEm) / 60000);
  $('info').textContent = `${BASE.length} cupons | atualizado ha ${min} min`
    + (indice.falhas ? ` | ${indice.falhas} pagina(s) falharam` : '');
}

function filtrar() {
  const termos = $('q').value.split(',').map(norm).filter(Boolean);
  const tipo = $('tipo').value;
  const min = parseFloat($('min').value);
  const ord = $('ord').value;

  VISTA = BASE.filter(c => {
    if (termos.length && !termos.some(t => c.busca.includes(t))) return false;
    if (tipo && c.tipo !== tipo) return false;
    if (!isNaN(min) && c.desconto < min) return false;
    return true;
  });

  VISTA.sort((a, b) => {
    if (ord === 'vendedor') return a.vendedor.localeCompare(b.vendedor, 'pt-BR');
    if (ord === 'dias') return (a.dias ?? 9e9) - (b.dias ?? 9e9);
    if (ord === 'orcamento') return b.orcamento - a.orcamento;
    if (a.tipo !== b.tipo) return a.tipo === '%' ? -1 : 1;
    return b.desconto - a.desconto;
  });

  render();
}

function render() {
  const LIM = 250;
  const linhas = VISTA.slice(0, LIM);
  if (!linhas.length) {
    $('lista').innerHTML = '<div class="vazio">Nenhum cupom bate com esse filtro.<br>'
      + 'Se o vendedor nao aparece, ele nao tem campanha ativa.</div>';
    return;
  }
  $('lista').innerHTML = `<table>
    <thead><tr><th>Desconto</th><th>Vendedor</th><th>Orcamento</th><th>Vence</th></tr></thead>
    <tbody>${linhas.map(c => `<tr>
      <td><b>${c.titulo || '-'}</b></td>
      <td><a href="https://www.mercadolivre.com.br/perfil/${encodeURIComponent(c.vendedor)}"
             target="_blank" rel="noopener">${c.vendedor}</a>${c.usado ? ' &bull;' : ''}</td>
      <td>${brl(c.orcamento)}</td>
      <td class="${c.dias !== null && c.dias <= 3 ? 'urg' : ''}">${dataBR(c.vence)}</td>
    </tr>`).join('')}</tbody></table>
    ${VISTA.length > LIM ? `<div class="vazio">Mostrando ${LIM} de ${VISTA.length}. Refine ou exporte o CSV.</div>` : ''}`;
}

function exportarCsv() {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const L = [['vendedor', 'desconto', 'tipo', 'valor', 'orcamento_restante', 'vence_em', 'dias', 'ja_gerado', 'id']
    .map(esc).join(';')];
  VISTA.forEach(c => L.push([c.vendedor, c.titulo, c.tipo, c.desconto, c.orcamento,
    dataBR(c.vence), c.dias, c.usado ? 'sim' : 'nao', c.id].map(esc).join(';')));
  const b = new Blob(['﻿' + L.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `cupons-afiliado-ml-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

async function carregar(forcar) {
  $('info').textContent = forcar ? 'baixando indice completo (cerca de 35s)...' : 'carregando...';
  const r = await pedir({ tipo: 'indice', forcar: !!forcar });
  if (!r.ok) {
    $('info').textContent = 'erro';
    $('lista').innerHTML = `<div class="vazio">${r.erro}<br><br>`
      + 'Abra o Mercado Livre e entre na sua conta de afiliado, depois clique em Atualizar.</div>';
    return;
  }
  preparar(r.dados);
  filtrar();
}

let t;
$('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(filtrar, 120); });
['tipo', 'min', 'ord'].forEach(id => $(id).addEventListener('input', filtrar));
$('csv').addEventListener('click', exportarCsv);
$('atualizar').addEventListener('click', () => carregar(true));

carregar(false);

/* ================================================================
   v1.2 — abas, caçador de produto e texto de venda
   ================================================================ */

document.querySelectorAll('.aba').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach(x => x.classList.toggle('ativa', x === b));
    $('painel-atender').hidden = b.dataset.aba !== 'atender';
    $('painel-cupons').hidden  = b.dataset.aba !== 'cupons';
    $('painel-cacar').hidden   = b.dataset.aba !== 'cacar';
    if (b.dataset.aba === 'cacar')   $('termo').focus();
    if (b.dataset.aba === 'atender') $('urlcli').focus();
  });
});

function escapar(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function tituloDoLink(u) {
  try {
    const p = decodeURIComponent(new URL(u).pathname);
    const s = p.replace(/^\/|\/p\/MLB\d+$/g, '').replace(/^MLB-\d+-/, '').replace(/-_JM$/, '');
    return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 78);
  } catch { return u.slice(0, 70); }
}

async function cacar() {
  const termo = $('termo').value.trim();
  if (!termo) return;
  $('btcacar').disabled = true;
  $('infoc').textContent = `buscando "${termo}" e checando os vendedores...`;
  $('listac').innerHTML = '';

  const t0 = performance.now();
  const r = await pedir({ tipo: 'cacar', termo, soFull: $('full').checked });
  $('btcacar').disabled = false;

  if (!r.ok) { $('infoc').textContent = 'erro: ' + r.erro; return; }

  const { achados, total } = r.dados;
  const seg = ((performance.now() - t0) / 1000).toFixed(1);
  $('infoc').textContent = `${achados.length} de ${total} anúncios são de loja com cupom (${seg}s)`;

  if (!achados.length) {
    $('listac').innerHTML = `<div class="vazio">Nenhuma loja com cupom vende isso agora.<br>
      Tente um termo mais amplo, ou desmarque "só entrega rápida".</div>`;
    return;
  }

  $('listac').innerHTML = achados.map((a, i) => `
    <div class="hit" data-i="${i}">
      <a href="${escapar(a.link)}" target="_blank" rel="noopener">${escapar(tituloDoLink(a.link))}</a>
      <div class="meta">
        <span class="cup">${escapar(a.cupom.titulo)}</span>
        ${escapar(a.vendedor)} · orçamento ${brl(a.cupom.orcamento)} · vence ${dataBR(a.cupom.vence)}
      </div>
      <button class="txt" data-i="${i}">gerar texto de venda</button>
      <div class="saida"></div>
    </div>`).join('');

  $('listac').querySelectorAll('button.txt').forEach(b => {
    b.addEventListener('click', async () => {
      const a = achados[+b.dataset.i];
      const saida = b.parentElement.querySelector('.saida');
      b.disabled = true; b.textContent = 'gerando...';
      const r2 = await pedir({
        tipo: 'texto',
        titulo: tituloDoLink(a.link),
        preco: 'ver no anúncio',
        cupom: a.cupom.titulo,
        canal: 'WhatsApp'
      });
      b.disabled = false; b.textContent = 'gerar texto de venda';
      saida.innerHTML = r2.ok
        ? `<pre>${escapar(r2.texto)}</pre>`
        : `<pre>${escapar(r2.erro)}</pre>`;
    });
  });
}

$('btcacar').addEventListener('click', cacar);
$('termo').addEventListener('keydown', e => { if (e.key === 'Enter') cacar(); });


/* ================================================================
   v1.3 — sincronia com o site
   ================================================================ */

async function mostrarStatusSincronia() {
  const r = await pedir({ tipo: 'statusSincronia' });
  const el = $('sincinfo');
  if (!el || !r.ok) return;
  if (!r.configurado) { el.textContent = 'Site: token de sincronia nao configurado (opcoes da extensao).'; return; }
  const u = r.ultima;
  if (!u) { el.textContent = 'Site: configurado, ainda sem sincronia.'; return; }
  const min = Math.round((Date.now() - u.quando) / 60000);
  el.textContent = u.erro
    ? `Site: falhou ha ${min} min — ${u.erro}`
    : `Site: ${u.total_agora} cupons, ${u.novos} novos, ${u.vencidos_removidos} vencidos removidos, ha ${min} min.`;
}

$('btsinc').addEventListener('click', async () => {
  const b = $('btsinc');
  b.disabled = true; b.textContent = 'sincronizando...';
  const r = await pedir({ tipo: 'sincronizar' });
  b.disabled = false; b.textContent = 'Sincronizar site';
  $('sincinfo').textContent = r.ok
    ? `Site atualizado: ${r.res.total_agora} cupons, ${r.res.novos} novos, ${r.res.vencidos_removidos} vencidos removidos.`
    : textoDoErro(r.erro);
});

/* O popup mostrava o codigo cru do erro, e "NAO_LOGADO" aparecia para quem
   estava logado. Codigo de erro e para o console; na tela vai o que a pessoa
   precisa saber e o que ela pode fazer a respeito. */
function textoDoErro(erro) {
  const e = String(erro || '');
  if (/NAO_LOGADO/.test(e)) {
    return 'Você não está logado no Mercado Livre neste navegador. Entre na sua conta e tente de novo.';
  }
  if (/CUPONS_RECUSADOS/.test(e)) {
    return 'O Mercado Livre recusou a lista de cupons agora (erro 403). Sua conta está logada e o gerador de links continua funcionando: é do lado deles. Tento de novo sozinho na próxima rodada.';
  }
  return 'Não consegui agora: ' + e;
}

mostrarStatusSincronia();


/* ================================================================
   v1.4 - Link do cliente entra, meu link sai
   ================================================================ */

function copiarPara(botao, texto, rotulo) {
  navigator.clipboard.writeText(texto).then(() => {
    const antes = botao.textContent;
    botao.textContent = 'copiado';
    setTimeout(() => { botao.textContent = antes; }, 1400);
  }).catch(() => { botao.textContent = 'falhou'; });
}

/* Mesma leitura do site: o cupom so e "bom" quando desconta de verdade neste
   preco. O resto e dito com todas as letras, sem enfeite. */
function blocoAvaliacao(d) {
  const c = d.cupom;
  if (!c) return { classe: 'neutro', txt: 'Hoje essa loja não tem cupom ativo. O link é seu do mesmo jeito.' };
  if (c.bloqueado) return { classe: 'ruim', txt: `Cupom de ${c.titulo} só vale acima de ${brl(c.minimo)}. Neste preço não entra.` };
  if (!d.temCupom && c.teto != null) return { classe: 'ruim', txt: `Cupom de ${c.titulo}, mas o desconto trava em ${brl(c.teto)}. Não vale destacar.` };
  if (!d.temCupom) return { classe: 'neutro', txt: `Cupom de ${c.titulo}, benefício pequeno neste item.` };
  return {
    classe: 'bom',
    txt: `Cupom de ${c.titulo} vale a pena: cerca de ${brl(c.economia)} de desconto.`
      + (c.minimo ? ` Mínimo de ${brl(c.minimo)}.` : '')
      + (c.teto != null ? ` Limite de ${brl(c.teto)}.` : '')
  };
}

/* Mensagem pronta para o cliente, com o link de afiliado e o codigo do cupom
   quando ele existe. Nunca leva a URL original: seria comissao perdida. */
function mensagemPronta(d) {
  const linhas = [];
  if (d.titulo) linhas.push(d.titulo);
  linhas.push(d.link);
  if (d.temCupom && d.cupom) {
    linhas.push('');
    linhas.push(d.codigoCupom
      ? `Cupom ${d.cupom.titulo}: cole o código ${d.codigoCupom} no carrinho.`
      : `A loja tem cupom de ${d.cupom.titulo}.`);
    if (d.cupom.minimo) linhas.push(`Vale em compras a partir de ${brl(d.cupom.minimo)}.`);
    if (d.cupom.teto != null) linhas.push(`O desconto vai até ${brl(d.cupom.teto)}.`);
  } else {
    linhas.push('');
    linhas.push('Hoje essa loja não tem cupom. Prefiro te dizer isso a inventar desconto.');
  }
  if (d.codigo) {
    linhas.push('');
    linhas.push(`Se o link não abrir no aplicativo, cole este código na busca: ${d.codigo}`);
  }
  return linhas.join('\n');
}

function mostrarAtendimento(d) {
  const box = escapar;
  const av = blocoAvaliacao(d);
  const msg = mensagemPronta(d);
  const el = document.createElement('div');
  el.className = 'res';
  el.innerHTML = `
    <div class="tit">${box(d.titulo || 'Anúncio sem título lido')}</div>
    ${d.preco != null ? `<div class="pre">${brl(d.preco)}</div>` : ''}
    <div class="meta">${box(d.vendedor || 'vendedor não identificado')}${d.id ? ' · ' + box(d.id) : ''}</div>
    <div class="aval ${av.classe}">${box(av.txt)}</div>
    ${d.codigoCupom ? `<div class="caixa-link">
      <input type="text" readonly value="${box(d.codigoCupom)}">
      <button class="pri" data-c="cupom">copiar código</button>
    </div>` : ''}
    <div class="caixa-link">
      <input type="text" readonly value="${box(d.link)}">
      <button class="pri" data-c="link">copiar link</button>
    </div>
    ${d.codigo ? `<div class="meta" style="margin-top:7px">código de busca: <b>${box(d.codigo)}</b></div>` : ''}
    <div class="msg">${box(msg)}</div>
    <button data-c="msg" style="margin-top:8px">copiar mensagem pronta</button>
    ${d.diagnostico ? `<div class="meta" style="margin-top:7px">leitura do anúncio: ${box(d.diagnostico)}</div>` : ''}
  `;
  el.querySelector('[data-c="link"]').addEventListener('click', e => copiarPara(e.target, d.link));
  el.querySelector('[data-c="msg"]').addEventListener('click', e => copiarPara(e.target, msg));
  const bc = el.querySelector('[data-c="cupom"]');
  if (bc) bc.addEventListener('click', e => copiarPara(e.target, d.codigoCupom));

  /* Mesma peca numa loja com cupom: é a recomendação principal quando a loja
     do anúncio não tem nada que preste. */
  const o = d.outraLoja;
  if (o) {
    const alt = document.createElement('div');
    alt.className = 'alt';
    const economia = o.economia != null ? ` · economia de ${brl(o.economia)}` : '';
    const final = o.final != null ? ` · sai por ${brl(o.final)}` : '';
    alt.innerHTML = `
      <div class="meta"><b>Mesmo produto, loja com cupom de verdade:</b></div>
      <div class="meta" style="margin-top:4px">
        <span class="cup">${box(o.cupomTitulo || 'cupom')}</span> ${box(o.vendedor || '')}
        ${o.preco != null ? ' · ' + brl(o.preco) : ''}${economia}${final}
      </div>
      <div class="caixa-link">
        <input type="text" readonly value="${box(o.link)}">
        <button class="pri" data-c="alt">copiar</button>
      </div>`;
    alt.querySelector('[data-c="alt"]').addEventListener('click', e => copiarPara(e.target, o.link));
    el.append(alt);
  } else if (d.procurouOutra) {
    const nada = document.createElement('div');
    nada.className = 'alt';
    nada.innerHTML = `<div class="meta">Procurei o mesmo produto em outras lojas e nenhuma tem cupom que compense.${
      d.motivoOutra ? ' Motivo: ' + box(d.motivoOutra) + '.' : ''
    }${d.varredura ? ` (${box(JSON.stringify(d.varredura))})` : ''}</div>`;
    el.append(nada);
  }

  const saida = $('saidaa');
  saida.textContent = '';
  saida.append(el);
}

async function atender() {
  const url = $('urlcli').value.trim();
  if (!url) return;
  const bt = $('btatender');
  bt.disabled = true; bt.textContent = 'gerando...';
  $('infoa').textContent = 'lendo o anúncio, conferindo o cupom real, criando o código e gerando o seu link...';
  $('saidaa').textContent = '';

  const t0 = performance.now();
  const r = await pedir({ tipo: 'atender', url, alternativas: $('altok').checked });
  bt.disabled = false; bt.textContent = 'Gerar meu link';

  if (!r.ok) {
    $('infoa').textContent = 'Não deu: ' + r.erro;
    return;
  }
  $('infoa').textContent = `pronto em ${((performance.now() - t0) / 1000).toFixed(1)}s`;
  mostrarAtendimento(r.dados);
}

$('btatender').addEventListener('click', atender);
$('urlcli').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) atender();
});
$('urlcli').addEventListener('paste', () => setTimeout(() => {
  if ($('urlcli').value.trim().length > 20) atender();
}, 60));

/* ------------------------------------------------ pausa de seguranca

   Quando o Mercado Livre pede captcha, a extensao pausa sozinha (5, 15, 60
   min). Daqui o Weslei resolve na mao e libera na hora: o botao 1 abre a
   pagina do desafio; ao sair do captcha a pausa cai sozinha, e o botao 2
   libera manualmente se precisar. */
async function mostrarFreio() {
  const r = await pedir({ tipo: 'estadoFreio' });
  const ativos = (r && r.ok && r.dados && r.dados.ativos) || [];
  $('freio').hidden = !ativos.length;
  if (!ativos.length) return;
  const nomes = { leitura: 'leitura de anúncios', etiqueta: 'criação de etiquetas', link: 'gerador de links' };
  $('freiotxt').textContent = ativos
    .map(a => `${nomes[a.area] || a.area}: volta em ${a.min} min (${a.motivo})`)
    .join(' · ');
}

$('btverif').addEventListener('click', async () => {
  $('btverif').textContent = 'Abrindo…';
  await pedir({ tipo: 'abrirVerificacao' });
  $('btverif').textContent = '1. Resolver verificação';
});

$('btliberar').addEventListener('click', async () => {
  $('btliberar').textContent = 'Liberando…';
  await pedir({ tipo: 'liberarFreio' });
  $('btliberar').textContent = 'Liberado';
  await mostrarFreio();
});

mostrarFreio();
