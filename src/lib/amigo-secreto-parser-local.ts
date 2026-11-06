/* AMIGO SECRETO: deterministic reader of a wish list (05/11). Runs on the
   server when the model is slow (> 3 s) or fails, and in the browser when the
   endpoint does not answer. It only splits what the person wrote into
   showcases and search terms; products always come from the catalog search. */
import { generoDaPessoa, ideiasDaEpoca } from "@/lib/amigo-secreto-curadoria";
import type { Interpretacao, TamanhosAmigo } from "@/lib/amigo-secreto-tipos";

const sem = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Categoria = {
  id: string;
  chaves: RegExp;
  icone: string;
  titulo: (c: Ctx) => string;
  termos: (c: Ctx) => string[];
  /** Ideas for the "Ideias criativas" showcase. */
  extras: string[];
};

type Ctx = {
  genero: "feminino" | "masculino" | null;
  cores: string[];
  temas: string[];
  tamanhos?: TamanhosAmigo;
  /** What the person wrote for this showcase, cleaned ("camiseta oversized masculina"). */
  pedidos?: string[];
};

const g = (c: Ctx, f: string, m: string) =>
  c.genero === "feminino" ? f : c.genero === "masculino" ? m : "";
const t = (...partes: string[]) => partes.join(" ").replace(/\s+/g, " ").trim();
const e = (lista: string[]) => (lista.length > 1 ? `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}` : (lista[0] ?? ""));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* Themes (franchises) people ask for in decoration and collectibles. */
const TEMAS: Array<[RegExp, string]> = [
  [/star ?wars/, "Star Wars"],
  [/marvel|vingadores|homem[- ]aranha/, "Marvel"],
  [/\bdc\b|batman|superman/, "DC"],
  [/harry potter|hogwarts/, "Harry Potter"],
  [/senhor dos aneis|tolkien/, "Senhor dos Anéis"],
  [/disney|mickey|stitch/, "Disney"],
  [/pokemon|pikachu/, "Pokémon"],
  [/naruto|one piece|dragon ball|\banime\b/, "Anime"],
  [/stranger things/, "Stranger Things"],
  [/friends\b/, "Friends"],
];

const CORES: Array<[RegExp, string]> = [
  [/\bprata\b|prateado/, "prata"],
  [/dourad|\bouro\b|banhad/, "dourado"],
  [/\brose\b|rose gold/, "rose gold"],
];

const CATEGORIAS: Categoria[] = [
  {
    id: "academia",
    chaves: /academia|fitness|treino|\bgym\b|crossfit|corrida|legging|\btops?\b/,
    icone: "🎽",
    titulo: (c) =>
      c.tamanhos?.observacoes
        ? `Roupas de academia (${c.tamanhos.observacoes.replace(/: /g, " ").replace(/ · /g, " e ")})`
        : "Roupas de academia",
    termos: (c) => [
      t("short academia", g(c, "feminino", "masculino")),
      c.genero === "masculino" ? "camiseta dry fit masculina" : "top fitness feminino",
      t("legging academia", g(c, "feminina", "")) || "calça academia",
      t("conjunto fitness", g(c, "feminino", "masculino")),
      t("camiseta dry fit", g(c, "feminina", "masculina")),
    ],
    extras: ["garrafa térmica academia", "bolsa academia", "toalha esportiva"],
  },
  {
    id: "livros",
    chaves: /livro|leitura|\bler\b|romance|kindle/,
    icone: "📚",
    titulo: () => "Livros e leituras em alta",
    termos: () => ["livro romance best seller", "livro mais vendido ficcao", "box livros ficcao", "livro fantasia", "livro suspense thriller"],
    extras: ["luminária de leitura", "marcador de página", "suporte para livro"],
  },
  {
    id: "decoracao-tema",
    chaves: /colecionav|geek|funko|action figure|boneco/,
    icone: "🌌",
    titulo: (c) => (c.temas.length ? `Decoração ${e(c.temas)}` : "Colecionáveis e decoração geek"),
    termos: (c) =>
      c.temas.length
        ? c.temas.flatMap((x) => [`${x} decoração`, `${x} colecionável`, `luminária ${x}`, `caneca ${x}`])
        : ["funko pop", "action figure", "luminária geek", "caneca geek"],
    extras: ["caneca personalizada", "quebra-cabeça 1000 peças"],
  },
  {
    id: "bijuterias",
    chaves: /bijuteri|\baneis\b|\banel\b|joia|semijoia|colar|brinco|pulseira|acessorio|corrente|cordao/,
    icone: "💍",
    titulo: (c) =>
      c.genero === "masculino"
        ? `Joias e acessórios masculinos${c.cores.length ? ` (${e(c.cores)})` : ""}`
        : c.cores.length
          ? `Bijuterias e semijoias (${e(c.cores)})`
          : "Bijuterias e semijoias",
    termos: (c) => {
      /* Weslei, 05/11: modern, youthful pieces and the best brands first. */
      const prata = c.cores.some((x) => /prat/.test(x));
      const banho = prata ? "prata" : "banhado a ouro";
      /* 06/11: men get men's pieces (a bridal set reached Vinicius). */
      if (c.genero === "masculino")
        return [
          `corrente masculina ${prata ? "prata 925" : "banhada a ouro"}`,
          `pulseira masculina ${prata ? "prata 925" : "banhada a ouro"}`,
          `corrente grumet masculina ${prata ? "prata" : "dourada"}`,
          "anel masculino aço inoxidável",
          "pulseira masculina couro",
          "cordão masculino aço",
        ];
      return [
        `colar ponto de luz ${banho}`,
        `brinco argola click zirconia ${banho}`,
        `ear cuff ${prata ? "prata" : "dourado"}`,
        `pulseira riviera zirconia ${banho}`,
        `conjunto colar e brinco ${banho}`,
        "vivara life",
        "rommanel colar",
        "semijoia mix de colares",
        "anel solitario zirconia",
      ];
    },
    extras: ["porta joias", "caixa organizadora de bijuterias"],
  },
  {
    /* 06/11: everyday clothes ("camiseta oversized masculina") had no showcase
       and ran as one raw search with 1 result. */
    id: "roupas",
    chaves: /camiset|oversized|\bcamisa\b|\bpolo\b|bermuda|jeans|moletom|jaqueta|blusa|vestido|\bsaia\b|cropped|\bcalcas?\b|\bregata\b/,
    icone: "👕",
    titulo: (c) => (c.genero === "masculino" ? "Roupas masculinas" : c.genero === "feminino" ? "Roupas femininas" : "Roupas"),
    termos: (c) => {
      const gen = g(c, "feminina", "masculina") || "unissex";
      const pedidos = (c.pedidos ?? []).map((p) => (/feminin|masculin|unissex/.test(p) ? p : `${p} ${gen}`));
      const basicos =
        c.genero === "feminino"
          ? ["blusa feminina", "vestido casual feminino", "camiseta básica feminina", "calça jeans feminina"]
          : [
              "camiseta oversized masculina streetwear",
              "camiseta masculina algodão fio 30",
              "camiseta básica masculina gola redonda",
              "camisa polo masculina algodão",
              "bermuda sarja masculina",
              "camisa linho masculina manga curta",
              "moletom masculino canguru",
              "calça jeans masculina slim",
            ];
      return [...pedidos, ...(c.genero ? basicos : ["camiseta oversized unissex", "moletom unissex"])];
    },
    extras: ["boné", "meia divertida"],
  },
  {
    id: "skincare",
    chaves: /skin ?care|autocuidado|beleza|facial|maquiagem|cosmetic|hidratante|cuidados? com a pele/,
    icone: "🌿",
    titulo: () => "Skincare e autocuidado",
    /* Best brands first (Weslei, 05/11). */
    termos: () => [
      "sallve kit",
      "principia skincare",
      "cerave hidratante",
      "la roche posay",
      "creamy skincare",
      "vichy serum facial",
      "bioderma agua micelar",
      "neutrogena hydro boost",
      "sérum vitamina c facial",
      "protetor solar facial toque seco",
    ],
    extras: ["necessaire", "espelho de maquiagem com luz"],
  },
  {
    id: "calcados",
    chaves: /calcado|sapato|tenis|sandalia|chinelo|rasteir|sapatilha|bota\b/,
    icone: "👠",
    titulo: (c) =>
      t("Calçados", g(c, "femininos", "masculinos"), c.tamanhos?.calcado ? `tamanho ${c.tamanhos.calcado}` : ""),
    termos: (c) =>
      c.genero === "masculino"
        ? ["tênis masculino", "chinelo masculino", "sapatênis", "sandália masculina"]
        : /* Every kind of shoe, known brands, season mixed in (Weslei, 05/11:
             "não deve se limitar a sandálias"). */
          [
            t("tênis", g(c, "feminino", ""), "casual"),
            "sandália salto bloco vizzano",
            "sapatilha feminina moleca",
            "mule feminino",
            "rasteirinha moleca",
            "tênis olympikus feminino",
            "mocassim feminino",
            "papete feminina beira rio",
            "slide nuvem feminino",
            "bota feminina cano curto",
          ],
    extras: ["kit meias", "porta sapatos"],
  },
  {
    id: "bolsas",
    chaves: /bolsa|carteira|mochila|necessaire/,
    icone: "👜",
    titulo: () => "Bolsas e carteiras",
    termos: (c) =>
      c.genero === "masculino"
        ? ["carteira masculina", "mochila masculina", "pochete masculina"]
        : ["bolsa feminina", "bolsa transversal", "carteira feminina", "mochila feminina"],
    extras: ["chaveiro", "organizador de bolsa"],
  },
  {
    id: "escritorio",
    chaves: /escritorio|papelaria|caneta|caderno|planner|home ?office/,
    icone: "🖊️",
    titulo: () => "Escritório e papelaria",
    termos: () => ["organizador de mesa", "planner", "kit canetas", "luminária de mesa", "caderno"],
    extras: ["caneca térmica", "mouse pad grande"],
  },
  {
    id: "jardim",
    chaves: /planta|jardim|jardinagem|suculenta|horta/,
    icone: "🪴",
    titulo: () => "Plantas e jardinagem",
    termos: () => ["vaso para plantas", "kit jardinagem", "cachepô", "regador", "suporte para plantas"],
    extras: ["vaso autoirrigável"],
  },
  {
    id: "decoracao",
    chaves: /decora|enfeite|casa\b|quadro|vela|difusor/,
    icone: "🏠",
    titulo: () => "Decoração de casa",
    termos: () => ["vaso decorativo", "quadro decorativo", "luminária decorativa", "difusor de aromas", "vela aromática"],
    extras: ["porta retrato", "manta decorativa"],
  },
  {
    id: "cozinha",
    chaves: /cozinha|cafe\b|cafeteira|cha\b|vinho|drink|churrasco/,
    icone: "☕",
    titulo: () => "Cozinha, café e bebidas",
    termos: () => ["kit café", "caneca térmica", "kit churrasco", "taças de vinho", "prensa francesa"],
    extras: ["avental", "porta temperos"],
  },
  {
    id: "perfume",
    chaves: /perfume|colonia|fragrancia/,
    icone: "🌸",
    titulo: () => "Perfumes",
    termos: (c) => [t("perfume", g(c, "feminino", "masculino")), "body splash", "kit perfume"],
    extras: ["hidratante corporal"],
  },
  {
    id: "games",
    chaves: /game|jogo|videogame|playstation|xbox|nintendo|gamer/,
    icone: "🎮",
    titulo: () => "Games e acessórios gamer",
    termos: () => ["controle gamer", "headset gamer", "mouse gamer", "jogo de tabuleiro"],
    extras: ["suporte de controle", "mouse pad gamer"],
  },
  {
    id: "eletronicos",
    chaves: /fone|eletronic|tecnologia|caixa de som|smartwatch|carregador/,
    icone: "🎧",
    titulo: () => "Eletrônicos e acessórios",
    termos: () => ["fone bluetooth", "caixa de som bluetooth", "smartwatch", "carregador portátil"],
    extras: ["suporte celular"],
  },
  {
    id: "pet",
    chaves: /\bpet\b|cachorr|\bgat[ao]s?\b|\bcao\b/,
    icone: "🐾",
    titulo: () => "Para o pet",
    termos: () => ["cama pet", "brinquedo cachorro", "arranhador gato", "comedouro pet"],
    extras: ["tapete higiênico"],
  },
];

const IDEIAS_PADRAO = ["caneca criativa", "kit presente", "organizador", "garrafa térmica", "luminária decorativa"];

export function generoDoTexto(texto: string, nome?: string | null): Ctx["genero"] {
  return generoDaPessoa(texto, nome);
}

/* "alguma camiseta oversized masculina" -> "camiseta oversized masculina". */
const limparPedido = (p: string) =>
  p
    .replace(/\([^)]*\)/g, "")
    .replace(/^(coisas|itens|algo|alguma?s?|algum|uns|umas?|quero|queria|gostaria de)\s+((de|para|pra)\s+)?/i, "")
    .trim();

const TAM = "PP|P|M|G|GG|XG|EG|XGG";

/** Sizes: "Roupa P", "M pra shorts, G pra camisetas e tops", "calçado 35". */
export function tamanhosDoTexto(texto: string): TamanhosAmigo {
  const pares: string[] = [];
  const reTam = new RegExp(`\\b(${TAM})\\s*(?:pra|para|p/|em|nos?|nas?)\\s+([\\p{L}]+(?:\\s+e\\s+[\\p{L}]+)?)`, "gu");
  for (const m of texto.matchAll(reTam)) pares.push(`${cap(m[2]!.toLowerCase())}: ${m[1]!.toUpperCase()}`);
  const reTam2 = new RegExp(`\\b(shorts?|camisetas?|tops?|blusas?|cal[cç]as?|leggings?|vestidos?)\\s*(?:tamanho\\s*)?(${TAM})\\b`, "giu");
  for (const m of texto.matchAll(reTam2)) pares.push(`${cap(m[1]!.toLowerCase())}: ${m[2]!.toUpperCase()}`);
  const roupa =
    new RegExp(`\\b(?:roupas?|veste|tamanho)\\s*(?:tamanho\\s*)?(${TAM})\\b`, "i").exec(texto)?.[1]?.toUpperCase() ??
    null;
  const calcado =
    /(?:cal[cç]ados?|sapatos?|t[eê]nis|sand[aá]lias?|chinelos?|n[uú]mero|numera[cç][aã]o|p[eé])\D{0,12}\b(3[3-9]|4[0-6])\b/i.exec(texto)?.[1] ??
    null;
  return {
    roupa,
    calcado,
    observacoes: pares.length ? [...new Set(pares)].join(" · ") : null,
  };
}

/** Top-level pieces: commas, semicolons, lines, " ou " and "/" outside parentheses. */
export function pedacosDoTexto(texto: string): string[] {
  const saida: string[] = [];
  let atual = "";
  let fundo = 0;
  const s = texto.replace(/\s+ou\s+/gi, " ¦ ");
  for (const ch of s) {
    if (ch === "(") fundo += 1;
    if (ch === ")") fundo = Math.max(0, fundo - 1);
    if (fundo === 0 && /[,;\n¦]/.test(ch)) {
      saida.push(atual);
      atual = "";
    } else atual += ch;
  }
  saida.push(atual);
  return saida.map((p) => p.replace(/¦/g, " ou ").replace(/\s+/g, " ").trim()).filter((p) => p.length > 1);
}

/** Free text of one person -> showcases (2 to 7) + sizes. */
export function interpretarLocal(texto: string, nome?: string | null): Interpretacao {
  const bruto = texto.slice(0, 600);
  const genero = generoDoTexto(bruto, nome);
  const tamanhos = tamanhosDoTexto(bruto);
  const usadas = new Map<string, { cat: Categoria; ctx: Ctx }>();
  const avulsas: string[] = [];
  for (const pedaco of pedacosDoTexto(bruto)) {
    const s = sem(pedaco);
    const temas = TEMAS.filter(([re]) => re.test(s)).map(([, n]) => n);
    const cores = CORES.filter(([re]) => re.test(s)).map(([, n]) => n);
    /* Theme text out before matching ("senhor dos aneis" is not a ring). */
    const limpo = TEMAS.reduce((x, [re]) => x.replace(re, " "), s);
    let achou = false;
    for (const cat of CATEGORIAS) {
      const casa = cat.chaves.test(limpo) || (cat.id === "decoracao-tema" && temas.length > 0);
      if (!casa) continue;
      /* Decoration with a theme is the themed showcase, not the generic one. */
      if (cat.id === "decoracao" && temas.length) continue;
      /* Gym wear is the gym showcase, not everyday clothes. */
      if (cat.id === "roupas" && CATEGORIAS[0]!.chaves.test(limpo)) continue;
      achou = true;
      const ja = usadas.get(cat.id);
      const ctx: Ctx = {
        genero,
        cores: [...new Set([...(ja?.ctx.cores ?? []), ...cores])],
        temas: [...new Set([...(ja?.ctx.temas ?? []), ...temas])],
        tamanhos,
        pedidos: [...new Set([...(ja?.ctx.pedidos ?? []), sem(limparPedido(pedaco)).slice(0, 50)])],
      };
      usadas.set(cat.id, { cat, ctx });
    }
    /* "Roupa P" alone is only a size, not a showcase. */
    const soTamanho = /^(roupas?|veste|tamanho)\b/.test(s) && s.split(" ").length <= 3;
    if (!achou && !soTamanho) {
      const termo = limparPedido(pedaco);
      if (termo.length > 2 && termo.length <= 50) avulsas.push(termo);
    }
  }
  /* Decoration + garden asked together: one showcase (Nath, 05/11). */
  if (usadas.has("decoracao") && usadas.has("jardim")) {
    const d = usadas.get("decoracao")!;
    const j = usadas.get("jardim")!;
    usadas.delete("jardim");
    usadas.set("decoracao", {
      ctx: d.ctx,
      cat: {
        ...d.cat,
        icone: "🪴",
        titulo: () => "Decoração de casa e jardinagem",
        termos: (c) => [...j.cat.termos(c).slice(0, 3), ...d.cat.termos(c).slice(0, 3)],
        extras: [...d.cat.extras, ...j.cat.extras],
      },
    });
  }
  const vitrines = [...usadas.values()].map(({ cat, ctx }) => ({
    titulo: cat.titulo(ctx),
    icone: cat.icone,
    termos: [...new Set(cat.termos(ctx).filter(Boolean))].slice(0, 6),
  }));
  for (const a of avulsas.slice(0, 3))
    vitrines.push({ titulo: cap(a), icone: "🎁", termos: [sem(a).slice(0, 50)] });
  const extras = [...new Set([...usadas.values()].flatMap(({ cat }) => cat.extras))];
  vitrines.splice(6);
  const epoca = ideiasDaEpoca();
  vitrines.push({
    titulo: epoca.titulo,
    icone: "💡",
    termos: [...new Set([...epoca.termos.slice(0, 4), ...extras, ...IDEIAS_PADRAO])].slice(0, 8),
  });
  return { tamanhos, vitrines };
}

/** Badges shown on the wish panel: "Shorts: M", "Calçado: 35". */
export function selosDeTamanho(t: TamanhosAmigo | undefined): string[] {
  if (!t) return [];
  const selos = t.observacoes ? t.observacoes.split(" · ") : [];
  if (t.roupa && !selos.length) selos.push(`Roupa: ${t.roupa}`);
  if (t.calcado) selos.push(`Calçado: ${t.calcado}`);
  return selos;
}

/* ---------- WhatsApp list importer ---------- */

const PREFIXO_ZAP =
  /^\[?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*(?:-\s*)?(?:[^:]{1,40}:\s*)?/;
const NOME = "\\p{Lu}[\\p{L}'’]+(?:\\s+\\p{Lu}[\\p{L}'’]+)?";
const RE_NOME_E_DESEJO = new RegExp(`^(${NOME})\\s*(?:[:\\-–—]|quer|pediu|gosta de)\\s*(.*)$`, "u");
const RE_SO_NOME = new RegExp(`^(${NOME}):?$`, "u");
const NAO_SAO_NOMES = /^(amigo|lista|sorteio|valor|presente|regras?|data|grupo|obs|tamanho|roupa|livros?)\b/i;

/** "Anna: roupa..., livros\nNath - roupa P, calçado 35" -> people. */
export function importarListaWhatsapp(texto: string): Array<{ nome: string; desejos: string }> {
  const pessoas: Array<{ nome: string; desejos: string }> = [];
  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta
      .replace(PREFIXO_ZAP, "")
      .replace(/[*_~]/g, "")
      .replace(/^\s*(?:[-•▪️►]|\d{1,2}[.)º-])\s*/u, "")
      .trim();
    if (!linha) continue;
    const comDesejo = RE_NOME_E_DESEJO.exec(linha);
    const soNome = RE_SO_NOME.exec(linha);
    const nome = (comDesejo?.[1] ?? soNome?.[1] ?? "").trim();
    if (nome && !NAO_SAO_NOMES.test(nome) && (soNome || comDesejo)) {
      pessoas.push({ nome: nome.slice(0, 40), desejos: (comDesejo?.[2] ?? "").trim() });
      continue;
    }
    const ultima = pessoas.at(-1);
    if (ultima) ultima.desejos = t(ultima.desejos, linha);
  }
  return pessoas
    .map((p) => ({ ...p, desejos: p.desejos.replace(/^[:\-–—]\s*/, "").slice(0, 600) }))
    .filter((p) => p.desejos.length > 2)
    .slice(0, 30);
}

/** Budget written in the list: "valor 80 a 100", "até R$ 50". */
export function faixaDoTexto(texto: string): { min: number | null; max: number } | null {
  const s = sem(texto);
  const entre = /(?:r\$\s*)?(\d{2,4})(?:,00)?\s*(?:a|ate|-|e)\s*(?:r\$\s*)?(\d{2,4})(?:,00)?\s*(?:reais)?/.exec(
    s.match(/(?:valor|preco|faixa|orcamento|entre|de r\$)[^\n]{0,40}/)?.[0] ?? "",
  );
  if (entre) {
    const a = Number(entre[1]);
    const b = Number(entre[2]);
    if (a > 0 && b > a) return { min: a, max: b };
  }
  const ate = /ate\s*r?\$?\s*(\d{2,4})/.exec(s);
  if (ate) return { min: null, max: Number(ate[1]) };
  return null;
}

/* ---------- model output check (server endpoint) ---------- */

const RE_LINK = /https?:|www\.|\.com/i;
const textoLimpo = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  return s && !RE_LINK.test(s) && !/\b(ia|inteligencia artificial)\b/i.test(s) ? s : "";
};

/** Validates the model JSON; null when it is not usable. */
export function interpretacaoDoModelo(j: unknown): Interpretacao | null {
  const o = (j && typeof j === "object" ? j : {}) as {
    tamanhos?: Record<string, unknown>;
    vitrines?: unknown;
  };
  const vitrines = (Array.isArray(o.vitrines) ? o.vitrines : [])
    .map((v: { titulo?: unknown; icone?: unknown; termos?: unknown }) => ({
      titulo: textoLimpo(v?.titulo, 70),
      icone: textoLimpo(v?.icone, 4) || "🎁",
      termos: [
        ...new Set(
          (Array.isArray(v?.termos) ? v.termos : [])
            .map((x) => textoLimpo(x, 50).toLowerCase())
            .filter((x) => x.length > 2),
        ),
      ].slice(0, 10),
    }))
    .filter((v) => v.titulo && v.termos.length)
    .slice(0, 7);
  if (vitrines.length < 2) return null;
  const t = o.tamanhos ?? {};
  const roupa = textoLimpo(t["roupa"], 4).toUpperCase();
  const calcado = textoLimpo(String(t["calcado"] ?? ""), 2);
  return {
    tamanhos: {
      roupa: /^(PP|P|M|G|GG|XG|EG|XGG)$/.test(roupa) ? roupa : null,
      calcado: /^(3[3-9]|4[0-6])$/.test(calcado) ? calcado : null,
      observacoes: textoLimpo(t["observacoes"], 80) || null,
    },
    vitrines,
  };
}
