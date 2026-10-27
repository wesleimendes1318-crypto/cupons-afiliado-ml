/* Resultados da busca por texto (27/10): o mesmo anúncio uma vez só, e a
   nota lida decide quem vai na frente. */
import type { ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";

/** Todos os MLB do endereço: o mesmo anúncio ou produto é um cartão só. */
export const idsDoEndereco = (u: string) =>
  (
    u
      .toUpperCase()
      .replace(/-/g, "")
      .match(/MLB\d{6,}/g) ?? []
  ).filter(Boolean);

/** Junta as listas na ordem, sem repetir anúncio ou produto. */
export function mesclarSemRepetir<T>(listas: T[][], url: (i: T) => string): T[] {
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const lista of listas)
    for (const i of lista) {
      const ids = idsDoEndereco(url(i));
      const chave = ids.length ? ids : [url(i)];
      if (chave.some((k) => vistos.has(k))) continue;
      chave.forEach((k) => vistos.add(k));
      saida.push(i);
    }
  return saida;
}

/** Nota acima de 4,5 na frente, sem nota no meio, nota menor no fim. */
export function faixaDaNota(r: ResumoAvaliacoes | undefined): 0 | 1 | 2 {
  const nota = r?.avaliacoes?.nota;
  if (nota == null) return 1;
  return nota > 4.5 ? 0 : 2;
}
