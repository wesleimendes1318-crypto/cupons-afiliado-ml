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

import { PALETAS, type PaletaCampanha, type TemaVisualId } from "@/lib/campanha-visual";

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
  /* Tema visual CONFIGURADO (ajuste manual; manda sobre a identificação
     pelo conteúdo). Sem ele, identificarTema decide pelo nome, descrição,
     categorias e produtos (src/lib/campanha-visual.ts). */
  temaVisual?: TemaVisualId;
  /* Textos do destaque (opcionais; sem eles, os do tema). */
  titulo?: string;
  tituloDestaque?: string;
  descricao?: string;
  /* Paleta (a do tema configurado). */
  tema: TemaCampanha;
};

/* Paleta da campanha: vem do sistema visual (src/lib/campanha-visual.ts). */
export type TemaCampanha = PaletaCampanha;

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
      /\b(brinquedos?|bonecas?|carrinho (de )?(controle|brinquedo|boneca|beb[eê])|carrinho el[eé]trico|lego|pistas? (de )?(carrinho|corrida|hot wheels|dinossauro)|pista hot wheels|pel[uú]cias?|quebra[- ]?cabe[cç]as?|jogos? de tabuleiro|patinetes?|bicicletas? infantil|bicicleta.{0,30}aro 1[246]|video ?games?|consoles?|nintendo|massinha|slime|squishy|hot ?wheels|barbie|infantil|kids|playmobil|baby alive|beyblade|kart el[eé]trico|moto el[eé]trica infantil|nerf|uno|pok[eé]mon|fisher[- ]?price|bonecos?|drone|polly|lol surprise|stitch|banco imobili[aá]rio|cara a cara|blocos? de montar)\b/i,
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
      /* +30 (Weslei, 05/10: "pelo menos 20 itens em cada vitrine sazonal"). */
      "lego star wars",
      "lego technic",
      "lego duplo",
      "hot wheels monster trucks",
      "hot wheels pista",
      "barbie boneca",
      "polly pocket",
      "boneca lol surprise",
      "nerf elite",
      "pelúcia stitch",
      "uno copag",
      "jogo banco imobiliário",
      "jogo cara a cara",
      "quebra-cabeça grow 1000 peças",
      "massinha play-doh",
      "kit slime",
      "bicicleta infantil aro 12",
      "drone infantil",
      "tablet infantil",
      "fisher-price",
      "tapete de atividades bebê",
      "blocos de montar magnéticos",
      "cozinha infantil",
      "boneco homem-aranha",
      "dinossauro de brinquedo",
      "pista dinossauro",
      "mini moto elétrica infantil",
      "beyblade",
      "carrinho de boneca",
      "patinete infantil",
    ],
    temaVisual: "criancas",
    tema: PALETAS.criancas,
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
    temaVisual: "black_friday",
    tema: PALETAS.black_friday,
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
      /\b(presente|kit (de )?(presente|natura|botic[aá]rio|perfume|maquiagem)|perfume|eau de (parfum|toilette)|col[oô]nia|necessaire|brinquedo|boneca?|lego|pel[uú]cia|fone|smartwatch|rel[oó]gio|carteira|bolsa|mochila|t[eê]nis|caixa de som|jbl|kindle|console|video ?game|panetone|chocolate|vinho|airpods?|watch|botic[aá]rio|natura|kaiak|malbec|lily|kindle|echo dot|alexa|air ?fryer|cafeteira|nespresso|secador|prancha|chapinha|maquiagem|havaianas|chinelo|panelas?|ta[cç]as?|nintendo|playstation|ps5|dualsense|egeo|carolina herrera|azzaro|ferrari)\b/i,
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
      /* +30 (Weslei, 05/10: "pelo menos 20 itens em cada vitrine sazonal"). */
      "perfume ferrari black",
      "egeo boticário",
      "essencial natura",
      "kit natura tododia",
      "kit presente boticário",
      "perfume good girl carolina herrera",
      "perfume azzaro pour homme",
      "relógio casio vintage",
      "smartwatch amazfit",
      "fone jbl tune 520bt",
      "jbl flip 6",
      "kindle paperwhite",
      "echo dot 5 geração",
      "air fryer mondial",
      "cafeteira nespresso",
      "havaianas",
      "mochila notebook",
      "carteira masculina couro",
      "bolsa feminina transversal",
      "tênis adidas",
      "jogo de panelas tramontina",
      "taças de vinho cristal",
      "nintendo switch",
      "controle dualsense ps5",
      "secador de cabelo",
      "prancha de cabelo",
      "kit maquiagem",
      "necessaire feminina",
      "panetone bauducco",
      "lego classic",
    ],
    temaVisual: "natal",
    tema: PALETAS.natal,
  },
];

/* Endereço da campanha de cada temporada na tabela campanhas (agente de
   campanhas e leitura da vitrine). */
export const SLUG_DA_TEMPORADA: Record<Temporada["id"], string> = {
  criancas: "dia-das-criancas",
  natal: "natal",
  black_friday: "black-friday",
};

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
