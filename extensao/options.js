const $ = id => document.getElementById(id);

chrome.storage.local.get(['geminiKey', 'geminiModel', 'sincToken', 'sincAuto'], d => {
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
    sincAuto: $('sincauto').checked
  }, () => {
    $('ok').textContent = 'Salvo. Pode fechar esta aba.';
    setTimeout(() => $('ok').textContent = '', 3500);
  });
});
