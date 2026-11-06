/* BUSCA GUIADA (Weslei, 05/10: "integre campos de buscas em pontos
   estratégicos do site... toda pesquisa ali deve ter o llm/ia como motor";
   "a cada busca, se fizer sentido, deixar na vitrine").
   1. O modelo (GPT primeiro; reserva Gemini flash-lite/Gemma) entende o
      pedido em linguagem natural ("presente para menino de 8 anos até
      R$ 200") e devolve até 3 buscas de produto, faixa de preço e uma
      frase curta. Sem modelo, a própria frase vira a busca.
   2. As buscas vão ao catálogo oficial do Mercado Livre (/products/search)
      e cada produto ganha o anúncio de referência (1ª oferta da lista
      oficial, /products/{id}/items): sem oferta ativa, fica de fora.
   3. Os primeiros resultados entram na fila de comparação (pedir_link_novo)
      com teto por hora: depois de comparados, aparecem na vitrine pelas
      regras de sempre (mesmo produto, qualidade, desconto real, afiliado).
   O site não mostra link de compra aqui: o botão abre a comparação, que
   gera o link de afiliado. Textos públicos não citam IA. */
import { curarResultados } from "@/lib/curadoria";
import { ampliarDominios } from "@/lib/familias-dominio";
import { ErroApiMl, mlGet } from "@/lib/ml-api";
import { nomeTemOTipo, termoDoProduto, tipoDoProduto } from "@/lib/termo-busca";
import {
  comAcessorio,
  extrairIntencaoRapida,
  foraDaIntencao,
  pisoDoAparelho,
  regraDoAparelho,
} from "@/lib/busca-intencao";
import { normalizar, ordenarPelaIntencao } from "@/lib/busca-sugestoes";
import { marcaDoTitulo, marcasDosResultados } from "@/lib/busca-resultados";

export { foraDaIntencao };
import { pareceFalso } from "@/lib/falsificado";
import { voltagemDosAtributos, voltagemDoTexto, type Voltagem } from "@/lib/voltagem";
import { envioDasTags } from "@/lib/internacional";

export type ResultadoBusca = {
  produto: string;
  item: string;
  nome: string;
  imagem: string | null;
  preco: number | null;
  url: string;
  /** Frete grátis do anúncio de referência (null: não informado). */
  freteGratis?: boolean | null;
  lojaOficial?: boolean;
  /** Quanto o anúncio custa a menos que a mediana das outras ofertas novas
      do mesmo produto (R$, inteiro); null sem outra oferta para comparar. */
  economia?: number | null;
  /** Posição na lista oficial de mais vendidos da categoria (1 = 1º). */
  maisVendido?: number | null;
  /** Voltagem da ficha oficial (atributo VOLTAGE) ou do título. */
  voltagem?: Voltagem | null;
  /** Oferta internacional (tags cbt_* da lista oficial): tributos não lidos. */
  internacional?: boolean;
};

/** Economia medida: mediana das outras ofertas novas menos o preço. */
export function economiaEntreOfertas(preco: number | null, outras: number[]): number | null {
  const v = outras.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (preco == null || !v.length) return null;
  const meio = v.length / 2;
  const mediana = v.length % 2 ? v[Math.floor(meio)]! : (v[meio - 1]! + v[meio]!) / 2;
  return Math.max(0, Math.floor(mediana - preco));
}

export type RespostaBusca = {
  resumo: string;
  buscas: string[];
  resultados: ResultadoBusca[];
  enfileirados: number;
  /** Quando os preços foram lidos (a resposta fica guardada até 6 h). */
  lidoEm?: string;
  /** Faixa de preço entendida (as páginas seguintes usam a mesma). */
  precoMin?: number | null;
  precoMax?: number | null;
  /** Intenção entendida (as páginas seguintes filtram igual). */
  tipoProduto?: string | null;
  contextoUso?: string | null;
  termosNegativos?: string[];
  dominiosPermitidos?: string[];
  marca?: string | null;
  modelo?: string | null;
  anuncios?: { id: number; chave: string } | null;
  /** Buscas com as marcas achadas na 1ª página ("Carregar mais"). */
  variantes?: string[];
  /** Próxima leitura do "Carregar mais" (null = o catálogo acabou). */
  proximo?: number | null;
};

/** Intenção universal (27/10, "tomada para banheiro" não traz HDMI, antena
    nem móvel). Os campos novos são opcionais: respostas guardadas antes
    continuam valendo. */
export type Interpretacao = {
  /** 2 a 3 termos que o catálogo do Mercado Livre indexa. */
  buscas: string[];
  precoMin: number | null;
  precoMax: number | null;
  resumo: string;
  /** Substantivo central ("tomada", "pneu", "racao"). */
  tipoProduto?: string | null;
  /** Finalidade ("eletrica_residencial", "automotivo", "pet_gatos"). */
  contextoUso?: string | null;
  /** Palavras que, no título, mostram outro produto (exclusão estrita). */
  termosNegativos?: string[];
  /** Domínios MLB que o modelo sugere; só somam aos previstos pela API. */
  dominiosPermitidos?: string[];
  /** Só quando a pessoa citou: o título do produto tem de trazer os dois. */
  marca?: string | null;
  modelo?: string | null;
};

const PROMPT = `Voce ajuda compradores no Brasil a achar produtos vendidos no Mercado Livre.
Converta o pedido em ate 3 buscas curtas de produto para o catalogo (2 a 5 palavras cada,
com marca e modelo quando fizer sentido; prefira produtos de marca conhecida e boa qualidade).
Mantenha os atributos tecnicos do pedido (medidas, quantidade de lugares, material, voltagem,
capacidade, marca) e tire palavras de venda que nao identificam o produto ("barato", "bom",
"melhor", "oferta", "promocao"). Ex.: "mesa boa de madeira pra 4 pessoas" -> "mesa de jantar
4 cadeiras madeira". Se o pedido e o aparelho ou movel, nunca busque peca de reposicao
(carcaca, tampa, refil, capa, suporte). Sem faixa de preco citada, varie as buscas para cobrir
opcoes de entrada, intermediarias e topo de linha.
Se o pedido citar preco ("ate R$ 200", "entre 100 e 300"), preencha precoMin/precoMax em reais.
Nunca invente preco, loja ou desconto. Pedido fora de compras: buscas vazias.
tipoProduto: o substantivo central do produto, uma palavra sem acento ("tomada", "pneu", "racao").
contextoUso: a finalidade em snake_case ("eletrica_residencial", "automotivo", "pet_gatos", "festa").
termosNegativos: ate 10 palavras que, no titulo, indicam OUTRO produto com o mesmo nome, peca ou item
de outro contexto. Ex.: "tomada para banheiro" -> ["hdmi", "antena", "rj45", "coaxial", "telefone",
"gabinete", "armario"]; "racao para gatos" -> ["comedouro", "brinquedo", "arranhador"]; "pneu aro 14"
-> ["miniatura", "chaveiro", "camara de ar", "calibrador"]. Nunca repita palavras do pedido.
marca e modelo: SO se o pedido cita um produto especifico (ex.: "Nike TC 7900 Beige Navy" -> marca "Nike",
modelo "TC 7900"; "iphone 15 pro" -> marca "Apple", modelo "iPhone 15 Pro"); modelo sem cor nem tamanho;
pedido generico ("tenis de corrida", "presente ate R$ 200"): null nos dois.
dominiosPermitidos: so se tiver certeza, ids de dominio do Mercado Livre ("MLB-TIRES"); senao [].
resumo: uma frase curta e simpatica em portugues dizendo o que vai buscar (sem prometer preco,
sem falar de inteligencia artificial, sem links).
Responda SO com JSON minificado, sem texto antes ou depois: {"buscas": ["..."], "tipoProduto": "...", "contextoUso": "...",
"termosNegativos": ["..."], "marca": null, "modelo": null, "dominiosPermitidos": [], "precoMin": null, "precoMax": null, "resumo": "..."}
Pedido`;

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function normalizarBusca(q: string) {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9$ ,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/* VELOCIDADE (Weslei, 02/11: "Garanta agilidade quando a busca é por
   texto"): a heurística local sai na hora e a interpretação remota tem no
   máximo 3,5 s; passou disso, vale a heurística. */
const PRAZO_INTERPRETACAO_MS = 3_500;

async function interpretarComModelo(prompt: string, q: string): Promise<Interpretacao | null> {
  let bruto: string | null = null;
  const inicio = Date.now();
  try {
    /* Cheaper Inference primeiro (09/10), GPT de reserva; depois Gemini/Gemma. */
    const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
    const gpt = await perguntarAoLlm(prompt, PRAZO_INTERPRETACAO_MS);
    if (gpt.ok) bruto = gpt.texto;
    else {
      const resta = PRAZO_INTERPRETACAO_MS - (Date.now() - inicio);
      if (resta < 800) return null;
      const { gerarComModelos } = await import("@/lib/conferir-produto");
      const r = await gerarComModelos([{ text: prompt }], {
        ordem: ["gemini-flash-lite-latest", "gemma-4-26b-a4b-it"],
        prazo: resta,
      });
      if (r.ok) bruto = r.texto;
    }
  } catch {
    bruto = null;
  }
  if (!bruto) return null;
  const { lerJson } = await import("@/lib/conferir-produto");
  return intencaoDoModelo(lerJson<JsonDoModelo>(bruto), q);
}

async function interpretar(q: string, contexto: string | null): Promise<Interpretacao> {
  const prompt = `${PROMPT}${contexto ? ` (contexto: ${contexto})` : ""}: ${JSON.stringify(q.slice(0, 160))}`;
  const rapida = extrairIntencaoRapida(q);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lida = await Promise.race([
    interpretarComModelo(prompt, q).catch(() => null),
    new Promise<null>((r) => {
      timer = setTimeout(() => r(null), PRAZO_INTERPRETACAO_MS);
    }),
  ]);
  clearTimeout(timer);
  if (!lida || !lida.buscas.length) return rapida;
  /* Faixa de preço lida na frase vale quando o modelo não trouxe. */
  return comAcessorio(
    {
      ...lida,
      precoMin: lida.precoMin ?? rapida.precoMin,
      precoMax: lida.precoMax ?? rapida.precoMax,
    },
    q,
  );
}

type JsonDoModelo = Partial<
  Record<
    | "buscas"
    | "precoMin"
    | "precoMax"
    | "resumo"
    | "tipoProduto"
    | "contextoUso"
    | "termosNegativos"
    | "dominiosPermitidos"
    | "marca"
    | "modelo",
    unknown
  >
>;

const textoCurto = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().slice(0, 40) : "";
  return s && !/^null$/i.test(s) && !/https?:|www\./i.test(s) ? s : null;
};

const lista = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim());

/** Camada A: valida o JSON do modelo (nada de link, domínio fora do formato
    oficial ou termo negativo que a própria pessoa digitou). */
export function intencaoDoModelo(j: JsonDoModelo | null, q: string): Interpretacao | null {
  if (!j) return null;
  const buscas = lista(j.buscas)
    .map((b) => b.slice(0, 60))
    .filter((b) => b.length >= 2 && !/https?:|www\./i.test(b))
    .slice(0, 3);
  const resumo = String(j.resumo ?? "").trim();
  const tipo = normalizar(String(j.tipoProduto ?? "")).split(" ")[0] ?? "";
  const tipoProduto = tipo.length >= 3 ? tipo : tipoDoProduto(buscas[0] ?? q);
  const pedido = ` ${normalizar(q)} `;
  const termosNegativos = [
    ...new Set(
      lista(j.termosNegativos)
        .map((t) => normalizar(t).slice(0, 30))
        .filter((t) => t.length >= 3 && t !== tipoProduto && !pedido.includes(` ${t} `)),
    ),
  ].slice(0, 12);
  const contexto = normalizar(String(j.contextoUso ?? ""))
    .replace(/ /g, "_")
    .slice(0, 40);
  return {
    buscas,
    precoMin: num(j.precoMin),
    precoMax: num(j.precoMax),
    resumo:
      resumo && !/https?:|www\.|intelig[eê]ncia artificial|\bIA\b/i.test(resumo)
        ? resumo.slice(0, 200)
        : "",
    tipoProduto,
    contextoUso: contexto || null,
    termosNegativos,
    marca: textoCurto(j.marca),
    modelo: textoCurto(j.modelo),
    dominiosPermitidos: lista(j.dominiosPermitidos)
      .filter((d) => /^MLB-[A-Z0-9_]+$/.test(d))
      .slice(0, 6),
  };
}

type ProdutoDoCatalogo = {
  id?: string;
  name?: string;
  domain_id?: string;
  pictures?: Array<{ url?: string }>;
  attributes?: Array<{ id?: string; value_name?: string | null }>;
};

type OfertasDoProduto = {
  results?: Array<{
    item_id?: string;
    price?: number;
    condition?: string;
    shipping?: { free_shipping?: boolean };
    official_store_id?: number | null;
    tags?: string[];
  }>;
};

/* Two-stage search (06/11): the quick preview and the full search of the same
   request read mostly the same products; a short memo keeps that one API read. */
const OFERTAS = new Map<string, { em: number; p: Promise<OfertasDoProduto> }>();
const OFERTAS_MS = 120_000;
function ofertasDoProduto(id: string): Promise<OfertasDoProduto> {
  const agora = Date.now();
  const m = OFERTAS.get(id);
  if (m && agora - m.em < OFERTAS_MS) return m.p;
  if (OFERTAS.size >= 3000) OFERTAS.delete(OFERTAS.keys().next().value!);
  const p = mlGet<OfertasDoProduto>(`/products/${id}/items?limit=5`);
  OFERTAS.set(id, { em: agora, p });
  p.catch(() => OFERTAS.delete(id));
  return p;
}

/** O produto com o anúncio de referência (1ª oferta NOVA da lista oficial),
    ou null sem oferta ativa ou fora da faixa de preço. */
async function comOferta(
  p: ProdutoDoCatalogo,
  opcoes: {
    precoMin?: number | null;
    precoMax?: number | null;
    /** Piso do aparelho (sem preço pedido): abaixo dele é peça ou insumo. */
    pisoPreco?: number | null;
    aceitarSemOferta?: boolean;
  },
): Promise<ResultadoBusca | null> {
  const id = String(p.id ?? "").toUpperCase();
  const foto = p.pictures?.[0]?.url ?? null;
  const imagem = foto ? foto.replace(/^http:/, "https:") : null;
  const nome = String(p.name ?? "").slice(0, 120);
  try {
    /* Oferta NOVA (10/10): a 1ª da lista pode ser usada, e o preço do
       cartão tem de ser o do anúncio que o botão abre. */
    const o = await ofertasDoProduto(id);
    const novas = (o.results ?? []).filter((x) => x.condition === "new");
    const oferta = novas[0];
    const item = oferta?.item_id;
    if (!item || !/^MLB\d+$/.test(item)) return null;
    const preco = num(oferta?.price);
    const outras = novas.slice(1).flatMap((x) => num(x.price) ?? []);
    if (opcoes.precoMax && preco && preco > opcoes.precoMax * 1.05) return null;
    if (opcoes.precoMin && preco && preco < opcoes.precoMin * 0.95) return null;
    if (opcoes.pisoPreco && preco && preco < opcoes.pisoPreco) return null;
    return {
      produto: id,
      item,
      nome,
      imagem,
      preco,
      url: `https://www.mercadolivre.com.br/p/${id}?pdp_filters=item_id%3A${item}`,
      freteGratis:
        typeof oferta?.shipping?.free_shipping === "boolean" ? oferta.shipping.free_shipping : null,
      lojaOficial: oferta?.official_store_id != null,
      economia: economiaEntreOfertas(preco, outras),
      voltagem: voltagemDosAtributos(p.attributes) ?? voltagemDoTexto(nome),
      ...(envioDasTags(oferta?.tags).internacional ? { internacional: true } : {}),
    };
  } catch (e) {
    /* Produto sem oferta ativa fica de fora; na busca do mesmo produto,
       o sem oferta destacada entra sem preço (a comparação acha as lojas). */
    if (opcoes.aceitarSemOferta && e instanceof ErroApiMl && e.status === 404)
      return {
        produto: id,
        item: "",
        nome,
        imagem,
        preco: null,
        url: `https://www.mercadolivre.com.br/p/${id}`,
      };
    return null;
  }
}

/** Roda fn em até n itens ao mesmo tempo; devolve na ordem (falha = null). */
async function emParalelo<T, R>(itens: T[], n: number, fn: (x: T) => Promise<R | null>) {
  const saida: Array<R | null> = new Array(itens.length).fill(null);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, itens.length) }, async () => {
      while (proximo < itens.length) {
        const k = proximo++;
        saida[k] = await fn(itens[k] as T).catch(() => null);
      }
    }),
  );
  return saida;
}

/** Busca no catálogo oficial e devolve os produtos com anúncio ativo (o
    anúncio de referência é a 1ª oferta da lista oficial). */
export async function buscarNoCatalogo(
  buscas: string[],
  opcoes: {
    precoMin?: number | null;
    precoMax?: number | null;
    pisoPreco?: number | null;
    max?: number;
    porBusca?: number;
    /** Produtos lidos por busca (padrão 6). */
    limite?: number;
    /** A partir de qual posição da busca oficial ("Ver mais opções"). */
    offset?: number;
    /** Só produtos destes domínios (categoria prevista pela API oficial). */
    dominios?: Set<string> | null;
    /** Sem domínio previsto: o nome do produto tem de trazer este tipo. */
    tipo?: string | null;
    /** Produto do catálogo sem oferta destacada ("No winners found", comum
        em autopeças) entra sem preço e sem anúncio: só "Comparar preço". */
    aceitarSemOferta?: boolean;
    /** Busca guiada: domínios previstos para cada busca (mesma ordem). */
    dominiosPorBusca?: Array<Set<string> | null>;
    /** Busca guiada: sem domínio, o tipo de cada busca filtra o nome. */
    tipoDaBusca?: boolean;
    /** Título fora da intenção (termo negativo): nem lê a oferta. */
    rejeitar?: (nome: string) => boolean;
    /** Ofertas lidas no máximo (padrão 18). */
    teto?: number;
    /** Produtos que já estão na tela: nem gastam a leitura da oferta. */
    ignorar?: Set<string>;
  } = {},
) {
  const max = opcoes.max ?? 8;
  const porBusca = opcoes.porBusca ?? 4;
  const limite = Math.min(Math.max(opcoes.limite ?? 6, 1), 20);
  const offset = Math.min(Math.max(Math.floor(opcoes.offset ?? 0), 0), 900);
  const TETO = Math.min(opcoes.teto ?? 18, 48);
  /* PARALELO (Weslei, 02/11: busca por texto rápida). 1) as buscas ao mesmo
     tempo; 2) os candidatos de todas, na ordem de antes, com as ofertas lidas
     6 por vez; 3) a escolha final na mesma ordem e com os mesmos limites. */
  const listas = await Promise.all(
    buscas.slice(0, TETO).map(async (busca) => {
      try {
        const r = await mlGet<{ results?: ProdutoDoCatalogo[] }>(
          `/products/search?status=active&site_id=MLB&q=${encodeURIComponent(busca)}&limit=${limite}${offset ? `&offset=${offset}` : ""}`,
        );
        return r.results ?? [];
      } catch (e) {
        if (!(e instanceof ErroApiMl)) throw e;
        return [] as ProdutoDoCatalogo[];
      }
    }),
  );
  const vistos = new Set<string>(opcoes.ignorar ?? []);
  /* Até 2 de folga por busca: oferta sem estoque não deixa a busca curta. */
  const candidatos: Array<{ b: number; p: ProdutoDoCatalogo }> = [];
  let vagas = TETO - listas.length;
  listas.forEach((lista, b) => {
    const dominios = opcoes.dominiosPorBusca?.[b] ?? opcoes.dominios ?? null;
    const tipo = opcoes.tipoDaBusca ? tipoDoProduto(buscas[b] ?? "") : opcoes.tipo;
    let desta = 0;
    for (const p of lista) {
      if (vagas <= 0 || desta >= porBusca + 2) break;
      const id = String(p.id ?? "").toUpperCase();
      if (!/^MLB\d+$/.test(id) || vistos.has(id)) continue;
      vistos.add(id);
      /* Réplica, "1:1", linha AAA ou clone sem marca nunca entra (27/10). */
      if (pareceFalso(p.name)) continue;
      if (opcoes.rejeitar?.(String(p.name ?? ""))) continue;
      /* Outra categoria nunca entra (11/10: bebedouro pet x fonte de Buda). */
      if (dominios && !dominios.has(String(p.domain_id ?? ""))) continue;
      if (!dominios && tipo && !nomeTemOTipo(String(p.name ?? ""), tipo)) continue;
      candidatos.push({ b, p });
      desta += 1;
      vagas -= 1;
    }
  });
  const ofertas = await emParalelo(candidatos, 6, ({ p }) => comOferta(p, opcoes));
  const resultados: ResultadoBusca[] = [];
  const porCada = new Map<number, number>();
  candidatos.forEach(({ b }, k) => {
    const r = ofertas[k];
    if (!r || resultados.length >= max || (porCada.get(b) ?? 0) >= porBusca) return;
    resultados.push(r);
    porCada.set(b, (porCada.get(b) ?? 0) + 1);
  });
  return resultados;
}

const LIDOS_NA_PRIMEIRA = 24;
export const MINIMO_RESULTADOS = 20;
const MAXIMO_PAGINA = 30;
/* A busca oficial do catálogo só vai até a posição 120 (offset 120 = 400,
   medido em 02/11). Mais fundo, só com outra busca (a marca junto). */
const FIM_DO_CATALOGO = 120;
/* Tempo máximo de cada "Carregar mais" lendo o catálogo. */
const PRAZO_DA_PAGINA_MS = 16_000;

type Passo = { buscas: string[]; offset: number };

/** Leituras de cada "Carregar mais" (página >= 1), sempre na mesma ordem:
    o resto das buscas da 1ª página (84-120) e, depois, cada variante (a
    busca com uma marca que apareceu) da posição 0 até 100. A página p
    continua do passo em que a anterior parou (cursor). */
export function passosDasSeguintes(buscas: string[], variantes: string[]): Passo[] {
  const passos: Passo[] = [];
  /* 05/11 ("está limitando"): the 1st page stops at 20 cards, often after
     offset 0 only, so "+20" starts at 24 (re-reads are skipped by `ignorar`). */
  for (const offset of [24, 44, 64, 84, FIM_DO_CATALOGO - 20]) passos.push({ buscas, offset });
  for (const v of variantes)
    for (let o = 0; o + 20 <= FIM_DO_CATALOGO; o += 20) passos.push({ buscas: [v], offset: o });
  return passos;
}

/** No brand in the results (apparel, decor): color variants keep "+20"
    going with the same product type (05/11: "está limitando"). */
export function variantesPorCor(base: string, max = 6) {
  const b = normalizar(base);
  if (/\b(preto|preta|branco|branca|azul|rosa|bege|verde|cinza|vermelh|vinho|marrom)\b/.test(b))
    return [];
  return ["preta", "azul", "rosa", "bege", "cinza", "branca", "verde", "vinho"]
    .slice(0, max)
    .map((c) => `${base} ${c}`);
}

/** Variantes pela marca: "geladeira frost free" + Brastemp, Electrolux... */
export function variantesPorMarca(base: string, itens: Array<{ nome: string }>, max = 6) {
  const b = normalizar(base);
  return marcasDosResultados(itens)
    .map((m) => m.marca)
    .filter((m) => !b.includes(normalizar(m)))
    .slice(0, max)
    .map((m) => `${base} ${m}`);
}

type LinhaEstoque = {
  produto: string;
  item: string | null;
  nome: string;
  imagem: string | null;
  preco: number | string | null;
  url: string | null;
  frete_gratis: boolean | null;
  loja_oficial: boolean | null;
  dominio_ml: string | null;
};

/** Filtro do estoque próprio (em_alta_catalogo) com as MESMAS regras do
    catálogo: falsificado, fora da intenção, domínio/tipo, faixa e piso. */
export function filtrarEstoque(
  linhas: LinhaEstoque[],
  buscas: string[],
  opcoes: {
    precoMin?: number | null;
    precoMax?: number | null;
    pisoPreco?: number | null;
    rejeitar?: (nome: string) => boolean;
    dominios?: Set<string> | null;
  },
): ResultadoBusca[] {
  const tipos = [...new Set(buscas.map((b) => tipoDoProduto(b)).filter(Boolean))] as string[];
  const saida: ResultadoBusca[] = [];
  for (const l of linhas) {
    const preco = num(l.preco);
    if (!l.item || !/^MLB\d+$/.test(l.item) || !/^MLB\d+$/.test(l.produto) || preco == null)
      continue;
    if (pareceFalso(l.nome) || opcoes.rejeitar?.(l.nome)) continue;
    if (
      opcoes.dominios
        ? !opcoes.dominios.has(String(l.dominio_ml ?? ""))
        : !tipos.some((t) => nomeTemOTipo(l.nome, t))
    )
      continue;
    if (opcoes.precoMax && preco > opcoes.precoMax * 1.05) continue;
    if (opcoes.precoMin && preco < opcoes.precoMin * 0.95) continue;
    if (opcoes.pisoPreco && preco < opcoes.pisoPreco) continue;
    saida.push({
      produto: l.produto,
      item: l.item,
      nome: l.nome.slice(0, 120),
      imagem: l.imagem,
      preco,
      url:
        l.url ?? `https://www.mercadolivre.com.br/p/${l.produto}?pdp_filters=item_id%3A${l.item}`,
      freteGratis: l.frete_gratis,
      lojaOficial: l.loja_oficial === true,
      voltagem: voltagemDoTexto(l.nome),
    });
  }
  return saida;
}

/** ESTOQUE PRÓPRIO (02/11, "busca híbrida"): os ~14 mil mais vendidos que o
    robô em alta já guardou, com preço lido nos últimos 3 dias. Uma consulta
    ao banco, sem gastar leitura da API; completa a 1ª página até 20. */
async function doEstoque(
  buscas: string[],
  opcoes: Parameters<typeof filtrarEstoque>[2],
): Promise<ResultadoBusca[]> {
  const tipos = [...new Set(buscas.map((b) => tipoDoProduto(b)).filter(Boolean))] as string[];
  if (!tipos.length && !opcoes.dominios) return [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let consulta = supabaseAdmin
      .from("em_alta_catalogo")
      .select("produto,item,nome,imagem,preco,url,frete_gratis,loja_oficial,dominio_ml")
      .gte("atualizado_em", new Date(Date.now() - 3 * 24 * 3600_000).toISOString())
      .not("preco", "is", null);
    consulta = opcoes.dominios
      ? consulta.in("dominio_ml", [...opcoes.dominios])
      : consulta.or(
          tipos
            .map((t) => `nome.ilike.%${t.replace(/[^a-z0-9]/g, "").replace(/(es|s)$/, "")}%`)
            .join(","),
        );
    const { data } = await consulta.order("posicao", { ascending: true }).limit(120);
    return filtrarEstoque((data ?? []) as unknown as LinhaEstoque[], buscas, opcoes);
  } catch {
    return [];
  }
}

/** Interpreta, busca no catálogo e devolve pelo menos 20 produtos com
    anúncio ativo (quando o catálogo tem). Página > 0 ("Carregar mais"): as
    mesmas buscas e variantes da 1ª página, nas posições seguintes. */
export async function buscaGuiada(
  q: string,
  contexto: string | null,
  pagina = 0,
  intencaoAnterior: Interpretacao | null = null,
  anterior: {
    variantes?: string[];
    excluir?: string[];
    cursor?: number | undefined;
    /** Quick preview (06/11): first catalog read + own stock only, no deeper reads. */
    previa?: boolean;
  } = {},
) {
  const lidaBruta = intencaoAnterior ?? (await interpretar(q, contexto));
  /* MARCA DIGITADA MANDA (Weslei, 02/11: "Lava e Seca Brastemp" voltou só
     Midea, LG e Samsung). A marca citada vira trava (foraDoModelo exige no
     título) e a frase do cliente é a 1ª busca. */
  const marcaPedida = lidaBruta.marca || marcaDoTitulo(q);
  const frase = normalizar(q).replace(/\s+/g, " ").trim().slice(0, 60);
  const lida = marcaPedida
    ? {
        ...lidaBruta,
        marca: marcaPedida,
        buscas: [...new Set([frase, ...lidaBruta.buscas])].slice(0, 3),
      }
    : lidaBruta;
  /* APARELHO (Weslei, 02/11: "voltou 1 máquina e muito cara"): a busca do
     catálogo por "lava e seca" devolve nicho, placa, mop e lava-louças; o
     aparelho real vem pela marca, só da categoria oficial, e os mais
     vendidos dela completam. */
  const regra = regraDoAparelho(q);
  /* Com marca, as buscas da regra viram buscas DA MARCA (nunca concorrente). */
  const marcaN = marcaPedida ? normalizar(marcaPedida) : "";
  const daRegra = (regra?.buscas ?? [])
    .map((b) => normalizar(b))
    .filter((b) => !marcaN || b.includes(marcaN) || !marcaDoTitulo(b))
    .map((b) => (marcaN && !b.includes(marcaN) ? `${b} ${marcaN}` : b));
  const intencao = regra
    ? {
        ...lida,
        buscas: [
          ...new Set(marcaPedida ? [...lida.buscas, ...daRegra] : [...daRegra, ...lida.buscas]),
        ].slice(0, 8),
      }
    : lida;
  /* Camada C: só os domínios que a API oficial prevê para cada busca (mais
     os do modelo); sem previsão, o tipo da busca tem de estar no nome. */
  const doModelo = intencao.dominiosPermitidos ?? [];
  const dominiosPorBusca = regra
    ? intencao.buscas.map(() => new Set(regra.dominios))
    : await Promise.all(
        intencao.buscas.map(async (b) => {
          const s = ampliarDominios(await dominiosPrevistos(b));
          return s ? new Set([...s, ...doModelo]) : null;
        }),
      );
  const dominioDaVariante = regra ? new Set(regra.dominios) : (dominiosPorBusca[0] ?? null);
  /* Sem preço pedido, o aparelho grande tem piso (02/11: nicho de R$ 371 e
     placa de R$ 479 na busca de lava e seca). */
  const piso = intencao.precoMin || intencao.precoMax ? null : pisoDoAparelho(q);
  const maximo = 24;
  const opcoes = {
    precoMin: intencao.precoMin,
    precoMax: intencao.precoMax,
    pisoPreco: piso,
    tipoDaBusca: true,
    rejeitar: (nome: string) => foraDaIntencao(nome, intencao, q),
    max: maximo,
    teto: 44,
  };
  const excluir = new Set(anterior.excluir ?? []);
  let achados: ResultadoBusca[] = [];
  /* PELO MENOS 20 SEMPRE (Weslei, 02/11). */
  const juntar = (novos: ResultadoBusca[]) => {
    const vistos = new Set([...excluir, ...achados.map((r) => r.produto)]);
    /* Curador while collecting, so the page still fills to 20 after drops. */
    achados = curarResultados(
      q,
      [...achados, ...novos.filter((r) => !vistos.has(r.produto))],
      (r) => r.nome,
      undefined,
      (r) => r.imagem,
    ).slice(0, MAXIMO_PAGINA);
  };
  const ler = (passo: Passo) =>
    buscarNoCatalogo(passo.buscas, {
      ...opcoes,
      limite: 20,
      offset: passo.offset,
      porBusca: 24,
      ignorar: new Set([...excluir, ...achados.map((r) => r.produto)]),
      dominiosPorBusca: passo.buscas.map((b) => {
        const k = intencao.buscas.indexOf(b);
        return k >= 0 ? (dominiosPorBusca[k] ?? null) : dominioDaVariante;
      }),
    });

  let variantes = anterior.variantes ?? [];
  let proximo: number | null = null;
  if (pagina > 0) {
    /* "Carregar mais": do cursor em diante, 2 leituras por vez, até juntar
       20 novos ou o prazo acabar; devolve onde parou. */
    const base = intencao.buscas[0] ?? q.slice(0, 60);
    /* 06/11 ("paginação trava"): after the brand variants, the color ones keep
       "+20" going (the catalog API itself stops at position 120). */
    const passos = passosDasSeguintes(intencao.buscas, [
      ...new Set([...variantes, ...variantesPorCor(base)]),
    ]);
    const inicio = Date.now();
    let k = Math.max(0, anterior.cursor ?? (pagina - 1) * 4);
    while (
      k < passos.length &&
      achados.length < MINIMO_RESULTADOS &&
      Date.now() - inicio < PRAZO_DA_PAGINA_MS
    ) {
      const lote = passos.slice(k, k + 2);
      k += lote.length;
      for (const r of await Promise.all(lote.map(ler))) juntar(r);
    }
    proximo = k < passos.length ? k : null;
    /* Catalog ran dry (apparel: most catalog products have no offer): the
       category best sellers complete the page once, then it ends. */
    if (
      achados.length < MINIMO_RESULTADOS &&
      proximo === null &&
      !anterior.excluir?.includes("fim-mv")
    ) {
      juntar(await maisVendidosDaCategoria(q, opcoes));
    }
  } else {
    /* O estoque próprio é lido junto com a 1ª leitura do catálogo. */
    const dominiosDoEstoque = regra
      ? new Set(regra.dominios)
      : dominiosPorBusca.every(Boolean)
        ? new Set(dominiosPorBusca.flatMap((d) => [...d!]))
        : null;
    const estoque = doEstoque(intencao.buscas, { ...opcoes, dominios: dominiosDoEstoque });
    juntar(
      await buscarNoCatalogo(intencao.buscas, {
        ...opcoes,
        dominiosPorBusca,
        limite: LIDOS_NA_PRIMEIRA,
        porBusca: Math.ceil(maximo / Math.max(1, intencao.buscas.length)) + 4,
      }),
    );
    if (anterior.previa) {
      if (achados.length < MINIMO_RESULTADOS) juntar(await estoque);
      return {
        intencao,
        resultados: ordenarPorPrecoSeBarato(
          q,
          ordenarPelaIntencao(q, achados, (r) => r.nome),
        ),
        variantes: [],
        proximo: null,
      };
    }
    /* Previsão de domínio errada não pode zerar a busca: refaz só pelo tipo.
       Aparelho conhecido (categoria fixa) não: sem a categoria, "máquina"
       traz nicho e placa. */
    if (!achados.length && dominiosPorBusca.some(Boolean) && !regra && !piso)
      juntar(await buscarNoCatalogo(intencao.buscas, opcoes));
    /* Pedido amplo ou sazonal (28/10, "decoração de natal" voltava vazio). */
    if (!achados.length && !regra && !piso) {
      const palavras = palavrasDoPedido([q, ...intencao.buscas]);
      juntar(
        await buscarNoCatalogo([...new Set([...intencao.buscas, q.slice(0, 60)])], {
          ...opcoes,
          tipoDaBusca: false,
          limite: 20,
          rejeitar: (nome) => opcoes.rejeitar(nome) || !palavras.some((p) => nomeTemOTipo(nome, p)),
        }),
      );
    }
    if (achados.length < MINIMO_RESULTADOS) juntar(await estoque);
    /* Mais fundo nas mesmas buscas (24-84), de 20 em 20. */
    /* Speed (05/11): the deeper reads go in parallel, not one after another. */
    if (achados.length < MINIMO_RESULTADOS) {
      const fundo = await Promise.all(
        [24, 44].map((offset) => ler({ buscas: intencao.buscas, offset }).catch(() => [])),
      );
      for (const r of fundo) juntar(r);
      if (achados.length < MINIMO_RESULTADOS)
        juntar(await ler({ buscas: intencao.buscas, offset: 64 }));
    }
    /* As marcas que apareceram viram variantes ("geladeira frost free
       brastemp"): completam a 1ª página e alimentam o "Carregar mais". */
    variantes = variantesPorMarca(intencao.buscas[0] ?? q.slice(0, 60), achados);
    if (!variantes.length) variantes = variantesPorCor(intencao.buscas[0] ?? q.slice(0, 60));
    proximo = 0;
    if (achados.length && achados.length < MINIMO_RESULTADOS && variantes.length) {
      juntar(await ler({ buscas: variantes.slice(0, 4), offset: 0 }));
    }
  }
  /* Aparelho: a posição na lista oficial de mais vendidos marca cada um
     (ordem "Mais vendidos" na tela) e, abaixo de 20, a lista completa. */
  const listas = regra ? await lerMaisVendidos(regra.categorias) : undefined;
  if (pagina === 0 && achados.length < MINIMO_RESULTADOS) {
    juntar(await maisVendidosDaCategoria(q, opcoes, listas));
  }
  /* SEMPRE O ANÚNCIO (Weslei, 02/11: "pesquisei um modelo que tem no
     Mercado Livre e não retornou"). Produto do catálogo sem oferta destacada
     (a maioria das Brastemp lava e seca) entra no fim, sem preço, só com
     "Comparar preço": a comparação acha a loja e gera o link de afiliado. */
  if (pagina === 0 && achados.length < MINIMO_RESULTADOS) {
    juntar(
      await buscarNoCatalogo(intencao.buscas, {
        ...opcoes,
        dominiosPorBusca,
        limite: LIDOS_NA_PRIMEIRA,
        aceitarSemOferta: true,
        pisoPreco: null,
        porBusca: 20,
        max: MAXIMO_PAGINA,
        teto: 60,
      }).catch(() => []),
    );
  }
  if (listas) {
    const posicao = posicoesMaisVendidos(listas);
    achados = achados.map((r) => ({
      ...r,
      maisVendido: r.maisVendido ?? posicao.get(r.produto) ?? null,
    }));
  }
  /* Busca universal (27/10): o mais fiel ao que foi digitado vem primeiro
     (modelo exato) e peça/acessório só se a busca é pela peça. */
  /* Curador: filter, one card per model, best brands/season first; the intent
     order below still decides first (ties keep this order). */
  const resultados = ordenarPorPrecoSeBarato(
    q,
    ordenarPelaIntencao(
      q,
      curarResultados(
        q,
        achados,
        (r) => r.nome,
        undefined,
        (r) => r.imagem,
      ),
      (r) => r.nome,
    ),
  );
  return { intencao, resultados, variantes, proximo };
}

/** Posição na busca oficial de cada página da busca do mesmo produto. */
export const offsetDaPagina = (pagina: number, primeira: number, demais: number) =>
  pagina <= 0 ? 0 : primeira + (pagina - 1) * demais;

/** "barata", "em conta", "mais barato": do menor para o maior preço (sem
    preço no fim), mantendo a ordem de quem empata. */
export function ordenarPorPrecoSeBarato<T extends { preco: number | null }>(q: string, itens: T[]) {
  if (!/\b(barat[oa]s?|em conta|economic[oa]s?|menor preco)\b/.test(normalizar(q))) return itens;
  return itens
    .map((r, k) => ({ r, k }))
    .sort((a, b) => (a.r.preco ?? Infinity) - (b.r.preco ?? Infinity) || a.k - b.k)
    .map((x) => x.r);
}

const VAZIAS_DO_PEDIDO = new Set([
  "para",
  "como",
  "mais",
  "entre",
  "sobre",
  "melhor",
  "barato",
  "barata",
  "promocao",
  "oferta",
]);

/** Palavras que identificam o pedido (4+ letras, sem acento). */
export function palavrasDoPedido(textos: string[]) {
  return [
    ...new Set(
      textos.flatMap((t) =>
        normalizar(t)
          .split(" ")
          .filter((p) => p.length >= 4 && /[a-z]/.test(p) && !VAZIAS_DO_PEDIDO.has(p)),
      ),
    ),
  ];
}

/** Listas oficiais de mais vendidos (/highlights) das categorias: os ids
    de produto de catálogo de cada uma, na ordem oficial. */
async function lerMaisVendidos(categorias: string[]): Promise<string[][]> {
  return Promise.all(
    categorias
      .filter((c) => /^MLB\d+$/.test(c))
      .map((cat) =>
        mlGet<{ content?: Array<{ id?: string; type?: string }> }>(
          `/highlights/MLB/category/${cat}`,
        )
          .then((h) =>
            (h.content ?? [])
              .filter((x) => x.type === "PRODUCT" && /^MLB\d+$/.test(String(x.id ?? "")))
              .map((x) => String(x.id)),
          )
          .catch(() => [] as string[]),
      ),
  );
}

/** Melhor posição de cada produto nas listas (1 = mais vendido). */
export function posicoesMaisVendidos(listas: string[][]): Map<string, number> {
  const posicao = new Map<string, number>();
  for (const l of listas)
    l.forEach((id, k) => {
      if (!posicao.has(id) || posicao.get(id)! > k + 1) posicao.set(id, k + 1);
    });
  return posicao;
}

/** Mais vendidos da categoria que a API oficial prevê para o pedido (lista
    oficial /highlights), só os produtos de catálogo com oferta ativa. */
async function maisVendidosDaCategoria(
  q: string,
  opcoes: {
    precoMin?: number | null;
    precoMax?: number | null;
    pisoPreco?: number | null;
    rejeitar?: (nome: string) => boolean;
  },
  /** Listas já lidas (aparelho de categoria conhecida): sem prever pela frase. */
  lidas?: string[][],
) {
  const resultados: ResultadoBusca[] = [];
  try {
    let listas = lidas;
    if (!listas) {
      const d = await mlGet<Array<{ category_id?: string }>>(
        `/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(termoDoProduto(q, 12))}`,
      );
      listas = await lerMaisVendidos([String((Array.isArray(d) ? d[0]?.category_id : "") ?? "")]);
    }
    /* Paralelo (02/11): ficha e oferta de cada um, 6 por vez; até 12
       produtos por categoria (8 sem categoria conhecida), na ordem oficial. */
    const ids = [...new Set(listas.flatMap((l) => l.slice(0, lidas ? 20 : 20)))];
    const posicao = posicoesMaisVendidos(listas);
    const achados = await emParalelo(ids, 6, async (id) => {
      const p = await mlGet<ProdutoDoCatalogo>(`/products/${id}`).catch(() => null);
      if (!p?.name || pareceFalso(p.name) || opcoes.rejeitar?.(p.name)) return null;
      const r = await comOferta({ ...p, id }, opcoes);
      return r && { ...r, maisVendido: posicao.get(id) ?? null };
    });
    for (const r of achados) if (r) resultados.push(r);
  } catch (e) {
    if (!(e instanceof ErroApiMl)) throw e;
  }
  return resultados;
}

/** Categorias (domínios) que a API oficial prevê para o título, até 4. */
export async function dominiosPrevistos(titulo: string): Promise<Set<string> | null> {
  const q = termoDoProduto(titulo, 12);
  if (q.length < 3) return null;
  try {
    const r = await mlGet<Array<{ domain_id?: string }>>(
      `/sites/MLB/domain_discovery/search?limit=4&q=${encodeURIComponent(q)}`,
    );
    const s = new Set(
      (Array.isArray(r) ? r : [])
        .map((d) => String(d.domain_id ?? ""))
        .filter((d) => /^MLB-[A-Z0-9_]+$/.test(d)),
    );
    return s.size ? s : null;
  } catch {
    return null;
  }
}

/** BUSCA DO MESMO PRODUTO (link de outra loja, 11/10): sem interpretar a
    frase; o título limpo (tipo, marca, modelo) vai ao catálogo e só entra
    produto da MESMA categoria prevista para o título (ou, sem previsão, com
    o tipo do produto no nome). */
export async function buscarMesmoProduto(titulo: string, pagina = 0) {
  /* 4 a 6 palavras-chave + formato, material e capacidade (11/10). */
  const longo = termoDoProduto(titulo, 6);
  const curto = termoDoProduto(titulo, 4);
  const buscas = [...new Set([longo, curto].filter((t) => t.length >= 3))];
  const dominios = await dominiosPrevistos(titulo);
  const resultados = buscas.length
    ? await buscarNoCatalogo(buscas, {
        max: 24,
        porBusca: 12,
        limite: 20,
        offset: offsetDaPagina(pagina, 10, 10),
        dominios,
        tipo: tipoDoProduto(titulo),
        aceitarSemOferta: true,
      })
    : [];
  return { buscas, dominios: dominios ? [...dominios] : [], resultados };
}
