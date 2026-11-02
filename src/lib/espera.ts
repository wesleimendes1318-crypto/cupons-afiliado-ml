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

/* ESPERA DO LINK COLADO (Weslei, 02/11: "transformar a espera em prova do
   esforço"). A etapa acesa continua sendo a REAL, vinda do banco; dentro
   dela, frases curtas do que aquela etapa faz de fato trocam a cada 4 s.
   Regra: só entra frase que o sistema realmente faz (nada de "centenas de
   ofertas"); frete só com o CEP da pessoa, porque sem ele não há simulação. */
export const TROCA_MICRO_MS = 4000;
export const TROCA_DICA_MS = 6000;

export function microEstadosDoLink(fase: string, cep: string | null): string[] {
  switch (fase) {
    case "enviando":
      return ["Enviando o link", "Conferindo as ofertas deste produto"];
    case "na-fila":
      return [
        "Lendo o anúncio",
        "Conferindo a ficha técnica e a foto",
        "Lendo o preço no Pix e no parcelado",
      ];
    case "outras-lojas":
      return [
        "Procurando o mesmo produto em outras lojas",
        "Conferindo se é o mesmo produto, não um parecido",
        ...(cep ? [`Simulando o frete para o CEP ${cep}`] : []),
        "Lendo as avaliações de cada loja",
      ];
    case "lendo":
      return ["Gerando seus links de compra", "Montando sua recomendação"];
    default:
      return ["Conferindo seu produto"];
  }
}

export type Dica = { tipo: "preco" | "nota" | "frete" | "aviso" | "pix"; texto: string };

/* Cada dica descreve uma regra que está no código (recomendacao-segura,
   preco-suspeito, ordenarPorCustoTotal, Pix x parcelado do anúncio). */
export function dicasDaEspera(cep: string | null): Dica[] {
  return [
    {
      tipo: "preco",
      texto:
        "O mesmo produto costuma ter vendedores com preços diferentes. Por isso a comparação vem antes da compra.",
    },
    { tipo: "nota", texto: "Vendedor com nota abaixo de 4,5 nunca vira a nossa recomendação." },
    ...(cep
      ? [
          {
            tipo: "frete" as const,
            texto:
              "Quando o frete para o seu CEP aparece, ele entra na conta de qual loja sai mais barata.",
          },
        ]
      : []),
    {
      tipo: "aviso",
      texto:
        "Preço muito abaixo das outras lojas ganha aviso para você conferir o vendedor antes de comprar.",
    },
    {
      tipo: "pix",
      texto: "Pix e parcelado aparecem separados: você vê quanto paga em cada forma.",
    },
  ];
}

/** "45s" ou "1min 05s". */
export function formatarSegundos(n: number): string {
  return n >= 60 ? `${Math.floor(n / 60)}min ${String(n % 60).padStart(2, "0")}s` : `${n}s`;
}

/** Texto do relógio pelo tempo REAL (percentil 75 do banco). Sem medição,
    só o tempo decorrido; passado o usual, a barra vira pulso, sem número. */
export function relogioDaEspera(
  passou: number,
  estimativa: { segundos: number; amostras: number } | null,
): { titulo: string; nota: string | null; pct: number | null } {
  if (!estimativa || estimativa.segundos <= 0) {
    return { titulo: `Comparando há ${formatarSegundos(passou)}`, nota: null, pct: null };
  }
  const falta = estimativa.segundos - passou;
  if (falta > 0) {
    return {
      titulo: `Pronto em cerca de ${formatarSegundos(falta)}`,
      nota: `Previsão pelo tempo real das últimas ${estimativa.amostras} consultas.`,
      pct: Math.round((passou / estimativa.segundos) * 100),
    };
  }
  return {
    titulo: "Finalizando a conferência das lojas…",
    nota: `Já são ${formatarSegundos(passou)}. O resultado aparece aqui sozinho.`,
    pct: null,
  };
}
