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
  /* Rótulo antes de a janela abrir (temporada em destaque antecipado). */
  rotuloAntecipado: string;
  /* Buscas de produtos de valor mais alto no catálogo oficial (tarefa
     sazonal): onde a economia de verdade aparece (os mais vendidos baratos
     quase nunca têm o mesmo produto bem mais barato, medido em 05/10). */
  buscas: readonly string[];
  /* Tema visual da seção no site (cores próprias, sem marca de terceiros). */
  tema: { fundo: string; texto: string; destaque: string; chip: string };
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
      /\b(brinquedo|boneca?|carrinho|lego|pista|pel[uú]cia|quebra[- ]?cabe[cç]a|jogo de tabuleiro|patinete|bicicleta infantil|video ?game|console|controle (ps|xbox)|nintendo|massinha|slime|squishy|dinossauro|hot ?wheels|barbie|infantil|kids|playmobil|aro 16|baby alive)\b/i,
    rotulo: "Para o Dia das Crianças",
    rotuloAntecipado: "Antecipe o Dia das Crianças",
    buscas: [
      "lego classic caixa criativa",
      "lego city",
      "lego friends",
      "hot wheels garagem",
      "bicicleta caloi aro 16",
      "nintendo switch oled",
      "boneca baby alive",
      "barbie dreamhouse",
      "patinete 3 rodas",
      "carrinho controle remoto 4x4",
      "playmobil",
      "jogo de tabuleiro estrela",
    ],
    tema: {
      fundo: "linear-gradient(135deg,#fff6d6 0%,#e3f1ff 100%)",
      texto: "#1d1d1f",
      destaque: "#0071e3",
      chip: "#ffffff",
    },
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
    rotuloAntecipado: "Antes da Black Friday: preço conferido",
    buscas: [
      "smart tv samsung 50 4k",
      "smart tv lg 50 4k",
      "air fryer mondial",
      "air fryer philips walita",
      "jbl flip 6",
      "jbl tune 520bt",
      "amazfit bip",
      "notebook lenovo ideapad 3",
      "monitor lg 24",
      "aspirador robô xiaomi",
    ],
    tema: {
      fundo: "linear-gradient(135deg,#0b0b0f 0%,#22222b 100%)",
      texto: "#f5f5f7",
      destaque: "#e8c468",
      chip: "#2c2c35",
    },
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
      /\b(presente|kit|perfume|eau de (parfum|toilette)|col[oô]nia|necessaire|brinquedo|boneca?|lego|pel[uú]cia|fone|smartwatch|rel[oó]gio|carteira|bolsa|mochila|t[eê]nis|caixa de som|jbl|kindle|console|video ?game|panetone|chocolate|vinho|airpods?|watch|botic[aá]rio|natura|kaiak|malbec|lily|kindle)\b/i,
    rotulo: "Ideia de presente de Natal",
    rotuloAntecipado: "Presente de Natal antecipado",
    buscas: [
      "perfume 212 vip men",
      "perfume la vie est belle",
      "kaiak natura 100ml",
      "malbec boticário 100ml",
      "kit lily boticário",
      "jbl go 4",
      "kindle 11 geração",
      "apple watch se",
      "tênis nike revolution",
      "fone jbl wave buds",
    ],
    tema: {
      fundo: "linear-gradient(135deg,#0f3d2e 0%,#5c1a26 100%)",
      texto: "#fdf8f0",
      destaque: "#f2c76e",
      chip: "#1d4a3a",
    },
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

/** Temporadas em destaque: as em andamento e as que começam em até
    `diasAntes` dias (antecipadas), na ordem da data. */
export function temporadasEmDestaque(agora = new Date(), diasAntes = 45): Temporada[] {
  const hoje = hojeEmBrasilia(agora);
  const limite = hojeEmBrasilia(new Date(agora.getTime() + diasAntes * 86_400_000));
  return TEMPORADAS.filter((t) => hoje <= t.fim && t.inicio <= limite).sort((a, b) =>
    a.dia.localeCompare(b.dia),
  );
}

export const antecipada = (t: Temporada, agora = new Date()) => hojeEmBrasilia(agora) < t.inicio;

/** Rótulo certo para hoje (em andamento ou antecipado). */
export const rotuloDa = (t: Temporada, agora = new Date()) =>
  antecipada(t, agora) ? t.rotuloAntecipado : t.rotulo;

/** A temporada em destaque que combina com o produto (pelo título), se
    houver; a em andamento tem preferência. */
export function temporadaDoProduto(
  titulo: string | null | undefined,
  agora = new Date(),
): Temporada | null {
  if (!titulo) return null;
  const lista = temporadasEmDestaque(agora);
  const combina = lista.filter((t) => t.termos.test(titulo));
  return combina.find((t) => !antecipada(t, agora)) ?? combina[0] ?? null;
}

/** Dias até a data (0 no próprio dia). */
export function diasAte(t: Temporada, agora = new Date()) {
  const hoje = Date.parse(`${hojeEmBrasilia(agora)}T12:00:00Z`);
  const dia = Date.parse(`${t.dia}T12:00:00Z`);
  return Math.max(0, Math.round((dia - hoje) / 86_400_000));
}
