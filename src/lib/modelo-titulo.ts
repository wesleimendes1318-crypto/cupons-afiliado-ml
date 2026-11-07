/* MODELO PELO TÍTULO (10/10, pedido 1181): a conferência pela foto chamou o
   "Echo Dot Max" de parecido que só muda a cor ("Cor: Preto -> Roxo",
   qualidade equivalente) contra o "Echo Dot 5ª Geração". Sem ficha (Amazon e
   Shopee não têm), o título é o que diz o modelo: versão (Max, Pro, Plus,
   Mini, Lite, Ultra...) e geração. Quando os dois títulos dizem coisas
   diferentes, o "Muda" ganha "Modelo: o do colado -> o do candidato" e o
   candidato nunca vira "mesmo produto". Só acrescenta diferença. */

const VERSOES = [
  "max",
  "pro",
  "plus",
  "mini",
  "lite",
  "ultra",
  "slim",
  "kids",
  "note",
  "neo",
  "fe",
] as const;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function versoes(titulo: string): Set<string> {
  const palavras = new Set(
    semAcento(titulo)
      .split(/[^a-z0-9+]+/)
      .filter(Boolean),
  );
  const achadas = new Set<string>();
  for (const v of VERSOES) if (palavras.has(v)) achadas.add(v);
  if ([...palavras].some((p) => p.endsWith("+"))) achadas.add("plus");
  return achadas;
}

function geracao(titulo: string): number | null {
  const t = semAcento(titulo);
  const m =
    /\b(\d{1,2})\s*(?:a|ª|º|°|th|rd|nd|st)?\s*gera(?:cao|tion)\b/.exec(t) ??
    /\bgera(?:cao|tion)\s*(\d{1,2})\b/.exec(t) ??
    /\b(\d{1,2})\s*(?:a|th|rd|nd|st)?\s*gen\b/.exec(t) ??
    /\bgen\s*(\d{1,2})\b/.exec(t);
  return m ? Number(m[1]) : null;
}

const nomeVersao = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

function descricao(vs: Set<string>, g: number | null): string {
  const partes = [...vs].map(nomeVersao);
  if (g != null) partes.push(`${g}ª geração`);
  return partes.length ? partes.join(" ") : "versão padrão";
}

/** "Modelo: 5ª geração -> Max" quando os títulos dizem modelos diferentes. */
export function diferencaDeModelo(
  original: string | null | undefined,
  candidato: string | null | undefined,
): string | null {
  if (!original || !candidato) return null;
  const vo = versoes(original);
  const vc = versoes(candidato);
  const go = geracao(original);
  const gc = geracao(candidato);
  const versaoMuda = vo.size !== vc.size || [...vo].some((v) => !vc.has(v));
  const geracaoMuda = go != null && gc != null && go !== gc;
  if (!versaoMuda && !geracaoMuda) return null;
  return `Modelo: ${descricao(vo, go)} -> ${descricao(vc, gc)}`;
}

/* Same as normalizar (busca-sugestoes.ts); copied because this file must stay
   a leaf (busca-sugestoes -> conferir-produto -> modelo-titulo). */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d)\s*[ªºao]\b/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* ECOSSISTEMA (Weslei, 07/11: "muito muito assertivo"). Linhas que dizem a
   marca sozinhas e as marcas rivais: buscando iPhone, Galaxy/Redmi/Moto não
   entram, e "iPhone 17 Pro Max" sem "Apple" no título continua valendo. */
export const ECOSSISTEMAS: { marca: string; re: RegExp; linha: RegExp }[] = [
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
  /* Consoles (07/11 spec): PS5 never brings Xbox or Switch items. */
  {
    marca: "sony",
    re: /\b(playstation|ps ?[2345]|dualsense|dualshock)\b/,
    linha: /\b(playstation|ps ?[345]|dualsense)\b/,
  },
  { marca: "microsoft", re: /\bxbox\b/, linha: /\bxbox\b/ },
  { marca: "nintendo", re: /\b(nintendo|joy ?cons?)\b/, linha: /\bnintendo\b/ },
];

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
export function acessorioDoAparelho(nome: string, modelo: string): boolean {
  const t = normalizar(nome);
  const m = normalizar(modelo);
  const pos = t.indexOf(m);
  const antes = pos >= 0 ? t.slice(0, pos) : t;
  return RE_ACESSORIO_DO_APARELHO.test(antes);
}

/* COMPARISON SHIELD (Weslei, 07/11: Samsung case for an iPhone, carcaça or
   display in place of the phone, iPhone 15 shown as the iPhone 16). Title
   only, no network; runs after the photo check (conferir-produto) and on
   every result that reaches the screen (multiloja-resultado). */
const RE_ACESSORIO_NO_INICIO =
  /^(?:kit )?(?:\d+ (?:un\w* )?)?(?:capas?|capinhas?|peliculas?|cases?|carcacas?|cabo flex|gaveta (?:de )?chip|conector (?:de )?carga|telas? touch|display (?:tela|lcd|oled|touch|frontal)|telas? (?:lcd|oled|display)|pecas? (?:de )?reposicao)\b/;

const NOMES_BONITOS: Record<string, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  airpods: "AirPods",
  se: "SE",
  fe: "FE",
};
const bonito = (modelo: string) =>
  modelo
    .split(" ")
    .map((p) => NOMES_BONITOS[p] ?? p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

function soAcessorio(titulo: string, modelo: string | null) {
  const t = normalizar(titulo);
  if (RE_ACESSORIO_NO_INICIO.test(t)) return true;
  return !!modelo && acessorioDoAparelho(titulo, modeloDaFrase(titulo)?.modelo ?? modelo);
}

export type TravaDeComparacao = { descartar: string } | { muda: string } | null;

/** Rival brand or accessory/part for a device: discard (not even similar).
    Same line, other number or tier ("iPhone 16 Pro Max" x "iPhone 15 Pro
    Max"): similar with "Modelo: X -> Y". Otherwise null. */
export function travaDeComparacao(
  original: string | null | undefined,
  candidato: string | null | undefined,
): TravaDeComparacao {
  if (!original || !candidato) return null;
  const o = normalizar(original);
  const c = normalizar(candidato);
  const ecos = ECOSSISTEMAS.filter((e) => e.re.test(o));
  if (ecos.length && ECOSSISTEMAS.some((e) => !ecos.includes(e) && e.re.test(c)))
    return { descartar: "Outra marca" };
  const mo = modeloDaFrase(original);
  if (!soAcessorio(original, mo?.modelo ?? null) && soAcessorio(candidato, mo?.modelo ?? null))
    return { descartar: "Apenas peça / acessório" };
  const mc = modeloDaFrase(candidato);
  if (
    mo &&
    mc &&
    mo.marca === mc.marca &&
    mo.modelo.replace(/ /g, "") !== mc.modelo.replace(/ /g, "")
  )
    return { muda: `Modelo: ${bonito(mo.modelo)} -> ${bonito(mc.modelo)}` };
  return null;
}
