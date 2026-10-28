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
import { ErroApiMl, mlGet } from "@/lib/ml-api";
import { nomeTemOTipo, termoDoProduto, tipoDoProduto } from "@/lib/termo-busca";
import { foraDaIntencao } from "@/lib/busca-intencao";
import { normalizar, ordenarPelaIntencao } from "@/lib/busca-sugestoes";

export { foraDaIntencao };
import { pareceFalso } from "@/lib/falsificado";

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
};

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
dominiosPermitidos: so se tiver certeza, ids de dominio do Mercado Livre ("MLB-TIRES"); senao [].
resumo: uma frase curta e simpatica em portugues dizendo o que vai buscar (sem prometer preco,
sem falar de inteligencia artificial, sem links).
Responda SO com JSON: {"buscas": ["..."], "tipoProduto": "...", "contextoUso": "...",
"termosNegativos": ["..."], "dominiosPermitidos": [], "precoMin": null, "precoMax": null, "resumo": "..."}
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

async function interpretar(q: string, contexto: string | null): Promise<Interpretacao> {
  const prompt = `${PROMPT}${contexto ? ` (contexto: ${contexto})` : ""}: ${JSON.stringify(q.slice(0, 160))}`;
  let bruto: string | null = null;
  try {
    /* Cheaper Inference primeiro (09/10), GPT de reserva; depois Gemini/Gemma. */
    const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
    const gpt = await perguntarAoLlm(prompt, 9_000);
    if (gpt.ok) bruto = gpt.texto;
    else {
      const { gerarComModelos } = await import("@/lib/conferir-produto");
      const r = await gerarComModelos([{ text: prompt }], {
        ordem: ["gemini-flash-lite-latest", "gemma-4-26b-a4b-it"],
        prazo: 9_000,
      });
      if (r.ok) bruto = r.texto;
    }
  } catch {
    bruto = null;
  }
  if (bruto) {
    const { lerJson } = await import("@/lib/conferir-produto");
    const lida = intencaoDoModelo(lerJson<JsonDoModelo>(bruto), q);
    if (lida) return lida;
  }
  /* Sem modelo: a frase da pessoa é a busca. */
  return {
    buscas: [q.slice(0, 60)],
    precoMin: null,
    precoMax: null,
    resumo: "",
    tipoProduto: tipoDoProduto(q),
    contextoUso: null,
    termosNegativos: [],
  };
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
    | "dominiosPermitidos",
    unknown
  >
>;

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
};

/** O produto com o anúncio de referência (1ª oferta NOVA da lista oficial),
    ou null sem oferta ativa ou fora da faixa de preço. */
async function comOferta(
  p: ProdutoDoCatalogo,
  opcoes: { precoMin?: number | null; precoMax?: number | null; aceitarSemOferta?: boolean },
): Promise<ResultadoBusca | null> {
  const id = String(p.id ?? "").toUpperCase();
  const foto = p.pictures?.[0]?.url ?? null;
  const imagem = foto ? foto.replace(/^http:/, "https:") : null;
  const nome = String(p.name ?? "").slice(0, 120);
  try {
    /* Oferta NOVA (10/10): a 1ª da lista pode ser usada, e o preço do
       cartão tem de ser o do anúncio que o botão abre. */
    const o = await mlGet<{
      results?: Array<{
        item_id?: string;
        price?: number;
        condition?: string;
        shipping?: { free_shipping?: boolean };
        official_store_id?: number | null;
      }>;
    }>(`/products/${id}/items?limit=5`);
    const oferta = o.results?.find((x) => x.condition === "new");
    const item = oferta?.item_id;
    if (!item || !/^MLB\d+$/.test(item)) return null;
    const preco = num(oferta?.price);
    if (opcoes.precoMax && preco && preco > opcoes.precoMax * 1.05) return null;
    if (opcoes.precoMin && preco && preco < opcoes.precoMin * 0.95) return null;
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

/** Busca no catálogo oficial e devolve os produtos com anúncio ativo (o
    anúncio de referência é a 1ª oferta da lista oficial). */
export async function buscarNoCatalogo(
  buscas: string[],
  opcoes: {
    precoMin?: number | null;
    precoMax?: number | null;
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
  } = {},
) {
  const max = opcoes.max ?? 8;
  const porBusca = opcoes.porBusca ?? 4;
  const limite = Math.min(Math.max(opcoes.limite ?? 6, 1), 20);
  const offset = Math.min(Math.max(Math.floor(opcoes.offset ?? 0), 0), 900);
  const resultados: ResultadoBusca[] = [];
  const vistos = new Set<string>();
  let chamadas = 0;
  const TETO = 18;
  for (const [b, busca] of buscas.entries()) {
    if (resultados.length >= max || chamadas >= TETO) break;
    const dominios = opcoes.dominiosPorBusca?.[b] ?? opcoes.dominios ?? null;
    const tipo = opcoes.tipoDaBusca ? tipoDoProduto(busca) : opcoes.tipo;
    let lista: ProdutoDoCatalogo[] = [];
    try {
      chamadas += 1;
      const r = await mlGet<{ results?: typeof lista }>(
        `/products/search?status=active&site_id=MLB&q=${encodeURIComponent(busca)}&limit=${limite}${offset ? `&offset=${offset}` : ""}`,
      );
      lista = r.results ?? [];
    } catch (e) {
      if (!(e instanceof ErroApiMl)) throw e;
      continue;
    }
    let desta = 0;
    for (const p of lista) {
      if (resultados.length >= max || chamadas >= TETO || desta >= porBusca) break;
      const id = String(p.id ?? "").toUpperCase();
      if (!/^MLB\d+$/.test(id) || vistos.has(id)) continue;
      vistos.add(id);
      /* Réplica, "1:1", linha AAA ou clone sem marca nunca entra (27/10). */
      if (pareceFalso(p.name)) continue;
      if (opcoes.rejeitar?.(String(p.name ?? ""))) continue;
      /* Outra categoria nunca entra (11/10: bebedouro pet x fonte de Buda). */
      if (dominios && !dominios.has(String(p.domain_id ?? ""))) continue;
      if (!dominios && tipo && !nomeTemOTipo(String(p.name ?? ""), tipo)) continue;
      chamadas += 1;
      const r = await comOferta(p, opcoes);
      if (r) {
        resultados.push(r);
        desta += 1;
      }
    }
  }
  return resultados;
}

/** Posição na busca oficial de cada página de "Ver mais opções": a 1ª lê
    6 por busca; as seguintes, 8 por busca a partir daí. */
export const offsetDaPagina = (pagina: number, primeira: number, demais: number) =>
  pagina <= 0 ? 0 : primeira + (pagina - 1) * demais;

/** Interpreta, busca no catálogo e devolve até 8 produtos com anúncio ativo.
    Página > 0 ("Ver mais opções", 27/10): as mesmas buscas da 1ª página
    (sem interpretar de novo, quando vierem), mais adiante no catálogo. */
export async function buscaGuiada(
  q: string,
  contexto: string | null,
  pagina = 0,
  intencaoAnterior: Interpretacao | null = null,
) {
  const intencao = intencaoAnterior ?? (await interpretar(q, contexto));
  /* Camada C: só os domínios que a API oficial prevê para cada busca (mais
     os do modelo); sem previsão, o tipo da busca tem de estar no nome. */
  const doModelo = intencao.dominiosPermitidos ?? [];
  const dominiosPorBusca = await Promise.all(
    intencao.buscas.map(async (b) => {
      const s = await dominiosPrevistos(b);
      return s ? new Set([...s, ...doModelo]) : null;
    }),
  );
  const opcoes = {
    precoMin: intencao.precoMin,
    precoMax: intencao.precoMax,
    tipoDaBusca: true,
    rejeitar: (nome: string) => foraDaIntencao(nome, intencao, q),
    ...(pagina > 0
      ? {
          limite: 8,
          porBusca: Math.ceil(8 / Math.max(1, intencao.buscas.length)) + 1,
          offset: offsetDaPagina(pagina, 6, 8),
        }
      : {}),
  };
  let achados = await buscarNoCatalogo(intencao.buscas, { ...opcoes, dominiosPorBusca });
  /* Previsão de domínio errada não pode zerar a busca: refaz só pelo tipo. */
  if (!achados.length && dominiosPorBusca.some(Boolean))
    achados = await buscarNoCatalogo(intencao.buscas, opcoes);
  /* Pedido amplo ou sazonal (28/10, "decoração de natal" voltava vazio): o
     título raramente traz o tipo ("decoração"), e os 1ºs do catálogo podem
     não ter oferta. Sem domínio nem tipo, lendo mais fundo, e o nome tem de
     trazer uma palavra do pedido; por fim, os mais vendidos da categoria. */
  if (!achados.length) {
    const palavras = palavrasDoPedido([q, ...intencao.buscas]);
    achados = await buscarNoCatalogo([...new Set([...intencao.buscas, q.slice(0, 60)])], {
      ...opcoes,
      tipoDaBusca: false,
      limite: 20,
      rejeitar: (nome) => opcoes.rejeitar(nome) || !palavras.some((p) => nomeTemOTipo(nome, p)),
    });
  }
  if (!achados.length && pagina === 0) achados = await maisVendidosDaCategoria(q, opcoes);
  /* Busca universal (27/10): o mais fiel ao que foi digitado vem primeiro
     (modelo exato) e peça/acessório só se a busca é pela peça. */
  const resultados = ordenarPelaIntencao(q, achados, (r) => r.nome);
  return { intencao, resultados };
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

/** Mais vendidos da categoria que a API oficial prevê para o pedido (lista
    oficial /highlights), só os produtos de catálogo com oferta ativa. */
async function maisVendidosDaCategoria(
  q: string,
  opcoes: {
    precoMin?: number | null;
    precoMax?: number | null;
    rejeitar?: (nome: string) => boolean;
  },
) {
  const resultados: ResultadoBusca[] = [];
  try {
    const d = await mlGet<Array<{ category_id?: string }>>(
      `/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(termoDoProduto(q, 12))}`,
    );
    const cat = String((Array.isArray(d) ? d[0]?.category_id : "") ?? "");
    if (!/^MLB\d+$/.test(cat)) return resultados;
    const h = await mlGet<{ content?: Array<{ id?: string; type?: string }> }>(
      `/highlights/MLB/category/${cat}`,
    );
    let chamadas = 2;
    for (const x of h.content ?? []) {
      if (resultados.length >= 8 || chamadas >= 18) break;
      if (x.type !== "PRODUCT" || !/^MLB\d+$/.test(String(x.id ?? ""))) continue;
      chamadas += 1;
      const p = await mlGet<ProdutoDoCatalogo>(`/products/${x.id}`).catch(() => null);
      if (!p?.name || pareceFalso(p.name) || opcoes.rejeitar?.(p.name)) continue;
      chamadas += 1;
      const r = await comOferta({ ...p, id: String(x.id) }, opcoes);
      if (r) resultados.push(r);
    }
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
        max: 8,
        porBusca: 6,
        limite: 10,
        offset: offsetDaPagina(pagina, 10, 10),
        dominios,
        tipo: tipoDoProduto(titulo),
        aceitarSemOferta: true,
      })
    : [];
  return { buscas, dominios: dominios ? [...dominios] : [], resultados };
}
