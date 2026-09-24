/* Mesmo produto em outras lojas, pela API oficial do Mercado Livre.

   Cenários que o cliente vê (regra do Weslei):
     1A  a loja do anúncio tem cupom
     1B  a loja do anúncio não tem cupom e outra loja com o mesmo produto tem
     1C  nenhuma tem cupom, mas outra loja vende mais barato
     1D  nenhuma opção melhor: fica o link do produto original
   Este arquivo só decide as OPÇÕES. O link de afiliado de cada opção é gerado
   depois pela extensão, na conta do Weslei, só para as opções escolhidas.

   Regras de "mesmo produto" e de escolha são as mesmas de
   extensao/comparador.js (testadas lá com node --test). */

import { ErroApiMl, mlGet } from "@/lib/ml-api";

/* ------------------------------------------------------------- textos */

const normPalavra = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const norm = (s: string | null | undefined) => normPalavra(s).replace(/ /g, "");

const VAZIAS = new Set(["com", "para", "sem", "por", "the", "and", "dos", "das", "que", "kit", "novo", "nova",
  "original", "promocao", "oferta", "frete", "gratis", "envio", "imediato", "pronta", "entrega"]);

function palavras(t: string) {
  return normPalavra(t)
    .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2")
    .split(" ")
    .filter((w) => (w.length >= 3 || /^\d+$/.test(w)) && !VAZIAS.has(w));
}

/** 60% das palavras do original no candidato, e todos os números do original. */
export function pareceMesmoProduto(original: string, candidato: string) {
  const a = [...new Set(palavras(original))];
  const b = new Set(palavras(candidato));
  if (a.length < 3) return false;
  if (a.filter((w) => b.has(w)).length / a.length < 0.6) return false;
  return a.filter((w) => /^\d+$/.test(w)).every((n) => b.has(n));
}

/* --------------------------------------------------------------- links */

export function idsDoLink(url: string) {
  let s = url;
  try { s = decodeURIComponent(url); } catch { /* fica como veio */ }
  const item = /item_id[:=](MLB\d{6,})/i.exec(s)?.[1] ?? /[?&#]wid=(MLB\d{6,})/i.exec(s)?.[1]
    ?? (/\/MLB-(\d{6,})/i.exec(s)?.[1] ? `MLB${/\/MLB-(\d{6,})/i.exec(s)![1]}` : null);
  const catalogo = /\/p\/(MLB\d{5,})/i.exec(s)?.[1] ?? null;
  return { item: item?.toUpperCase() ?? null, catalogo: catalogo?.toUpperCase() ?? null };
}

const urlDaOferta = (catalogo: string, item: string) =>
  `https://www.mercadolivre.com.br/p/${catalogo}?pdp_filters=item_id%3A${item}`;

/* -------------------------------------------------------------- cupons */

export type CupomLoja = {
  id: number; vendedor: string; desconto: string | null; tipo: string | null; valor: number | null;
  teto: number | null; sem_teto: boolean | null; compra_min: number | null; vence: string | null;
  codigo_cupom: string | null;
};

/** Desconto real do cupom neste preço (teto e compra mínima). null = não vale. */
export function economiaDoCupom(c: CupomLoja | null, preco: number | null) {
  if (!c || preco == null) return null;
  if (c.compra_min != null && preco < Number(c.compra_min)) return null;
  const valor = Number(c.valor) || 0;
  let e = c.tipo === "%" ? (preco * valor) / 100 : valor;
  if (!c.sem_teto && c.teto != null) e = Math.min(e, Number(c.teto));
  e = Math.min(e, preco);
  return e >= 5 ? Math.round(e * 100) / 100 : null;
}

async function cuponsPorNome(nomes: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("melhores_cupons_por_nome" as never, { p_nomes: nomes } as never);
  const mapa = new Map<string, CupomLoja>();
  for (const l of (data ?? []) as (CupomLoja & { nome: string })[]) mapa.set(l.nome, l);
  return mapa;
}

/* ------------------------------------------------------------ API do ML */


const cacheVendedor = new Map<number, string | null>();

async function apelido(sellerId: number) {
  if (cacheVendedor.has(sellerId)) return cacheVendedor.get(sellerId) ?? null;
  let nome: string | null = null;
  try { nome = (await mlGet<{ nickname?: string }>(`/users/${sellerId}`)).nickname ?? null; }
  catch { nome = null; }
  cacheVendedor.set(sellerId, nome);
  return nome;
}

/* ------------------------------------------------------------- decisão */

export type Opcao = {
  item: string; url: string; vendedor: string | null; preco: number; economia: number; final: number;
  cupom: { id: number; titulo: string | null; teto: number | null; minimo: number | null; vence: string | null } | null;
  ganho: number; finalAtual: number; motivo: "mais_barata" | "tem_cupom"; achadoNaBusca: boolean;
};

export type Comparacao = {
  procurou: boolean;
  motivo: string | null;
  produto: { item: string | null; titulo: string | null; preco: number | null; vendedor: string | null } | null;
  opcoes: Opcao[];
  fonte: "api-oficial";
  /* Resposta de cada endereço da API nesta comparação. Fica gravada com o
     resultado, para dar para ver depois o que funcionou e o que não. */
  trilha?: string[];
  /* true quando o produto de catálogo foi achado pelo NOME (palpite forte),
     e não por estar ligado ao anúncio. O site avisa o cliente. */
  catalogoPorNome?: boolean;
};

type Candidato = { item: string; url: string; preco: number; sellerId: number; achadoNaBusca: boolean };

/* O que a extensão já sabe do anúncio (ela lê a página que o CLIENTE colou).
   A API oficial não deixa ler anúncio de outra conta (403 medido em 24/09),
   então preço, loja e catálogo do anúncio original vêm daqui quando
   necessário. */
export type DicaAnuncio = {
  catalogo?: string | null; item?: string | null; preco?: number | null;
  vendedor?: string | null; titulo?: string | null;
  gtin?: string | null; marca?: string | null; modelo?: string | null; catalogoPagina?: string | null;
};

/* O QUE A API OFICIAL PERMITE, medido com a conta do Weslei em 24/09/2026:
     /products/{catalogo}          200
     /products/{catalogo}/items    200  <- outras lojas do MESMO produto
     /items/{id} de outra conta    403
     /sites/MLB/search             403
   Então a comparação automática vale para produto de CATÁLOGO. Anúncio fora
   do catálogo não tem comparação pela API, e o site diz isso ao cliente. */
const statusDe = (e: unknown) => (e instanceof ErroApiMl ? String(e.status) : "falhou");

/** Nome de catálogo e título do anúncio falam do mesmo produto? Vale nos dois
 *  sentidos: nome de catálogo costuma ser mais curto que o título do anúncio
 *  ("Banco Mesa 1,80 m 8 Lugares" dentro de "Banco Que Vira Mesa 1,80 M - 8
 *  Lugares - Campeão De Vendas"). Números sempre precisam bater. */
function mesmoNome(tituloAnuncio: string, nomeCatalogo: string) {
  /* Números iguais nos DOIS sentidos (tamanho, volume, modelo). Sem isso,
     "Capa Anti Impacto Motorola" aceitava a capa do Moto E6, do Moto G54 e
     do iPhone 14 (teste de 24/09): o título não tinha número para conferir. */
  const nums = (t: string) => [...new Set(palavras(t).filter((w) => /^\d+$/.test(w)))].sort().join(",");
  if (nums(tituloAnuncio) !== nums(nomeCatalogo)) return false;
  return pareceMesmoProduto(tituloAnuncio, nomeCatalogo) || pareceMesmoProduto(nomeCatalogo, tituloAnuncio);
}

type BuscaCatalogo = { results?: { id?: string; name?: string; status?: string }[] };

async function ofertasDoCatalogo(catalogo: string) {
  const r = await mlGet<{ results?: Record<string, unknown>[] }>(`/products/${catalogo}/items?limit=20`);
  return r.results ?? [];
}

/* COMO ACHAR O MESMO PRODUTO, SEJA QUAL FOR O LINK COLADO.

   O cliente não sabe se o link é de catálogo (/p/MLB...), de produto de
   vendedor (/up/MLBU...), anúncio avulso (MLB-...) ou compartilhamento. Então
   o produto é identificado pelo que ELE É, na ordem do mais exato ao menos:

     1. catálogo no próprio link                          -> exato
     2. (/user-products: 403 para produto de outra conta, medido em 24/09)
     3. catálogo citado na página do anúncio, CONFERIDO: só vale se a lista de
        ofertas desse catálogo contém o próprio anúncio   -> exato
     4. código de barras (GTIN/EAN, dígito verificador conferido) buscado no
        catálogo oficial (/products/search?product_identifier=)   -> exato
     5. marca + modelo buscados no catálogo; o modelo precisa aparecer no nome
                                                          -> palpite forte
     6. título do anúncio buscado no catálogo; nomes e números precisam bater
                                                          -> palpite forte
   Tudo pela API oficial. Nenhuma página do Mercado Livre é lida aqui. */
/* Devolve ATÉ 6 produtos de catálogo. O mesmo produto físico às vezes
   existe em mais de uma ficha de catálogo (medido em 24/09: o Wella Oil
   Reflections 100ml da Fragranciaria não trouxe a Amobeleza, que vende o
   mesmo frasco). Por isso, nas buscas por nome, as ofertas de todas as fichas
   aceitas entram juntas na comparação. */
async function catalogoDoAnuncio(url: string, dica: DicaAnuncio, itemAtual: string | null, trilha: string[]) {
  /* /user-products/{MLBU} respondeu 403 ("caller is not allowed to access
     this user product") no teste de 24/09 com a conta do Weslei: so o dono
     do produto le. Por isso nao e chamado; os passos abaixo cobrem. */
  void url;

  const daPagina = (dica.catalogoPagina ?? "").toUpperCase();
  if (/^MLB\d{5,}$/.test(daPagina) && itemAtual) {
    try {
      const ofertas = await ofertasDoCatalogo(daPagina);
      const contem = ofertas.some((o) => String(o["item_id"] ?? o["id"] ?? "").toUpperCase() === itemAtual);
      trilha.push(`catalogo-da-pagina ${daPagina} contem-o-anuncio=${contem ? "sim" : "nao"}`);
      if (contem) return { catalogos: [daPagina], porNome: false };
    } catch (e) { trilha.push(`catalogo-da-pagina ${statusDe(e)}`); }
  }

  const buscar = async (rotulo: string, params: string, aceitar: (nome: string) => boolean) => {
    const achados: string[] = [];
    try {
      const r = await mlGet<BuscaCatalogo>(`/products/search?status=active&site_id=MLB&${params}&limit=20`);
      const lista = (r.results ?? []).filter((p) => p.id);
      const aceitos = lista.filter((x) => aceitar(x.name ?? ""));
      /* Entre os aceitos, ficam os que têm oferta de loja (até 6). */
      for (const p of aceitos.slice(0, 8)) {
        const ofertas = await ofertasDoCatalogo(p.id!).catch(() => []);
        if (ofertas.length) achados.push(p.id!.toUpperCase());
        if (achados.length >= 6) break;
      }
      trilha.push(`${rotulo} 200 resultados=${lista.length} aceitos=${aceitos.map((x) => `${x.id}:${(x.name ?? "").slice(0, 50)}`).join(" | ") || "nenhum"} escolhidos=${achados.join(",") || "nenhum"}`);
    } catch (e) { trilha.push(`${rotulo} ${statusDe(e)}`); }
    return achados;
  };

  if (dica.gtin && /^\d{8,14}$/.test(dica.gtin)) {
    const c = await buscar("gtin", `product_identifier=${dica.gtin}`, () => true);
    if (c.length) return { catalogos: c, porNome: false };
  }

  const titulo = (dica.titulo ?? "").trim();
  const modelo = (dica.modelo ?? "").trim();
  const juntos = new Set<string>();
  if (modelo) {
    const q = normPalavra(`${dica.marca ?? ""} ${modelo}`).split(" ").slice(0, 8).join(" ");
    const tokensModelo = palavras(modelo);
    const c = await buscar("marca-modelo", `q=${encodeURIComponent(q)}`, (nome) => {
      const b = new Set(palavras(nome));
      return tokensModelo.length > 0 && tokensModelo.every((w) => b.has(w)) && (!titulo || mesmoNome(titulo, nome));
    });
    c.forEach((x) => juntos.add(x));
  }

  if (titulo) {
    const q = normPalavra(titulo).split(" ").slice(0, 10).join(" ");
    const c = await buscar("titulo", `q=${encodeURIComponent(q)}`, (nome) => mesmoNome(titulo, nome));
    c.forEach((x) => juntos.add(x));
  }
  if (juntos.size) return { catalogos: [...juntos].slice(0, 6), porNome: true };
  return null;
}

export async function compararMesmoProduto(url: string, dica: DicaAnuncio = {}): Promise<Comparacao> {
  const ids = idsDoLink(url);
  const trilha: string[] = [];
  const direto = (ids.catalogo ?? dica.catalogo ?? null)?.toUpperCase() ?? null;
  let catalogos: string[] = direto ? [direto] : [];
  let catalogoPorNome = false;
  const itemAtual = (ids.item ?? dica.item ?? null)?.toUpperCase() ?? null;
  if (!catalogos.length) {
    const achado = await catalogoDoAnuncio(url, dica, itemAtual, trilha);
    if (achado) { catalogos = achado.catalogos; catalogoPorNome = achado.porNome; }
  }
  const catalogo = catalogos[0] ?? null;
  if (!catalogo) {
    return {
      procurou: false,
      motivo: "não achei o mesmo produto (mesmo código de barras, marca e modelo) sendo vendido por outras lojas no catálogo oficial do Mercado Livre",
      produto: null, opcoes: [], fonte: "api-oficial", trilha,
    };
  }

  try {
    /* 1. Nome do produto de catálogo (só para exibir). */
    let titulo: string | null = null;
    try { titulo = (await mlGet<{ name?: string }>(`/products/${catalogo}`)).name ?? null; } catch { titulo = null; }

    /* 2. Todas as ofertas do mesmo produto, de lojas diferentes. */
    const candidatos: Candidato[] = [];
    for (const cat of catalogos) {
      /* A primeira ficha é obrigatória (erro dela vira erro da comparação);
         as demais são extras e podem falhar sozinhas. */
      let lista: Record<string, unknown>[] = [];
      try { lista = await ofertasDoCatalogo(cat); }
      catch (e) { if (cat === catalogo) throw e; trilha.push(`products/${cat}/items ${statusDe(e)}`); continue; }
      for (const o of lista) {
        const item = String(o["item_id"] ?? o["id"] ?? "");
        const preco = Number(o["price"]);
        const sellerId = Number(o["seller_id"] ?? (o["seller"] as { id?: number } | undefined)?.id);
        if (!item || !Number.isFinite(preco) || preco <= 0 || !Number.isFinite(sellerId)) continue;
        if (candidatos.some((c) => c.item === item)) continue;
        candidatos.push({ item, url: urlDaOferta(cat, item), preco, sellerId, achadoNaBusca: catalogoPorNome });
      }
    }

    /* 3. A oferta que o cliente estava vendo: pela lista, ou pelo que a
          extensão leu na página. */
    const minha = candidatos.find((c) => c.item === itemAtual) ?? null;
    const preco = minha?.preco ?? dica.preco ?? null;

    /* 4. Nome de cada loja e o cupom dela no banco. */
    const sellers = [...new Set(candidatos.map((c) => c.sellerId))].slice(0, 40);
    const nomes = new Map<number, string | null>();
    for (const s of sellers) nomes.set(s, await apelido(s));
    const cupons = await cuponsPorNome([...nomes.values(), dica.vendedor].filter(Boolean) as string[]);
    const cupomDe = (sellerId: number) => {
      const n = nomes.get(sellerId);
      return n ? cupons.get(norm(n)) ?? null : null;
    };

    const vendedorAqui = minha ? nomes.get(minha.sellerId) ?? dica.vendedor ?? null : dica.vendedor ?? null;
    const cupomAqui = minha ? cupomDe(minha.sellerId) : (dica.vendedor ? cupons.get(norm(dica.vendedor)) ?? null : null);
    const economiaAqui = economiaDoCupom(cupomAqui, preco) ?? 0;
    const finalAtual = preco != null ? preco - economiaAqui : null;
    const produto = { item: itemAtual, titulo, preco, vendedor: vendedorAqui };
    const item = minha ? { id: minha.item, seller_id: minha.sellerId } : null;
    const ehMinhaLoja = (sellerId: number) =>
      (item && sellerId === item.seller_id)
      || (!!dica.vendedor && !!nomes.get(sellerId) && norm(nomes.get(sellerId)) === norm(dica.vendedor));

    if (finalAtual == null) {
      return { procurou: false, motivo: "não consegui o preço do anúncio", produto, opcoes: [], fonte: "api-oficial", trilha };
    }

    /* 4. Escolha: mais barata por pelo menos R$ 2, ou com cupom quando a loja
          do cliente não tem (sem sair mais cara). Nunca a própria loja. */
    const porLoja = new Map<number, Opcao>();
    for (const c of candidatos) {
      if (c.item === itemAtual || ehMinhaLoja(c.sellerId)) continue;
      const cupom = cupomDe(c.sellerId);
      const economia = economiaDoCupom(cupom, c.preco) ?? 0;
      const final = Math.round((c.preco - economia) * 100) / 100;
      const ganho = Math.round((finalAtual - final) * 100) / 100;
      const temCupom = economia > 0;
      let motivo: Opcao["motivo"] | null = null;
      if (ganho >= 2) motivo = "mais_barata";
      else if (!economiaAqui && temCupom && final <= finalAtual) motivo = "tem_cupom";
      if (!motivo) continue;
      const opcao: Opcao = {
        item: c.item, url: c.url, vendedor: nomes.get(c.sellerId) ?? null, preco: c.preco, economia, final,
        cupom: temCupom && cupom ? {
          id: cupom.id, titulo: cupom.desconto, teto: cupom.sem_teto ? null : cupom.teto,
          minimo: cupom.compra_min, vence: cupom.vence,
        } : null,
        ganho: Math.max(ganho, 0), finalAtual, motivo, achadoNaBusca: c.achadoNaBusca,
      };
      const atual = porLoja.get(c.sellerId);
      if (!atual || opcao.final < atual.final) porLoja.set(c.sellerId, opcao);
    }
    const opcoes = [...porLoja.values()]
      .sort((a, b) => a.final - b.final || (b.cupom ? 1 : 0) - (a.cupom ? 1 : 0))
      .slice(0, 3);

    trilha.push(`catalogos=${catalogos.join(",")} ofertas=${candidatos.length} final-aqui=${finalAtual}`);
    /* Cada loja vista e o que ela daria, para conferir depois por que uma
       loja não virou opção. */
    for (const c of candidatos.slice(0, 40)) {
      const cupom = cupomDe(c.sellerId);
      trilha.push(`loja ${nomes.get(c.sellerId) ?? c.sellerId} ${c.item} R$${c.preco} cupom=${cupom ? cupom.desconto : "-"} final=${Math.round((c.preco - (economiaDoCupom(cupom, c.preco) ?? 0)) * 100) / 100}`);
    }
    return { procurou: true, motivo: null, produto, opcoes, fonte: "api-oficial", trilha, catalogoPorNome };
  } catch (e) {
    const status = e instanceof ErroApiMl ? e.status : 0;
    const motivo = status === 401 || status === 403
      ? "a API oficial do Mercado Livre pediu autorização (configurar o aplicativo)"
      : status === 429 ? "limite de consultas da API oficial atingido" : "a API oficial do Mercado Livre não respondeu";
    trilha.push(`erro ${statusDe(e)}`);
    return { procurou: false, motivo, produto: null, opcoes: [], fonte: "api-oficial", trilha };
  }
}
