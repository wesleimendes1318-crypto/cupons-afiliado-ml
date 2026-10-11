/* Identificação no servidor (10/10): completa o analisarLink com o que só a
   rede dá. Encurtado (amzn.to, a.co, shope.ee, meli.la...) vira o endereço
   final, sem abrir a página (só os redirecionamentos). Loja conhecida sem
   nome no endereço: lê só o título da página (og:title / <title>), com prazo
   curto; página de verificação ("Robot Check", "Just a moment") não vale.
   Nada é guardado.

   CAMPEÃO DO NICHO (11/10): de loja sem afiliação lê também o preço
   anunciado (JSON-LD/meta da própria página), a foto (og:image, só dos
   servidores de imagem das lojas conhecidas, para a conferência pela foto)
   e a categoria, e diz em qual marketplace afiliado a busca começa
   (src/lib/campeao-segmento.ts). Sem o dado, o campo fica vazio. */

import { analisarLink, type AnaliseLink } from "@/lib/analisar-link";
import { determinarCampeaoDoSegmento, type Campeao } from "@/lib/campeao-segmento";
import { RE_FOTO_PERMITIDA } from "@/lib/conferir-produto";

export type LinkIdentificado = AnaliseLink & {
  /** Preço anunciado na loja do link (lido na página; nunca estimado). */
  precoOrigem?: number;
  /** Foto do produto na loja do link (servidor de imagem conhecido). */
  imagemOrigem?: string;
  /** Categoria lida na página (JSON-LD/breadcrumb). */
  categoriaOrigem?: string;
  /** Onde a busca começa: o próprio player (Amazon/Shopee) ou o campeão. */
  campeao?: Campeao;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

/* Só endereços públicos com nome (nada de IP, localhost ou rede interna). */
export function hostPublico(host: string): boolean {
  const h = host.toLowerCase();
  if (!h.includes(".") || h === "localhost") return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return false;
  if (/\.(local|internal|lan|home|corp|localhost)$/.test(h)) return false;
  return true;
}

/* Lojas cujo título da página pode ser lido. */
const RE_TITULO_PERMITIDO =
  /(^|\.)(amazon\.com\.br|magazineluiza\.com\.br|kabum\.com\.br|casasbahia\.com\.br|pontofrio\.com\.br|extra\.com\.br|americanas\.com\.br|submarino\.com\.br|shoptime\.com\.br|shein\.com|aliexpress\.com|carrefour\.com\.br|netshoes\.com\.br|centauro\.com\.br|dafiti\.com\.br|fastshop\.com\.br|leroymerlin\.com\.br|madeiramadeira\.com\.br|temu\.com|petz\.com\.br|cobasi\.com\.br|drogasil\.com\.br|drogaraia\.com\.br|girafa\.com\.br)$/i;

async function comPrazo(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controle.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* Segue até 5 redirecionamentos sem ler a página. */
export async function resolverEncurtado(url: string): Promise<string | null> {
  let atual = url;
  for (let i = 0; i < 5; i++) {
    let u: URL;
    try {
      u = new URL(atual);
    } catch {
      return null;
    }
    if (!/^https?:$/.test(u.protocol) || !hostPublico(u.hostname)) return null;
    const r = await comPrazo(
      atual,
      { method: "GET", redirect: "manual", headers: { "User-Agent": UA } },
      4000,
    );
    if (!r) return i > 0 ? atual : null;
    try {
      await r.body?.cancel();
    } catch {
      /* corpo já fechado */
    }
    const destino = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && destino) {
      atual = new URL(destino, atual).toString();
      continue;
    }
    return i > 0 ? atual : null;
  }
  return atual;
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

function decodificarHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

const RE_TITULO_GENERICO =
  /^(amazon(\.com)?(\.br)?|robot check|just a moment|attention required|access denied|acesso negado|shopee( brasil)?|p[áa]gina n[ãa]o encontrada|ops|404|error|erro)\b/i;

/* Título limpo: sem o nome da loja antes ou depois. */
export function limparTitulo(bruto: string): string | null {
  let t = decodificarHtml(bruto).replace(/\s+/g, " ").trim();
  t = t.replace(/^amazon\.com\.br\s*:\s*/i, "");
  t = t.replace(/\s*:\s*amazon\.com\.br.*$/i, "");
  // "Produto | Loja", "Produto - Loja", "Produto – Loja": fica a parte maior.
  const partes = t.split(/\s+[|–—]\s+|\s+-\s+/).filter(Boolean);
  if (partes.length > 1) t = partes.reduce((a, b) => (b.length > a.length ? b : a));
  t = t.trim();
  if (t.length < 5 || t.length > 200 || RE_TITULO_GENERICO.test(t)) return null;
  if (!/\p{L}{3}/u.test(t)) return null;
  return t;
}

export type DadosDaPagina = {
  titulo: string | null;
  preco: number | null;
  imagem: string | null;
  categoria: string | null;
};

const precoValido = (v: unknown): number | null => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(
            v
              .replace(/[^\d.,]/g, "")
              .replace(/\.(?=\d{3}(\D|$))/g, "")
              .replace(",", "."),
          )
        : NaN;
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
};

/* Produto do JSON-LD (schema.org): preço da oferta, foto e categoria. */
export function dadosDoJsonLd(
  html: string,
): Omit<DadosDaPagina, "titulo"> & { nome: string | null } {
  const saida = {
    nome: null as string | null,
    preco: null as number | null,
    imagem: null as string | null,
    categoria: null as string | null,
  };
  const blocos = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const nos: unknown[] = [];
  for (const b of blocos) {
    try {
      const j = JSON.parse(b[1]!.trim()) as unknown;
      const lista = Array.isArray(j) ? j : [j];
      for (const x of lista) {
        nos.push(x);
        const g = (x as { "@graph"?: unknown[] })?.["@graph"];
        if (Array.isArray(g)) nos.push(...g);
      }
    } catch {
      /* bloco inválido: ignora */
    }
  }
  const tipo = (n: unknown) => {
    const t = (n as { "@type"?: unknown })?.["@type"];
    return Array.isArray(t) ? t.map(String) : [String(t ?? "")];
  };
  for (const n of nos) {
    const o = n as {
      name?: unknown;
      image?: unknown;
      category?: unknown;
      offers?: unknown;
      itemListElement?: unknown;
    };
    if (tipo(n).includes("Product")) {
      if (!saida.nome && typeof o.name === "string") saida.nome = o.name;
      const img = Array.isArray(o.image) ? o.image[0] : o.image;
      const urlImg = typeof img === "string" ? img : (img as { url?: unknown })?.url;
      if (!saida.imagem && typeof urlImg === "string") saida.imagem = urlImg;
      if (!saida.categoria && typeof o.category === "string") saida.categoria = o.category;
      const ofertas = Array.isArray(o.offers) ? o.offers : [o.offers];
      for (const of of ofertas) {
        const x = of as { price?: unknown; lowPrice?: unknown } | undefined;
        const p = precoValido(x?.price) ?? precoValido(x?.lowPrice);
        if (p != null && saida.preco == null) saida.preco = p;
      }
    }
    if (tipo(n).includes("BreadcrumbList") && !saida.categoria) {
      const itens =
        (o.itemListElement as Array<{ name?: unknown; item?: { name?: unknown } }>) ?? [];
      const nomes = (Array.isArray(itens) ? itens : [])
        .map((i) => String(i?.name ?? i?.item?.name ?? "").trim())
        .filter((x) => x && !/^(home|in[ií]cio|p[aá]gina inicial)$/i.test(x));
      if (nomes.length) saida.categoria = nomes.slice(0, 4).join(" > ");
    }
  }
  return saida;
}

const meta = (html: string, prop: string) =>
  new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  ).exec(html)?.[1] ??
  new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`,
    "i",
  ).exec(html)?.[1];

/** Título, preço, foto e categoria lidos na própria página (até 600 KB). */
export function dadosDoHtml(html: string): DadosDaPagina {
  const ld = dadosDoJsonLd(html);
  const og = meta(html, "og:title");
  const bruto = og ?? /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? ld.nome;
  const titulo = bruto ? limparTitulo(bruto) : null;
  const preco =
    ld.preco ??
    precoValido(meta(html, "product:price:amount")) ??
    precoValido(meta(html, "og:price:amount")) ??
    precoValido(meta(html, "price"));
  const foto = decodificarHtml(meta(html, "og:image") ?? ld.imagem ?? "").trim();
  const imagem = /^https:\/\//i.test(foto) && RE_FOTO_PERMITIDA.test(foto) ? foto : null;
  const categoria = ld.categoria ? decodificarHtml(ld.categoria).slice(0, 160) : null;
  return { titulo, preco, imagem, categoria };
}

/** Lê no máximo 600 KB da página da loja e devolve o que achar. */
export async function dadosDaPagina(url: string): Promise<DadosDaPagina | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!RE_TITULO_PERMITIDO.test(u.hostname) || !hostPublico(u.hostname)) return null;
  const r = await comPrazo(
    url,
    {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
    },
    4500,
  );
  if (!r || !r.ok || !r.body) return null;
  const leitor = r.body.getReader();
  const dec = new TextDecoder();
  let html = "";
  try {
    while (html.length < 600_000) {
      const { done, value } = await leitor.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      /* Com o título e o preço do produto, não precisa ler o resto. */
      if (/<\/head>/i.test(html) && /"price"\s*:/.test(html) && /<\/script>/i.test(html)) {
        if (dadosDoJsonLd(html).preco != null) break;
      }
    }
  } catch {
    /* lê o que veio */
  } finally {
    try {
      await leitor.cancel();
    } catch {
      /* já fechado */
    }
  }
  return dadosDoHtml(html);
}

/** Só o título (compatibilidade). */
export async function tituloDaPagina(url: string): Promise<string | null> {
  return (await dadosDaPagina(url))?.titulo ?? null;
}

/* Shopee: o encurtado às vezes cai num endereço com o produto no meio. */
function shopeeNoMeio(final: string): string | null {
  const texto = decodeURIComponent(final.replace(/%(?![0-9a-f]{2})/gi, "%25"));
  const m =
    /shopee\.com\.br\/([^/?#\s]+-i\.\d+\.\d+)/i.exec(texto) ??
    /shopee\.com\.br\/product\/(\d+\/\d+)/i.exec(texto);
  if (!m) return null;
  return /-i\./.test(m[1]!)
    ? `https://shopee.com.br/${m[1]}`
    : `https://shopee.com.br/product/${m[1]}`;
}

export async function identificarLink(texto: string): Promise<LinkIdentificado> {
  const inicial = analisarLink(texto);
  if (inicial.origem === "invalido") return inicial;
  let a: LinkIdentificado = inicial;
  if (a.encurtado && a.origem !== "mercadolivre") {
    const final = await resolverEncurtado(a.urlLimpa);
    if (final) {
      const alvo = a.origem === "shopee" ? (shopeeNoMeio(final) ?? final) : final;
      const b = analisarLink(alvo);
      if (b.origem !== "invalido") {
        a = {
          ...b,
          ...(b.termoIdentificado || !inicial.termoIdentificado
            ? {}
            : { termoIdentificado: inicial.termoIdentificado }),
        };
      }
    }
  }
  /* Loja sem afiliação: título, preço, foto e categoria da página. Amazon e
     Shopee: só o título quando o endereço não traz o nome (o resto a
     extensão lê com a sessão). */
  if (a.origem === "outro_player" && a.urlLimpa) {
    const d = await dadosDaPagina(a.urlLimpa);
    if (d) {
      a = {
        ...a,
        ...(a.termoIdentificado || !d.titulo ? {} : { termoIdentificado: d.titulo }),
        ...(d.preco != null ? { precoOrigem: d.preco } : {}),
        ...(d.imagem ? { imagemOrigem: d.imagem } : {}),
        ...(d.categoria ? { categoriaOrigem: d.categoria } : {}),
      };
    }
  } else if (!a.termoIdentificado && a.origem !== "mercadolivre" && a.urlLimpa) {
    const titulo = await tituloDaPagina(a.urlLimpa);
    if (titulo) a = { ...a, termoIdentificado: titulo };
  }
  if (a.origem !== "mercadolivre" && a.termoIdentificado) {
    a = {
      ...a,
      campeao: determinarCampeaoDoSegmento({
        titulo: a.termoIdentificado,
        categoria: a.categoriaOrigem ?? null,
        preco: a.precoOrigem ?? null,
      }),
    };
  }
  return a;
}
