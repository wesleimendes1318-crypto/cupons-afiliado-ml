/* CURADOR (Weslei, 05/11: "agentes que façam essa curadoria maravilhosa em
   todas as buscas e resultados"). One rule set for every result list: site
   search, categories, showcases and Amigo Secreto (they all go through
   buscaGuiada). Free and instant: only words, no model call.
   - drops what never belongs (toy in beauty, resale lots in jewelry, men's
     shoes in a women's search) unless the person asked for it;
   - the same model in another color/size shows once ("Comparar preço" opens
     the other listings);
   - best brands and the season's pieces go first among equally good matches
     (the intent order — exact model, matched words — still decides first).
   Never invents a product: it only drops or reorders. */

const sem = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const CORES =
  /\b(preto|preta|pretos|pretas|branco|branca|brancos|rosa|azul|verde|vermelho|vermelha|bege|cinza|nude|marrom|caramelo|dourado|dourada|prata|off ?white|amarelo|amarela|lilas|roxo|roxa|vinho|laranja|marinho|creme|areia|chumbo|grafite|tamanho|tam|\d{2})\b/g;

/* Kit/volume multipliers and filler words left out of the model key
   (Weslei, 05/11: "3x", "kit", "combo", "unidades" made the same product
   show twice). */
const MULTIPLICADORES =
  /\b(\d+ ?x|x ?\d+|\d+ ?(un|und|unid|unidades|pecas|pcs|ml|l|g|kg)|kit|combo|unidades?|unid|und|pecas?|pcs|com|de|da|do|das|dos|e|para|em)\b/g;

/* Marketing filler, sizes and extra colors that never tell two products apart
   (Weslei, 06/11: "Ateliê Kr", "Verão", "Casual", "Viscolinho", "Botões"). */
const ENCHIMENTO =
  /\b(um|uma|casual|verao|inverno|primavera|outono|luxo|elegante|elegancia|botoes|botao|bolsos?|alta|qualidade|original|promocao|oferta|novo|nova|moda|tendencia|estilo|lindo|linda|conforto|confortavel|viscolinho|viscose|gg|xg|xgg|eg|egg|plus|size|unico|unica|azul ?marinho|verde ?militar|terracota|mostarda|goiaba|off|white)\b/g;

/** Title words that identify the product: no accents, colors, sizes,
    multipliers; common double-letter spellings folded ("multirrestaurador"
    = "multirestaurador"). */
export function palavrasDoModelo(nome: string | null | undefined): string[] {
  if (!nome) return [];
  return sem(nome)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(CORES, " ")
    .replace(MULTIPLICADORES, " ")
    .replace(ENCHIMENTO, " ")
    .replace(/rr/g, "r")
    .replace(/ss/g, "s")
    .split(/\s+/)
    .filter((w) => w.length > 1 || /\d/.test(w));
}

/** "sig:" key of a listing's model (first 10 identifying words).
    05/11: 6 words merged different shoes with generic titles ("Tênis Feminino
    Casual Academia Caminhada ...") and cut showcases from ~35 to ~5. */
export function assinaturaDoModelo(nome: string | null | undefined): string | null {
  const p = palavrasDoModelo(nome).slice(0, 10);
  return p.length >= 3 ? `sig:${p.join(" ")}` : null;
}

/** "foto:" key of the main photo: Mercado Livre serves the same picture under
    the same id ("D_NQ_NP_2X_<id>-F.webp", "D_<id>-O.jpg"). */
export function idDaFoto(url: string | null | undefined): string | null {
  const m = /mlstatic\.com\/(?:D_(?:NQ_NP_)?(?:2X_)?(?:Q_NP_)?)?(\d+-ML[A-Z]\d+_\d+)/.exec(
    url ?? "",
  );
  return m ? `foto:${m[1]}` : null;
}

/** "core:" key: the identifying words in alphabetical order, so the same
    product with the words in another order ("Conjunto Regata e Short
    Feminino" / "Conjunto Feminino Regata Short") gets the same key. */
export function assinaturaCanonica(nome: string | null | undefined): string | null {
  const p = [...new Set(palavrasDoModelo(nome))].sort();
  return p.length >= 3 ? `core:${p.join("_")}` : null;
}

/** Same product under another title (Weslei, 06/11): the shorter title
    inside the longer one (75%+), or Jaccard >= 0.55. Two guards keep
    different products apart: a number only one side has (128gb / 256gb,
    volume 1 / volume 2), and both sides having two or more words of their
    own (luminária "Darth Vader" / "Mestre Yoda", tênis "Vili Olimp" /
    "Actvitta Knit"). */
export function ehMesmoProduto(a: string[], b: string[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const A = new Set(a);
  const B = new Set(b);
  const soA = [...A].filter((w) => !B.has(w));
  const soB = [...B].filter((w) => !A.has(w));
  if (soA.some((w) => /\d/.test(w)) && soB.some((w) => /\d/.test(w))) return false;
  const proprias = Math.min(soA.length, soB.length);
  if (proprias >= 2) return false;
  const comuns = A.size - soA.length;
  /* Containment only when the shorter title has no word of its own: one
     extra word is often the model name ("Planner Max" / "Planner Cicero"). */
  if (proprias === 0 && comuns / Math.min(A.size, B.size) >= 0.75) return true;
  return comuns / (A.size + B.size - comuns) >= 0.55;
}

/** Kept for callers of the old name. */
export const quaseIgual = ehMesmoProduto;

/** One gate for repeated products, shared by the curator and Amigo Secreto:
    same photo, same model key, or a near-identical title. Adds the keys to
    `vistos` when the product is new. */
export function repetido(
  vistos: Set<string>,
  titulos: string[][],
  nome: string | null | undefined,
  imagem: string | null | undefined,
  marcar = true,
): boolean {
  const foto = idDaFoto(imagem);
  const sig = assinaturaDoModelo(nome);
  const core = assinaturaCanonica(nome);
  const palavras = palavrasDoModelo(nome);
  if (
    (foto && vistos.has(foto)) ||
    (sig && vistos.has(sig)) ||
    (core && vistos.has(core)) ||
    titulos.some((t) => ehMesmoProduto(t, palavras))
  )
    return true;
  if (marcar) {
    if (foto) vistos.add(foto);
    if (sig) vistos.add(sig);
    if (core) vistos.add(core);
    titulos.push(palavras);
  }
  return false;
}

export type Area = "beleza" | "joia" | "calcado" | "outro";

export function areaDaBusca(q: string): Area {
  const s = sem(q);
  if (
    /skin ?care|facial|hidratante|serum|protetor solar|sabonete|micelar|cosmetic|maquiagem|perfume|creme|tonico|autocuidado/.test(
      s,
    )
  )
    return "beleza";
  if (
    /bijuteri|semijoia|\bjoias?\b|colar|brinco|pulseira|\baneis\b|\banel\b|pingente|ear cuff|argola/.test(
      s,
    )
  )
    return "joia";
  if (
    /calcado|sapato|tenis|sandalia|chinelo|rasteir|sapatilha|papete|\bbotas?\b|slide|tamanco|mule\b/.test(
      s,
    )
  )
    return "calcado";
  return "outro";
}

const generoDaBusca = (s: string) =>
  /feminin|mulher|\bdela\b/.test(s) ? "f" : /masculin|homem|\bdele\b/.test(s) ? "m" : null;

const TOY =
  /\b(zona ?criativa|uatt|brinquedo|infantil|kids|crianca|menina|pelucia|slime|massinha|fantasia|boneca|kit spa infantil)\b/;
const JOIA_FORA = /\b(atacado|revenda|lote|kit \d{2,}|saquinho)\b/;
const CALCADO_MASC = /\b(kenner|pegada|democrata|ferracini|sapatenis|rider)\b/;

/** Best brands per area (owner, 05/11: "as melhores marcas como resultados principais"). */
const MARCAS: Record<Area, RegExp | null> = {
  beleza:
    /\b(sallve|principia|cerave|la roche|vichy|bioderma|neutrogena|creamy|avene|eucerin|isdin|nivea|natura|o boticario|boticario|loccitane|simple organic|adcos|episol|cetaphil|garnier|dove|granado|eudora)\b/,
  joia: /\b(vivara|life by vivara|pandora|rommanel|monte carlo|swarovski|bruna tavares|amsterdam sauer|mart joias|pratas? 925|banhad[oa] a ouro 18k)\b/,
  calcado:
    /\b(vizzano|moleca|beira rio|piccadilly|usaflex|melissa|havaianas|arezzo|schutz|santa lolla|ramarim|dakota|olympikus|nike|adidas|mizuno|asics|fila|vans|converse|puma|new balance|azaleia|grendene|ipanema|rider)\b/,
  outro: null,
};

/* Themed searches (franchise/fandom) without a product type: showpiece items
   (3D LED lamps, collectibles, wall art) go first, simple pre-school toys go
   last. Owner, 05/11: the Star Wars 3D lamp "encantador". */
const TEMA =
  /\b(star ?wars|marvel|vingadores|homem[- ]aranha|batman|dc comics|harry potter|pokemon|naruto|anime|disney|stitch|mandalorian|darth vader|baby yoda|grogu|senhor dos aneis|friends|stranger things)\b/;
const TIPO_PEDIDO =
  /\b(caneca|chaveiro|camiseta|camisa|almofada|lego|funko|boneco|action figure|luminaria|abajur|quadro|livro|meia|bone|mochila|copo|pelucia|fantasia)\b/;
const DESTAQUE =
  /\b(luminaria|abajur|led 3d|3d led|16 cores|colecionavel|edicao especial|replica|estatua|busto|quadro|funko|lego|hot toys|sabre de luz)\b/;
const MIUDEZA =
  /\b(chaveiro|adesivo|botton|playskool|imaginext|pre ?escolar|bate e volta|giratorio)\b/;
const pesoTema = (s: string, t: string) =>
  !TEMA.test(s) || TIPO_PEDIDO.test(s) ? 0 : DESTAQUE.test(t) ? 2 : MIUDEZA.test(t) ? -1 : 0;

/* Season, by São Paulo month (Nov–Feb summer, May–Aug winter). */
function estacao(agora: Date): "verao" | "inverno" | null {
  const m = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(
      agora,
    ),
  );
  if (m >= 11 || m <= 2) return "verao";
  if (m >= 5 && m <= 8) return "inverno";
  return null;
}
const DA_ESTACAO = {
  verao:
    /\b(sandalia|rasteir|papete|chinelo|slide|tamanco|anabela|praia|protetor solar|biquini|regata|short)\b/,
  inverno: /\b(bota|coturno|moletom|jaqueta|casaco|cachecol|meia|pantufa|hidratante labial)\b/,
};

/** Does this title belong in a list for the query? */
export function aprovadoPeloCurador(q: string, titulo: string): boolean {
  const s = sem(q);
  const t = sem(titulo);
  const area = areaDaBusca(q);
  if (area === "beleza" && !TOY.test(s) && TOY.test(t)) return false;
  if (area === "joia" && !JOIA_FORA.test(s) && JOIA_FORA.test(t)) return false;
  if (area === "calcado" && generoDaBusca(s) === "f" && CALCADO_MASC.test(t) && !/feminin/.test(t))
    return false;
  return true;
}

/** Filter, one card per model, best brands and the season first (stable). */
export function curarResultados<T>(
  q: string,
  itens: T[],
  nome: (i: T) => string,
  agora = new Date(),
  imagem?: (i: T) => string | null | undefined,
): T[] {
  const area = areaDaBusca(q);
  const marca = MARCAS[area];
  const est = estacao(agora);
  const temporada = est ? DA_ESTACAO[est] : null;
  const sq = sem(q);
  const vistos = new Set<string>();
  const titulos: string[][] = [];
  const ficam: T[] = [];
  for (const i of itens) {
    const n = nome(i);
    if (!aprovadoPeloCurador(q, n)) continue;
    if (repetido(vistos, titulos, n, imagem?.(i))) continue;
    ficam.push(i);
  }
  return ficam
    .map((i, k) => {
      const t = sem(nome(i));
      const peso =
        (marca?.test(t) ? 2 : 0) +
        (area !== "outro" && temporada?.test(t) ? 1 : 0) +
        pesoTema(sq, t);
      return { i, k, peso };
    })
    .sort((a, b) => b.peso - a.peso || a.k - b.k)
    .map((x) => x.i);
}

/** Gift archetype of a title: its first identifying word, singular
    ("Vasos Decorativos Cerâmica" -> "vaso"). */
export function arquetipoDoTitulo(nome: string | null | undefined): string {
  /* 07/11: "Kit Vasos" is a vase, and "Abajur" and "Luminária" are one kind. */
  const w = palavrasDoModelo(nome).find((p) => !GENERICOS.has(p) && !/^\d+$/.test(p)) ?? "";
  const k = w.length > 4 ? w.replace(/(oes|aes)$/, "ao").replace(/s$/, "") : w;
  return MESMO_TIPO[k] ?? k;
}
const GENERICOS = new Set(["kit", "conjunto", "jogo", "par", "combo", "mini", "super"]);
const MESMO_TIPO: Record<string, string> = {
  abajur: "luminaria",
  luminaria: "luminaria",
  luz: "luminaria",
  aromatizador: "difusor",
  difusor: "difusor",
  poster: "quadro",
  quadro: "quadro",
  capinha: "capa",
  vasinho: "vaso",
  headphone: "fone",
  headset: "fone",
};

/* Weslei, 06/11: no archetype monopoly ("Decoração" with 60 vases). Round
   robin over archetypes, each group keeping its own order (best first), so
   the first cards cover as many kinds as the list has. Drops nothing. */
export function intercalarPorDiversidade<T>(
  itens: T[],
  extrairArquetipo: (item: T) => string,
): T[] {
  const grupos = new Map<string, T[]>();
  for (const x of itens) {
    const k = extrairArquetipo(x);
    const g = grupos.get(k);
    if (g) g.push(x);
    else grupos.set(k, [x]);
  }
  const filas = [...grupos.values()];
  const saida: T[] = [];
  for (let i = 0; saida.length < itens.length; i++)
    for (const f of filas) if (i < f.length) saida.push(f[i]!);
  return saida;
}

/* Weslei, 06/11: in any 20-card window, one archetype fills at most 20%
   (4 cards). Extras move to the next window; nothing is dropped, and when
   only that archetype is left the order stays as it was. */
export function limitarPorArquetipo<T>(
  itens: T[],
  arquetipo: (item: T) => string,
  max = 4,
  janela = 20,
): T[] {
  const fila = [...itens];
  const saida: T[] = [];
  while (fila.length) {
    const inicio = saida.length - (saida.length % janela);
    const conta = new Map<string, number>();
    for (let i = inicio; i < saida.length; i++) {
      const k = arquetipo(saida[i]!);
      conta.set(k, (conta.get(k) ?? 0) + 1);
    }
    const k = fila.findIndex((x) => (conta.get(arquetipo(x)) ?? 0) < max);
    saida.push(fila.splice(Math.max(0, k), 1)[0]!);
  }
  return saida;
}

/* Weslei, 06/11: "sempre priorize produtos em alta, mais vendidos e de alta
   qualidade primeiro". Tier from the card's own signals: official best-seller
   rank and official store (the server already put trending/most compared
   first inside each answer; equal tiers keep that order). */
export function tierDeQualidade(r: { maisVendido?: number | null; lojaOficial?: boolean }): number {
  const pos = r.maisVendido ?? null;
  let t = pos == null ? 0 : pos <= 10 ? 4 : pos <= 50 ? 3 : pos <= 100 ? 2 : 1;
  if (r.lojaOficial === true) t += 2;
  return t;
}

/** Best tier first; inside each tier, kinds interleaved (variety) when asked. */
export function qualidadePrimeiro<T extends { maisVendido?: number | null; lojaOficial?: boolean }>(
  itens: T[],
  arquetipo?: (item: T) => string,
): T[] {
  const porTier = new Map<number, T[]>();
  for (const x of itens) {
    const t = tierDeQualidade(x);
    const g = porTier.get(t);
    if (g) g.push(x);
    else porTier.set(t, [x]);
  }
  return [...porTier.entries()]
    .sort((a, b) => b[0] - a[0])
    .flatMap(([, g]) => (arquetipo ? intercalarPorDiversidade(g, arquetipo) : g));
}
