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
  /* Nunca entra (Weslei, 05/10: "diferencie automotivo de brinquedos"):
     peça e acessório de carro/moto não é brinquedo, salvo sinal infantil. */
  exclui?: RegExp;
  /* Rótulo curto no canal e na vitrine. */
  rotulo: string;
  /* Rótulo antes de a janela abrir (temporada em destaque antecipado). */
  rotuloAntecipado: string;
  /* Mostrar e publicar ofertas ANTES da janela abrir? Natal e Dia das
     Crianças sim (antecedência é economia); Black Friday não (Weslei,
     05/10: as lojas ainda não entraram na campanha; antes dela, só a
     contagem de dias). */
  ofertasAntecipadas: boolean;
  /* Página da categoria sazonal no site (Natal e Dia das Crianças). */
  pagina?: "/natal" | "/dia-das-criancas";
  /* Buscas de produtos de valor mais alto no catálogo oficial (tarefa
     sazonal): onde a economia de verdade aparece (os mais vendidos baratos
     quase nunca têm o mesmo produto bem mais barato, medido em 05/10). */
  buscas: readonly string[];
  /* Tema visual da campanha (cores próprias, sem marca de terceiros).
     Trocar cores e ilustração de uma campanha futura = editar só isto e a
     arte em src/components/ArteSazonal.tsx. */
  tema: TemaCampanha;
};

export type TemaCampanha = {
  /* Fundo da seção (degradês, sem imagem). */
  fundo: string;
  /* Texto principal e secundário sobre o fundo (contraste AA conferido). */
  texto: string;
  textoSuave: string;
  /* Cor de ação (botões) e o texto sobre ela. */
  destaque: string;
  sobreDestaque: string;
  /* Segunda cor da campanha (detalhes da arte, números grandes). */
  realce: string;
  /* Cor de texto pequeno de destaque (selos, contagem) com contraste AA
     sobre o fundo. */
  rotulo: string;
  /* Pílulas e áreas translúcidas sobre o fundo. */
  superficie: string;
  borda: string;
  /* Pontos de luz / decoração. */
  brilho: string;
  /* Decoração de fundo: neve, confete ou pontos de luz. */
  decoracao: "neve" | "confete" | "luzes";
  /* Compatibilidade (pílula antiga). */
  chip: string;
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
      /\b(brinquedos?|bonecas?|carrinho (de )?(controle|brinquedo|boneca|beb[eê])|carrinho el[eé]trico|lego|pistas? (de )?(carrinho|corrida|hot wheels|dinossauro)|pista hot wheels|pel[uú]cias?|quebra[- ]?cabe[cç]as?|jogos? de tabuleiro|patinetes?|bicicletas? infantil|bicicleta.{0,30}aro 1[246]|video ?games?|consoles?|nintendo|massinha|slime|squishy|hot ?wheels|barbie|infantil|kids|playmobil|baby alive|beyblade|kart el[eé]trico|moto el[eé]trica infantil)\b/i,
    exclui:
      /\b(freio|pneus?|rela[cç][aã]o|retentor|amortecedor|farol|retrovisor|para-?choque|palheta|[oó]leo (de )?motor|escapamento|rastreador|bateria automotiva|carregador de bateria|cavalete|capacete|intercomunicador|automotiv[oa]|veicular)\b/i,
    rotulo: "Para o Dia das Crianças",
    rotuloAntecipado: "Antecipe o Dia das Crianças",
    ofertasAntecipadas: true,
    pagina: "/dia-das-criancas",
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
      fundo:
        "radial-gradient(90% 85% at 92% 0%, #ffe6a3 0%, rgba(255,230,163,0) 58%), linear-gradient(160deg, #fff9ea 0%, #fff4df 45%, #e6f2ff 100%)",
      texto: "#1d1d1f",
      textoSuave: "#4a4a52",
      destaque: "#0071e3",
      sobreDestaque: "#ffffff",
      realce: "#ff7a59",
      rotulo: "#0058b0",
      superficie: "rgba(255,255,255,0.78)",
      borda: "rgba(0,113,227,0.16)",
      brilho: "#ffc93c",
      decoracao: "confete",
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
    ofertasAntecipadas: false,
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
      fundo:
        "radial-gradient(80% 90% at 88% 0%, rgba(122,92,255,0.42) 0%, rgba(122,92,255,0) 60%), radial-gradient(60% 60% at 0% 100%, rgba(122,92,255,0.18) 0%, rgba(122,92,255,0) 70%), linear-gradient(160deg, #121218 0%, #1a1a23 60%, #14141b 100%)",
      texto: "#f4f2ff",
      textoSuave: "rgba(244,242,255,0.74)",
      destaque: "#7a5cff",
      sobreDestaque: "#ffffff",
      realce: "#c8b8ff",
      rotulo: "#d4c8ff",
      superficie: "rgba(255,255,255,0.07)",
      borda: "rgba(160,138,255,0.38)",
      brilho: "#b9a6ff",
      decoracao: "luzes",
      chip: "#26232f",
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
      /\b(presente|kit (de )?(presente|natura|botic[aá]rio|perfume|maquiagem)|perfume|eau de (parfum|toilette)|col[oô]nia|necessaire|brinquedo|boneca?|lego|pel[uú]cia|fone|smartwatch|rel[oó]gio|carteira|bolsa|mochila|t[eê]nis|caixa de som|jbl|kindle|console|video ?game|panetone|chocolate|vinho|airpods?|watch|botic[aá]rio|natura|kaiak|malbec|lily|kindle)\b/i,
    rotulo: "Ideia de presente de Natal",
    rotuloAntecipado: "Presente de Natal antecipado",
    ofertasAntecipadas: true,
    pagina: "/natal",
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
      fundo:
        "radial-gradient(85% 90% at 90% 0%, rgba(217,180,90,0.22) 0%, rgba(217,180,90,0) 58%), radial-gradient(70% 70% at 0% 100%, rgba(194,65,59,0.16) 0%, rgba(194,65,59,0) 70%), linear-gradient(160deg, #0b3125 0%, #0f3d2e 55%, #0d3628 100%)",
      texto: "#f7f0e1",
      textoSuave: "rgba(247,240,225,0.8)",
      destaque: "#e2bf66",
      sobreDestaque: "#1b2a22",
      realce: "#d2453f",
      rotulo: "#f0d48a",
      superficie: "rgba(247,240,225,0.09)",
      borda: "rgba(226,191,102,0.38)",
      brilho: "#f6dd94",
      decoracao: "neve",
      chip: "#163f31",
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

/** Temporadas que podem ter ofertas hoje: em andamento, ou antecipadas
    quando a estratégia é antecipar (Natal, Dia das Crianças). */
export function temporadasComOfertas(agora = new Date()): Temporada[] {
  return temporadasEmDestaque(agora).filter((t) => !antecipada(t, agora) || t.ofertasAntecipadas);
}

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
  const lista = temporadasComOfertas(agora);
  const combina = lista.filter((t) => combinaComTemporada(t, titulo));
  return combina.find((t) => !antecipada(t, agora)) ?? combina[0] ?? null;
}

/** Dias até a data (0 no próprio dia). */
export function diasAte(t: Temporada, agora = new Date()) {
  const hoje = Date.parse(`${hojeEmBrasilia(agora)}T12:00:00Z`);
  const dia = Date.parse(`${t.dia}T12:00:00Z`);
  return Math.max(0, Math.round((dia - hoje) / 86_400_000));
}

/** O título combina com a temporada (termos) e não cai na exclusão
    (peça/acessório automotivo não é brinquedo). */
export function combinaComTemporada(t: Temporada, titulo: string) {
  return t.termos.test(titulo) && !(t.exclui && t.exclui.test(titulo));
}
