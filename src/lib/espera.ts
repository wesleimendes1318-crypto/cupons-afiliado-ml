/* ESPERA ATIVA (Weslei, 02/11: "fiquei esperando muito tempo, não soube
   quanto"; "técnicas psicológicas que deem a impressão de espera rápida").
   A barra anda pelo tempo, rápida no começo e cada vez mais devagar, e nunca
   passa de 90% antes da resposta: não mostra número nem promete prazo. As
   etapas descrevem o que a busca faz; o tempo decorrido é o real. */

/** Fração da barra (0 a 0,9) depois de `ms` de espera: 40% em 0,3 s, 80%
    em 2 s e depois cada vez mais devagar, sem passar de 90%. */
export function progressoDaEspera(ms: number): number {
  const s = Math.max(0, ms) / 1000;
  if (s <= 0.3) return 0.4 * (s / 0.3);
  if (s <= 2) return 0.4 + 0.4 * ((s - 0.3) / 1.7);
  return 0.9 - 0.1 * Math.exp(-(s - 2) / 6);
}

/* Troca a cada 1,5 s no começo (Weslei, 02/11). */
export const ETAPAS_DA_ESPERA = [
  { desde: 0, texto: "Identificando o produto e compatibilidade…" },
  { desde: 1.5, texto: "Consultando lojas e conferindo disponibilidade…" },
  { desde: 3, texto: "Filtrando opções com boa reputação e frete rápido…" },
  { desde: 6, texto: "Quase pronto: organizando as melhores opções para você…" },
] as const;

/** Índice da etapa depois de `ms` de espera. */
export function etapaDaEspera(ms: number): number {
  const s = ms / 1000;
  let i = 0;
  ETAPAS_DA_ESPERA.forEach((e, k) => {
    if (s >= e.desde) i = k;
  });
  return i;
}
