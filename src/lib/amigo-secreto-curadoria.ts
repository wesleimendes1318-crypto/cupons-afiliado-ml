/* AMIGO SECRETO: editorial curation (Weslei, 05/11: "estão fazendo piada com
   os resultados ruins"). Applied on every card before it enters a showcase:
   - adult clothing never shows kids' pieces (adults CAN get toys/collectibles:
     the block is only on clothing and on preschool brands inside a themed
     showcase);
   - books are gifts people enjoy (no tax, law or exam books);
   - a franchise showcase only keeps products of that franchise;
   - beauty avoids tone-dependent makeup (base, concealer) that is easy to miss.
   It also widens each showcase with more desirable search terms and the
   season's ideas, so "+20 opções" keeps finding new products. Never invents a
   product: it only picks catalog search terms and drops bad matches. */

const sem = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export type TipoVitrine = "roupa" | "calcado" | "livros" | "tema" | "beleza" | "joia" | "ideias" | "outro";

/* Toys/novelty kits sneaking into beauty (05/11: a Zona Criativa kit). */
const NAO_E_SKINCARE =
  /\b(zona ?criativa|uatt|brinquedo|infantil|kids|crianca|menina|pelucia|slime|massinha|maleta de maquiagem infantil|fantasia|boneca|kit spa infantil|estojo de maquiagem infantil)\b/;
/* Old-fashioned / loose pieces / resale lots in jewelry. */
const JOIA_FORA =
  /\b(pingente avulso|so pingente|saquinho|atacado|revenda|lote|kit \d{2,}|religios\w*|estrela de davi|crucifixo|terco|medalha|infantil|menina|bebe|masculin[oa])\b/;
/* Men's footwear brands/models in a women's showcase. */
const CALCADO_MASCULINO = /\b(kenner|pegada|democrata|ferracini|sapatenis|mocassim masculino|rider)\b/;

export type ContextoVitrine = {
  tipo: TipoVitrine;
  adulto: boolean;
  genero: "feminino" | "masculino" | null;
  /** Franchise keys ("star wars", "marvel"). */
  temas: string[];
  academia: boolean;
};

/* Franchise -> words a product title of it carries. */
const FRANQUIAS: Record<string, { chave: RegExp; titulo: RegExp; termos: string[] }> = {
  "star wars": {
    chave: /star ?wars|jedi|darth|yoda|mandalorian|grogu/,
    titulo: /star ?wars|darth|vader|yoda|grogu|mandalorian|jedi|stormtrooper|skywalker|chewbacca|r2-?d2|bb-?8|millennium|sith|boba fett|kylo/,
    termos: [
      "funko pop star wars",
      "luminaria star wars",
      "caneca star wars",
      "lego star wars",
      "action figure star wars",
      "quadro decorativo star wars",
      "chaveiro star wars",
      "almofada star wars",
    ],
  },
  marvel: {
    chave: /marvel|vingadores|avengers|homem[- ]aranha|spider|iron man|homem de ferro|thor|deadpool|wolverine|groot/,
    titulo: /marvel|vingadores|avengers|homem[- ]aranha|spider|iron ?man|homem de ferro|capitao america|thor|hulk|loki|deadpool|wolverine|groot|thanos|pantera negra|venom|x-?men|guardioes da galaxia/,
    termos: [
      "funko pop marvel",
      "luminaria marvel",
      "caneca marvel",
      "lego marvel",
      "action figure marvel",
      "quadro decorativo marvel",
      "manopla thanos",
      "almofada marvel",
    ],
  },
  dc: {
    chave: /\bdc\b|batman|superman|mulher maravilha|coringa|joker/,
    titulo: /\bdc\b|batman|superman|mulher[- ]maravilha|coringa|joker|flash|aquaman|arlequina|harley/,
    termos: ["funko pop batman", "luminaria batman", "caneca dc comics", "action figure batman", "lego batman"],
  },
  "harry potter": {
    chave: /harry potter|hogwarts|grifinoria|sonserina/,
    titulo: /harry potter|hogwarts|grifinoria|sonserina|corvinal|lufa|varinha|weasley|hermione|dumbledore|pomo/,
    termos: ["varinha harry potter", "caneca harry potter", "funko pop harry potter", "luminaria harry potter", "cachecol harry potter"],
  },
  "senhor dos aneis": {
    chave: /senhor dos aneis|tolkien|hobbit/,
    titulo: /senhor dos aneis|tolkien|hobbit|gandalf|frodo|sauron|gollum|terra[- ]media/,
    termos: ["senhor dos aneis colecionavel", "box senhor dos aneis", "caneca senhor dos aneis", "anel um senhor dos aneis"],
  },
  disney: {
    chave: /disney|mickey|stitch|princesa/,
    titulo: /disney|mickey|minnie|stitch|pixar|princesa|frozen|toy story|ursinho pooh/,
    termos: ["stitch pelucia", "caneca disney", "funko pop disney", "luminaria stitch"],
  },
  pokemon: {
    chave: /pokemon|pikachu/,
    titulo: /pokemon|pikachu|charizard|eevee|gengar|bulbasaur|squirtle|snorlax/,
    termos: ["pelucia pikachu", "cartas pokemon", "funko pop pokemon", "caneca pokemon"],
  },
  anime: {
    chave: /naruto|one piece|dragon ball|\banime\b|demon slayer|jujutsu/,
    titulo: /naruto|one piece|dragon ball|goku|anime|demon slayer|jujutsu|luffy|attack on titan|sasuke|kakashi/,
    termos: ["action figure anime", "funko pop anime", "caneca anime", "luminaria anime"],
  },
  "stranger things": {
    chave: /stranger things/,
    titulo: /stranger things|hellfire|eleven|demogorgon/,
    termos: ["stranger things colecionavel", "caneca stranger things", "camiseta hellfire club"],
  },
  friends: {
    chave: /\bfriends\b/,
    titulo: /\bfriends\b|central perk/,
    termos: ["caneca friends", "friends central perk", "lego friends central perk"],
  },
};

/* Kids' clothing words/brands: never in an adult's clothing showcase. */
const VESTUARIO_INFANTIL =
  /\b(infantil|infantis|juvenil|juvenis|menina|meninas|menino|meninos|kids|kid|bebe|bebes|baby|crianca|criancas|teen|mirim|coloritta|colorita|kyly|brandili|milon|malwee kids|hering kids|tip top|marisol|lilica|tigor|precoce|primeiros passos)\b|\btam(anho)?\s*(2|4|6|8|10|12|14|16)\s*(anos)?\b|\b\d{1,2}\s*a\s*\d{1,2}\s*anos\b/;

/* Books nobody wants as a party gift (unless the person asked for them). */
const LIVRO_TECNICO =
  /\b(imposto|impostos|tributari\w*|tributo|contabil\w*|fiscal|concurso|concursos|vade mecum|direito (penal|civil|tributario|administrativo|constitucional)|codigo (civil|penal|tributario)|resistencia d[eo]s? materiais|volumetria|engenharia|calculo diferencial|fisica (basica|geral)|estatistica aplicada|apostila|legislacao|oab|enem|vestibular|didatico|gramatica|questoes comentadas|manual pratico|nr-?\d+|cpc|clt)\b/;
const LIVRO_INFANTIL = /\b(livro infantil|infantil|colorir|para criancas|bebe|primeiras palavras|cartonado|livro de banho)\b/;

/* Preschool brands that ruin a grown-up themed showcase. */
const PRE_ESCOLAR =
  /\b(patrulha canina|paw patrol|peppa|galinha pintadinha|bolofofos|mundo bita|pj masks|baby shark|cocomelon|luccas neto|masha|bluey|lol surprise|polly|barbie|hot wheels|chase|skye|marshall)\b/;

/* Tone-dependent makeup: easy to miss on someone else. */
const MAQUIAGEM_DE_TOM = /\b(base liquida|base facial|base matte|\bbase\b|corretivo|po compacto|po translucido|contorno|bronzer)\b/;

/* Accessories that sneak into clothing searches. */
const NAO_E_ROUPA = /\b(cabide|manequim|etiqueta|tecido|molde|maquina de costura|capa para|organizador)\b/;

export function ehAdulto(texto: string): boolean {
  const s = sem(texto);
  const idade = /\b(\d{1,2})\s*anos\b/.exec(s);
  if (idade) return Number(idade[1]) >= 14;
  if (/\b(crianca|infantil|bebe|menininh|filh[oa] pequen)/.test(s)) return false;
  return true;
}

export function generoDaPessoa(texto: string): ContextoVitrine["genero"] {
  const s = sem(texto);
  if (/feminin|\btops?\b|vestido|\bsaia\b|bolsa|salto|sutia|maquiagem|brinco|calcinha|biquini|\bela\b|\bdela\b/.test(s))
    return "feminino";
  if (/masculin|barba|cueca|\bele\b|\bdele\b/.test(s)) return "masculino";
  return null;
}

export function temasDoTexto(texto: string): string[] {
  const s = sem(texto);
  return Object.entries(FRANQUIAS)
    .filter(([, f]) => f.chave.test(s))
    .map(([k]) => k);
}

export function contextoDaVitrine(
  v: { titulo: string; termosBusca: string[] },
  textoDaPessoa: string,
): ContextoVitrine {
  const base = sem(`${v.titulo} ${v.termosBusca.join(" ")}`);
  const temas = temasDoTexto(`${v.titulo} ${v.termosBusca.join(" ")}`);
  const tipo: TipoVitrine = /ideias|criativ|da epoca|sazona/.test(sem(v.titulo))
    ? "ideias"
    : temas.length && !/livro/.test(base)
      ? "tema"
      : /livro|leitura/.test(base)
        ? "livros"
        : /calcado|tenis|sandalia|chinelo|rasteir|sapat|papete|bota\b/.test(base) && !/academia|fitness/.test(base)
          ? "calcado"
          : /roupa|academia|fitness|camiseta|\bshorts?\b|legging|\btops?\b|blusa|vestido|calca|pijama|moletom|conjunto|bermuda|regata|lingerie|biquini|maio/.test(base)
            ? "roupa"
            : /skin ?care|maquiagem|beleza|autocuidado|facial|cosmetic/.test(base)
              ? "beleza"
              : /bijuteri|semijoia|joia|colar|brinco|pulseira|\banel\b/.test(base)
                ? "joia"
                : "outro";
  return {
    tipo,
    adulto: ehAdulto(textoDaPessoa),
    genero: generoDaPessoa(textoDaPessoa),
    temas,
    academia: /academia|fitness|treino|gym|corrida/.test(base),
  };
}

/** Does this card belong in the showcase? */
export function aprovadoNaVitrine(titulo: string, c: ContextoVitrine): boolean {
  const t = sem(titulo);
  if (!t) return false;
  if (c.adulto && (c.tipo === "roupa" || c.tipo === "calcado")) {
    if (VESTUARIO_INFANTIL.test(t)) return false;
    if (NAO_E_ROUPA.test(t)) return false;
    /* Adult women's clothing: no men's pieces, and vice versa. */
    if (c.genero === "feminino" && /\bmasculin[oa]s?\b/.test(t) && !/unissex/.test(t)) return false;
    if (c.genero === "masculino" && /\bfeminin[oa]s?\b/.test(t) && !/unissex/.test(t)) return false;
  }
  /* The catalog fills thin searches with best sellers of other kinds
     (figurinhas in "Livros", a teddy in "Star Wars"): each kind needs its word. */
  if (c.tipo === "livros" && /\b(figurinhas?|album|pacotes?|adesivos?|cartas colecionaveis|marcenaria)\b/.test(t))
    return false;
  if (c.tipo === "roupa" && !/\b(short|shorts|top|tops|legging|calca|camiseta|regata|blusa|conjunto|bermuda|macaquinho|macacao|jaqueta|moletom|vestido|saia|cropped|body|pijama|meia|meias|sutia|biquini|maio|bone|viseira|bolsa|garrafa|toalha|squeeze)\b/.test(t))
    return false;
  /* Gym showcase: the piece has to be gym wear (05/11: a dress and a watch showed up). */
  if (c.tipo === "roupa" && c.academia && !/\b(fitness|academia|treino|dry ?fit|esportiv[oa]|legging|tops?|shorts?|cropped|ciclista|corrida|yoga|compressao|bermuda|regata|macaquinho|garrafa|squeeze|toalha|bolsa)\b/.test(t))
    return false;
  if (c.tipo === "livros") {
    if (LIVRO_TECNICO.test(t)) return false;
    if (c.adulto && LIVRO_INFANTIL.test(t)) return false;
  }
  if (c.temas.length) {
    if (PRE_ESCOLAR.test(t)) return false;
    if (c.tipo === "tema" && !c.temas.some((k) => FRANQUIAS[k]?.titulo.test(t))) return false;
    /* Weslei, 05/11: "Homem aranha não é star wars!" — a card of another
       franchise never enters a franchise showcase. */
    if (
      c.tipo === "tema" &&
      Object.entries(FRANQUIAS).some(([k, f]) => !c.temas.includes(k) && f.titulo.test(t)) &&
      !c.temas.some((k) => FRANQUIAS[k]?.titulo.test(t))
    )
      return false;
    if (c.tipo === "tema" && c.temas.length === 1) {
      const outras = Object.entries(FRANQUIAS).filter(([k]) => k !== c.temas[0]);
      if (outras.some(([, f]) => f.titulo.test(t))) return false;
    }
  }
  if (c.tipo === "beleza" && (MAQUIAGEM_DE_TOM.test(t) || NAO_E_SKINCARE.test(t))) return false;
  if (c.tipo === "joia" && (JOIA_FORA.test(t) || /^pingente\b/.test(t)))
    return false;
  if (c.tipo === "calcado" && c.genero === "feminino" && CALCADO_MASCULINO.test(t) && !/feminin/.test(t)) return false;
  /* Gifts for adults in generic showcases: no baby items. */
  if (c.adulto && c.tipo !== "tema" && /\b(bebe|baby|recem[- ]nascido|chupeta|mamadeira|fralda)\b/.test(t)) return false;
  return true;
}

/* Seasonal gift ideas, by month (São Paulo calendar). */
export function ideiasDaEpoca(agora = new Date()): { titulo: string; termos: string[] } {
  const mes = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(agora),
  );
  if (mes === 11 || mes === 12 || mes === 1)
    return {
      titulo: "Ideias da época: Natal e verão",
      termos: [
        "copo termico inox com tampa",
        "garrafa termica inox 1 litro",
        "kit taças de vinho",
        "necessaire de viagem",
        "bolsa de praia",
        "toalha de praia microfibra",
        "caixa de som bluetooth a prova d'agua",
        "kit chocolates importados",
        "luminaria de mesa led",
        "kit hidratante corporal presente",
        "caneca termica",
        "difusor de aromas eletrico",
      ],
    };
  if (mes >= 6 && mes <= 8)
    return {
      titulo: "Ideias da época: inverno",
      termos: ["manta de sofa", "meia termica", "caneca termica", "kit chocolate quente", "pantufa adulto", "garrafa termica inox"],
    };
  return {
    titulo: "Ideias criativas para presentear",
    termos: ["copo termico inox", "luminaria de mesa led", "kit presente", "caneca criativa", "difusor de aromas", "necessaire"],
  };
}

const ACADEMIA_FEMININA = [
  "conjunto fitness feminino short e top",
  "short academia feminino cintura alta",
  "top fitness feminino com bojo",
  "legging academia feminina cintura alta",
  "bermuda ciclista feminina academia",
  "conjunto legging e top academia",
  "macaquinho fitness feminino",
  "camiseta dry fit feminina academia",
  "regata fitness feminina",
  "short saia academia feminino",
  "jaqueta corta vento feminina academia",
];
const ACADEMIA_MASCULINA = [
  "camiseta dry fit masculina academia",
  "short academia masculino",
  "regata masculina academia",
  "bermuda treino masculina",
  "conjunto academia masculino",
  "calça jogger masculina academia",
  "camiseta compressao masculina",
];
const ACADEMIA_UNISSEX = [
  "camiseta dry fit academia",
  "short academia",
  "garrafa academia inox",
  "bolsa academia",
  "toalha academia microfibra",
];
const LIVROS_DESEJO = [
  "livro romance best seller",
  "box livros ficcao",
  "livro colleen hoover",
  "livro taylor jenkins reid",
  "livro suspense thriller",
  "livro fantasia",
  "livro capa dura edicao especial",
  "livro romance de epoca",
  "livro freida mcfadden",
  "kindle capa",
  "luminaria de leitura",
];
const BELEZA_UNIVERSAL = [
  "sallve kit",
  "principia skincare",
  "cerave hidratante",
  "la roche posay effaclar",
  "creamy skincare",
  "bioderma agua micelar",
  "serum acido hialuronico",
  "serum vitamina c facial",
  "hidratante facial",
  "protetor solar facial toque seco",
  "lip balm hidratante labial",
  "mascara facial argila",
  "kit banho presente",
  "espelho de maquiagem com led",
  "necessaire feminina",
];

const JOIA_DESEJO = [
  "colar ponto de luz banhado a ouro 18k",
  "brinco argola click zirconia",
  "ear cuff dourado",
  "pulseira riviera zirconia",
  "vivara life",
  "rommanel colar",
];
const CALCADO_VERAO = [
  "sandália salto bloco vizzano",
  "rasteirinha moleca",
  "papete feminina beira rio",
  "slide nuvem feminino",
  "havaianas slim",
  "melissa sandália",
];

/** Showcase terms + a wider pool so "+20 opções" never runs dry. */
export function ampliarTermos(termos: string[], c: ContextoVitrine, agora = new Date()): string[] {
  const extra: string[] = [];
  if (c.tipo === "roupa" && c.academia)
    extra.push(
      ...(c.genero === "feminino" ? ACADEMIA_FEMININA : c.genero === "masculino" ? ACADEMIA_MASCULINA : ACADEMIA_UNISSEX),
    );
  if (c.tipo === "livros") extra.push(...LIVROS_DESEJO);
  if (c.tipo === "tema") for (const k of c.temas) extra.push(...(FRANQUIAS[k]?.termos ?? []));
  if (c.tipo === "beleza") extra.push(...BELEZA_UNIVERSAL);
  if (c.tipo === "joia") extra.push(...JOIA_DESEJO);
  if (c.tipo === "calcado" && c.genero !== "masculino") extra.push(...CALCADO_VERAO);
  if (c.tipo === "ideias") extra.push(...ideiasDaEpoca(agora).termos);
  /* Clothing terms for adults carry the gender word (no kids' pieces). */
  const ajustados = termos.map((x) => {
    if (c.tipo !== "roupa" || !c.adulto) return x;
    const s = sem(x);
    if (/feminin|masculin|adulto|unissex/.test(s)) return x;
    return c.genero === "feminino" ? `${x} feminino` : c.genero === "masculino" ? `${x} masculino` : `${x} adulto`;
  });
  /* Themed showcase: interleave so every franchise shows from the start. */
  const pool = [...ajustados, ...extra].map((x) => x.trim()).filter((x) => x.length > 2 && x.length <= 60);
  return [...new Set(pool.map((x) => x.toLowerCase()))].slice(0, 16);
}

