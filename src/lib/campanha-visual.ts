/* SISTEMA VISUAL DAS CAMPANHAS (Weslei, 05/10: "uma vitrine que identifique
   o tema de cada campanha e adapte suas artes, símbolos, cores e
   composição... precisa funcionar também para outras datas, categorias e
   campanhas"; "quando não houver informação suficiente, aplique uma
   composição neutra e elegante da marca").

   Cada tema reúne paleta, textos padrão, arte (cena vetorial própria em
   src/components/ArteCampanha.tsx ou uma imagem salva em public/campanhas/)
   e configuração de movimento. A identificação é por campanha, uma a uma
   (campanhas simultâneas não se misturam):
     1. tema configurado na campanha (ajuste manual) manda;
     2. senão, o CONTEÚDO: nome e descrição (peso 3), categorias (peso 2) e
        a parte dos produtos que combina com o tema (até 4 pontos);
     3. o calendário só soma 1 ponto ao tema da data em andamento (estar em
        outubro não faz toda campanha virar Dia das Crianças);
     4. sem vencedor claro (menos de 3 pontos ou empate), tema neutro. */

export type TemaVisualId =
  "criancas" | "natal" | "black_friday" | "tecnologia" | "casa" | "beleza" | "neutro";

export type PaletaCampanha = {
  /* Fundo da seção (degradês, sem imagem). */
  fundo: string;
  /* Texto principal e secundário sobre o fundo (contraste AA conferido). */
  texto: string;
  textoSuave: string;
  /* Cor de ação (botões) e o texto sobre ela. */
  destaque: string;
  sobreDestaque: string;
  /* Segunda cor (detalhes da arte, palavra em destaque do título). */
  realce: string;
  /* Texto pequeno de destaque (selos, contagem) com contraste AA. */
  rotulo: string;
  /* Pílulas e áreas translúcidas sobre o fundo. */
  superficie: string;
  borda: string;
  /* Pontos de luz / decoração. */
  brilho: string;
  decoracao: "neve" | "confete" | "luzes";
  chip: string;
  /* Fundo do cartão-convite e da área da arte. */
  cartao: string;
};

export type TemaVisual = {
  id: TemaVisualId;
  nome: string;
  paleta: PaletaCampanha;
  /* Título curto em duas partes (a segunda em destaque) e descrição de uma
     linha. Sempre o que o site entrega: comparação, não promessa. */
  titulo: string;
  tituloDestaque: string;
  descricao: string;
  /* Arte salva (gerada uma vez e reutilizada nas visitas). Sem ela, a cena
     vetorial do tema. Dimensões reservadas para não deslocar a página. */
  /* estudio: cenário 3D de estúdio com fundo ripado (Weslei, 05/10: "as
     artes devem ter como base esses exemplos"), sem texto na imagem, num
     quadro com a proporção da arte e movimento lento de câmera + reflexo. */
  imagem?: { src: string; largura: number; altura: number; estudio?: boolean };
  /* Movimento: só a entrada suave da arte e respostas nos botões/cartões;
     nada contínuo disputando com preços. */
  movimento: "entrada" | "nenhum";
  /* Palavras que indicam o tema no nome, descrição, categorias e produtos. */
  palavras: RegExp;
  /* Janela do calendário que soma 1 ponto (MM-DD, inclusive). */
  calendario?: { de: string; ate: string };
};

const P = {
  /* Lilás do estúdio da arte (Weslei, 05/10). */
  criancas: {
    fundo:
      "radial-gradient(70% 90% at 100% 0%, #d9ccff 0%, rgba(217,204,255,0) 60%), radial-gradient(60% 70% at 0% 100%, #e6deff 0%, rgba(230,222,255,0) 70%), linear-gradient(165deg, #f6f2ff 0%, #efe9ff 50%, #ebe6fb 100%)",
    texto: "#24124f",
    textoSuave: "#4b3f6b",
    destaque: "#0071e3",
    sobreDestaque: "#ffffff",
    realce: "#c2410c",
    rotulo: "#4c2bb3",
    superficie: "rgba(255,255,255,0.78)",
    borda: "rgba(108,79,214,0.2)",
    brilho: "#ffc93c",
    decoracao: "confete",
    chip: "#ffffff",
    cartao: "rgba(255,255,255,0.72)",
  },
  natal: {
    fundo:
      "radial-gradient(85% 90% at 90% 0%, rgba(217,180,90,0.22) 0%, rgba(217,180,90,0) 58%), radial-gradient(70% 70% at 0% 100%, rgba(194,65,59,0.16) 0%, rgba(194,65,59,0) 70%), linear-gradient(160deg, #0b3125 0%, #0f3d2e 55%, #0d3628 100%)",
    texto: "#f7f0e1",
    textoSuave: "rgba(247,240,225,0.8)",
    destaque: "#e2bf66",
    sobreDestaque: "#1b2a22",
    realce: "#f0d48a",
    rotulo: "#f0d48a",
    superficie: "rgba(247,240,225,0.09)",
    borda: "rgba(226,191,102,0.38)",
    brilho: "#f6dd94",
    decoracao: "neve",
    chip: "#163f31",
    cartao: "rgba(247,240,225,0.08)",
  },
  black_friday: {
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
    cartao: "rgba(255,255,255,0.06)",
  },
  tecnologia: {
    fundo:
      "radial-gradient(70% 90% at 100% 0%, #dfe9ff 0%, rgba(223,233,255,0) 60%), radial-gradient(50% 60% at 0% 100%, #ece6ff 0%, rgba(236,230,255,0) 70%), linear-gradient(165deg, #f7f9fd 0%, #eef3fb 100%)",
    texto: "#1d1d1f",
    textoSuave: "#4a4f5c",
    destaque: "#0071e3",
    sobreDestaque: "#ffffff",
    realce: "#5b5bd6",
    rotulo: "#0058b0",
    superficie: "rgba(255,255,255,0.8)",
    borda: "rgba(0,113,227,0.16)",
    brilho: "#8fb8ff",
    decoracao: "luzes",
    chip: "#ffffff",
    cartao: "rgba(255,255,255,0.72)",
  },
  casa: {
    fundo:
      "radial-gradient(70% 90% at 100% 0%, #f6e3cf 0%, rgba(246,227,207,0) 60%), radial-gradient(50% 60% at 0% 100%, #e5eddf 0%, rgba(229,237,223,0) 70%), linear-gradient(165deg, #fbf7f1 0%, #f4ece2 100%)",
    texto: "#2b2420",
    textoSuave: "#5a4f47",
    destaque: "#2f6b4f",
    sobreDestaque: "#ffffff",
    realce: "#b5643c",
    rotulo: "#7a4a2a",
    superficie: "rgba(255,255,255,0.78)",
    borda: "rgba(122,74,42,0.18)",
    brilho: "#f2c27a",
    decoracao: "luzes",
    chip: "#ffffff",
    cartao: "rgba(255,255,255,0.7)",
  },
  beleza: {
    fundo:
      "radial-gradient(70% 90% at 100% 0%, #fbd9e4 0%, rgba(251,217,228,0) 60%), radial-gradient(50% 60% at 0% 100%, #f1e4fb 0%, rgba(241,228,251,0) 70%), linear-gradient(165deg, #fff7f9 0%, #fbeff4 100%)",
    texto: "#2a1d24",
    textoSuave: "#5c4852",
    destaque: "#a3285f",
    sobreDestaque: "#ffffff",
    realce: "#c2456f",
    rotulo: "#8e2a57",
    superficie: "rgba(255,255,255,0.8)",
    borda: "rgba(163,40,95,0.16)",
    brilho: "#f7b6cb",
    decoracao: "luzes",
    chip: "#ffffff",
    cartao: "rgba(255,255,255,0.72)",
  },
  neutro: {
    fundo:
      "radial-gradient(70% 90% at 100% 0%, #e3eefc 0%, rgba(227,238,252,0) 60%), linear-gradient(165deg, #ffffff 0%, #f5f5f7 100%)",
    texto: "#1d1d1f",
    textoSuave: "#4a4a52",
    destaque: "#0071e3",
    sobreDestaque: "#ffffff",
    realce: "#0071e3",
    rotulo: "#0058b0",
    superficie: "rgba(255,255,255,0.85)",
    borda: "rgba(0,0,0,0.08)",
    brilho: "#9cc6ff",
    decoracao: "luzes",
    chip: "#ffffff",
    cartao: "rgba(255,255,255,0.8)",
  },
} satisfies Record<TemaVisualId, PaletaCampanha>;

export const PALETAS: Record<TemaVisualId, PaletaCampanha> = P;

export const TEMAS_VISUAIS: Record<TemaVisualId, TemaVisual> = {
  criancas: {
    id: "criancas",
    nome: "Brincadeira e imaginação",
    paleta: P.criancas,
    titulo: "Um mundo para brincar.",
    tituloDestaque: "Compare. Escolha. Encante.",
    descricao:
      "Brinquedos já comparados com as outras lojas: o mesmo produto mais barato, alternativa de qualidade igual ou o melhor preço encontrado.",
    imagem: { src: "/campanhas/estudio-criancas.webp", largura: 760, altura: 703, estudio: true },
    movimento: "entrada",
    palavras:
      /\b(crian[cç]as?|infantil|brinquedos?|bonecas?|lego|pel[uú]cias?|carrinho|hot ?wheels|barbie|jogos? de tabuleiro|quebra[- ]?cabe[cç]a|patinete|massinha|beb[eê]s?|kids)\b/i,
    calendario: { de: "09-28", ate: "10-12" },
  },
  natal: {
    id: "natal",
    nome: "Presentes e luzes",
    paleta: P.natal,
    titulo: "Escolhas que viram sorrisos.",
    tituloDestaque: "Compare antes de presentear.",
    descricao: "Ideias de presente já comparadas com as outras lojas. Comprar antes é economizar.",
    imagem: { src: "/campanhas/estudio-natal.webp", largura: 760, altura: 686, estudio: true },
    movimento: "entrada",
    palavras:
      /\b(natal|natalin[oa]|papai noel|amigo secreto|presentes?|panetone|ceia|fim de ano)\b/i,
    calendario: { de: "11-15", ate: "12-24" },
  },
  black_friday: {
    id: "black_friday",
    nome: "Black Friday",
    paleta: P.black_friday,
    titulo: "Compare antes.",
    tituloDestaque: "Escolha melhor.",
    descricao:
      "Sua próxima melhor escolha. Na data, você vê se o desconto existe mesmo: comparação com as outras lojas e histórico do preço.",
    imagem: {
      src: "/campanhas/estudio-black_friday.webp",
      largura: 760,
      altura: 696,
      estudio: true,
    },
    movimento: "entrada",
    palavras: /\b(black ?friday|black ?week|cyber ?monday|esquenta black)\b/i,
    calendario: { de: "11-01", ate: "11-30" },
  },
  tecnologia: {
    id: "tecnologia",
    nome: "Tecnologia",
    paleta: P.tecnologia,
    titulo: "Tecnologia pelo preço certo.",
    tituloDestaque: "O mesmo produto, na loja mais em conta.",
    descricao:
      "Eletrônicos já comparados entre as lojas, com a loja oficial quando houver e o frete indicado.",
    movimento: "entrada",
    palavras:
      /\b(tecnologia|tech|eletr[oô]nicos?|inform[aá]tica|celular|smartphone|iphone|galaxy|notebook|tablet|fone|headphone|smartwatch|caixa de som|jbl|monitor|teclado|mouse|gamer|console|tv|smart ?tv|ssd)\b/i,
  },
  casa: {
    id: "casa",
    nome: "Casa e aconchego",
    paleta: P.casa,
    titulo: "Casa com mais aconchego.",
    tituloDestaque: "Escolhas comparadas, preço justo.",
    descricao:
      "Decoração e utilidades já comparadas com as outras lojas, do mesmo produto ao melhor preço encontrado.",
    movimento: "entrada",
    palavras:
      /\b(casa|decora[cç][aã]o|m[oó]veis?|cozinha|banheiro|quarto|sala|cama|mesa|banho|lumin[aá]ria|lumin[aá]rias|tapete|cortina|vaso|almofada|organizador|panela|jogo de cama|toalha|air ?fryer|cafeteira|aspirador)\b/i,
  },
  beleza: {
    id: "beleza",
    nome: "Beleza e cuidado",
    paleta: P.beleza,
    titulo: "Beleza com preço conferido.",
    tituloDestaque: "O mesmo produto, na loja certa.",
    descricao:
      "Perfumes, maquiagem e cuidados já comparados com as outras lojas, com a loja oficial quando houver.",
    movimento: "entrada",
    palavras:
      /\b(beleza|perfumes?|col[oô]nia|eau de (parfum|toilette)|maquiagem|batom|base l[ií]quida|skincare|hidratante|s[eé]rum|shampoo|condicionador|cabelo|botic[aá]rio|natura|lanc[oô]me|wella|kit de banho)\b/i,
  },
  neutro: {
    id: "neutro",
    nome: "Marca",
    paleta: P.neutro,
    titulo: "Antes de comprar, compare.",
    tituloDestaque: "Mesmo produto ou alternativa semelhante.",
    descricao:
      "Produtos já comparados com as outras lojas, com o que muda explicado e o link seguro para comprar.",
    movimento: "entrada",
    palavras: /$^/,
  },
};

export type ConteudoCampanha = {
  /* Ajuste manual: quando definido, manda. */
  temaConfigurado?: TemaVisualId | null;
  nome?: string | null;
  descricao?: string | null;
  categorias?: readonly string[] | null;
  produtos?: readonly string[] | null;
};

export type TemaIdentificado = {
  tema: TemaVisualId;
  fonte: "configurado" | "conteudo" | "neutro";
  pontos: Partial<Record<TemaVisualId, number>>;
};

const mmdd = (agora: Date) =>
  agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(5);

/** Identifica o tema visual de UMA campanha pelo conteúdo (ver o topo). */
export function identificarTema(c: ConteudoCampanha, agora = new Date()): TemaIdentificado {
  if (c.temaConfigurado && TEMAS_VISUAIS[c.temaConfigurado])
    return { tema: c.temaConfigurado, fonte: "configurado", pontos: {} };
  const texto = `${c.nome ?? ""} ${c.descricao ?? ""}`;
  const produtos = (c.produtos ?? []).filter(Boolean);
  const hoje = mmdd(agora);
  const pontos: Partial<Record<TemaVisualId, number>> = {};
  for (const t of Object.values(TEMAS_VISUAIS)) {
    if (t.id === "neutro") continue;
    let p = 0;
    if (t.palavras.test(texto)) p += 3;
    p += 2 * (c.categorias ?? []).filter((x) => t.palavras.test(x)).length;
    if (produtos.length)
      p += (4 * produtos.filter((x) => t.palavras.test(x)).length) / produtos.length;
    if (p > 0 && t.calendario && hoje >= t.calendario.de && hoje <= t.calendario.ate) p += 1;
    if (p > 0) pontos[t.id] = Math.round(p * 10) / 10;
  }
  const ordem = (Object.entries(pontos) as Array<[TemaVisualId, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  const [primeiro, segundo] = ordem;
  if (primeiro && primeiro[1] >= 3 && (!segundo || primeiro[1] - segundo[1] >= 1))
    return { tema: primeiro[0], fonte: "conteudo", pontos };
  return { tema: "neutro", fonte: "neutro", pontos };
}
