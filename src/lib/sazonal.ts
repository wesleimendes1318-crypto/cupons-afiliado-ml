/* ESTRATÉGIA SAZONAL (Weslei, 05/10: "use estratégias sazonais, em breve
   haverá Natal"). Calendário único usado pela coleta de mercado, pelo
   preparo e pelo garimpo do canal, pela vitrine e pelo "Acompanhar preço".
   Datas no horário de Brasília. Nada aqui inventa preço ou desconto: a
   temporada só muda PRIORIDADE (o que comparar e mostrar primeiro) e o
   rótulo; as regras de economia, qualidade, frete e afiliado continuam as
   mesmas.

   - Dia das Crianças (12/10): brinquedos e jogos.
   - Black Friday (última sexta de novembro, 27/11/2026): eletrônicos,
     celulares, informática e eletrodomésticos; o diferencial é mostrar se
     o desconto é de verdade (histórico do "Acompanhar preço").
   - Natal (25/12): presentes (brinquedos, beleza/perfumes, eletrônicos,
     esportes). */

export type Temporada = {
  id: "criancas" | "black_friday" | "natal";
  nome: string;
  emoji: string;
  /* Primeiro e último dia (Brasília, inclusive). */
  inicio: string;
  fim: string;
  /* Dia da data em si, para a contagem ("faltam N dias"). */
  dia: string;
  /* Categorias do Mercado Livre acompanhadas na coleta durante a temporada. */
  categorias: ReadonlyArray<{ id: string; nome: string }>;
  /* Produto que combina com a temporada (pelo título). */
  termos: RegExp;
  /* Rótulo curto no canal e na vitrine. */
  rotulo: string;
};

export const TEMPORADAS: readonly Temporada[] = [
  {
    id: "criancas",
    nome: "Dia das Crianças",
    emoji: "🧸",
    inicio: "2026-09-28",
    fim: "2026-10-12",
    dia: "2026-10-12",
    categorias: [{ id: "MLB1132", nome: "Brinquedos e Hobbies" }],
    termos:
      /\b(brinquedo|boneca?|carrinho|lego|pista|pel[uú]cia|quebra[- ]?cabe[cç]a|jogo de tabuleiro|patinete|bicicleta infantil|video ?game|console|controle (ps|xbox)|nintendo|massinha|slime|squishy|dinossauro|hot ?wheels|barbie|infantil|kids)\b/i,
    rotulo: "Para o Dia das Crianças",
  },
  {
    id: "black_friday",
    nome: "Black Friday",
    emoji: "🖤",
    inicio: "2026-11-01",
    fim: "2026-11-30",
    dia: "2026-11-27",
    categorias: [
      { id: "MLB1000", nome: "Eletrônicos, Áudio e Vídeo" },
      { id: "MLB1648", nome: "Informática" },
    ],
    termos:
      /\b(smart ?tv|tv \d|notebook|celular|smartphone|iphone|galaxy|fone|headphone|airpods?|smartwatch|rel[oó]gio inteligente|tablet|ipad|console|playstation|xbox|air ?fryer|fritadeira|geladeira|refrigerador|lava ?(e seca|roupas)|micro-?ondas|aspirador|ar[- ]condicionado|monitor|ssd|mem[oó]ria)\b/i,
    rotulo: "Black Friday: preço conferido",
  },
  {
    id: "natal",
    nome: "Natal",
    emoji: "🎄",
    inicio: "2026-11-15",
    fim: "2026-12-24",
    dia: "2026-12-25",
    categorias: [
      { id: "MLB1132", nome: "Brinquedos e Hobbies" },
      { id: "MLB1000", nome: "Eletrônicos, Áudio e Vídeo" },
    ],
    termos:
      /\b(presente|kit|perfume|eau de (parfum|toilette)|col[oô]nia|necessaire|brinquedo|boneca?|lego|pel[uú]cia|fone|smartwatch|rel[oó]gio|carteira|bolsa|mochila|t[eê]nis|caixa de som|jbl|kindle|console|video ?game|panetone|chocolate|vinho|airpods?)\b/i,
    rotulo: "Ideia de presente de Natal",
  },
];

/** Dia de hoje em Brasília (AAAA-MM-DD). */
export function hojeEmBrasilia(agora = new Date()) {
  return agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Temporadas em andamento (pode haver duas ao mesmo tempo, ex.: Black Friday e Natal). */
export function temporadasAtivas(agora = new Date()): Temporada[] {
  const hoje = hojeEmBrasilia(agora);
  return TEMPORADAS.filter((t) => hoje >= t.inicio && hoje <= t.fim);
}

/** A temporada em andamento que combina com o produto (pelo título), se houver. */
export function temporadaDoProduto(
  titulo: string | null | undefined,
  agora = new Date(),
): Temporada | null {
  if (!titulo) return null;
  return temporadasAtivas(agora).find((t) => t.termos.test(titulo)) ?? null;
}

/** Dias até a data (0 no próprio dia). */
export function diasAte(t: Temporada, agora = new Date()) {
  const hoje = Date.parse(`${hojeEmBrasilia(agora)}T12:00:00Z`);
  const dia = Date.parse(`${t.dia}T12:00:00Z`);
  return Math.max(0, Math.round((dia - hoje) / 86_400_000));
}
