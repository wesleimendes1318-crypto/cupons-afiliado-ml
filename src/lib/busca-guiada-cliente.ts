import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { foraDaIntencao, foraDoModelo } from "@/lib/busca-intencao";
import { lerConsentimento } from "@/lib/consentimento";
import { pareceFalso } from "@/lib/falsificado";
import { enviarEvento } from "@/lib/medicao";
/* Busca guiada no navegador (05/10; separada em 10/10 para o
   reconhecimento de links de outras lojas usar a mesma busca). */

export type Resultado = {
  produto: string;
  item: string;
  nome: string;
  imagem: string | null;
  preco: number | null;
  url: string;
  freteGratis?: boolean | null;
  lojaOficial?: boolean;
  /* Economia medida contra as outras ofertas do mesmo produto (R$). */
  economia?: number | null;
  /* Posição na lista oficial de mais vendidos da categoria. */
  maisVendido?: number | null;
  /* Voltagem da ficha oficial (ou do título). */
  voltagem?: "127" | "220" | "bivolt" | null;
  /* Oferta internacional (tributos não lidos): nunca entra na faixa do Amigo Secreto. */
  internacional?: boolean;
};

export type Resposta = {
  resumo: string;
  buscas: string[];
  resultados: Resultado[];
  enfileirados: number;
  lidoEm?: string;
  /* Intenção entendida (filtro final no navegador). */
  tipoProduto?: string | null;
  contextoUso?: string | null;
  termosNegativos?: string[];
  /* Marca e modelo citados: só aparece o que traz os dois (28/10). */
  marca?: string | null;
  modelo?: string | null;
  /* Modelo fora do catálogo oficial: busca nos anúncios pela extensão. */
  anuncios?: { id: number; chave: string } | null;
  /** Apparel listings read by the extension, one per piece, with its lock words. */
  anunciosPecas?: { id: number; chave: string; marca: string; modelo: string }[];
  /* "Carregar mais": de onde continuar (null = o catálogo acabou). */
  proximo?: number | null;
};

/** "agora" ou "às 14:05" (horário de Brasília): a busca fica guardada até
    6 h e o preço do cartão é o daquele momento. */
export function quandoFoiLido(lidoEm: string | undefined, agora = Date.now()): string {
  const t = lidoEm ? Date.parse(lidoEm) : NaN;
  if (!Number.isFinite(t) || agora - t < 10 * 60_000) return "agora";
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(t);
  return agora - t < 20 * 3_600_000 ? `às ${hora}` : "há mais de um dia";
}

export type ContextoBusca = "home" | "natal" | "criancas";

export type EstadoAnuncios = { estado: "buscando" | "pronto" | "falhou"; itens: Resultado[] };

const RE_ANUNCIO = /^https:\/\/(produto|www)\.mercadolivre\.com\.br\//;

/** Trava do que a extensão gravou: anúncio do Mercado Livre (MLB...), preço,
    e de novo a marca, o modelo e a versão pedidos. */
export function anunciosValidos(
  resultado: unknown,
  marca: string | null | undefined,
  modelo: string | null | undefined,
): Resultado[] {
  const itens = (resultado as { itens?: unknown } | null)?.itens;
  if (!Array.isArray(itens) || (!marca && !modelo)) return [];
  return itens.flatMap((x: Record<string, unknown>) => {
    const item = String(x?.["item"] ?? "");
    const url = String(x?.["url"] ?? "");
    const nome = String(x?.["titulo"] ?? "").slice(0, 160);
    const preco = typeof x?.["preco"] === "number" && x["preco"] > 0 ? x["preco"] : null;
    const imagem = String(x?.["imagem"] ?? "");
    if (!/^MLB\d+$/.test(item) || !RE_ANUNCIO.test(url) || !nome || preco == null) return [];
    if (pareceFalso(nome) || foraDoModelo(nome, marca, modelo)) return [];
    return [
      {
        produto: item,
        item,
        nome,
        imagem: /^https:\/\/http2\.mlstatic\.com\//.test(imagem) ? imagem : null,
        preco,
        url,
        freteGratis: typeof x["freteGratis"] === "boolean" ? x["freteGratis"] : null,
      },
    ];
  });
}

/** Acompanha a busca nos anúncios (a cada 3 s, até 5 min: a extensão atende ~1 por minuto): a do modelo e
    as das peças de roupa (07/11), juntas; q é o pedido digitado, que filtra
    de novo cada anúncio (gênero, peça, uso). */
export function useAnunciosPeloNome(resposta: Resposta | null, q?: string): EstadoAnuncios | null {
  const pedidos = [
    ...(resposta?.anuncios
      ? [{ ...resposta.anuncios, marca: resposta.marca, modelo: resposta.modelo }]
      : []),
    ...(resposta?.anunciosPecas ?? []),
  ];
  const assinatura = pedidos.map((p) => `${p.id}:${p.chave}`).join(",");
  const [estado, setEstado] = useState<EstadoAnuncios | null>(null);
  useEffect(() => {
    setEstado(null);
    if (!pedidos.length) return;
    let vivo = true;
    const fim = Date.now() + 300_000;
    const prontos = new Map<number, Resultado[]>();
    setEstado({ estado: "buscando", itens: [] });
    const olhar = async () => {
      if (!vivo) return;
      for (const p of pedidos) {
        if (prontos.has(p.id)) continue;
        const { data } = await supabase
          .rpc("ver_busca_anuncios" as never, { p_id: p.id, p_chave: p.chave } as never)
          .then(
            (r) => r,
            () => ({ data: null }),
          );
        if (!vivo) return;
        const d = data as { estado?: string; resultado?: unknown } | null;
        if (d?.estado === "pronto")
          prontos.set(
            p.id,
            anunciosValidos(d.resultado, p.marca, p.modelo).filter(
              (r) => !q || !resposta || !foraDaIntencao(r.nome, resposta, q),
            ),
          );
        else if (d?.estado === "falhou") prontos.set(p.id, []);
      }
      const itens = [...prontos.values()].flat();
      if (prontos.size === pedidos.length || Date.now() > fim) {
        setEstado({ estado: itens.length || prontos.size ? "pronto" : "falhou", itens });
        return;
      }
      if (itens.length) setEstado({ estado: "buscando", itens });
      setTimeout(() => void olhar(), 3_000);
    };
    void olhar();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);
  return estado;
}

/* Busca no catálogo oficial (a mesma da busca guiada). Também usada pelo
   reconhecimento de links de outras lojas (LinkDeOutraLoja). */
export async function buscarProdutos(
  pergunta: string,
  contexto: ContextoBusca = "home",
  /** "produto": título de um anúncio; busca o MESMO produto na mesma categoria. */
  modo: "guiada" | "produto" = "guiada",
  /** "Ver mais opções": 0 é a 1ª página. */
  pagina = 0,
  /** Slug do nó da árvore: busca dentro daquela categoria (27/10). */
  no?: string,
  /** "Carregar mais": de onde continuar e o que já está na tela. */
  mais?: { cursor?: number | null | undefined; vistos?: string[] },
  /** Two stages (06/11): the quick catalog read shows while the full search runs. */
  aoPrevia?: (r: Resposta) => void,
): Promise<{ resposta: Resposta | null; erro: string | null }> {
  const primeira = !pagina && mais?.cursor == null && !mais?.vistos?.length;
  const chaveCache = primeira ? chaveDaSessao(pergunta, contexto, modo, no) : null;
  const doCache = chaveCache ? lerDaSessao(chaveCache) : null;
  if (doCache) return { resposta: doCache, erro: null };
  const previa = Boolean(aoPrevia) && primeira && modo === "guiada" && !no;
  /* Painel do fundador: conta a busca nova (não a paginação), com consentimento. */
  if (
    modo === "guiada" &&
    !pagina &&
    mais?.cursor == null &&
    typeof window !== "undefined" &&
    lerConsentimento()?.analise === true
  )
    enviarEvento({
      p_tipo: "busca_texto",
      p_origem: contexto,
      p_pagina: window.location.pathname.slice(0, 120),
    });
  try {
    const r = await fetch("/api/public/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: pergunta.slice(0, 160),
        contexto,
        modo,
        ...(pagina ? { pagina } : {}),
        ...(no ? { no } : {}),
        ...(mais?.cursor != null ? { cursor: mais.cursor } : {}),
        ...(mais?.vistos?.length ? { vistos: mais.vistos.slice(-400) } : {}),
        ...(previa ? { previa: true } : {}),
      }),
    });
    let j: (Resposta & { erro?: string }) | null = null;
    let vista: Resposta | null = null;
    if (/ndjson/.test(r.headers.get("content-type") ?? "") && r.body) {
      /* One JSON per line: the preview first (flag previa), the full answer last. */
      const leitor = r.body.getReader();
      const texto = new TextDecoder();
      let resto = "";
      for (;;) {
        const { done, value } = await leitor.read();
        resto += texto.decode(value ?? new Uint8Array(), { stream: !done });
        const linhas = resto.split("\n");
        resto = done ? "" : (linhas.pop() ?? "");
        for (const l of linhas) {
          if (!l.trim()) continue;
          const o = JSON.parse(l) as Resposta & { erro?: string; previa?: boolean };
          if (o.previa) {
            vista = o;
            aoPrevia?.(o);
          } else j = o;
        }
        if (done) break;
      }
    } else j = (await r.json()) as Resposta & { erro?: string };
    if (!r.ok || !j || j.erro) {
      /* Full search failed after the preview: the preview stays. */
      if (vista) return { resposta: vista, erro: null };
      return { resposta: null, erro: j?.erro ?? "A busca não respondeu agora. Tente de novo." };
    }
    if (chaveCache && j.resultados?.length) gravarNaSessao(chaveCache, j);
    return { resposta: j, erro: null };
  } catch {
    return { resposta: null, erro: "Sem conexão agora. Tente de novo." };
  }
}

/* Per-tab cache of first pages (06/11): going back to a search answers at once.
   Catalog data only (the same answer the server caches for everyone for 6 h);
   sessionStorage dies with the tab. */
const SESSAO_MS = 6 * 3600_000;
export function chaveDaSessao(q: string, contexto: string, modo: string, no?: string) {
  const n = q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h * 33) ^ n.charCodeAt(i)) >>> 0;
  return `bg7_cache_${contexto}_${modo}_${no ?? ""}_${h.toString(36)}_${n.length}`;
}
function lerDaSessao(chave: string): Resposta | null {
  try {
    const bruto = typeof window !== "undefined" ? window.sessionStorage.getItem(chave) : null;
    const v = bruto ? (JSON.parse(bruto) as { em: number; r: Resposta }) : null;
    return v && Date.now() - v.em < SESSAO_MS && v.r?.resultados?.length ? v.r : null;
  } catch {
    return null;
  }
}
function gravarNaSessao(chave: string, r: Resposta) {
  try {
    window.sessionStorage.setItem(chave, JSON.stringify({ em: Date.now(), r }));
  } catch {
    /* full or blocked storage: no cache */
  }
}
