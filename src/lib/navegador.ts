/* Identificador aleatório deste navegador, para "Meus preços" (28/09). Não é
   dado pessoal: não tem nome, e-mail nem conta; some se a pessoa limpar os
   dados do site. */
const CHAVE = "melhorescolha-navegador";

export function idDoNavegador(): string | null {
  try {
    const atual = localStorage.getItem(CHAVE);
    if (atual && /^[0-9a-f-]{36}$/i.test(atual)) return atual;
    const novo = crypto.randomUUID();
    localStorage.setItem(CHAVE, novo);
    return novo;
  } catch {
    return null;
  }
}
