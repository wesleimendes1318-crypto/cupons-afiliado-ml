import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { foraDoModelo } from "@/lib/busca-intencao";
import { pareceFalso } from "@/lib/falsificado";
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

/** Acompanha a busca nos anúncios (a cada 3 s, até 2 min). */
export function useAnunciosPeloNome(resposta: Resposta | null): EstadoAnuncios | null {
  const pedido = resposta?.anuncios ?? null;
  const [estado, setEstado] = useState<EstadoAnuncios | null>(null);
  useEffect(() => {
    setEstado(null);
    if (!pedido) return;
    let vivo = true;
    const fim = Date.now() + 120_000;
    setEstado({ estado: "buscando", itens: [] });
    const olhar = async () => {
      if (!vivo) return;
      const { data } = await supabase
        .rpc("ver_busca_anuncios" as never, { p_id: pedido.id, p_chave: pedido.chave } as never)
        .then(
          (r) => r,
          () => ({ data: null }),
        );
      if (!vivo) return;
      const d = data as { estado?: string; resultado?: unknown } | null;
      if (d?.estado === "pronto") {
        setEstado({
          estado: "pronto",
          itens: anunciosValidos(d.resultado, resposta?.marca, resposta?.modelo),
        });
        return;
      }
      if (d?.estado === "falhou" || Date.now() > fim) {
        setEstado({ estado: "falhou", itens: [] });
        return;
      }
      setTimeout(() => void olhar(), 3_000);
    };
    void olhar();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.id, pedido?.chave]);
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
): Promise<{ resposta: Resposta | null; erro: string | null }> {
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
      }),
    });
    const j = (await r.json()) as Resposta & { erro?: string };
    if (!r.ok || j.erro)
      return { resposta: null, erro: j.erro ?? "A busca não respondeu agora. Tente de novo." };
    return { resposta: j, erro: null };
  } catch {
    return { resposta: null, erro: "Sem conexão agora. Tente de novo." };
  }
}
