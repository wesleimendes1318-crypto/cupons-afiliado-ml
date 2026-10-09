/* CAMPANHAS NA TELA (Weslei, 09/10). O site lê só campanha ATIVA e dentro
   do prazo (campanhas_ativas, filtrada no banco) e revalida sozinho quando
   a pessoa volta para a aba depois de 10 minutos (aba esquecida aberta não
   mostra campanha vencida). Sem a leitura (rede, banco), a vitrine usa a
   conta local de sempre (nunca tela vazia). */
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import type { Oferta } from "@/lib/ofertas-vitrine";

export type ProdutoDaCampanha = {
  chave: string;
  titulo: string;
  imagem: string | null;
  tipo: "mesmo" | "parecido" | "menor";
  preco: number;
  antes: number;
  economia: number;
  loja: string | null;
  link: string | null;
  lojas: number | null;
  url_produto: string | null;
  conferido_em: string;
  loja_oficial: boolean;
  mercado_lider: string | null;
};

export type CampanhaPublica = {
  slug: string;
  nome: string;
  beneficio_texto: string | null;
  regras_resumo: string | null;
  tema_visual: string | null;
  temporada: string | null;
  inicia_em: string;
  termina_em: string;
  fonte: string;
  demanda_tipo: string | null;
  nacional: boolean;
  link_afiliado_campanha: string | null;
  produtos: ProdutoDaCampanha[];
};

export const REVALIDAR_MS = 10 * 60_000;

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

/** Produto da campanha no formato do cartão (só link de afiliado). */
export function ofertaDaCampanha(p: ProdutoDaCampanha, agora = Date.now()): Oferta | null {
  const preco = num(p.preco);
  const antes = num(p.antes);
  const economia = num(p.economia);
  if (![preco, antes, economia].every(Number.isFinite)) return null;
  return {
    chave: p.chave,
    titulo: p.titulo,
    imagem: p.imagem,
    preco,
    antes,
    economia,
    loja: p.loja,
    link: ehLinkDeAfiliado(p.link) ? p.link : null,
    tipo: p.tipo,
    lojas: p.lojas,
    urlProduto: p.url_produto,
    recente: agora - Date.parse(p.conferido_em) < 24 * 3600_000,
    vistoEm: p.conferido_em,
  };
}

/** Chama `fn` quando a aba volta a ficar visível depois de `ms` (padrão
    10 min) desde a última vez. */
export function useRevalidarAoVoltar(fn: () => void, ms = REVALIDAR_MS) {
  const ultima = useRef(Date.now());
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultima.current < ms) return;
      ultima.current = Date.now();
      ref.current();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [ms]);
}

/** Campanhas ativas agora. `null` = leitura falhou (usar a conta local). */
export function useCampanhasAtivas(uf: string | null = null) {
  const [campanhas, setCampanhas] = useState<CampanhaPublica[] | null>(null);
  const [carregou, setCarregou] = useState(false);
  const ler = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc(
        "campanhas_ativas" as never,
        { p_uf: uf } as never,
      );
      if (error || !Array.isArray(data)) throw error ?? new Error("sem dados");
      /* Segunda trava: nada vencido passa, mesmo com resposta em cache. */
      const agora = Date.now();
      setCampanhas(
        (data as CampanhaPublica[]).filter(
          (c) => Date.parse(c.termina_em) > agora && Date.parse(c.inicia_em) <= agora,
        ),
      );
    } catch {
      /* Falhou a releitura: mantém a lista anterior, sem o que já venceu. */
      const agora = Date.now();
      setCampanhas((atual) => atual?.filter((c) => Date.parse(c.termina_em) > agora) ?? null);
    } finally {
      setCarregou(true);
    }
  }, [uf]);
  useEffect(() => {
    void ler();
  }, [ler]);
  useRevalidarAoVoltar(() => void ler());
  return { campanhas, carregou };
}
