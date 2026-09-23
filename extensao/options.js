const $ = id => document.getElementById(id);

chrome.storage.local.get(['geminiKey', 'geminiModel', 'sincToken', 'sincAuto', 'ntfyTopico'], d => {
  if (d.ntfyTopico) $('ntfy').value = d.ntfyTopico;
  if (d.geminiKey) $('key').value = d.geminiKey;
  if (d.geminiModel) $('modelo').value = d.geminiModel;
  if (d.sincToken) $('sinc').value = d.sincToken;
  $('sincauto').checked = d.sincAuto !== false;
});

$('salvar').addEventListener('click', () => {
  chrome.storage.local.set({
    geminiKey: $('key').value.trim(),
    geminiModel: $('modelo').value,
    sincToken: $('sinc').value.trim(),
    sincAuto: $('sincauto').checked,
    ntfyTopico: $('ntfy').value.trim().replace(/[^A-Za-z0-9_-]/g, '')
  }, () => {
    $('ok').textContent = 'Salvo. Pode fechar esta aba.';
    setTimeout(() => $('ok').textContent = '', 3500);
  });
});
