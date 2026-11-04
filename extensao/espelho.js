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

const RE_COMISSAO = /ganhos|comiss[aã]o|receita|earnings|rendimento/i;
const RE_PEDIDOS = /pedidos|vendas|itens (pedidos|vendidos|enviados)|convers[oõ]es|orders/i;
const RE_CLIQUES = /cliques|clicks/i;
const RE_ROTULO = new RegExp([RE_COMISSAO, RE_PEDIDOS, RE_CLIQUES].map(r => r.source).join('|'), 'i');

function reaisEmCentavos(t) {
  const m = /R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?(?!\s*%)/.exec(t);
  if (!m) return null;
  return Number(m[1].replace(/\./g, '')) * 100 + Number((m[2] || '0').padEnd(2, '0'));
}

function contagem(t) {
  if (/R\$|%/.test(t)) return null;
  const m = /(?:^|\s)(\d{1,3}(?:\.\d{3})+|\d+)(?:\s|$)/.exec(t);
  return m ? Number(m[1].replace(/\./g, '')) : null;
}

/** Junta "R$" / "1.234" / "," / "56" quebrados em linhas. */
function corrido(ls) {
  return ls.join(' ').replace(/R\$\s+/g, 'R$ ').replace(/\s*,\s*(\d{2})\b/g, ',$1');
}

/** Le comissao (centavos), pedidos e cliques das linhas da tela. O valor
    tem de estar na linha do rotulo ou nas 4 seguintes, antes de outro
    rotulo. Primeiro achado vale (o resumo fica no topo dos portais). */
export function lerResumoDoPainel(linhas) {
  const ls = (linhas || []).map(l => String(l || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = { comissao_centavos: null, pedidos: null, cliques: null, achados: [] };
  ls.forEach((l, k) => {
    if (!RE_ROTULO.test(l) || l.length > 60) return;
    const janela = [l.replace(RE_ROTULO, ' ')];
    for (let j = k + 1; j < Math.min(ls.length, k + 5) && !RE_ROTULO.test(ls[j]); j++) janela.push(ls[j]);
    const texto = corrido(janela);
    let campo = null; let valor = null;
    if (RE_COMISSAO.test(l) && !/taxa|%|extra/i.test(l) && out.comissao_centavos == null) {
      valor = reaisEmCentavos(texto); campo = 'comissao_centavos';
    } else if (RE_CLIQUES.test(l) && out.cliques == null) {
      valor = janela.map(contagem).find(v => v != null) ?? null; campo = 'cliques';
    } else if (RE_PEDIDOS.test(l) && out.pedidos == null) {
      valor = janela.map(contagem).find(v => v != null) ?? null; campo = 'pedidos';
    }
    if (campo && valor != null) {
      out[campo] = valor;
      if (out.achados.length < 12) out.achados.push({ rotulo: l.slice(0, 60), valor: texto.slice(0, 80) });
    }
  });
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
    /* Mercado Livre: o resumo de ganhos fica numa pagina do portal ligada
       ao hub. Segue so link do proprio portal (navegacao GET, nada clicado). */
    if (p.seguir && r.comissao_centavos == null) {
      const alvo = tela.links.find(l => p.seguir.test(l.t) && p.seguirHref.test(l.h) && l.h.split('#')[0] !== p.url);
      if (alvo) {
        await chrome.tabs.update(aba.id, { url: alvo.h });
        await esperarCarregar(aba.id, 25000);
        await sleep(5000);
        const ruim2 = await confere();
        if (ruim2) return ruim2;
        tela = await ler();
        const r2 = lerResumoDoPainel(tela.linhas);
        if (r2.achados.length >= r.achados.length) r = r2;
      }
    }
    const temNumero = r.comissao_centavos != null || r.pedidos != null || r.cliques != null;
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
