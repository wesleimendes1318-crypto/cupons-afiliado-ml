/* Título da PÁGINA DE VERIFICAÇÃO (27/10): a leitura abriu o muro do Mercado
   Livre e "Por segurança, complete esta etapa" virou o nome do produto colado,
   termo de busca e item da vitrine. Nunca é nome de produto. Mesma regra da
   extensão (extensao/comparador.js, ehTituloDeDesafio) e do banco
   (produto_permitido). */
const RE_TITULO_DESAFIO =
  /^\s*(por seguran.a,? complete esta etapa|confirme que voc. n.o . um rob.|verifica..o de seguran.a|robot check|just a moment|attention required|access denied|acesso negado)/i;

export const ehTituloDeDesafio = (t: unknown): boolean =>
  typeof t === "string" && RE_TITULO_DESAFIO.test(t);
