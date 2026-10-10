/* Identificação no servidor (10/10): completa o analisarLink com o que só a
   rede dá. Encurtado (amzn.to, a.co, shope.ee, meli.la...) vira o endereço
   final, sem abrir a página (só os redirecionamentos). Loja conhecida sem
   nome no endereço: lê só o título da página (og:title / <title>), com prazo
   curto; página de verificação ("Robot Check", "Just a moment") não vale.
   Nada é guardado. */

import { analisarLink, type AnaliseLink } from "@/lib/analisar-link";

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
  /(^|\.)(amazon\.com\.br|magazineluiza\.com\.br|kabum\.com\.br|casasbahia\.com\.br|pontofrio\.com\.br|extra\.com\.br|americanas\.com\.br|submarino\.com\.br|shoptime\.com\.br|shein\.com|aliexpress\.com|carrefour\.com\.br|netshoes\.com\.br|centauro\.com\.br|dafiti\.com\.br|fastshop\.com\.br|leroymerlin\.com\.br|madeiramadeira\.com\.br|temu\.com)$/i;

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

/* Lê no máximo 400 KB da página e devolve o título do produto. */
export async function tituloDaPagina(url: string): Promise<string | null> {
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
    while (html.length < 400_000) {
      const { done, value } = await leitor.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
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
  const og =
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i.exec(html)?.[1];
  const titulo = og ?? /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
  return titulo ? limparTitulo(titulo) : null;
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

export async function identificarLink(texto: string): Promise<AnaliseLink> {
  const inicial = analisarLink(texto);
  if (inicial.origem === "invalido") return inicial;
  let a = inicial;
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
  if (!a.termoIdentificado && a.origem !== "mercadolivre" && a.urlLimpa) {
    const titulo = await tituloDaPagina(a.urlLimpa);
    if (titulo) a = { ...a, termoIdentificado: titulo };
  }
  return a;
}
