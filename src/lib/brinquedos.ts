/* BRINQUEDOS POR IDADE (Weslei, 05/10: "aumentar a lista de brinquedos,
   opções em alta", "faixa etária e recomendação de produtos", "brinquedos
   com menor ticket médio... para doação", "produtos que já estão no menor
   preço... indicar que foi o menor preço encontrado", "o agente pode
   realizar buscas diretamente na API do Mercado Livre... sem depender das
   buscas dos usuários", "ter mapeado as melhores oportunidades e buscar
   depois na API para retornar o produto já com meu link afiliado").

   Parte compartilhada (site e servidor): faixas, buscas e dicas. A coleta
   (só servidor) fica em src/lib/curadoria-brinquedos.ts. */

export type Faixa = {
  id: "bebe" | "3a5" | "6a8" | "9a12" | "doacao";
  nome: string;
  curto: string;
  /* Idade em anos (doação: qualquer idade). */
  min: number;
  max: number;
  /* Preço máximo do produto (doação). */
  precoMax?: number;
  /* Buscas no catálogo oficial: marcas conhecidas e o que está em alta. */
  buscas: string[];
  /* Recomendação curta e fixa (sem promessa, sem dado inventado). */
  dica: string;
};

export const FAIXAS: Faixa[] = [
  {
    id: "bebe",
    nome: "Bebês (0 a 2 anos)",
    curto: "0 a 2 anos",
    min: 0,
    max: 2,
    buscas: [
      "brinquedo bebe fisher price",
      "mordedor chocalho bebe",
      "tapete de atividades bebe",
      "cubo didatico bebe",
      "pelucia bebe antialergica",
      "brinquedo de empilhar bebe",
    ],
    dica: "Peças grandes, sem partes pequenas que soltam, e selo do Inmetro. Para estimular: sons, texturas e cores.",
  },
  {
    id: "3a5",
    nome: "3 a 5 anos",
    curto: "3 a 5 anos",
    min: 3,
    max: 5,
    buscas: [
      "lego duplo",
      "massinha play doh kit",
      "boneca baby alive",
      "carrinho hot wheels kit",
      "jogo da memoria infantil",
      "patinete 3 rodas infantil",
    ],
    dica: "Faz de conta, montar e massinha ajudam na coordenação. Confira a idade mínima indicada na embalagem.",
  },
  {
    id: "6a8",
    nome: "6 a 8 anos",
    curto: "6 a 8 anos",
    min: 6,
    max: 8,
    /* 09/10: lego classic, pista hot wheels e barbie têm idade mínima de 3-4
       anos no catálogo e iam para "3 a 5"; a faixa ficou com 1 produto. */
    buscas: [
      "lego friends",
      "lego city",
      "lego minecraft",
      "jogo banco imobiliario",
      "jogo detetive estrela",
      "bicicleta infantil aro 16",
    ],
    dica: "Montagem, jogos de regra simples e brinquedos de movimento. Bicicleta: aro 16 costuma servir de 5 a 8 anos.",
  },
  {
    id: "9a12",
    nome: "9 a 12 anos",
    curto: "9 a 12 anos",
    min: 9,
    max: 12,
    /* 09/10 (pesquisa): quebra-cabeça, kit de ciência, beyblade e nerf
       não renderam produto em 2 dias (sem oferta nova no catálogo);
       trocados por marcas de catálogo. */
    buscas: [
      "lego technic",
      "lego star wars",
      "jogo uno",
      "jogo war grow",
      "jogo imagem e acao grow",
      "nerf elite",
    ],
    dica: "Desafios maiores: montagem técnica, quebra-cabeça, ciência e jogos para jogar em grupo.",
  },
  {
    id: "doacao",
    nome: "Para doação e lembrancinhas (até R$ 30)",
    curto: "Até R$ 30",
    min: 0,
    max: 12,
    precoMax: 30,
    /* 09/10: só 1 ou 2 de 9 produtos achados ficavam até R$ 30; buscas
       genéricas trocadas por marcas conhecidas de item barato. */
    buscas: [
      "carrinho hot wheels basico",
      "jogo uno cartas",
      "massinha de modelar infantil",
      "cubo magico moyu",
      "slime kimeleka",
      "kit pintura infantil",
      "bolha de sabao brinquedo",
      "pião beyblade",
    ],
    dica: "Para muitas crianças, um brinquedo simples já é simbólico. Preço por unidade; o frete aparece à parte em cada um.",
  },
];

export const faixaPorId = (id: string | null | undefined) =>
  FAIXAS.find((f) => f.id === id) ?? null;

/* Título que não é brinquedo (peças de veículo, adulto) fica de fora. 09/10:
   também cama/banho, material escolar, roupa e lote de atacado com o
   personagem ("Kit com 2 fronhas Barbie" saiu em 6 a 8 anos). */
const NAO_E_BRINQUEDO =
  /\b(freio|pneus?|rela[cç][aã]o|retentor|amortecedor|farol|retrovisor|para-?choque|palheta|[oó]leo|escapamento|rastreador|bateria automotiva|automotiv[oa]|veicular|adulto|er[oó]tic|sex|fronhas?|len[cç][oó]is|len[cç]ol|jogo de cama|edredom|cobertor|travesseiros?|toalhas?|cortinas?|mochilas?|lancheiras?|estojos?|garrafas?|squeeze|canecas?|camisetas?|pijamas?|capinhas?|adesivos? de parede|papel de parede|topo de bolo|atacado)\b/i;

export const pareceBrinquedo = (titulo: string) => !NAO_E_BRINQUEDO.test(titulo);

/** Idade indicada pelos atributos do catálogo ("3 anos", "18 meses"):
    devolve { min, max } em anos quando o catálogo informa. */
export function idadeDosAtributos(
  attrs: Array<{ id?: string; name?: string; value_name?: string | null }> | undefined,
): { min: number | null; max: number | null; texto: string | null } {
  let min: number | null = null;
  let max: number | null = null;
  const anos = (v: string | null | undefined) => {
    const m = /(\d+(?:[.,]\d+)?)\s*(anos?|meses|m[eê]s|years?|months?)/i.exec(v ?? "");
    if (!m) return null;
    const n = Number(m[1]!.replace(",", "."));
    return /m[eê]s|meses|month/i.test(m[2]!) ? n / 12 : n;
  };
  for (const a of attrs ?? []) {
    const id = (a.id ?? "").toUpperCase();
    const nome = (a.name ?? "").toLowerCase();
    if (!/AGE/.test(id) && !/idade/.test(nome)) continue;
    const v = anos(a.value_name);
    if (v == null) continue;
    if (/MAX|m[aá]xima/i.test(id + nome)) max = v;
    else if (min == null || v < min) min = v;
  }
  const fmt = (n: number) =>
    n < 1
      ? `${Math.round(n * 12)} meses`
      : `${Math.round(n)} ${Math.round(n) === 1 ? "ano" : "anos"}`;
  const texto =
    min != null && max != null
      ? `${fmt(min)} a ${fmt(max)}`
      : min != null
        ? `a partir de ${fmt(min)}`
        : null;
  return { min, max, texto };
}

/** Faixa que combina com a idade indicada (sem idade: null). */
export function faixaDaIdade(min: number | null): Faixa["id"] | null {
  if (min == null) return null;
  if (min < 3) return "bebe";
  if (min < 6) return "3a5";
  if (min < 9) return "6a8";
  if (min <= 12) return "9a12";
  return null;
}
