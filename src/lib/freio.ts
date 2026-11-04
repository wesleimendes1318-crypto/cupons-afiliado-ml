/* Freio simples em memória por chave (endereço, e-mail): no máximo `max`
   usos por janela. shortcut: vale por instância do servidor, como os outros
   freios do site; se o envio for abusado mesmo assim, guardar no banco. */
export function criarFreio(max: number, janelaMs: number) {
  const usos = new Map<string, number[]>();
  return (chave: string, agora = Date.now()) => {
    const recentes = (usos.get(chave) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= max) {
      usos.set(chave, recentes);
      return true;
    }
    recentes.push(agora);
    usos.set(chave, recentes);
    if (usos.size > 5_000)
      for (const [k, v] of usos) if (!v.some((t) => agora - t < janelaMs)) usos.delete(k);
    return false;
  };
}
