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
    : 'Erro: ' + r.erro;
});

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

function blocoAvaliacao(d) {
  const a = d.avaliacao;
  if (!d.cupom) return { classe: 'neutro', txt: 'Esta loja não tem cupom de afiliado ativo agora. O link é seu do mesmo jeito.' };
  if (!a) return { classe: 'neutro', txt: `Loja com cupom de ${d.cupom.titulo}. Não consegui conferir as condições.` };
  if (a.bloqueado) return { classe: 'ruim', txt: `Cupom de ${d.cupom.titulo} só vale acima de ${brl(a.minimo)}. Neste preço não entra.` };
  if (!a.vale && a.teto != null) return { classe: 'ruim', txt: `Cupom de ${d.cupom.titulo}, mas o desconto trava em ${brl(a.teto)}. Não vale destacar.` };
  if (!a.vale) return { classe: 'neutro', txt: `Cupom de ${d.cupom.titulo}, benefício pequeno neste item.` };
  return { classe: 'bom', txt: `Cupom de ${d.cupom.titulo} vale a pena: cerca de ${brl(a.economia)} de desconto.`
    + (a.minimo ? ` Mínimo de ${brl(a.minimo)}.` : '') };
}

function mostrarAtendimento(d) {
  const box = escapar;
  const av = blocoAvaliacao(d);
  const el = document.createElement('div');
  el.className = 'res';
  el.innerHTML = `
    <div class="tit">${box(d.titulo || 'Anúncio do Mercado Livre')}</div>
    ${d.preco != null ? `<div class="pre">${brl(d.preco)}</div>` : ''}
    <div class="meta">${box(d.vendedor || 'vendedor não identificado')}${d.id ? ' · ' + box(d.id) : ''}</div>
    <div class="aval ${av.classe}">${box(av.txt)}</div>
    <div class="caixa-link">
      <input type="text" readonly value="${box(d.link)}">
      <button class="pri" data-c="link">copiar</button>
    </div>
    ${d.codigo ? `<div class="meta" style="margin-top:7px">código de busca: <b>${box(d.codigo)}</b></div>` : ''}
    <div class="msg">${box(d.mensagem)}</div>
    <button data-c="msg" style="margin-top:8px">copiar mensagem pronta</button>
  `;
  el.querySelector('[data-c="link"]').addEventListener('click', e => copiarPara(e.target, d.link));
  el.querySelector('[data-c="msg"]').addEventListener('click', e => copiarPara(e.target, d.mensagem));

  if (d.alternativas && d.alternativas.length) {
    const alt = document.createElement('div');
    alt.className = 'alt';
    alt.innerHTML = `<div class="meta">Mesmo produto em loja com cupom:</div>`;
    d.alternativas.forEach(a => {
      const linha = document.createElement('div');
      linha.style.marginTop = '7px';
      linha.innerHTML = `<a href="${box(a.link)}" target="_blank" rel="noopener">${box(tituloDoLink(a.link))}</a>
        <div class="meta"><span class="cup">${box(a.cupom.titulo)}</span> ${box(a.vendedor)}</div>`;
      const b = document.createElement('button');
      b.textContent = 'gerar meu link desta';
      b.style.marginTop = '5px';
      b.addEventListener('click', async () => {
        b.disabled = true; b.textContent = 'gerando...';
        const r = await pedir({ tipo: 'linkDe', url: a.link });
        b.disabled = false;
        if (r.ok) { b.textContent = 'copiar ' + r.link; b.onclick = () => copiarPara(b, r.link); }
        else b.textContent = 'erro: ' + r.erro;
      });
      linha.append(b);
      alt.append(linha);
    });
    el.append(alt);
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
  $('infoa').textContent = 'limpando o link, identificando a loja e gerando o seu link...';
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
