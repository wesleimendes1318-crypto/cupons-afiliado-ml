/* Real comparison stats per department, read live from the DB
   (estatisticas_categoria, migration 20261113160000). No number here is
   typed by hand: if the function is missing or a category has < 20
   comparisons, the block simply does not render. */

/** Department slug (taxonomia) -> ML category name stored in produtos_vistos.categoria. */
export const CATEGORIA_ML: Record<string, string> = {
  eletronicos: "Eletrônicos, Áudio e Vídeo",
  celulares: "Celulares e Telefones",
  informatica: "Informática",
  casa: "Casa, Móveis e Decoração",
  moda: "Calçados, Roupas e Bolsas",
  beleza: "Beleza e Cuidado Pessoal",
  automotivo: "Acessórios para Veículos",
  brinquedos: "Brinquedos e Hobbies",
  eletrodomesticos: "Eletrodomésticos",
  ferramentas: "Ferramentas",
  saude: "Saúde",
  esportes: "Esportes e Fitness",
  bebes: "Bebês",
  pet: "Pet Shop",
  papelaria: "Arte, Papelaria e Armarinho",
  mercado: "Alimentos e Bebidas",
};

export type DadosCategoria = {
  comparados: number;
  comEconomia: number;
  mediana: number;
  medianaPct: number;
  p90: number;
  pequenas: number;
  freteConhecido: number;
  maisBarataCobraFrete: number;
  inicio: string;
  fim: string;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

type Linha = {
  categoria?: unknown;
  comparados?: unknown;
  com_economia?: unknown;
  economia_mediana?: unknown;
  economia_mediana_pct?: unknown;
  economia_p90?: unknown;
  pequenas?: unknown;
  frete_conhecido?: unknown;
  mais_barata_cobra_frete?: unknown;
  inicio?: unknown;
  fim?: unknown;
};

export function lerDadosCategoria(linhas: unknown, slug: string): DadosCategoria | null {
  const nome = CATEGORIA_ML[slug];
  if (!nome || !Array.isArray(linhas)) return null;
  const r = (linhas as Linha[]).find((l) => l.categoria === nome);
  if (!r) return null;
  const d: DadosCategoria = {
    comparados: num(r.comparados),
    comEconomia: num(r.com_economia),
    mediana: num(r.economia_mediana),
    medianaPct: num(r.economia_mediana_pct),
    p90: num(r.economia_p90),
    pequenas: num(r.pequenas),
    freteConhecido: num(r.frete_conhecido),
    maisBarataCobraFrete: num(r.mais_barata_cobra_frete),
    inicio: String(r.inicio ?? ""),
    fim: String(r.fim ?? ""),
  };
  if (!(d.comparados >= 20) || !(d.comEconomia > 0) || !Number.isFinite(d.mediana)) return null;
  return d;
}

export const reais = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n: number) => `${Math.round(n)}%`;
/** "2026-10-18" -> "18/10/2026". */
export const dataBr = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** Sentences built only from the numbers; first person, Weslei's voice. */
export function textoDosDados(nome: string, d: DadosCategoria): string[] {
  const fatia = (100 * d.comEconomia) / d.comparados;
  const frases = [
    `Comparei ${d.comparados} anúncios de ${nome.toLowerCase()} entre ${dataBr(d.inicio)} e ${dataBr(d.fim)}. Em ${pct(fatia)} deles, outra loja vendia o mesmo produto mais barato. Quando havia diferença, a economia mediana foi de ${reais(d.mediana)} (${d.medianaPct.toLocaleString("pt-BR")}% do preço do anúncio), e 1 em cada 10 passou de ${reais(d.p90)}.`,
    `Nos outros ${pct(100 - fatia)}, o anúncio colado já era o mais barato entre as lojas com o mesmo produto. Nesses casos, trocar de loja não compensa: fique com o que você achou.`,
  ];
  if (d.freteConhecido >= 10)
    frases.push(
      d.maisBarataCobraFrete === 0
        ? `Nas ${d.freteConhecido} economias em que o frete era conhecido, a loja mais barata também tinha frete grátis. Aqui o frete quase nunca inverte o ganhador.`
        : `Nas ${d.freteConhecido} economias em que o frete era conhecido, a loja mais barata cobrava frete em ${d.maisBarataCobraFrete}. Nesses casos, confira o frete para o seu CEP antes de trocar.`,
    );
  if (d.pequenas > 0)
    frases.push(
      `${d.pequenas} das economias ficaram abaixo de 5% do preço. Com diferença tão pequena, a loja oficial costuma valer os poucos reais a mais.`,
    );
  return frases;
}
