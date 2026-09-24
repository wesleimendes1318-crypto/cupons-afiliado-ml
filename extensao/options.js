const $ = id => document.getElementById(id);

/* POR QUE ESTA PAGINA GANHOU TANTA VERIFICACAO.

   O Weslei colou as chaves, clicou em Salvar e nada foi salvo, sem uma palavra
   na tela. A versao anterior confiava que o clique sempre chegava ao fim: se
   chrome.storage falhasse, o callback nunca rodava e a pagina continuava
   exatamente igual, como se ninguem tivesse clicado.

   E ha um jeito novo de isso acontecer, que fui eu quem criou: desde a 1.51.0 a
   extensao se recarrega sozinha quando chega versao nova no disco. Toda aba de
   Opcoes que estivesse aberta nesse instante fica com o contexto morto. O
   chrome.storage entao lanca "Extension context invalidated", e antes isso
   sumia no silencio.

   Agora: todo acesso ao storage vai em try/catch, o erro aparece na tela em
   portugues, e depois de salvar a pagina LE DE VOLTA o que ficou gravado. So
   diz "Salvo" quando conferiu que salvou. */

/* ABERTA COMO ARQUIVO, ESTA PAGINA NAO E A EXTENSAO.

   O Weslei abriu C:/cupons-afiliado-ml/extensao/options.html com dois cliques.
   A barra de endereco mostrava "Arquivo". Numa pagina file:// o chrome.storage
   nao existe, entao nao havia onde salvar: clicar em Salvar nao podia dar certo
   de jeito nenhum, e a pagina nao dizia isso.

   Pior: os campos apareciam preenchidos com pontinhos, o que parecia que os
   valores tinham carregado. Era o autopreenchimento do proprio Chrome.

   Agora a pagina detecta isso antes de qualquer coisa, desliga o botao e
   explica o caminho certo. */
function ehPaginaDaExtensao() {
  try {
    return location.protocol === 'chrome-extension:'
      && typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
  } catch (e) { return false; }
}

function travarPorEstarSoltaNoDisco() {
  const b = $('salvar');
  if (b) { b.disabled = true; b.textContent = 'Abra pelo Chrome, nao pelo arquivo'; }
  for (const id of ['key', 'sinc', 'ntfy', 'modelo', 'sincauto']) {
    const el = $(id);
    if (el) { el.disabled = true; el.value = ''; }
  }
  const el = $('ok');
  if (el) {
    el.style.color = '#c0392b';
    el.style.whiteSpace = 'pre-line';
    el.textContent =
      'Esta pagina foi aberta como ARQUIVO do disco, e assim ela nao consegue salvar nada: '
      + 'o armazenamento da extensao so existe quando a pagina e aberta pelo Chrome.\n\n'
      + 'Abra deste jeito:\n'
      + '1. Clique com o botao direito no icone da extensao, na barra do Chrome.\n'
      + '2. Escolha "Opcoes".\n\n'
      + 'Ou por chrome://extensions, botao Detalhes no "Conferidor de Cupons", '
      + 'e depois "Opcoes da extensao".\n\n'
      + 'O endereco certo comeca com chrome-extension:// e nao com C:/ nem file://.';
  }
}

function avisar(texto, ehErro) {
  const el = $('ok');
  if (!el) return;
  el.textContent = texto;
  el.style.color = ehErro ? '#c0392b' : '';
  if (!ehErro) setTimeout(() => { el.textContent = ''; }, 3500);
}

/* Contexto morto e o caso mais comum depois de uma atualizacao automatica, e a
   solucao e trivial: recarregar a aba. So que ninguem adivinha isso sozinho. */
function contextoMorto(e) {
  return /Extension context invalidated|context invalidated|receiving end does not exist/i
    .test(String((e && e.message) || e));
}

const CAMPOS = ['geminiKey', 'geminiModel', 'sincToken', 'sincAuto', 'ntfyTopico'];

function lerStorage() {
  return new Promise((ok, falha) => {
    try {
      chrome.storage.local.get(CAMPOS, d => {
        const e = chrome.runtime.lastError;
        if (e) falha(new Error(e.message)); else ok(d || {});
      });
    } catch (e) { falha(e); }
  });
}

function gravarStorage(dados) {
  return new Promise((ok, falha) => {
    try {
      chrome.storage.local.set(dados, () => {
        const e = chrome.runtime.lastError;
        if (e) falha(new Error(e.message)); else ok();
      });
    } catch (e) { falha(e); }
  });
}

async function carregar() {
  try {
    const d = await lerStorage();
    if (d.ntfyTopico) $('ntfy').value = d.ntfyTopico;
    if (d.geminiKey) $('key').value = d.geminiKey;
    if (d.geminiModel) $('modelo').value = d.geminiModel;
    if (d.sincToken) $('sinc').value = d.sincToken;
    $('sincauto').checked = d.sincAuto !== false;
  } catch (e) {
    avisar(contextoMorto(e)
      ? 'Esta aba ficou velha porque a extensao se atualizou. Aperte F5 para recarregar e tente de novo.'
      : 'Nao consegui ler o que estava salvo: ' + ((e && e.message) || e), true);
  }
}

$('salvar').addEventListener('click', async () => {
  const b = $('salvar');
  b.disabled = true;
  try {
    const querido = {
      geminiKey: $('key').value.trim(),
      geminiModel: $('modelo').value,
      sincToken: $('sinc').value.trim(),
      sincAuto: $('sincauto').checked,
      ntfyTopico: $('ntfy').value.trim().replace(/[^A-Za-z0-9_-]/g, '')
    };

    await gravarStorage(querido);

    /* A CONFERENCIA QUE FALTAVA. Gravar sem erro nao prova que ficou gravado.
       Le de volta e compara antes de dizer qualquer coisa. */
    const salvo = await lerStorage();
    const bateu = salvo.geminiKey === querido.geminiKey
               && salvo.sincToken === querido.sincToken
               && salvo.geminiModel === querido.geminiModel
               && salvo.ntfyTopico === querido.ntfyTopico
               && (salvo.sincAuto !== false) === querido.sincAuto;

    if (!bateu) {
      avisar('Cliquei em salvar mas ao reler o valor voltou diferente. Aperte F5 e tente de novo.', true);
      return;
    }

    const temToken = Boolean(querido.sincToken);
    avisar(temToken
      ? 'Salvo e conferido. O token de sincronia esta guardado.'
      : 'Salvo e conferido. O token de sincronia ficou vazio, entao o site nao vai ser alimentado.');
  } catch (e) {
    avisar(contextoMorto(e)
      ? 'Esta aba ficou velha porque a extensao se atualizou sozinha. Aperte F5 para recarregar, cole de novo e salve.'
      : 'Nao consegui salvar: ' + ((e && e.message) || e), true);
  } finally {
    b.disabled = false;
  }
});

if (ehPaginaDaExtensao()) {
  carregar();
} else {
  travarPorEstarSoltaNoDisco();
}
