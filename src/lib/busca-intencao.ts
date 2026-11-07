/* Filtro final da intenção (27/10, "tomada para banheiro" não traz HDMI,
   antena nem tomada de móvel). Puro, sem rede: vale no servidor (antes de
   ler a oferta) e no navegador (produtos já conhecidos do site e respostas
   guardadas antes do filtro). */
import { buscaDeAparelho, itemSecundarioFora, normalizar } from "@/lib/busca-sugestoes";
import { diferencaDeModelo } from "@/lib/modelo-titulo";
import { tipoDoProduto } from "@/lib/termo-busca";

export type IntencaoDoFiltro = {
  tipoProduto?: string | null;
  termosNegativos?: string[];
  contextoUso?: string | null;
  /** Marca e modelo que a pessoa citou: o título tem de trazer os dois. */
  marca?: string | null;
  modelo?: string | null;
};

const junto = (s: string) => normalizar(s).replace(/ /g, "");

/* ECOSSISTEMA (Weslei, 07/11: "muito muito assertivo"). Linhas que dizem a
   marca sozinhas e as marcas rivais: buscando iPhone, Galaxy/Redmi/Moto não
   entram, e "iPhone 17 Pro Max" sem "Apple" no título continua valendo. */
const ECOSSISTEMAS: { marca: string; re: RegExp; linha: RegExp }[] = [
  {
    marca: "apple",
    re: /\b(apple|iphone|ipad|airpods?|macbook|imac|apple watch)\b/,
    linha: /\b(iphone|ipad|airpods?|macbook|imac|apple watch)\b/,
  },
  { marca: "samsung", re: /\b(samsung|galaxy)\b/, linha: /\bgalaxy\b/ },
  { marca: "xiaomi", re: /\b(xiaomi|redmi|poco)\b/, linha: /\b(redmi|poco)\b/ },
  {
    marca: "motorola",
    re: /\b(motorola|moto ?[ge] ?\d{1,3}|moto edge|razr)\b/,
    linha: /\b(moto ?[ge] ?\d{1,3}|moto edge|razr)\b/,
  },
];

function ecossistemaDoPedido(marca?: string | null, modelo?: string | null) {
  const m = normalizar(marca ?? "");
  const md = normalizar(modelo ?? "");
  return ECOSSISTEMAS.find((e) => e.marca === m || e.linha.test(md)) ?? null;
}

/* Spaces optional ("TC7900" = "TC 7900"), but numbers never merge:
   "galaxy s2" is not "galaxy s24", "iphone 1" is not "iphone 15". */
function contemSemEmendar(titulo: string, pedido: string) {
  const c = [...junto(pedido)];
  if (!c.length) return true;
  const corpo = c.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s-]?");
  const re = new RegExp(
    `${/\d/.test(c[0]!) ? "(?<!\\d)" : ""}${corpo}${/\d/.test(c[c.length - 1]!) ? "(?!\\d)" : ""}`,
  );
  return re.test(normalizar(titulo));
}

/** Outra marca, outro modelo ou outra versão (Pro, Max, geração) do que foi
    pedido (Weslei, 28/10: "muito assertiva, no modelo, versões tudo"; "Nike
    TC 7900" trazia Vans Old Skool). Sem marca nem modelo, não filtra. */
export function foraDoModelo(nome: string, marca?: string | null, modelo?: string | null) {
  const eco = ecossistemaDoPedido(marca, modelo);
  /* A linha já diz a marca ("iPhone" = Apple): a marca não precisa estar escrita. */
  const marcaImplicita = !!eco && !!modelo && eco.linha.test(normalizar(modelo));
  const pedidos = [marcaImplicita ? null : marca, modelo].filter(
    (v): v is string => !!v && junto(v).length >= 2,
  );
  if (pedidos.some((v) => !contemSemEmendar(nome, v))) return true;
  if (eco) {
    const n = normalizar(nome);
    const pedido = normalizar(`${marca ?? ""} ${modelo ?? ""}`);
    if (ECOSSISTEMAS.some((r) => r !== eco && r.re.test(n) && !r.re.test(pedido))) return true;
  }
  return !!modelo && diferencaDeModelo([marca, modelo].filter(Boolean).join(" "), nome) != null;
}

/* Aparelho citado pelo nome da linha, sem rede (a interpretação remota pode
   não responder, e a prévia nunca espera por ela). Só linhas inequívocas. */
const RE_LINHAS: { marca: string; re: RegExp }[] = [
  {
    marca: "Apple",
    re: /\b(iphone ?\d{1,2}e?(?: ?(?:pro max|pro|plus|max|mini|air))?|ipad(?: ?(?:pro|air|mini))?|apple watch(?: ?(?:series ?\d{1,2}|ultra ?\d?|se))?|airpods(?: ?(?:pro|max))?(?: ?\d)?)\b/,
  },
  {
    marca: "Samsung",
    re: /\b(galaxy ?(?:[saz] ?\d{1,3}|note ?\d{1,2}|z ?(?:flip|fold) ?\d?)(?: ?(?:ultra|plus|fe|edge))?)\b/,
  },
  {
    marca: "Xiaomi",
    re: /\b((?:redmi|poco) ?(?:note ?)?[a-z]?\d{1,2}[a-z]?(?: ?(?:pro\+?|pro|plus|ultra|s))?)\b/,
  },
  {
    marca: "Motorola",
    re: /\b(moto ?[ge] ?\d{1,3}(?: ?(?:power|play|stylus|plus))?|moto edge ?\d{0,2}(?: ?(?:pro|plus|ultra|neo))?)\b/,
  },
];

/** Marca e modelo da linha citada na frase ("capa iphone 17 pro max" ->
    Apple, "iphone 17 pro max"). Sem linha conhecida: null. */
export function modeloDaFrase(q: string): { marca: string; modelo: string } | null {
  const t = normalizar(q);
  for (const { marca, re } of RE_LINHAS) {
    const m = re.exec(t);
    if (m?.[1] && /\d|ipad|airpods|apple watch/.test(m[1])) return { marca, modelo: m[1].trim() };
  }
  return null;
}

/* Busca pelo aparelho (sem palavra de acessório): capa, película, cabo e
   carregador "para iPhone 17 Pro Max" não são o aparelho. O acessório vem
   ANTES do modelo no título ("Capa iPhone..."); "iPhone ... com cabo" fica. */
const RE_ACESSORIO_DO_APARELHO =
  /\b(capas?|capinhas?|peliculas?|cases?|cabos?|carregador(es)?|suportes?|baterias?|vidros?|protetor(es)?|lentes?|adaptador(es)?|pulseiras?|carcacas?|kit|compativel|para)\b/;
function acessorioDoAparelho(nome: string, modelo: string): boolean {
  const t = normalizar(nome);
  const m = normalizar(modelo);
  const pos = t.indexOf(m);
  const antes = pos >= 0 ? t.slice(0, pos) : t;
  return RE_ACESSORIO_DO_APARELHO.test(antes);
}

/* Negativos que valem sem o modelo. Por tipo: conector de outro sinal e
   tomada de outro uso (móvel, painel, industrial) no lugar da tomada de
   parede. Universais: miniatura, chaveiro e brinquedo no lugar do item de
   verdade (pneu, ração, peça de carro), salvo busca de presente ou infantil. */
const NEGATIVOS_ELETRICA = [
  "hdmi",
  "antena",
  "coaxial",
  "rj45",
  "rj11",
  "keystone",
  "cat5",
  "cat5e",
  "cat6",
  "vga",
  "telefone",
  "moveis",
  "movel",
  "painel",
  "industrial",
];
const NEGATIVOS_POR_TIPO: Record<string, string[]> = {
  tomada: NEGATIVOS_ELETRICA,
  tomadas: NEGATIVOS_ELETRICA,
  interruptor: NEGATIVOS_ELETRICA,
};
/* APARELHO DA LINHA BRANCA E TV (Weslei, 02/11: "maquina lava e seca
   barata" trouxe lava-louças, nicho e placa). Pelo pedido: outros produtos
   com nome parecido saem, as buscas certas entram na heurística e, sem
   preço pedido, um piso tira o que custa menos que qualquer aparelho real. */
const NEGATIVOS_LAVADORA = [
  "lava louca",
  "lava loucas",
  "lavalouca",
  "lava pisos",
  "mop",
  "esfregao",
  "nicho",
  "suporte",
  "placa",
  "amortecedor",
];
/** dominios: só produtos destas categorias oficiais do Mercado Livre (o
    catálogo devolve nicho, placa e mop na busca "lava e seca"); categorias:
    os mais vendidos de cada uma completam a lista. Conferidos em 02/11 no
    catálogo em alta do site. */
type RegraAparelho = {
  re: RegExp;
  negativos: string[];
  buscas?: string[];
  piso?: number;
  dominios?: string[];
  categorias?: string[];
};
const APARELHOS: RegraAparelho[] = [
  {
    re: /\b(lava e seca|lava seca|lavadora e secadora)\b/,
    negativos: NEGATIVOS_LAVADORA,
    buscas: [
      "lava e seca",
      "lava e seca samsung",
      "lava e seca lg",
      "lava e seca electrolux",
      "lava e seca midea",
      "lavadora e secadora",
    ],
    piso: 1200,
    dominios: ["MLB-WASHING_MACHINES", "MLB-LAUNDRY_CENTERS"],
    categorias: ["MLB21168", "MLB455298"],
  },
  {
    re: /\b(lavadoras?( de roupas?)?|maquinas? de lavar( roupas?)?|lava roupas?)\b/,
    negativos: NEGATIVOS_LAVADORA,
    buscas: [
      "maquina de lavar",
      "lavadora de roupas brastemp",
      "lavadora de roupas electrolux",
      "lavadora de roupas consul",
      "lavadora de roupas samsung",
    ],
    dominios: ["MLB-WASHING_MACHINES", "MLB-LAUNDRY_CENTERS"],
    categorias: ["MLB21168"],
  },
  {
    re: /\b(geladeiras?|refrigerador(es)?)\b/,
    negativos: [],
    piso: 1000,
    dominios: ["MLB-REFRIGERATORS"],
    categorias: ["MLB181294"],
  },
  {
    re: /\bar condicionado\b/,
    negativos: ["climatizador", "mini ar", "usb", "tubulacao"],
    buscas: [
      "ar condicionado split inverter",
      "ar condicionado split 9000 btus",
      "ar condicionado split 12000 btus",
    ],
    piso: 800,
    dominios: ["MLB-AIR_CONDITIONERS"],
    categorias: ["MLB1646"],
  },
  {
    re: /\b(tv|tvs|smart tv|televis(ao|oes|or|ores))\b/,
    negativos: [],
    dominios: ["MLB-TELEVISIONS"],
    categorias: ["MLB1002"],
  },
];

const regrasDoPedido = (consulta: string) =>
  buscaDeAparelho(consulta) ? APARELHOS.filter((r) => r.re.test(normalizar(consulta))) : [];

/** Categoria oficial e buscas do aparelho pedido (a 1ª regra com
    categoria), ou null quando a busca não é por um desses aparelhos. */
export function regraDoAparelho(consulta: string) {
  const r = regrasDoPedido(consulta).find((x) => x.dominios?.length);
  return r
    ? { buscas: r.buscas ?? [], dominios: r.dominios ?? [], categorias: r.categorias ?? [] }
    : null;
}

/** Preço mínimo de um aparelho de verdade (lava e seca, geladeira, ar,
    TV de 43" ou mais), só quando a pessoa não pediu preço nem a peça. */
export function pisoDoAparelho(consulta: string): number | null {
  const q = normalizar(consulta);
  if (buscaDeAparelho(q)) {
    const piso = regrasDoPedido(q).find((r) => r.piso)?.piso;
    if (piso) return piso;
    const tv = /\b(tv|tvs|smart tv|televis(ao|or))\b/.test(q);
    const pol = Number(
      /\b(\d{2,3}) ?(polegadas|pol)\b/.exec(q)?.[1] ?? /\btv (\d{2,3})\b/.exec(q)?.[1],
    );
    if (tv && pol >= 43 && pol <= 100) return 900;
  }
  return null;
}

const NEGATIVOS_UNIVERSAIS = ["miniatura", "chaveiro", "maquete", "de brinquedo"];
const BUSCA_INFANTIL =
  /\b(brinquedos?|criancas?|infantil|menin[oa]s?|bebes?|presentes?|pelucias?|kids|colecao|colecionavel)\b/;

/* Weslei, 07/11 ("mesa de jantar de luxo" trouxe luminária de mesa,
   organizador de cabos de mesa, mousepad de mesa). The type word in the title
   was only a detail of another product. When the request names a kind
   ("mesa DE JANTAR", "cadeira DE ESCRITORIO") and the title is another
   product (its first word is not the type), the kind must be in the title. */
const NAO_E_TIPO = new Set(["luxo", "qualidade", "verdade", "marca", "presente", "boa", "bom"]);
export function tipoUsadoComoDetalhe(nome: string, tipo: string, consulta: string): boolean {
  const raiz =
    normalizar(tipo)
      .split(" ")[0]
      ?.replace(/(es|s)$/, "") ?? "";
  if (raiz.length < 3) return false;
  const pedido = normalizar(consulta);
  const qual = new RegExp(`\\b${raiz}(?:e?s)? (?:de|para|pra) ([a-z]{4,})`).exec(pedido)?.[1];
  if (!qual || NAO_E_TIPO.has(qual)) return false;
  /* 07/11: "roupa de academia" is any gym piece (camiseta dry fit, bermuda de
     treino); qualificadorFora checks the piece and the gym words instead. */
  if (raiz === "roupa" && RE_USO_ACADEMIA.test(qual)) return false;
  const t = ` ${normalizar(nome)} `;
  const qualRaiz = qual.replace(/(es|s)$/, "");
  if (t.includes(` ${qual} `) || t.includes(` ${qualRaiz} `) || t.includes(` ${qualRaiz}s `))
    return false;
  const cabeca = (tipoDoProduto(nome) ?? "").replace(/(es|s)$/, "");
  return cabeca !== raiz;
}

/* QUALIFICADORES DA FRASE (Weslei, 07/11: "roupa de academia masculino"
   trouxe legging feminina, bolsa de academia e roupa de umbanda). O que a
   pessoa digitou vira trava: gênero, peça de roupa e uso (academia). */
const RE_FEM = /\b(feminin[oa]s?|mulher(es)?|women|woman|ladies|damas?)\b/;
const RE_MASC = /\b(masculin[oa]s?|homens?|men|mens|male)\b/;
/* Pieces sold for women unless the title says otherwise. */
const PECA_FEMININA =
  /\b(leggings?|tops?|cropped|croped|saias?|sutias?|vestidos?|biquinis?|maios?|bodys?|calcinhas?|lingeries?|macaquinhos?|shortsaias?)\b/;
const PECAS_DE_ROUPA = new Set(
  "roupa camiseta camisa regata bermuda short calca conjunto legging top jaqueta moletom blusa macacao macaquinho cropped saia vestido agasalho colete cueca body corta-vento blusao camisao".split(
    " ",
  ),
);
const RE_USO_ACADEMIA =
  /\b(academia|fitness|treinos?|dry ?fit|esportiv[oa]s?|esportes?|corridas?|crossfit|musculacao|gym|compressao|running|caminhada|suplex|segunda pele|workout|training)\b/;

const ROUPA_DE_CASA = /\broupas? (de|para) (cama|banho|mesa)\b/;
const singular = (w: string) => w.replace(/(oes|aes)$/, "ao").replace(/(es|s)$/, "");

export function generoDoPedido(pedido: string): "m" | "f" | null {
  if (/\bunissex\b/.test(pedido)) return null;
  const f = RE_FEM.test(pedido);
  const m = RE_MASC.test(pedido);
  return f === m ? null : f ? "f" : "m";
}

/** Gênero, peça e uso pedidos e o título não cumpre (normalizados). */
export function qualificadorFora(titulo: string, pedido: string): boolean {
  const g = generoDoPedido(pedido);
  const fem = RE_FEM.test(titulo);
  const masc = RE_MASC.test(titulo);
  if (g === "m" && !masc && (fem || PECA_FEMININA.test(titulo))) return true;
  if (g === "f" && masc && !fem) return true;
  const tipoPedido = singular(tipoDoProduto(pedido) ?? "");
  const ehRoupa = PECAS_DE_ROUPA.has(tipoPedido);
  /* "roupa de ..." is any piece of clothing, never a bag or a bottle. */
  if (
    tipoPedido === "roupa" &&
    !ROUPA_DE_CASA.test(pedido) &&
    !PECAS_DE_ROUPA.has(singular(tipoDoProduto(titulo) ?? ""))
  )
    return true;
  if (ehRoupa && RE_USO_ACADEMIA.test(pedido) && !RE_USO_ACADEMIA.test(titulo)) return true;
  /* 07/11 ("Conjunto Roupa Fitness Paris" was a women's set): clothing for a
     gender must say that gender (or unissex) in the title. */
  if (
    (ehRoupa || tipoPedido === "roupa") &&
    g &&
    !/\bunissex\b/.test(titulo) &&
    !(g === "m" ? masc : fem)
  )
    return true;
  return false;
}

/** "roupa de academia masculino" is never a catalog product: search the
    real pieces of that gender and use ("camiseta academia masculina"...). */
export function buscasDeRoupa(q: string): string[] {
  const t = normalizar(q);
  if (singular(tipoDoProduto(t) ?? "") !== "roupa" || ROUPA_DE_CASA.test(t)) return [];
  const g = generoDoPedido(t);
  const resto = t
    .replace(/\broupas?\b/g, " ")
    .replace(/\b(de|para|pra)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pecas =
    g === "f"
      ? ["legging", "conjunto", "top", "short", "macaquinho"]
      : g === "m"
        ? ["camiseta", "bermuda", "regata", "short", "conjunto"]
        : ["camiseta", "conjunto", "bermuda"];
  return pecas.map((p) => `${p} ${resto}`.trim().slice(0, 60));
}

/** O título mostra outro produto? (termo negativo do modelo, do tipo ou
    universal, com plural simples; o que a pessoa digitou nunca exclui).
    Sem tipo informado, vale o tipo da própria consulta. */
export function foraDaIntencao(
  nome: string,
  intencao: IntencaoDoFiltro,
  consulta: string,
): boolean {
  if (foraDoModelo(nome, intencao.marca, intencao.modelo)) return true;
  if (
    intencao.modelo &&
    !acessorioDoPedido(consulta) &&
    ECOSSISTEMAS.some((e) => e.linha.test(normalizar(intencao.modelo!))) &&
    acessorioDoAparelho(nome, intencao.modelo)
  )
    return true;
  if (itemSecundarioFora(consulta, nome)) return true;
  if (qualificadorFora(normalizar(nome), normalizar(consulta))) return true;
  const pedido = normalizar(`${consulta} ${intencao.contextoUso ?? ""}`.replace(/_/g, " "));
  // Weslei, 02/11: "lava e seca" trazia lavadora que só lava. Pedido com as
  // duas funções exige a secagem no nome.
  if (
    /\blava(dora)?s? e seca(dora)?s?\b|\blava ?seca\b/.test(pedido) &&
    !/\bseca(dora|gem)?s?\b|\blava ?seca\b|\bwasher ?dryer\b/.test(normalizar(nome))
  )
    return true;
  const tipo = intencao.tipoProduto ?? tipoDoProduto(consulta) ?? "";
  if (tipoUsadoComoDetalhe(nome, tipo, consulta)) return true;
  const t = ` ${normalizar(nome)} `;
  const termos = [
    ...(intencao.termosNegativos ?? []),
    ...(NEGATIVOS_POR_TIPO[tipo] ?? []),
    ...regrasDoPedido(consulta).flatMap((r) => r.negativos),
    ...(BUSCA_INFANTIL.test(pedido) ? [] : NEGATIVOS_UNIVERSAIS),
    /* Weslei, 05/11: adult clothing ("feminino", "masculino") never shows kids' pieces. */
    ...(!BUSCA_INFANTIL.test(pedido) &&
    /\b(feminin[oa]s?|masculin[oa]s?|adult[oa]s?|mulher|homem)\b/.test(pedido)
      ? ["menina", "menino", "infantil", "juvenil", "bebe", "kids"]
      : []),
  ];
  return termos.some((n) => {
    if (` ${pedido} `.includes(` ${n} `)) return false;
    return [n, `${n}s`, `${n}es`].some((f) => t.includes(` ${f} `));
  });
}

/** Sem nada para mostrar (Weslei, 02/11: mensagem do comprador, sem jargão). */
export const MENSAGEM_SEM_OPCOES =
  "Não encontramos anúncios ativos para este termo exato no momento. Experimente buscar com outras palavras ou cole o link direto de uma oferta.";

/* ACESSÓRIO x APARELHO (Weslei, 02/11: "Capinha masculina iPhone 17 pro max"
   virou "O Apple iPhone 17 Pro Max não está no catálogo"). Com palavra de
   acessório, o produto é o acessório; o aparelho citado só filtra a
   compatibilidade. */
const ACESSORIOS: [RegExp, string][] = [
  [/\bcapinhas?\b/, "capinha"],
  [/\bpeliculas?\b/, "pelicula"],
  [/\bcapas?\b/, "capa"],
  [/\bcases?\b/, "case"],
  [/\bcarregador(es)?\b/, "carregador"],
  [/\bcabos?\b/, "cabo"],
  [/\bsuportes?\b/, "suporte"],
  [/\bfones?\b/, "fone"],
  [/\bbaterias?\b/, "bateria"],
];

/** O acessório pedido (sem acento, no singular) ou null. */
export function acessorioDoPedido(q: string): string | null {
  const t = normalizar(q);
  for (const [re, nome] of ACESSORIOS) {
    const m = re.exec(t);
    // "iPhone 15 com carregador" é o celular: o acessório só vale quando é o produto.
    if (m && !/\b(com|sem|e|mais|inclui|acompanha)\s*$/.test(t.slice(0, m.index))) return nome;
  }
  return null;
}

/** Aplica a regra do acessório à intenção: tipo = acessório e toda busca
    traz o acessório (nunca só o nome do aparelho). Sem acessório, igual. */
export function comAcessorio<
  T extends {
    buscas: string[];
    tipoProduto?: string | null;
    marca?: string | null;
    modelo?: string | null;
  },
>(intencao: T, q: string): T {
  const acessorio = acessorioDoPedido(q);
  if (!acessorio) return intencao;
  const buscas = intencao.buscas.map((b) =>
    acessorioDoPedido(b) ? b : `${acessorio} ${b}`.slice(0, 60),
  );
  return {
    ...intencao,
    tipoProduto: acessorio,
    buscas: buscas.length ? buscas : [q.slice(0, 60)],
    /* A marca citada é a do aparelho, não a da capinha ("Capinha iPhone 17
       Pro Max" de outra marca não traz "Apple" no título): só o modelo filtra. */
    ...(intencao.modelo ? { marca: null } : {}),
  };
}

const SINONIMOS_ACESSORIO: Record<string, string[]> = {
  capinha: ["capinha", "capa"],
  capa: ["capa", "capinha"],
  case: ["case", "capinha"],
  pelicula: ["pelicula"],
  carregador: ["carregador"],
  cabo: ["cabo"],
  suporte: ["suporte"],
  fone: ["fone"],
  bateria: ["bateria"],
};

const RE_PRECO =
  /\b(?:(ate|abaixo de|menos de|no maximo)|(a partir de|acima de|mais de|no minimo)|entre)\s+(\d+(?:[.,]\d+)?)(?:\s*reais)?(?:\s+(?:e|a)\s+(\d+(?:[.,]\d+)?)(?:\s*reais)?)?/;

const numero = (s: string | undefined) => {
  if (!s) return null;
  const n = Number(s.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Faixa de preço citada na frase ("até R$ 100", "menos de 200", "entre 50 e
    150", "a partir de 300") e a frase sem ela. */
export function faixaDePreco(q: string): { min: number | null; max: number | null; resto: string } {
  const t = normalizar(q.replace(/r\$\s*/gi, " ").replace(/(\d)\.(\d{3})\b/g, "$1$2"));
  const m = RE_PRECO.exec(t);
  if (!m) return { min: null, max: null, resto: t };
  const a = numero(m[3]);
  const b = numero(m[4]);
  const resto = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length))
    .replace(/\s+/g, " ")
    .trim();
  if (b != null && a != null) return { min: Math.min(a, b), max: Math.max(a, b), resto };
  if (m[2]) return { min: a, max: null, resto };
  return { min: null, max: a, resto };
}

/* Palavras de venda não identificam o produto ("lava e seca barata"). */
const RE_VENDA =
  /\b(barat[oa]s?|bo[mn]s?|boas?|melhor(es)?|promocao|promocoes|ofertas?|custo beneficio|em conta)\b/g;

/** Intenção sem rede, na hora (Weslei, 02/11: busca por texto rápida): vale
    quando a interpretação remota não responde em 3,5 s. Acessório vira o
    produto, com o sinônimo como segunda busca; faixa de preço pela frase. */
export function extrairIntencaoRapida(q: string): {
  buscas: string[];
  precoMin: number | null;
  precoMax: number | null;
  resumo: string;
  tipoProduto: string | null;
  contextoUso: null;
  termosNegativos: string[];
} {
  const { min, max, resto } = faixaDePreco(q);
  const frase = (
    (resto || normalizar(q)).replace(RE_VENDA, " ").replace(/\s+/g, " ").trim() || normalizar(q)
  ).slice(0, 60);
  const acessorio = acessorioDoPedido(frase);
  let buscas = [...new Set([...regrasDoPedido(frase).flatMap((r) => r.buscas ?? []), frase])];
  if (acessorio) {
    const sem = frase
      .replace(new RegExp(`\\b${acessorio}(e?s)?\\b`), " ")
      .replace(/\s+/g, " ")
      .trim();
    buscas = [
      ...new Set((SINONIMOS_ACESSORIO[acessorio] ?? [acessorio]).map((a) => `${a} ${sem}`.trim())),
    ];
  }
  const roupa = buscasDeRoupa(frase);
  if (roupa.length) buscas = [...roupa, ...buscas];
  return {
    buscas: buscas.filter((b) => b.length >= 2).slice(0, 3),
    precoMin: min,
    precoMax: max,
    resumo: "",
    tipoProduto: acessorio ?? tipoDoProduto(frase),
    contextoUso: null,
    termosNegativos: [],
  };
}
