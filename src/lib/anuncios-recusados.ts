/* VENDEDOR RECUSADO PELO PROGRAMA DE AFILIADOS (Guardião, 18/10, pedidos
   1000041-44: a tela recomendou um guarda-roupa de R$ 400 contra R$ 929,99 e
   o cliente clicou 4 vezes; o gerador respondeu "The seller must have
   reputation yellow and up, reputation: 1_red"). Anúncio que o programa
   recusa (reputação abaixo de amarela, "URL not allowed") não tem link de
   afiliado possível: o preço dele não é alcançável pelo botão. Ele vira
   semAfiliado, sai da tabela e da recomendação (mesma regra da loja recusada,
   02/10) e nunca é indicado (Weslei, 18/10: "Garanta sempre produtos com
   qualidade"). A lista vem do banco (anuncios_recusados, só os códigos). */
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { itemDaOferta } from "@/lib/avaliacoes-detalhe";

type Oferta = {
  item?: string | null;
  url?: string | null;
  link?: string | null;
  semAfiliado?: boolean | null;
};
type ComOfertas = {
  outraLoja?: Oferta | null;
  outrasLojas?: Oferta[] | null;
  referencias?: Oferta[] | null;
  parecidos?: Oferta[] | null;
};

const ofertasDa = (a: ComOfertas | null | undefined): Oferta[] => [
  ...(a?.outraLoja ? [a.outraLoja] : []),
  ...(a?.outrasLojas ?? []),
  ...(a?.referencias ?? []),
  ...(a?.parecidos ?? []),
];

/** Anúncios da análise que precisam do link no clique (sem link pronto). */
export function itensSemLink(a: ComOfertas | null | undefined): string[] {
  const itens = ofertasDa(a)
    .filter((o) => !ehLinkDeAfiliado(o.link))
    .map((o) => itemDaOferta(o))
    .filter((i): i is string => !!i && /^MLB\d{6,}$/.test(i));
  return [...new Set(itens)].slice(0, 300);
}

/** Marca semAfiliado as ofertas recusadas que não têm link próprio. */
export function semRecusados<A extends ComOfertas>(a: A, recusados: Set<string>): A {
  if (!recusados.size) return a;
  const marcar = <O extends Oferta>(o: O): O => {
    if (ehLinkDeAfiliado(o.link)) return o;
    const item = itemDaOferta(o);
    return item && recusados.has(item) ? { ...o, semAfiliado: true } : o;
  };
  return {
    ...a,
    outraLoja: a.outraLoja ? marcar(a.outraLoja) : a.outraLoja,
    outrasLojas: a.outrasLojas?.map(marcar) ?? a.outrasLojas,
    referencias: a.referencias?.map(marcar) ?? a.referencias,
    parecidos: a.parecidos?.map(marcar) ?? a.parecidos,
  };
}

export async function lerAnunciosRecusados(itens: string[]): Promise<Set<string>> {
  if (!itens.length) return new Set();
  try {
    const { data } = await supabase.rpc(
      "anuncios_recusados" as never,
      { p_itens: itens.slice(0, 300) } as never,
    );
    return new Set(
      (Array.isArray(data) ? (data as Array<{ item?: string | null }>) : [])
        .map((r) => r.item ?? "")
        .filter((i) => /^MLB\d{6,}$/.test(i)),
    );
  } catch {
    return new Set();
  }
}

/** Recusados entre as ofertas sem link da análise (uma leitura por conjunto). */
export function useAnunciosRecusados(a: ComOfertas | null | undefined): Set<string> {
  const [recusados, setRecusados] = useState<Set<string>>(() => new Set());
  const assinatura = itensSemLink(a).sort().join(",");
  useEffect(() => {
    if (!assinatura) return;
    let vivo = true;
    void lerAnunciosRecusados(assinatura.split(",")).then((s) => {
      if (vivo) setRecusados(s);
    });
    return () => {
      vivo = false;
    };
  }, [assinatura]);
  return recusados;
}
