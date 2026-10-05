/* INTELIGÊNCIA DE MERCADO (Weslei, 05/10): coleta diária de sinais externos
   por fontes oficiais, medição do canal e preparo das ofertas do garimpo.
   Tudo determinístico (sem modelo de linguagem) e registrado no banco
   (mercado_sinais, canal_metricas, operacao_execucoes).

   Fontes:
   - API oficial do Mercado Livre: /trends/MLB (termos em alta, geral e por
     categoria) e /highlights/MLB/category/{id} (mais vendidos), com o nome do
     produto pelo /products/{id}. Ranking não é volume de vendas nem conversão.
   - Google Trends "em alta no Brasil" (feed RSS público, diário): assuntos do
     dia, não intenção de compra; serve só de sinal complementar.
   Poucas chamadas por execução (limite de subrequisições do servidor). */

import { ErroApiMl, mlGet } from "@/lib/ml-api";
import {
  TEMPORADAS,
  temporadaDoProduto,
  temporadasAtivas,
  temporadasEmDestaque,
} from "@/lib/sazonal";
import { telegram } from "@/lib/telegram";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* Nichos do 1º ciclo (05/10): onde o site já acha economia de verdade
   (Beleza 4 de 5 produtos com o mesmo mais barato; Eletrodomésticos com
   ticket médio de R$ 2.434) e categorias de demanda constante. O nome
   oficial é conferido a cada coleta (/categories/{id}). */
/* Nomes fixos (sem conferir /categories a cada coleta, para caber no
   limite de subrequisições); IDs errados aparecem em "erros" da execução. */
export const CATEGORIAS_FOCO = [
  { id: "MLB5726", nome: "Eletrodomésticos" },
  { id: "MLB1246", nome: "Beleza e Cuidado Pessoal" },
  { id: "MLB1574", nome: "Casa, Móveis e Decoração" },
  { id: "MLB5672", nome: "Acessórios para Veículos" },
  /* Exploratório (05/10): celular e iPhone em alta (2º e 5º termos do
     /trends/MLB), mas o site ainda não achou o mesmo produto mais barato. */
  { id: "MLB1051", nome: "Celulares e Telefones" },
] as const;

const PRODUTOS_POR_CATEGORIA = 3;

type Sinal = {
  fonte: string;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  posicao?: number | null;
  termo?: string | null;
  produto_id?: string | null;
  url?: string | null;
  extra?: Record<string, unknown> | null;
};

const erroCurto = (e: unknown) =>
  e instanceof ErroApiMl ? `${e.status}` : String((e as Error)?.message ?? e).slice(0, 80);

function semEntidades(t: string | null) {
  if (!t) return t;
  return t
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function googleTrendsBrasil(): Promise<Sinal[]> {
  const r = await fetch("https://trends.google.com/trending/rss?geo=BR", {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/rss+xml, text/xml" },
  });
  if (!r.ok) throw new Error(`google_trends ${r.status}`);
  const xml = await r.text();
  const itens = xml.split("<item>").slice(1, 21);
  return itens.map((bloco, i) => {
    const titulo = semEntidades(/<title>([^<]{1,200})<\/title>/.exec(bloco)?.[1] ?? null);
    const trafego = /<ht:approx_traffic>([^<]{1,30})<\/ht:approx_traffic>/.exec(bloco)?.[1] ?? null;
    return {
      fonte: "google_trends",
      posicao: i + 1,
      termo: titulo,
      extra: trafego ? { trafego_aproximado: trafego } : null,
    };
  });
}

/** Coleta os sinais externos do dia. Cada fonte falha sozinha. */
export async function coletarMercado(db: Db) {
  const sinais: Sinal[] = [];
  const erros: Record<string, string> = {};

  try {
    const geral = await mlGet<Array<{ keyword?: string; url?: string }>>("/trends/MLB");
    geral.slice(0, 50).forEach((t, i) =>
      sinais.push({
        fonte: "ml_trends",
        posicao: i + 1,
        termo: t.keyword ?? null,
        url: t.url ?? null,
      }),
    );
  } catch (e) {
    erros["ml_trends"] = erroCurto(e);
  }

  /* Temporada (Dia das Crianças, Black Friday, Natal): até 2 categorias a
     mais enquanto ela dura, com menos nomes de produto (limite de
     subrequisições do servidor). */
  const focoIds = new Set<string>(CATEGORIAS_FOCO.map((c) => c.id));
  const sazonais = temporadasAtivas()
    .flatMap((t) => t.categorias.map((c) => ({ ...c, temporada: t.id })))
    .filter((c, i, l) => !focoIds.has(c.id) && l.findIndex((x) => x.id === c.id) === i)
    .slice(0, 2);
  const categorias: Array<{ id: string; nome: string; temporada?: string }> = [
    ...CATEGORIAS_FOCO,
    ...sazonais,
  ];
  for (const cat of categorias) {
    const nome: string = cat.nome;
    const limiteNomes = cat.temporada ? 2 : PRODUTOS_POR_CATEGORIA;
    try {
      const t = await mlGet<Array<{ keyword?: string; url?: string }>>(`/trends/MLB/${cat.id}`);
      t.slice(0, 20).forEach((x, i) =>
        sinais.push({
          fonte: "ml_trends",
          categoria_id: cat.id,
          categoria_nome: nome,
          posicao: i + 1,
          termo: x.keyword ?? null,
          url: x.url ?? null,
          extra: cat.temporada ? { temporada: cat.temporada } : null,
        }),
      );
    } catch (e) {
      erros[`trends_${cat.id}`] = erroCurto(e);
    }
    try {
      const h = await mlGet<{ content?: Array<{ id?: string; position?: number; type?: string }> }>(
        `/highlights/MLB/category/${cat.id}`,
      );
      const lista = (h.content ?? []).slice(0, 20);
      let nomes = 0;
      for (const item of lista) {
        let termo: string | null = null;
        if (item.type === "PRODUCT" && item.id && nomes < limiteNomes) {
          nomes += 1;
          try {
            const p = await mlGet<{ name?: string }>(`/products/${item.id}`);
            termo = p.name ?? null;
          } catch {
            /* sem nome: fica só o id */
          }
        }
        sinais.push({
          fonte: "ml_mais_vendidos",
          categoria_id: cat.id,
          categoria_nome: nome,
          posicao: item.position ?? null,
          termo,
          produto_id: item.id ?? null,
          url:
            item.type === "PRODUCT" && item.id
              ? `https://www.mercadolivre.com.br/p/${item.id}`
              : null,
          extra: {
            tipo: item.type ?? null,
            ...(cat.temporada ? { temporada: cat.temporada } : {}),
          },
        });
      }
    } catch (e) {
      erros[`mais_vendidos_${cat.id}`] = erroCurto(e);
    }
  }

  try {
    sinais.push(...(await googleTrendsBrasil()));
  } catch (e) {
    erros["google_trends"] = erroCurto(e);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  if (sinais.length) {
    const { error } = await t.from("mercado_sinais").insert(sinais);
    if (error) erros["gravar"] = String(error.message).slice(0, 120);
  }
  const porFonte: Record<string, number> = {};
  for (const s of sinais) porFonte[s.fonte] = (porFonte[s.fonte] ?? 0) + 1;
  return { ok: sinais.length > 0, sinais: sinais.length, porFonte, erros };
}

/** Membros do canal hoje (Bot API getChatMemberCount). */
export async function medirCanal(db: Db) {
  const token = process.env["API_TELEGRAM"];
  const canal = process.env["TELEGRAM_CANAL_ID"];
  if (!token || !canal) return { ok: false, erro: "canal ou token não configurado" };
  const r = await telegram(token, "getChatMemberCount", { chat_id: canal });
  if (!r?.ok || typeof r.result !== "number")
    return { ok: false, erro: r?.description ?? "sem resposta do Telegram" };
  const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("canal_metricas")
    .upsert({ dia, membros: r.result, medido_em: new Date().toISOString() });
  return { ok: true, dia, membros: r.result };
}

/* PREPARO DO GARIMPO: as melhores economias dos últimos 7 dias são
   comparadas DE NOVO (pedir_link_novo) cerca de 1 h antes da publicação; o
   garimpo só publica o que foi comparado nas últimas 3 h (oferta conferida
   na hora, nada de preço velho). Pré-filtro pelos valores da vitrine; a
   decisão final é a da tela (decisaoDaTela) no garimpo. */
export const PREPARAR_POR_VEZ = 2;
const ECONOMIA_MINIMA = 30;

export async function prepararRevalidacao(db: Db) {
  const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const recente = Date.now() - 6 * 3600_000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const [{ data: vistos }, { data: publicados }] = await Promise.all([
    t
      .from("produtos_vistos")
      .select(
        "url_produto,titulo,economia,melhor_link,alt_economia,alt_link,alt_frete_gratis,visto_em",
      )
      .gte("visto_em", desde)
      .limit(300),
    t.from("canal_publicacoes").select("chave").gte("publicado_em", desde).limit(500),
  ]);
  const jaPublicado = new Set(
    ((publicados ?? []) as Array<{ chave: string }>).map((p) => p.chave.split("|")[0]),
  );
  type Visto = {
    url_produto: string | null;
    titulo: string | null;
    economia: number | null;
    melhor_link: string | null;
    alt_economia: number | null;
    alt_link: string | null;
    alt_frete_gratis: boolean | null;
    visto_em: string;
  };
  const candidatos = ((vistos ?? []) as Visto[])
    .map((v) => {
      const mesmo =
        (v.economia ?? 0) >= ECONOMIA_MINIMA && /^https:\/\/meli\.la\//.test(v.melhor_link ?? "")
          ? Number(v.economia)
          : 0;
      const alt =
        (v.alt_economia ?? 0) >= ECONOMIA_MINIMA &&
        v.alt_frete_gratis === true &&
        /^https:\/\/meli\.la\//.test(v.alt_link ?? "")
          ? Number(v.alt_economia)
          : 0;
      const ganho = Math.max(mesmo, alt);
      /* Temporada: produto que combina (brinquedo no Dia das Crianças,
         presente no Natal) passa na frente com 50% a mais na nota. A regra
         de economia mínima não muda. */
      return { ...v, ganho, nota: temporadaDoProduto(v.titulo) ? ganho * 1.5 : ganho };
    })
    .filter(
      (v) =>
        v.url_produto &&
        v.ganho > 0 &&
        !jaPublicado.has(v.url_produto.split("?")[0]!) &&
        Date.parse(v.visto_em) < recente,
    )
    .sort((a, b) => b.nota - a.nota)
    .slice(0, PREPARAR_POR_VEZ);

  const pedidos: Array<{ url: string; pedido: number | null; ganho: number }> = [];
  for (const c of candidatos) {
    const { data, error } = await t.rpc("pedir_link_novo", { p_url: c.url_produto });
    pedidos.push({
      url: c.url_produto as string,
      pedido: error ? null : typeof data === "number" ? data : null,
      ganho: c.ganho,
    });
  }
  return { ok: true, candidatos: candidatos.length, pedidos };
}

/* REMOVER POST DO CANAL (05/10): só posts registrados pelo garimpo
   (canal_publicacoes, com message_id). Usado quando um post deixa de cumprir
   a premissa (ex.: alternativa sem qualidade equivalente). Fica registrado
   quando e por quê. */
export async function removerPublicacao(db: Db, id: number, motivo: string) {
  const token = process.env["API_TELEGRAM"];
  const canal = process.env["TELEGRAM_CANAL_ID"];
  if (!token || !canal) return { ok: false, erro: "canal ou token não configurado" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const { data: pub } = await t
    .from("canal_publicacoes")
    .select("id,message_id,titulo,removida_em")
    .eq("id", id)
    .maybeSingle();
  if (!pub?.message_id) return { ok: false, erro: "publicação sem message_id" };
  if (pub.removida_em) return { ok: true, jaRemovida: true };
  const r = await telegram(token, "deleteMessage", { chat_id: canal, message_id: pub.message_id });
  if (!r?.ok) return { ok: false, erro: r?.description ?? "sem resposta do Telegram" };
  await t
    .from("canal_publicacoes")
    .update({ removida_em: new Date().toISOString(), removida_motivo: motivo.slice(0, 200) })
    .eq("id", id);
  return { ok: true, removida: pub.titulo };
}

/* BUSCA SAZONAL (Weslei, 05/10: "já faça buscas interessantes, de
   qualidade, com desconto real"): para cada busca da temporada, os
   primeiros produtos do catálogo oficial (/products/search, API do Mercado
   Livre) entram na fila de comparação (pedir_link_novo). A extensão compara
   um por vez, com o freio de sempre; o garimpo e a vitrine só mostram o que
   passar nas regras (economia, qualidade, frete, afiliado). */
export async function buscarSazonal(
  db: Db,
  opcoes: { temporada?: string | null; max?: number } = {},
) {
  const max = Math.min(Math.max(opcoes.max ?? 12, 1), 15);
  const temporadas = (
    opcoes.temporada ? TEMPORADAS.filter((t) => t.id === opcoes.temporada) : temporadasEmDestaque()
  ).slice(0, 3);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  /* Só conta como "já comparado" o que saiu com link de afiliado; o que o
     programa recusou pela página de catálogo pode voltar pelo anúncio. */
  const { data: recentes } = await t
    .from("pedidos_link")
    .select("url_alvo")
    .gte("criado_em", desde)
    .not("link", "is", null)
    .limit(500);
  const jaPedidos = new Set(
    ((recentes ?? []) as Array<{ url_alvo: string | null }>)
      .map((r) => /\/p\/(MLB\d+)/i.exec(r.url_alvo ?? "")?.[1]?.toUpperCase())
      .filter(Boolean),
  );
  const erros: Record<string, string> = {};
  const fila: Array<{ id: string; nome: string | null; busca: string; temporada: string }> = [];
  /* Intercala as temporadas e as buscas para variar os produtos. */
  const pares = temporadas.flatMap((tp) => tp.buscas.map((b, i) => ({ tp, b, i })));
  pares.sort((a, b) => a.i - b.i);
  for (const { tp, b } of pares) {
    if (fila.length >= max) break;
    try {
      const r = await mlGet<{ results?: Array<{ id?: string; name?: string; status?: string }> }>(
        `/products/search?status=active&site_id=MLB&q=${encodeURIComponent(b)}&limit=3`,
      );
      for (const p of r.results ?? []) {
        const id = String(p.id ?? "").toUpperCase();
        if (!/^MLB\d+$/.test(id) || jaPedidos.has(id) || fila.some((f) => f.id === id)) continue;
        fila.push({ id, nome: p.name ?? null, busca: b, temporada: tp.id });
        break; // um produto por busca: mais variedade
      }
    } catch (e) {
      erros[b] = erroCurto(e);
    }
  }
  /* O gerador de links do programa recusa a página de catálogo pura
     (/p/MLB..., erro 111 "URL not allowed", 05/10: 34 de 49). Com o anúncio
     no endereço (pdp_filters=item_id), o link sai. Sem anúncio conhecido, o
     produto fica de fora. */
  const pedidos: Array<{ produto: string; nome: string | null; pedido: number | null }> = [];
  for (const f of fila) {
    /* Anúncio de referência: a primeira oferta da lista oficial do
       catálogo, na ordem do próprio Mercado Livre (nunca a mais cara, para a
       economia mostrada ser honesta). */
    let item: string | null = null;
    try {
      const r = await mlGet<{ results?: Array<{ item_id?: string }> }>(
        `/products/${f.id}/items?limit=1`,
      );
      item = r.results?.[0]?.item_id ?? null;
    } catch (e) {
      erros[f.id] = erroCurto(e);
    }
    if (!item || !/^MLB\d+$/.test(item)) {
      erros[f.id] ??= "sem oferta principal";
      continue;
    }
    const { data, error } = await t.rpc("pedir_link_novo", {
      p_url: `https://www.mercadolivre.com.br/p/${f.id}?pdp_filters=item_id%3A${item}`,
    });
    pedidos.push({
      produto: f.id,
      nome: f.nome,
      pedido: error ? null : typeof data === "number" ? data : null,
    });
  }
  return {
    ok: pedidos.length > 0 || Object.keys(erros).length === 0,
    temporadas: temporadas.map((x) => x.id),
    pedidos,
    erros,
  };
}
