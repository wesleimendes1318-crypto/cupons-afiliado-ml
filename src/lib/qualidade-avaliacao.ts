/* QUALIDADE PRIMEIRO NAS VITRINES (Weslei, 18/10: "Garanta sempre produtos
   com qualidade!!!!! Boas avaliações etc. precisa encantar quem olha").
   Régua única das vitrines (geral, categorias, mais vendidos, brinquedos,
   campanhas) e do canal, com a nota que a página do próprio anúncio mostra
   (lida pela extensão ou na comparação):
   - nota abaixo de 4,5: fora;
   - página lida e sem nenhuma avaliação: fora (qualidade não comprovada);
   - nota ainda não lida: fora das vitrines de produtos comparados (a
     comparação já lê a nota); nos mais vendidos (lista oficial, lidos aos
     poucos) fica depois dos bem avaliados;
   - entre os bem avaliados, a nota pesa junto com o número de avaliações
     (média bayesiana): 5,0 com 1 avaliação não passa na frente de 4,8 com
     5 mil.
   Nunca inventa nota: sem leitura, nada de estrela nem selo. */
import type { Avaliacoes } from "@/lib/avaliacoes";

export const NOTA_MINIMA = 4.5;
/* "Muito bem avaliado" no cartão: nota alta com volume de opiniões. */
export const SELO_NOTA = 4.8;
export const SELO_TOTAL = 50;
/* Canal (vai para todo mundo): pelo menos 5 avaliações. */
export const MINIMO_AVALIACOES_CANAL = 5;
/* Peso da média de partida (4,5) na nota ponderada. */
const PESO_PARTIDA = 10;

export type Veredito = "boa" | "fraca" | "sem" | "desconhecida";
export type ResumoQualidade =
  { avaliacoes: Avaliacoes | null; sem?: boolean | null } | null | undefined;

export function vereditoDaAvaliacao(r: ResumoQualidade): Veredito {
  const a = r?.avaliacoes;
  if (a) return a.nota >= NOTA_MINIMA ? "boa" : "fraca";
  return r?.sem ? "sem" : "desconhecida";
}

/** Nota baixa ou nenhuma avaliação: nunca aparece. */
export function reprovadaPelaAvaliacao(r: ResumoQualidade): boolean {
  const v = vereditoDaAvaliacao(r);
  return v === "fraca" || v === "sem";
}

/** Entra na vitrine? exigirNota: só com nota boa já lida. */
export function passaNaQualidade(r: ResumoQualidade, exigirNota: boolean): boolean {
  const v = vereditoDaAvaliacao(r);
  return v === "boa" || (!exigirNota && v === "desconhecida");
}

/** Nota ponderada pelo número de avaliações (0 = sem nota boa). */
export function pontuacaoDaAvaliacao(r: ResumoQualidade): number {
  const a = r?.avaliacoes;
  if (!a || a.nota < NOTA_MINIMA) return 0;
  return (a.nota * a.total + NOTA_MINIMA * PESO_PARTIDA) / (a.total + PESO_PARTIDA);
}

/** Bem avaliados primeiro; dentro de cada grupo, a ordem que já vinha. */
export function bemAvaliadosPrimeiro<T>(lista: T[], resumoDe: (x: T) => ResumoQualidade): T[] {
  return lista
    .map((x, i) => ({ x, i, boa: vereditoDaAvaliacao(resumoDe(x)) === "boa" }))
    .sort((a, b) => Number(b.boa) - Number(a.boa) || a.i - b.i)
    .map((e) => e.x);
}

/** Selo do cartão: só com a nota e o volume lidos na página. */
export function seloDeAvaliacao(r: ResumoQualidade): string | null {
  const a = r?.avaliacoes;
  return a && a.nota >= SELO_NOTA && a.total >= SELO_TOTAL ? "Muito bem avaliado" : null;
}

/** Canal: nota boa com volume; sem nota lida, só loja oficial. */
export function aprovadaParaCanal(a: Avaliacoes | null, lojaOficial: boolean): boolean {
  if (!a) return lojaOficial;
  return a.nota >= NOTA_MINIMA && a.total >= MINIMO_AVALIACOES_CANAL;
}
