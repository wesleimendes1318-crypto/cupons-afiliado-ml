/* AVALIAÇÃO DAS PESSOAS (Weslei, 10/10: "adicione a avaliação das pessoas,
   como mais um símbolo de convencimento"). A extensão (1.164.0) lê no evento
   do próprio anúncio a nota média e o total de avaliações que a página
   mostra ({ nota, total }). Aqui só se confere e se escreve: sem o dado, nada
   aparece (nunca inventa nem arredonda para cima). */

export type Avaliacoes = { nota: number; total: number };

export function avaliacoesValidas(a: unknown): Avaliacoes | null {
  if (!a || typeof a !== "object") return null;
  const { nota, total } = a as { nota?: unknown; total?: unknown };
  if (typeof nota !== "number" || !Number.isFinite(nota) || nota <= 0 || nota > 5) return null;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 1) return null;
  return { nota: Math.floor(nota * 10) / 10, total };
}

export function notaEscrita(a: Avaliacoes): string {
  return a.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function totalEscrito(a: Avaliacoes): string {
  return `${a.total.toLocaleString("pt-BR")} ${a.total === 1 ? "avaliação" : "avaliações"}`;
}

/* "Nota 4,9 de 5, 5.056 avaliações" (leitor de tela e title). */
export function rotuloDasAvaliacoes(a: Avaliacoes): string {
  return `Nota ${notaEscrita(a)} de 5, ${totalEscrito(a)}`;
}

/* Bot e canal: "⭐ 4,9 de 5 (5.056 avaliações)". */
export function linhaDasAvaliacoes(a: unknown): string | null {
  const v = avaliacoesValidas(a);
  return v ? `⭐ ${notaEscrita(v)} de 5 (${totalEscrito(v)})` : null;
}
