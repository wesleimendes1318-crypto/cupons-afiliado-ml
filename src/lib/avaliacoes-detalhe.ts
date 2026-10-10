/* AVALIAÇÕES EM TODOS OS CARTÕES E O DETALHAMENTO REAL (Weslei, 10/10:
   "precisa ter as avaliações em TODOS, e precisa de um espaço que abra o
   detalhamento das avaliações reais"). A extensão lê na página de cada
   anúncio a nota, o total, a distribuição por estrelas e as primeiras
   opiniões dos compradores (avaliacoes_anuncios). Aqui só se confere e se
   lê: sem o dado, nada é mostrado como se existisse. */
import { createContext, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { avaliacoesValidas, type Avaliacoes } from "@/lib/avaliacoes";

/* O que o cartão sabe da oferta. item: o anúncio (MLB...) ou o produto de
   catálogo (MLBP...); sem: a página do anúncio foi lida e não tem nenhuma
   avaliação; detalhe: há distribuição ou opiniões para o painel. */
export type ResumoAvaliacoes = {
  item: string | null;
  avaliacoes: Avaliacoes | null;
  sem: boolean;
  detalhe: boolean;
};

export type Nivel = { estrelas: number; total: number };
export type Opiniao = {
  nota: number;
  texto: string;
  data: string | null;
  criadoEm: string | null;
  uteis: number | null;
};
export type DetalheAvaliacoes = {
  item: string;
  avaliacoes: Avaliacoes | null;
  sem: boolean;
  distribuicao: Nivel[] | null;
  opinioes: Opiniao[];
  totalComentarios: number | null;
  aviso: string | null;
  lidoEm: string | null;
};

const RE_ITEM = /^MLBP?\d{6,}$/;

/** Anúncio (ou produto de catálogo) do endereço, como o banco faz. */
export function itemDoEndereco(u: string | null | undefined): string | null {
  if (!u) return null;
  const s = String(u);
  const direto = s.toUpperCase().replace(/-/g, "");
  if (RE_ITEM.test(direto)) return direto;
  const filtro = /item_id(?:%3A|:)(MLB\d{6,})/i.exec(s) ?? /[?&]wid=(MLB\d{6,})/i.exec(s);
  if (filtro?.[1]) return filtro[1].toUpperCase();
  const prod = /\/p\/MLB(\d{6,})/i.exec(s);
  if (prod) return `MLBP${prod[1]}`;
  if (!/mercadoli[vb]re\.com/i.test(s)) return null;
  const anuncio = /MLB-?(\d{6,})/i.exec(s);
  return anuncio ? `MLB${anuncio[1]}` : null;
}

export function itemDaOferta(
  o: { item?: string | null | undefined; url?: string | null | undefined } | null | undefined,
): string | null {
  if (!o) return null;
  return itemDoEndereco(o.item ?? null) ?? itemDoEndereco(o.url ?? null);
}

export function resumoDaLinha(r: {
  item?: string | null;
  nota?: unknown;
  total?: unknown;
  sem_avaliacoes?: unknown;
  com_detalhe?: unknown;
}): ResumoAvaliacoes {
  const avaliacoes = avaliacoesValidas({
    nota: r.nota == null ? null : Number(r.nota),
    total: r.total == null ? null : Number(r.total),
  });
  return {
    item: r.item && RE_ITEM.test(r.item) ? r.item : null,
    avaliacoes,
    sem: !avaliacoes && r.sem_avaliacoes === true,
    detalhe: Boolean(avaliacoes) && r.com_detalhe === true,
  };
}

export type MapaPorItem = Map<string, ResumoAvaliacoes>;

export async function lerAvaliacoesPorItens(itens: string[]): Promise<MapaPorItem> {
  const mapa: MapaPorItem = new Map();
  const unicos = [...new Set(itens.filter((i) => RE_ITEM.test(i)))].slice(0, 300);
  if (!unicos.length) return mapa;
  try {
    const { data } = await supabase.rpc(
      "avaliacoes_por_itens" as never,
      { p_itens: unicos } as never,
    );
    if (Array.isArray(data))
      for (const r of data as Array<Parameters<typeof resumoDaLinha>[0]>) {
        const v = resumoDaLinha(r);
        if (v.item && (v.avaliacoes || v.sem)) mapa.set(v.item, v);
      }
  } catch {
    /* sem a leitura: os cartões seguem como estão */
  }
  return mapa;
}

/** Notas dos anúncios da lista (uma leitura por conjunto). */
export function useAvaliacoesPorItens(itens: Array<string | null | undefined>): MapaPorItem {
  const [mapa, setMapa] = useState<MapaPorItem>(() => new Map());
  const assinatura = [...new Set(itens.filter((i): i is string => !!i && RE_ITEM.test(i)))]
    .sort()
    .join(",");
  useEffect(() => {
    if (!assinatura) return;
    let vivo = true;
    void lerAvaliacoesPorItens(assinatura.split(",")).then((m) => {
      if (vivo) setMapa(m);
    });
    return () => {
      vivo = false;
    };
  }, [assinatura]);
  return mapa;
}

/** As notas lidas por anúncio na tela em volta (resultado da comparação). */
export const ContextoAvaliacoesPorItem = createContext<MapaPorItem>(new Map());

function niveisValidos(d: unknown, total: number | null): Nivel[] | null {
  if (!Array.isArray(d) || d.length !== 5) return null;
  const niveis: Nivel[] = [];
  for (const x of d) {
    const e = Number((x as { estrelas?: unknown })?.estrelas);
    const t = Number((x as { total?: unknown })?.total);
    if (!Number.isInteger(e) || e < 1 || e > 5 || !Number.isInteger(t) || t < 0) return null;
    niveis.push({ estrelas: e, total: t });
  }
  niveis.sort((a, b) => b.estrelas - a.estrelas);
  if (new Set(niveis.map((n) => n.estrelas)).size !== 5) return null;
  const soma = niveis.reduce((s, n) => s + n.total, 0);
  if (soma <= 0 || (total != null && soma > total * 1.05 + 5)) return null;
  return niveis;
}

type LinhaOpiniao = {
  nota?: unknown;
  texto?: unknown;
  data?: unknown;
  criado_em?: unknown;
  uteis?: unknown;
};
type LinhaDetalhe = {
  nota?: unknown;
  total?: unknown;
  sem_avaliacoes?: unknown;
  distribuicao?: unknown;
  comentarios?: unknown;
  total_comentarios?: unknown;
  aviso?: unknown;
  lido_em?: unknown;
};

function opinioesValidas(c: unknown): Opiniao[] {
  if (!Array.isArray(c)) return [];
  const out: Opiniao[] = [];
  for (const x of c) {
    const o = (x ?? {}) as LinhaOpiniao;
    const nota = Number(o?.nota);
    const texto = typeof o?.texto === "string" ? o.texto.trim() : "";
    if (!Number.isInteger(nota) || nota < 1 || nota > 5 || texto.length < 2) continue;
    /* Pedaço do código da página no lugar do texto (opinião vazia, 10/10). */
    if (/"\s*:\s*"|"\s*,\s*"|see_more|see_less/.test(texto)) continue;
    out.push({
      nota,
      texto,
      data: typeof o.data === "string" && o.data.trim() ? o.data.trim() : null,
      criadoEm:
        typeof o.criado_em === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.criado_em)
          ? o.criado_em
          : null,
      uteis: Number.isInteger(o.uteis) && (o.uteis as number) > 0 ? (o.uteis as number) : null,
    });
    if (out.length >= 6) break;
  }
  return out;
}

const cacheDetalhe = new Map<string, DetalheAvaliacoes | null>();

/** O painel "Ver avaliações": tudo o que foi lido da página do anúncio. */
export async function lerDetalheAvaliacoes(item: string): Promise<DetalheAvaliacoes | null> {
  if (!RE_ITEM.test(item)) return null;
  if (cacheDetalhe.has(item)) return cacheDetalhe.get(item) ?? null;
  try {
    const { data, error } = await supabase.rpc(
      "detalhe_avaliacoes" as never,
      { p_item: item } as never,
    );
    if (error) return null;
    const r = (Array.isArray(data) ? data[0] : null) as LinhaDetalhe | null;
    if (!r) {
      cacheDetalhe.set(item, null);
      return null;
    }
    const avaliacoes = avaliacoesValidas({
      nota: r.nota == null ? null : Number(r.nota),
      total: r.total == null ? null : Number(r.total),
    });
    const d: DetalheAvaliacoes = {
      item,
      avaliacoes,
      sem: !avaliacoes && r.sem_avaliacoes === true,
      distribuicao: avaliacoes ? niveisValidos(r.distribuicao, avaliacoes.total) : null,
      opinioes: avaliacoes ? opinioesValidas(r.comentarios) : [],
      totalComentarios:
        Number.isInteger(r.total_comentarios) && (r.total_comentarios as number) > 0
          ? (r.total_comentarios as number)
          : null,
      aviso: typeof r.aviso === "string" && r.aviso.trim() ? r.aviso.trim() : null,
      lidoEm: typeof r.lido_em === "string" ? r.lido_em : null,
    };
    cacheDetalhe.set(item, d);
    return d;
  } catch {
    return null;
  }
}

/** Percentual de cada nível, arredondado para baixo (nunca infla). */
export function percentual(n: Nivel, niveis: Nivel[]): number {
  const soma = niveis.reduce((s, x) => s + x.total, 0);
  return soma > 0 ? Math.floor((n.total / soma) * 100) : 0;
}
