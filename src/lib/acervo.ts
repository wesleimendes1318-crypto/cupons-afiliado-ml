/* ACERVO DE OFERTAS (Weslei, 05/11: "não buscar do zero"). Every listing a
   search reads with a known price and a known shipping answer is kept in
   public.acervo_ofertas (server only, RLS without policies), tagged with the
   search terms that found it. Showcases read the acervo first; the catalog
   is only called to complete. A background job (jobs/garimpar-acervo) keeps
   reading the next pages of the terms people asked for.
   Never invents anything: a row is a real listing read from the official
   catalog in the last ACERVO_HORAS hours; older rows are not served. */
import { idDaFoto } from "@/lib/curadoria";
import type { ResultadoBusca } from "@/lib/busca-guiada";

export const ACERVO_HORAS = 12;

/* Untyped client: these tables are not in the generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const sem = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Search term as stored in `termos` (no accents, lower case). */
export const termoDoAcervo = (termo: string) => sem(termo).slice(0, 80);

/** Rows worth keeping: real catalog ids, price and a shipping answer. */
export function linhasDoAcervo(termo: string, resultados: ResultadoBusca[]) {
  const t = termoDoAcervo(termo);
  return resultados
    .filter(
      (r) =>
        /^MLB\d+$/.test(r.produto) &&
        /^MLB\d+$/.test(r.item) &&
        r.preco != null &&
        r.preco > 0 &&
        typeof r.freteGratis === "boolean",
    )
    .map((r) => ({
      produto: r.produto,
      item: r.item,
      nome: r.nome.slice(0, 160),
      imagem: r.imagem,
      foto: idDaFoto(r.imagem),
      preco: r.preco,
      frete_gratis: r.freteGratis,
      internacional: r.internacional === true,
      loja_oficial: r.lojaOficial === true,
      url: r.url,
      termos: [t],
      atualizado_em: new Date().toISOString(),
    }));
}

type LinhaAcervo = ReturnType<typeof linhasDoAcervo>[number];

export function resultadoDoAcervo(l: LinhaAcervo): ResultadoBusca {
  return {
    produto: l.produto,
    item: l.item,
    nome: l.nome,
    imagem: l.imagem,
    preco: Number(l.preco),
    url: l.url,
    freteGratis: l.frete_gratis ?? null,
    lojaOficial: l.loja_oficial,
    ...(l.internacional ? { internacional: true } : {}),
  };
}

/** Saves (or refreshes) the listings; the term joins the row's `termos`. */
export async function guardarNoAcervo(db: Db, termo: string, resultados: ResultadoBusca[]) {
  const linhas = linhasDoAcervo(termo, resultados);
  if (!linhas.length) return;
  try {
    await db.rpc("acervo_guardar", { p_linhas: linhas });
  } catch {
    /* The acervo only speeds things up: a failure never breaks a search. */
  }
}

/** Fresh listings of a term inside the price range, newest first. */
export async function lerDoAcervo(
  db: Db,
  termo: string,
  faixa: { min: number | null; max: number | null; freteACalcular?: boolean },
  excluir: string[],
  limite: number,
): Promise<ResultadoBusca[]> {
  try {
    let q = db
      .from("acervo_ofertas")
      .select("produto,item,nome,imagem,foto,preco,frete_gratis,internacional,loja_oficial,url,termos,atualizado_em")
      .contains("termos", [termoDoAcervo(termo)])
      .gte("atualizado_em", new Date(Date.now() - ACERVO_HORAS * 3600_000).toISOString());
    if (faixa.min != null) q = q.gte("preco", faixa.min);
    if (faixa.max != null) q = q.lte("preco", faixa.max);
    if (!faixa.freteACalcular) q = q.eq("frete_gratis", true);
    const { data } = await q.order("atualizado_em", { ascending: false }).limit(limite + excluir.length);
    const fora = new Set(excluir);
    return ((data ?? []) as LinhaAcervo[])
      .filter((l) => !fora.has(l.produto) && !fora.has(l.item))
      .slice(0, limite)
      .map(resultadoDoAcervo);
  } catch {
    return [];
  }
}

/** Asks the background job to keep reading this term in this range. */
export async function pedirGarimpo(
  db: Db,
  termo: string,
  faixa: { min: number | null; max: number | null; freteACalcular?: boolean },
  inicio: { cursor: number | null; variantes: string[] },
) {
  if (inicio.cursor == null) return;
  try {
    await db.rpc("acervo_pedir_garimpo", {
      p_termo: termoDoAcervo(termo),
      p_min: faixa.min,
      p_max: faixa.max,
      p_frete_a_calcular: faixa.freteACalcular === true,
      p_cursor: inicio.cursor,
      p_variantes: inicio.variantes.slice(0, 8),
    });
  } catch {
    /* ignore */
  }
}

/* Garimpo finds (produtos_vistos): products already compared, with a real
   saving and confirmed free shipping. Shown with the price of the listing the
   link opens (preco + pdp item_id), never the cheaper store's price. */
type LinhaVisto = { titulo: string | null; imagem: string | null; preco: number | string | null; url_produto: string | null; frete_gratis: boolean | null };

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "em", "kit"]);

/** Every meaningful word of the term appears in the title. */
export function tituloCombina(termo: string, titulo: string): boolean {
  const t = ` ${sem(titulo)} `;
  const palavras = sem(termo)
    .split(" ")
    .filter((w) => w.length > 2 && !PALAVRAS_VAZIAS.has(w));
  return palavras.length > 0 && palavras.every((w) => t.includes(` ${w.replace(/s$/, "")}`));
}

export function achadoDoGarimpo(l: LinhaVisto): ResultadoBusca | null {
  const url = l.url_produto ?? "";
  const produto = /\/p\/(MLB\d+)/.exec(url)?.[1];
  const item = /item_id%3A(MLB\d+)/i.exec(url)?.[1];
  const preco = Number(l.preco);
  if (!produto || !item || !l.titulo || !(preco > 0) || l.frete_gratis !== true) return null;
  return {
    produto,
    item,
    nome: l.titulo.slice(0, 160),
    imagem: l.imagem,
    preco,
    url: `https://www.mercadolivre.com.br/p/${produto}?pdp_filters=item_id%3A${item}`,
    freteGratis: true,
  };
}

export async function achadosDoGarimpo(
  db: Db,
  termo: string,
  faixa: { min: number | null; max: number | null },
): Promise<ResultadoBusca[]> {
  try {
    let q = db
      .from("produtos_vistos")
      .select("titulo,imagem,preco,url_produto,frete_gratis")
      .gte("economia", 10)
      .eq("melhor_frete_gratis", true)
      .gte("visto_em", new Date(Date.now() - 24 * 3600_000).toISOString());
    if (faixa.min != null) q = q.gte("preco", faixa.min);
    if (faixa.max != null) q = q.lte("preco", faixa.max);
    const { data } = await q.order("economia", { ascending: false }).limit(200);
    return ((data ?? []) as LinhaVisto[])
      .filter((l) => l.titulo && tituloCombina(termo, l.titulo))
      .flatMap((l) => achadoDoGarimpo(l) ?? [])
      .slice(0, 6);
  } catch {
    return [];
  }
}
