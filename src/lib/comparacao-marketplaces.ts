/* COMPARAÇÃO DOS 3 MARKETPLACES (Weslei, 09/10: "deve fazer a mesma analise
   em cada player e por fim comparar os 3 players"; 10/10: tabela "Mesmo
   produto" com uma coluna por marketplace e "Alternativas parecidas").

   Cada marketplace passa pela mesma análise (conferência pela foto, mesmo
   produto x parecido, usado/falso/peça fora, frete em linha própria). Na
   tabela, a melhor oferta do MESMO produto de cada um:
   - só disputa a "Melhor escolha" quem tem o CUSTO TOTAL CONFIRMADO
     (produto + frete): frete grátis confirmado ou de valor conhecido, nos 3
     marketplaces. "Prime" é frete grátis só para assinantes e "confira no
     anúncio" não é valor: não confirmam;
   - empate (menos de R$ 0,50): Mercado Livre primeiro, depois loja oficial;
   - mais barato só no produto, com frete a confirmar = "Menor preço no
     produto (frete a confirmar)", com o frete em linha própria.
   Nunca inventa preço: sem oferta conferida, a coluna diz o que houve.
   Identificação dos marketplaces (Weslei, 10/10: "use a medida que me
   resguarde dos termos de uso de cada afiliado, mas que seja possível
   identificar o player"): só o NOME em texto e o endereço da loja, sem
   logotipo e sem as cores das marcas (as diretrizes de marca da Amazon só
   permitem o logotipo nos arquivos fornecidos por ela, sem alteração). */
import { ehLinkDeCompra, type Marketplace } from "@/lib/afiliado";
import type { LojaExterna } from "@/lib/coletor-multiloja";
import type { NivelQualidade } from "@/lib/qualidade";

export type Jogador = Marketplace;

export const NOME_DO_JOGADOR: Record<Jogador, string> = {
  mercadolivre: "Mercado Livre",
  amazon: "Amazon Brasil",
  shopee: "Shopee",
};

/* Endereço da loja, em texto: ajuda a reconhecer o marketplace sem usar
   logotipo nem as cores da marca. */
export const ENDERECO_DO_JOGADOR: Record<Jogador, string> = {
  mercadolivre: "mercadolivre.com.br",
  amazon: "amazon.com.br",
  shopee: "shopee.com.br",
};

export const ORDEM_DAS_COLUNAS: Jogador[] = ["mercadolivre", "amazon", "shopee"];

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
  /* Endereço do anúncio para gerar o link de afiliado no clique (só
     Mercado Livre, quando o link ainda não saiu). */
  urlLoja?: string | null;
  /* É o próprio anúncio colado (só Mercado Livre). */
  ehColado?: boolean;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Frete confirmado para qualquer comprador: grátis confirmado ou valor
    conhecido. Prime e "confira no anúncio" não confirmam. */
export function freteConfirmado(o: { freteGratis: boolean | null; custoFrete: number | null }) {
  return o.freteGratis === true || (o.custoFrete != null && o.custoFrete > 0);
}

/** Custo total confirmado (produto + frete) ou null quando o frete não está
    confirmado para qualquer comprador. Mesma régua nos 3 marketplaces. */
export function totalConfirmado(o: {
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
      const ta = totalConfirmado(a);
      const tb = totalConfirmado(b);
      if ((ta == null) !== (tb == null)) return ta == null ? 1 : -1;
      const d = (ta ?? a.preco) - (tb ?? b.preco);
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
    const ta = totalConfirmado(a);
    const tb = totalConfirmado(b);
    if ((ta == null) !== (tb == null)) return ta == null ? 1 : -1;
    const d = (ta ?? a.preco) - (tb ?? b.preco);
    return Math.abs(d) >= 0.5 ? d : desempate(a, b);
  });
  const vencedor = ofertas.find((o) => totalConfirmado(o) != null) ?? null;
  const maisBaratoNoProduto = [...ofertas].sort((a, b) => {
    const d = a.preco - b.preco;
    return Math.abs(d) >= 0.5 ? d : desempate(a, b);
  })[0];
  const menorNoProduto =
    maisBaratoNoProduto &&
    totalConfirmado(maisBaratoNoProduto) == null &&
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

/** Linha do frete (sempre em linha própria, sem juntar com outro valor).
    Prime é frete grátis só para assinantes; o resto sem valor é "a
    confirmar" (frete desconhecido não é grátis). */
export function linhaDoFrete(
  o: Pick<OfertaDoJogador, "freteGratis" | "custoFrete" | "notaFrete"> & { prime?: boolean },
) {
  if (o.freteGratis === true) return "Frete grátis";
  if (o.custoFrete != null && o.custoFrete > 0) return `Frete ${brl(o.custoFrete)}`;
  if (o.prime || /prime/i.test(o.notaFrete ?? "")) return "Frete grátis só para assinantes Prime";
  return o.freteGratis === false ? "Sem frete grátis" : "Frete a confirmar";
}

/** Frete na célula "Frete" da tabela (o rótulo da linha já diz "Frete"). */
export function celulaDoFrete(
  o: Pick<OfertaDoJogador, "freteGratis" | "custoFrete" | "notaFrete" | "prime">,
) {
  if (o.freteGratis === true) return "Grátis";
  if (o.custoFrete != null && o.custoFrete > 0) return brl(o.custoFrete);
  if (o.prime || /prime/i.test(o.notaFrete ?? "")) return "Grátis só para assinantes Prime";
  if (o.freteGratis === false) return "Pago, valor a confirmar";
  return "A confirmar";
}

export type ItemDoQueMuda = { campo: string | null; seu: string | null; este: string };

/** "Marca: Logitech -> não informada; Cor: Preto -> Azul" em itens. Item sem
    "Campo: X -> Y" fica como texto livre (campo e seu nulos). */
export function itensDoQueMuda(muda: string | null | undefined): ItemDoQueMuda[] {
  return String(muda ?? "")
    .split(/;\s*/)
    .map((p) => p.trim())
    .filter((p) => p && !/->\s*$/.test(p))
    .map((p) => {
      const m = /^([^:]{1,40}):\s*(.+?)\s*->\s*(.+)$/.exec(p);
      return m
        ? { campo: m[1]!.trim(), seu: m[2]!.trim(), este: m[3]!.trim() }
        : { campo: null, seu: null, este: p };
    });
}

const NAO_INFORMADA =
  /^n[aã]o\s+(informad[ao]|identificad[ao]|vis[ií]vel)|^sem marca|^gen[eé]ric[ao]$/i;

/** Marca do parecido pelo que a conferência apontou ("Marca: X -> Y");
    null quando não informada ou quando a conferência não falou da marca. */
export function marcaDoParecido(muda: string | null | undefined): string | null {
  const item = itensDoQueMuda(muda).find((i) => i.campo && /^marca$/i.test(i.campo));
  if (!item || NAO_INFORMADA.test(item.este)) return null;
  return item.este;
}

/** Características do parecido no que difere do seu, sem a marca (que tem
    linha própria): só o valor DELE, como no cartão ("Azul/Branco ·
    Bluetooth + USB"). */
export function detalhesDoParecido(muda: string | null | undefined): string[] {
  return itensDoQueMuda(muda)
    .filter((i) => !(i.campo && /^marca$/i.test(i.campo)))
    .map((i) => i.este);
}

/** O que muda, por extenso ("Cor: o seu Preto → este Azul"), para quem
    quiser conferir campo a campo. */
export function comparacaoDoParecido(muda: string | null | undefined): string[] {
  return itensDoQueMuda(muda).map((i) =>
    i.campo ? `${i.campo}: o seu ${i.seu} → este ${i.este}` : i.este,
  );
}

/** "Parecido" (muito semelhante ou mesma foto) ou "Produto diferente". */
export function rotuloDaRelacao(l: { semelhanca: number | null; mesmaFoto?: boolean | null }) {
  return l.mesmaFoto === true || (l.semelhanca ?? 0) >= 60 ? "Parecido" : "Produto diferente";
}

/** Qualidade do parecido no cartão, pelo veredito da conferência. */
export function qualidadeDoCartao(q: string | null | undefined): {
  nivel: NivelQualidade;
  texto: string;
} {
  if (q === "superior") return { nivel: "superior", texto: "Qualidade superior à do seu" };
  if (q === "equivalente") return { nivel: "equivalente", texto: "Qualidade equivalente à do seu" };
  if (q === "inferior") return { nivel: "inferior", texto: "Qualidade inferior à do seu" };
  return { nivel: "incerta", texto: "Qualidade não confirmada" };
}
