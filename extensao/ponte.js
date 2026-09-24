/* Ponte entre o site e a extensao
   ===============================
   O gargalo real do tempo de espera era o alarme: o Chrome nao deixa um alarme
   rodar em menos de 1 minuto, entao um pedido feito logo depois de um ciclo
   esperava ate 60 segundos parado antes de alguem olhar para ele.

   Aqui o site avisa na hora. A pagina dispara um postMessage, este content
   script escuta e chama o service worker, que sai atendendo. A espera cai de
   "ate 60s" para "o tempo de ler o anuncio e gerar o link".

   Cuidado de origem: so aceita mensagem da propria janela e do proprio site.
   Nao ha dado sensivel nessa mensagem - e so um "tem pedido novo" - mas o
   filtro evita que outra aba qualquer faca a extensao trabalhar. */

/* Enderecos do site: o antigo (lovable.app) e o dominio proprio. */
const SITES = ['https://cupons-afiliado-ml.lovable.app', 'https://melhorescolha.io', 'https://www.melhorescolha.io'];

window.addEventListener('message', (evento) => {
  if (evento.source !== window) return;
  if (!SITES.includes(evento.origin)) return;
  const dado = evento.data;
  if (!dado || dado.de !== 'cupons-afiliado-ml' || dado.tipo !== 'pedido-novo') return;

  try {
    chrome.runtime.sendMessage({ tipo: 'atenderAgora' }, () => {
      // A extensao pode estar reiniciando; o alarme de 1 min cobre esse caso.
      void chrome.runtime.lastError;
    });
  } catch (e) { /* sem extensao ativa: o alarme resolve */ }
});

// Deixa o site saber que a extensao esta viva, para ajustar o texto de espera.
if (SITES.includes(window.location.origin)) {
  window.postMessage({ de: 'extensao-cupons-ml', tipo: 'pronta' }, window.location.origin);
}
