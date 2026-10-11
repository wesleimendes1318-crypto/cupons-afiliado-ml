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

export type ResultadoBusca = {
  produto: string;
  item: string;
  nome: string;
  imagem: string | null;
  preco: number | null;
  url: string;
};

export type RespostaBusca = {
  resumo: string;
  buscas: string[];
  resultados: ResultadoBusca[];
  enfileirados: number;
  /** Quando os preços foram lidos (a resposta fica guardada até 6 h). */
  lidoEm?: string;
};

type Interpretacao = {
  buscas: string[];
  precoMin: number | null;
  precoMax: number | null;
  resumo: string;
};

const PROMPT = `Voce ajuda compradores no Brasil a achar produtos vendidos no Mercado Livre.
Converta o pedido em ate 3 buscas curtas de produto para o catalogo (2 a 5 palavras cada,
com marca e modelo quando fizer sentido; prefira produtos de marca conhecida e boa qualidade).
Se o pedido citar preco ("ate R$ 200", "entre 100 e 300"), preencha precoMin/precoMax em reais.
Nunca invente preco, loja ou desconto. Pedido fora de compras: buscas vazias.
resumo: uma frase curta e simpatica em portugues dizendo o que vai buscar (sem prometer preco,
sem falar de inteligencia artificial, sem links).
Responda SO com JSON: {"buscas": ["..."], "precoMin": null, "precoMax": null, "resumo": "..."}
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
    const j = lerJson<{
      buscas?: unknown;
      precoMin?: unknown;
      precoMax?: unknown;
      resumo?: unknown;
    }>(bruto);
    const buscas = (Array.isArray(j?.buscas) ? j.buscas : [])
      .map((b) =>
        String(b ?? "")
          .trim()
          .slice(0, 60),
      )
      .filter((b) => b.length >= 2 && !/https?:|www\./i.test(b))
      .slice(0, 3);
    const resumo = String(j?.resumo ?? "").trim();
    if (j)
      return {
        buscas,
        precoMin: num(j.precoMin),
        precoMax: num(j.precoMax),
        resumo:
          resumo && !/https?:|www\.|intelig[eê]ncia artificial|\bIA\b/i.test(resumo)
            ? resumo.slice(0, 200)
            : "",
      };
  }
  /* Sem modelo: a frase da pessoa é a busca. */
  return { buscas: [q.slice(0, 60)], precoMin: null, precoMax: null, resumo: "" };
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
    /** Só produtos destes domínios (categoria prevista pela API oficial). */
    dominios?: Set<string> | null;
    /** Sem domínio previsto: o nome do produto tem de trazer este tipo. */
    tipo?: string | null;
  } = {},
) {
  const max = opcoes.max ?? 8;
  const porBusca = opcoes.porBusca ?? 4;
  const limite = Math.min(Math.max(opcoes.limite ?? 6, 1), 20);
  const resultados: ResultadoBusca[] = [];
  const vistos = new Set<string>();
  let chamadas = 0;
  const TETO = 18;
  for (const busca of buscas) {
    if (resultados.length >= max || chamadas >= TETO) break;
    let lista: Array<{
      id?: string;
      name?: string;
      domain_id?: string;
      pictures?: Array<{ url?: string }>;
    }> = [];
    try {
      chamadas += 1;
      const r = await mlGet<{ results?: typeof lista }>(
        `/products/search?status=active&site_id=MLB&q=${encodeURIComponent(busca)}&limit=${limite}`,
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
      /* Outra categoria nunca entra (11/10: bebedouro pet x fonte de Buda). */
      if (opcoes.dominios && !opcoes.dominios.has(String(p.domain_id ?? ""))) continue;
      if (!opcoes.dominios && opcoes.tipo && !nomeTemOTipo(String(p.name ?? ""), opcoes.tipo))
        continue;
      try {
        chamadas += 1;
        /* Oferta NOVA (10/10): a 1ª da lista pode ser usada, e o preço do
           cartão tem de ser o do anúncio que o botão abre. */
        const o = await mlGet<{
          results?: Array<{ item_id?: string; price?: number; condition?: string }>;
        }>(`/products/${id}/items?limit=5`);
        const oferta = o.results?.find((x) => x.condition === "new");
        const item = oferta?.item_id;
        if (!item || !/^MLB\d+$/.test(item)) continue;
        const preco = num(oferta?.price);
        if (opcoes.precoMax && preco && preco > opcoes.precoMax * 1.05) continue;
        if (opcoes.precoMin && preco && preco < opcoes.precoMin * 0.95) continue;
        const foto = p.pictures?.[0]?.url ?? null;
        resultados.push({
          produto: id,
          item,
          nome: String(p.name ?? "").slice(0, 120),
          imagem: foto ? foto.replace(/^http:/, "https:") : null,
          preco,
          url: `https://www.mercadolivre.com.br/p/${id}?pdp_filters=item_id%3A${item}`,
        });
        desta += 1;
      } catch {
        /* produto sem oferta ativa: fica de fora */
      }
    }
  }
  return resultados;
}

/** Interpreta, busca no catálogo e devolve até 8 produtos com anúncio ativo. */
export async function buscaGuiada(q: string, contexto: string | null) {
  const intencao = await interpretar(q, contexto);
  const resultados = await buscarNoCatalogo(intencao.buscas, {
    precoMin: intencao.precoMin,
    precoMax: intencao.precoMax,
  });
  return { intencao, resultados };
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
export async function buscarMesmoProduto(titulo: string) {
  const longo = termoDoProduto(titulo, 8);
  const curto = termoDoProduto(titulo, 5);
  const buscas = [...new Set([longo, curto].filter((t) => t.length >= 3))];
  const dominios = await dominiosPrevistos(titulo);
  const resultados = buscas.length
    ? await buscarNoCatalogo(buscas, {
        max: 8,
        porBusca: 6,
        limite: 10,
        dominios,
        tipo: tipoDoProduto(titulo),
      })
    : [];
  return { buscas, dominios: dominios ? [...dominios] : [], resultados };
}
