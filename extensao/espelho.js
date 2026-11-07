/* ESPELHO DE AFILIADO (Weslei, 04/11/2026; extensao 1.177.0).

   O painel /admin mostra comissao, pedidos e cliques dos portais de
   afiliado. Nenhum dos tres tem API aberta para isso: os numeros so
   aparecem na SESSAO LOGADA do proprio Weslei. Entao a extensao abre, numa
   aba de fundo, so os paineis das contas DELE e le o resumo da tela:
     - Mercado Livre: hub de afiliados (segue o link de relatorio/ganhos);
     - Amazon: associados.amazon.com.br/home (resumo do mes);
     - Shopee: affiliate.shopee.com.br/dashboard.

   Quando: no clique "Sincronizar vendas agora" do /admin (comando em
   admin_comandos_sinc, avisado pela ponte na hora ou pelo alarme de 1 min)
   e sozinha a cada 12 h. Sempre com a extensao parada (cliente primeiro) e
   sem freio. Login pedido ou verificacao = nao le e diz isso no painel.

   Sigilo: numeros e o trecho lido vao SO para gravar_metricas_afiliado
   (senha da extensao), que grava em tabelas que so a conta mestre le.
   Nunca vao para o diagnostico, que e de uso geral.

   Leitura pela tela: cada portal muda o layout quando quer. O trecho lido
   (rotulo + valor) volta para o /admin para conferir com o que se ve no
   portal; numero que nao achar fica vazio, nunca chutado. */

const AUTOMATICA_MS = 12 * 3600e3;

export const PAINEIS = [
  {
    marketplace: 'mercadolivre', nome: 'Mercado Livre',
    url: 'https://www.mercadolivre.com.br/afiliados/hub',
    dominio: /mercadolivre\.com\.br\/afiliados/i,
    seguir: /relat[oó]rio|desempenho|m[eé]tricas|resultados|meus ganhos|ganhos/i,
    seguirHref: /mercadolivre\.com\.br\/afiliados\//i
  },
  {
    marketplace: 'amazon', nome: 'Amazon',
    url: 'https://associados.amazon.com.br/home',
    dominio: /associados\.amazon\.com\.br/i
  },
  {
    marketplace: 'shopee', nome: 'Shopee',
    url: 'https://affiliate.shopee.com.br/dashboard',
    dominio: /affiliate\.shopee\.com\.br/i
  }
];

const RE_LOGIN = /\/jms\/|\/login|signin|\/ap\/|registration|\/buyer\/login|account\.shopee/i;

/* ---------------- funcoes puras (testadas) ---------------- */

/* Rotulos por campo, do mais especifico para o generico. Lidos de verdade
   em 05-06/11: o hub do ML tem "GANHOS / EXTRAS 18% R$ 349" (cartao de
   produto: preco com comissao extra, NAO e ganho) e "Ganho estimado R$ 0";
   a Amazon escreve "Total de comissões R$0.41" (ponto decimal) e o grafico
   de cliques solta "06Oct 09 12 15" (eixo, nao contagem). */
const CAMPOS = [
  { campo: 'aprovada_centavos', tipo: 'reais', re: /dispon[ií]ve(l|is)|aprovad|liberad|para (sacar|retirar)/i },
  { campo: 'pendente_centavos', tipo: 'reais', re: /pendente|em an[aá]lise|a liberar|em processamento/i },
  { campo: 'faturamento_centavos', tipo: 'reais', re: /faturamento|vendas geradas|valor (total )?(das |de |do )?(vendas|pedidos?)|gmv/i },
  { campo: 'comissao_centavos', tipo: 'reais', re: /ganhos? estimados?|ganhos? (totais|do m[eê]s)|total de comiss|comiss[aã]o (estimada|total)|^(ganhos?|comiss[oõ]es|earnings|receita)$/i },
  { campo: 'conversao_pct', tipo: 'pct', re: /convers[aã]o|taxa de convers/i },
  { campo: 'cliques', tipo: 'conta', re: /cliques|clicks/i },
  { campo: 'pedidos', tipo: 'conta', re: /^(pedidos|vendas|itens (pedidos|vendidos|enviados)|total de (produtos|itens) (pedidos|vendidos)|orders)\b/i }
];
const RE_ROTULO = new RegExp(CAMPOS.map(c => c.re.source.replace(/\^|\$/g, '')).join('|'), 'i');

function reaisEmCentavos(t) {
  const i = t.indexOf('R$');
  if (i < 0 || t.slice(0, i).includes('%')) return null;
  const resto = t.slice(i);
  const ponto = /^R\$\s*(\d+)\.(\d{2})(?![\d,])/.exec(resto);
  if (ponto) return Number(ponto[1]) * 100 + Number(ponto[2]);
  const m = /^R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?(?!\s*%)/.exec(resto);
  if (!m) return null;
  return Number(m[1].replace(/\./g, '')) * 100 + Number((m[2] || '0').padEnd(2, '0'));
}

const RE_INTEIRO = /^(\d{1,3}(?:\.\d{3})+|\d+)$/;
const inteiro = t => Number(t.replace(/\./g, ''));

/** Junta "R$" / "1.234" / "," / "56" quebrados em linhas. */
function corrido(ls) {
  return ls.join(' ').replace(/R\$\s+/g, 'R$ ').replace(/\s*,\s*(\d{2})\b/g, ',$1');
}

/** Le os numeros do resumo pelas linhas da tela. Dinheiro: o R$ tem de vir
    na linha do rotulo ou nas 4 seguintes, sem % antes (taxa de comissao).
    Contagem: "Cliques: 12" ou a 1a linha seguinte so com o numero.
    Primeiro achado de cada campo vale; nada achado = null (nunca chuta). */
export function lerResumoDoPainel(linhas) {
  const ls = (linhas || []).map(l => String(l || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = { comissao_centavos: null, aprovada_centavos: null, pendente_centavos: null,
    faturamento_centavos: null, conversao_pct: null, pedidos: null, cliques: null, achados: [] };
  ls.forEach((l, k) => {
    if (l.length > 60 || !RE_ROTULO.test(l)) return;
    const c = CAMPOS.find(x => x.re.test(l) && out[x.campo] == null);
    if (!c) return;
    const resto = l.replace(c.re, ' ').trim();
    const seguintes = [];
    for (let j = k + 1; j < Math.min(ls.length, k + 5) && !RE_ROTULO.test(ls[j]); j++) seguintes.push(ls[j]);
    let valor = null; let visto = '';
    if (c.tipo === 'reais') {
      visto = corrido([resto, ...seguintes]);
      valor = reaisEmCentavos(visto);
    } else if (c.tipo === 'pct') {
      visto = corrido([resto, ...seguintes.slice(0, 2)]);
      const m = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/.exec(visto);
      valor = m ? Number(m[1].replace(',', '.')) : null;
    } else {
      const proprio = /^[:\s]*(\d{1,3}(?:\.\d{3})+|\d+)$/.exec(resto);
      if (proprio) { valor = inteiro(proprio[1]); visto = resto; }
      else if (seguintes[0] && RE_INTEIRO.test(seguintes[0])) { valor = inteiro(seguintes[0]); visto = seguintes[0]; }
    }
    if (valor != null) {
      out[c.campo] = valor;
      if (out.achados.length < 14) out.achados.push({ rotulo: l.slice(0, 60), valor: visto.slice(0, 80) });
    }
  });
  return out;
}

/** Junta duas leituras: a primeira vale, a segunda so preenche o que faltou. */
export function juntarLeituras(a, b) {
  const out = { ...a, achados: [...(a.achados || [])] };
  for (const k of Object.keys(b)) {
    if (k === 'achados' || out[k] != null) continue;
    out[k] = b[k];
  }
  for (const x of b.achados || []) if (!out.achados.some(y => y.rotulo === x.rotulo)) out.achados.push(x);
  return out;
}

export function deveRodarSozinha(ultima, agora = Date.now()) {
  return !ultima || agora - ultima >= AUTOMATICA_MS;
}

/* ---------------- leitura na aba (sessao logada) ---------------- */

async function lerTela() {
  const espera = ms => new Promise(r => setTimeout(r, ms));
  for (let k = 0; k < 4; k++) { window.scrollBy(0, window.innerHeight); await espera(700); }
  window.scrollTo(0, 0);
  const linhas = (document.body.innerText || '').split('\n').map(l => l.trim()).filter(Boolean)
    .slice(0, 800).map(l => l.slice(0, 120));
  const links = [...document.querySelectorAll('a[href]')].slice(0, 300)
    .map(a => ({ t: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60), h: a.href }));
  return { linhas, links };
}

async function lerPainel(p, dep) {
  const { sleep, esperarCarregar, ehCaptcha } = dep;
  let aba = null;
  try {
    aba = await chrome.tabs.create({ url: p.url, active: false });
    await esperarCarregar(aba.id, 25000);
    await sleep(5000);
    const confere = async () => {
      const fim = (await chrome.tabs.get(aba.id)).url || '';
      if (ehCaptcha('', fim)) return { status: 'verificacao' };
      if (RE_LOGIN.test(fim) && !p.dominio.test(fim)) return { status: 'sem_login' };
      if (!p.dominio.test(fim)) return { status: 'pagina_inesperada' };
      return null;
    };
    const ruim = await confere();
    if (ruim) return ruim;
    const ler = async () => {
      const [s] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: lerTela });
      return (s && s.result) || { linhas: [], links: [] };
    };
    let tela = await ler();
    let r = lerResumoDoPainel(tela.linhas);
    const links = tela.links.filter(l => p.seguirHref && p.seguirHref.test(l.h) && l.t).map(l => l.t).slice(0, 20);
    /* Mercado Livre: alem do hub, abre a pagina de relatorio/ganhos do
       proprio portal (navegacao GET, nada clicado) e completa o que faltou. */
    if (p.seguir) {
      const alvo = tela.links.find(l => p.seguir.test(l.t) && p.seguirHref.test(l.h) && l.h.split('#')[0] !== p.url);
      if (alvo) {
        await chrome.tabs.update(aba.id, { url: alvo.h });
        await esperarCarregar(aba.id, 25000);
        await sleep(5000);
        const ruim2 = await confere();
        if (!ruim2) {
          tela = await ler();
          r = juntarLeituras(lerResumoDoPainel(tela.linhas), r);
        }
      }
    }
    r.links_portal = links;
    const temNumero = ['comissao_centavos', 'aprovada_centavos', 'pendente_centavos', 'pedidos', 'cliques'].some(k => r[k] != null);
    return { status: temNumero ? 'lido' : 'sem_numeros', ...r,
      pagina: ((await chrome.tabs.get(aba.id)).url || '').split('?')[0].slice(0, 120) };
  } catch (e) {
    return { status: 'erro', erro: String((e && e.message) || e).slice(0, 120) };
  } finally {
    if (aba) { try { await chrome.tabs.remove(aba.id); } catch (e) { /* ja fechada */ } }
  }
}

let rodando = false;

/** dep: { token, sleep, esperarCarregar, ehCaptcha, freioLigado, ocupado,
    comandoPendente(token), gravar(token, dados) } */
export async function sincronizarEspelho(dep) {
  if (rodando || dep.ocupado()) return { pulou: true };
  const comando = await dep.comandoPendente(dep.token).catch(() => null);
  const { espelhoUltimo } = await chrome.storage.local.get('espelhoUltimo');
  if (!comando && !deveRodarSozinha(espelhoUltimo)) return { pulou: true };
  if (await dep.freioLigado('leitura')) {
    if (comando) await dep.gravar(dep.token, { comando_id: comando.id, fim: true, erro: 'Leitura em pausa (verificação do Mercado Livre). Tente de novo mais tarde.' }).catch(() => {});
    return { freio: true };
  }
  rodando = true;
  await chrome.storage.local.set({ espelhoUltimo: Date.now() });
  const id = comando ? comando.id : null;
  const resultado = [];
  try {
    for (const p of PAINEIS) {
      if (dep.ocupado()) break;
      await dep.gravar(dep.token, { comando_id: id, etapa: `Lendo ${p.nome}...` }).catch(() => {});
      const r = await lerPainel(p, dep);
      resultado.push({ marketplace: p.marketplace, ...r });
      if (r.status === 'verificacao') break;
      await dep.sleep(2500);
    }
    return await dep.gravar(dep.token, { comando_id: id, fim: true, marketplaces: resultado });
  } catch (e) {
    await dep.gravar(dep.token, { comando_id: id, fim: true, marketplaces: resultado, erro: String(e.message).slice(0, 160) }).catch(() => {});
    return { erro: e.message };
  } finally {
    rodando = false;
  }
}
