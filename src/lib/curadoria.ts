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

/** "sig:" key of a listing's model (title without colors/sizes, first 6 words). */
export function assinaturaDoModelo(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const p = sem(nome)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(CORES, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return p.length >= 3 ? `sig:${p.join(" ")}` : null;
}

export type Area = "beleza" | "joia" | "calcado" | "outro";

export function areaDaBusca(q: string): Area {
  const s = sem(q);
  if (/skin ?care|facial|hidratante|serum|protetor solar|sabonete|micelar|cosmetic|maquiagem|perfume|creme|tonico|autocuidado/.test(s)) return "beleza";
  if (/bijuteri|semijoia|\bjoias?\b|colar|brinco|pulseira|\baneis\b|\banel\b|pingente|ear cuff|argola/.test(s)) return "joia";
  if (/calcado|sapato|tenis|sandalia|chinelo|rasteir|sapatilha|papete|\bbotas?\b|slide|tamanco|mule\b/.test(s)) return "calcado";
  return "outro";
}

const generoDaBusca = (s: string) =>
  /feminin|mulher|\bdela\b/.test(s) ? "f" : /masculin|homem|\bdele\b/.test(s) ? "m" : null;

const TOY = /\b(zona ?criativa|uatt|brinquedo|infantil|kids|crianca|menina|pelucia|slime|massinha|fantasia|boneca|kit spa infantil)\b/;
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
const TEMA = /\b(star ?wars|marvel|vingadores|homem[- ]aranha|batman|dc comics|harry potter|pokemon|naruto|anime|disney|stitch|mandalorian|darth vader|baby yoda|grogu|senhor dos aneis|friends|stranger things)\b/;
const TIPO_PEDIDO = /\b(caneca|chaveiro|camiseta|camisa|almofada|lego|funko|boneco|action figure|luminaria|abajur|quadro|livro|meia|bone|mochila|copo|pelucia|fantasia)\b/;
const DESTAQUE = /\b(luminaria|abajur|led 3d|3d led|16 cores|colecionavel|edicao especial|replica|estatua|busto|quadro|funko|lego|hot toys|sabre de luz)\b/;
const MIUDEZA = /\b(chaveiro|adesivo|botton|playskool|imaginext|pre ?escolar|bate e volta|giratorio)\b/;
const pesoTema = (s: string, t: string) =>
  !TEMA.test(s) || TIPO_PEDIDO.test(s) ? 0 : DESTAQUE.test(t) ? 2 : MIUDEZA.test(t) ? -1 : 0;

/* Season, by São Paulo month (Nov–Feb summer, May–Aug winter). */
function estacao(agora: Date): "verao" | "inverno" | null {
  const m = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(agora));
  if (m >= 11 || m <= 2) return "verao";
  if (m >= 5 && m <= 8) return "inverno";
  return null;
}
const DA_ESTACAO = {
  verao: /\b(sandalia|rasteir|papete|chinelo|slide|tamanco|anabela|praia|protetor solar|biquini|regata|short)\b/,
  inverno: /\b(bota|coturno|moletom|jaqueta|casaco|cachecol|meia|pantufa|hidratante labial)\b/,
};

/** Does this title belong in a list for the query? */
export function aprovadoPeloCurador(q: string, titulo: string): boolean {
  const s = sem(q);
  const t = sem(titulo);
  const area = areaDaBusca(q);
  if (area === "beleza" && !TOY.test(s) && TOY.test(t)) return false;
  if (area === "joia" && !JOIA_FORA.test(s) && JOIA_FORA.test(t)) return false;
  if (area === "calcado" && generoDaBusca(s) === "f" && CALCADO_MASC.test(t) && !/feminin/.test(t)) return false;
  return true;
}

/** Filter, one card per model, best brands and the season first (stable). */
export function curarResultados<T>(q: string, itens: T[], nome: (i: T) => string, agora = new Date()): T[] {
  const area = areaDaBusca(q);
  const marca = MARCAS[area];
  const est = estacao(agora);
  const temporada = est ? DA_ESTACAO[est] : null;
  const sq = sem(q);
  const vistos = new Set<string>();
  const ficam: T[] = [];
  for (const i of itens) {
    const n = nome(i);
    if (!aprovadoPeloCurador(q, n)) continue;
    const sig = assinaturaDoModelo(n);
    if (sig) {
      if (vistos.has(sig)) continue;
      vistos.add(sig);
    }
    ficam.push(i);
  }
  return ficam
    .map((i, k) => {
      const t = sem(nome(i));
      const peso =
        (marca?.test(t) ? 2 : 0) + (area !== "outro" && temporada?.test(t) ? 1 : 0) + pesoTema(sq, t);
      return { i, k, peso };
    })
    .sort((a, b) => b.peso - a.peso || a.k - b.k)
    .map((x) => x.i);
}
