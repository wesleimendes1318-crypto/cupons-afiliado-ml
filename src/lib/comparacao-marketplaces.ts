/* COMPARAÇÃO FINAL DOS 3 MARKETPLACES (Weslei, 09/10: "deve fazer a mesma
   analise em cada player e por fim comparar os 3 players"; prompt "Linha da
   Amazon na tabela de comparação", tag melhoresc0fff-20).

   Cada marketplace passa pela mesma análise (conferência pela foto, mesmo
   produto x parecido, usado/falso/peça fora, frete em linha própria). No
   fim, uma linha por marketplace com a melhor oferta do MESMO produto:
   - disputa o "Mais barato" quem tem custo confirmado: no Mercado Livre, a
     mesma conta da tabela (totalDaLoja: frete pago sem valor fica fora); na
     Amazon e na Shopee, só frete grátis confirmado ou de valor conhecido.
     "Prime" é frete grátis só para assinantes: não confirma o custo de
     todo comprador, então não passa na frente;
   - empate (menos de R$ 0,50): Mercado Livre primeiro, depois loja oficial;
   - quem é mais barato só no produto, com frete não confirmado, aparece
     como "Menor preço no produto", com o frete em linha própria.
   Nunca inventa preço: sem oferta conferida, a linha diz o que houve. */
import { ehLinkDeCompra, type Marketplace } from "@/lib/afiliado";
import type { LojaExterna } from "@/lib/coletor-multiloja";
import type { NivelQualidade } from "@/lib/qualidade";

export type Jogador = Marketplace;

export const NOME_DO_JOGADOR: Record<Jogador, string> = {
  mercadolivre: "Mercado Livre",
  amazon: "Amazon Brasil",
  shopee: "Shopee",
};

export type OfertaDoJogador = {
  jogador: Jogador;
  titulo: string | null;
  loja: string | null;
  /* Preço do produto (sem frete). */
  preco: number;
  freteGratis: boolean | null;
  custoFrete: number | null;
  /* Texto do frete sem valor confirmado ("Frete grátis para assinantes Prime"). */
  notaFrete: string | null;
  prime: boolean;
  oficial: boolean;
  /* Link de compra (afiliado do próprio marketplace) ou null. */
  link: string | null;
  /* Custo que disputa o "Mais barato" (null = não confirmado). */
  total: number | null;
  /* É o próprio anúncio colado (só Mercado Livre). */
  ehColado?: boolean;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Frete confirmado para qualquer comprador: grátis confirmado ou valor
    conhecido. Prime e "confira no anúncio" não confirmam. */
export function freteConfirmado(o: { freteGratis: boolean | null; custoFrete: number | null }) {
  return o.freteGratis === true || (o.custoFrete != null && o.custoFrete > 0);
}

/** Total confirmado de uma oferta de outro marketplace (ou null). */
export function totalExterno(o: {
  preco: number;
  freteGratis: boolean | null;
  custoFrete: number | null;
}) {
  if (o.freteGratis === true) return o.preco;
  if (o.custoFrete != null && o.custoFrete > 0) return centavos(o.preco + o.custoFrete);
  return null;
}

/** Oferta de outro marketplace no formato da comparação final. */
export function ofertaExterna(l: LojaExterna): OfertaDoJogador {
  return {
    jogador: l.marketplace,
    titulo: l.titulo,
    loja: l.loja ?? null,
    preco: l.preco,
    freteGratis: l.freteGratis ?? null,
    custoFrete: l.custoFrete ?? null,
    notaFrete: l.notaFrete ?? null,
    prime: (l.selos ?? []).includes("Prime"),
    oficial: false,
    link: ehLinkDeCompra(l.link, l.marketplace) ? l.link : null,
    total: totalExterno(l),
  };
}

/** Melhor oferta do MESMO produto num marketplace: custo confirmado mais
    baixo; sem nenhum confirmado, o menor preço no produto (Prime primeiro
    no empate). Parecido nunca entra. */
export function melhorDoMarketplace(lojas: LojaExterna[], mk: "amazon" | "shopee") {
  const mesmos = lojas
    .filter((l) => l.marketplace === mk && l.relacao === "mesmo")
    .map(ofertaExterna)
    .filter((o) => o.link != null);
  return (
    mesmos.sort((a, b) => {
      if ((a.total == null) !== (b.total == null)) return a.total == null ? 1 : -1;
      const d = (a.total ?? a.preco) - (b.total ?? b.preco);
      if (Math.abs(d) >= 0.5) return d;
      return (b.prime ? 1 : 0) - (a.prime ? 1 : 0) || d;
    })[0] ?? null
  );
}

const ORDEM: Record<Jogador, number> = { mercadolivre: 0, amazon: 1, shopee: 2 };

export type Decisao = {
  /* Ofertas na ordem da tabela: custo confirmado primeiro (do menor), depois
     as de frete não confirmado (pelo preço do produto). */
  ofertas: OfertaDoJogador[];
  vencedor: OfertaDoJogador | null;
  /* Mais barato só no produto, com frete não confirmado (outro marketplace
     que o vencedor). */
  menorNoProduto: OfertaDoJogador | null;
};

export function decidirEntreMarketplaces(lista: Array<OfertaDoJogador | null>): Decisao {
  const ofertas = lista.filter(
    (o): o is OfertaDoJogador => o != null && Number.isFinite(o.preco) && o.preco > 0,
  );
  const desempate = (a: OfertaDoJogador, b: OfertaDoJogador) =>
    ORDEM[a.jogador] - ORDEM[b.jogador] || (b.oficial ? 1 : 0) - (a.oficial ? 1 : 0);
  ofertas.sort((a, b) => {
    if ((a.total == null) !== (b.total == null)) return a.total == null ? 1 : -1;
    const d = (a.total ?? a.preco) - (b.total ?? b.preco);
    return Math.abs(d) >= 0.5 ? d : desempate(a, b);
  });
  const vencedor = ofertas.find((o) => o.total != null) ?? null;
  const maisBaratoNoProduto = [...ofertas].sort((a, b) => {
    const d = a.preco - b.preco;
    return Math.abs(d) >= 0.5 ? d : desempate(a, b);
  })[0];
  const menorNoProduto =
    maisBaratoNoProduto &&
    maisBaratoNoProduto.total == null &&
    maisBaratoNoProduto !== vencedor &&
    (vencedor == null || maisBaratoNoProduto.preco <= vencedor.preco - 0.5)
      ? maisBaratoNoProduto
      : null;
  return { ofertas, vencedor, menorNoProduto };
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Diferença contra o anúncio colado (Weslei, 03/10): pelo custo final só
    quando o frete dos dois lados é conhecido; senão, no produto. Nunca junta
    o valor em reais com o frete numa expressão de valor. */
export function diferencaContraColado(
  o: Pick<OfertaDoJogador, "preco" | "freteGratis" | "custoFrete" | "ehColado">,
  colado: { preco: number | null; totalConfirmado: number | null },
): string | null {
  if (o.ehColado) return "É o anúncio que você colou";
  if (colado.preco == null) return null;
  const custoFinal = colado.totalConfirmado != null && freteConfirmado(o);
  const deste = custoFinal
    ? o.freteGratis === true
      ? o.preco
      : centavos(o.preco + (o.custoFrete ?? 0))
    : o.preco;
  const base = custoFinal ? (colado.totalConfirmado as number) : colado.preco;
  const d = centavos(base - deste);
  if (Math.abs(d) < 0.5)
    return custoFinal ? "Mesmo custo final que o seu" : "Mesmo preço no produto";
  const quanto = `${brl(Math.abs(d))} a ${d > 0 ? "menos" : "mais"}`;
  return custoFinal ? `${quanto} no custo final, já com o frete` : `${quanto} no produto`;
}

/** Linha do frete (sempre em linha própria, sem juntar com outro valor). */
export function linhaDoFrete(o: Pick<OfertaDoJogador, "freteGratis" | "custoFrete" | "notaFrete">) {
  if (o.freteGratis === true) return "Frete grátis";
  if (o.custoFrete != null && o.custoFrete > 0) return `Frete ${brl(o.custoFrete)}`;
  if (o.notaFrete) return o.notaFrete;
  return o.freteGratis === false ? "Sem frete grátis" : "Frete: confira no anúncio";
}

/** Selo da qualidade do parecido, pelo veredito da conferência. */
export function seloDaQualidade(q: string | null | undefined): {
  nivel: NivelQualidade;
  texto: string;
} {
  if (q === "superior") return { nivel: "superior", texto: "✓ Qualidade superior" };
  if (q === "equivalente") return { nivel: "equivalente", texto: "✓ Qualidade equivalente" };
  if (q === "inferior") return { nivel: "inferior", texto: "⚠ Qualidade inferior" };
  return { nivel: "incerta", texto: "? Qualidade não confirmada" };
}
