/* OFERTAS DA VITRINE (regra única do site e do agente de campanhas): a
   melhor oferta de cada produto comparado. Três estratégias, todas JÁ
   COMPARADAS: mesmo produto mais barato em outra loja, alternativa de
   qualidade igual ou melhor, ou o próprio anúncio já no menor preço contra
   pelo menos 2 lojas (src/lib/menor-preco.ts). Só link de afiliado. */
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { menorPrecoVale } from "@/lib/menor-preco";

export type ItemVitrine = {
  chave: string;
  titulo: string;
  imagem: string | null;
  loja: string | null;
  preco: number | null;
  url_produto: string | null;
  link?: string | null;
  melhor_loja: string | null;
  melhor_preco: number | null;
  melhor_link: string | null;
  economia: number | null;
  visto_em: string;
  alt_preco: number | null;
  alt_economia: number | null;
  alt_titulo: string | null;
  alt_link: string | null;
  alt_loja: string | null;
  alt_frete_gratis: boolean | null;
};

export type ItemMenorPreco = {
  chave: string;
  titulo: string;
  imagem: string | null;
  loja: string | null;
  preco: number | null;
  link: string | null;
  url_produto: string | null;
  segunda_preco: number | null;
  segunda_loja: string | null;
  lojas_mais_caras: number | null;
  visto_em: string;
};

export type Oferta = {
  chave: string;
  titulo: string;
  imagem: string | null;
  preco: number;
  antes: number;
  economia: number;
  loja: string | null;
  link: string | null;
  tipo: "mesmo" | "parecido" | "menor";
  lojas?: number | null;
  urlProduto: string | null;
  recente: boolean;
  /* Quando foi comparado (para "preço de dd/mm"). */
  vistoEm?: string;
};

const recente = (iso: string) => Date.now() - Date.parse(iso) < 24 * 3600_000;

/* A melhor oferta de cada produto comparado: o mesmo produto em outra loja
   ou, se economiza mais, a alternativa (que só entra na vitrine com
   qualidade equivalente ou superior; ver alternativa_da_analise). */
export function ofertaDo(i: ItemVitrine): Oferta | null {
  const mesmo =
    (i.economia ?? 0) > 0 && i.melhor_preco != null && i.preco != null
      ? {
          titulo: i.titulo,
          preco: i.melhor_preco,
          economia: i.economia as number,
          loja: i.melhor_loja,
          link: ehLinkDeAfiliado(i.melhor_link) ? i.melhor_link : null,
          tipo: "mesmo" as const,
        }
      : null;
  const alt =
    (i.alt_economia ?? 0) > 0 && i.alt_preco != null && i.preco != null && i.alt_frete_gratis
      ? {
          titulo: i.alt_titulo ?? i.titulo,
          preco: i.alt_preco,
          economia: i.alt_economia as number,
          loja: i.alt_loja,
          link: ehLinkDeAfiliado(i.alt_link) ? i.alt_link : null,
          tipo: "parecido" as const,
        }
      : null;
  const melhor = mesmo && (!alt || mesmo.economia >= alt.economia) ? mesmo : alt;
  if (!melhor || i.preco == null) return null;
  return {
    chave: i.chave,
    imagem: i.imagem,
    antes: i.preco,
    urlProduto: i.url_produto,
    recente: recente(i.visto_em),
    vistoEm: i.visto_em,
    ...melhor,
  };
}

export function ofertaMenorPreco(i: ItemMenorPreco): Oferta | null {
  if (!menorPrecoVale(i) || i.preco == null || i.segunda_preco == null) return null;
  return {
    chave: i.chave,
    titulo: i.titulo,
    imagem: i.imagem,
    preco: i.preco,
    antes: i.segunda_preco,
    economia: Math.round((i.segunda_preco - i.preco) * 100) / 100,
    loja: i.loja,
    link: ehLinkDeAfiliado(i.link) ? i.link : null,
    tipo: "menor",
    lojas: i.lojas_mais_caras,
    urlProduto: i.url_produto,
    recente: recente(i.visto_em),
    vistoEm: i.visto_em,
  };
}
