/* Respostas SEM IA, calculadas, para quando a IA não responde.

   Por que existe: medido no ar, a chave gratuita do Gemini estoura a cota
   (429) e o gateway da plataforma fica sem crédito (402) ao mesmo tempo. Aí
   a busca com IA, o comparador e o gerador de texto mostravam só "fora do
   ar". Tudo o que essas telas precisam dá para calcular com os números do
   próprio cupom — desconto, teto, compra mínima, validade — sem inventar
   nada. A resposta calculada é mais simples que a da IA, mas é verdadeira e
   sempre chega. */

type CupomBase = {
  id: number;
  vendedor: string;
  categoria: string | null;
  desconto: string | null;
  teto: number | null;
  compra_min: number | null;
};

const normalizar = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const moeda = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/** Quanto o cupom desconta numa compra de `valor` reais, respeitando teto e mínimo. */
export function economiaEm(c: Pick<CupomBase, "desconto" | "teto" | "compra_min">, valor: number): number {
  if (c.compra_min != null && valor < c.compra_min) return 0;
  const d = c.desconto ?? "";
  const pct = /(\d{1,3}(?:[.,]\d+)?)\s*%/.exec(d);
  const reais = /R\$\s*([\d.]+(?:,\d{1,2})?)/.exec(d);
  let bruto = 0;
  if (pct?.[1]) bruto = (valor * Number(pct[1].replace(",", "."))) / 100;
  else if (reais?.[1]) bruto = Number(reais[1].replace(/\./g, "").replace(",", "."));
  const teto = c.teto ?? Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(bruto, teto, valor));
}

/* Palavras comuns que não dizem o que a pessoa procura. */
const VAZIAS = new Set(["quero", "preciso", "procuro", "para", "com", "uma", "um", "de", "do", "da", "dos", "das",
  "cupom", "cupons", "desconto", "loja", "lojas", "comprar", "barato", "melhor", "algo", "coisa", "meu", "minha"]);

function descreverCupom(c: CupomBase): string {
  const partes = [`${c.desconto ?? "Cupom"} na ${c.vendedor}`];
  if (c.teto == null) partes.push("sem limite de valor informado");
  else partes.push(`até ${moeda(c.teto)} de desconto`);
  if (c.compra_min != null && c.compra_min > 0) partes.push(`compra mínima de ${moeda(c.compra_min)}`);
  return partes.join(", ") + ".";
}

/** Recomendação por palavras do pedido + desconto real numa compra de R$ 300. */
export function recomendarSemIa(pedido: string, cupons: CupomBase[]) {
  const termos = normalizar(pedido).split(" ").filter((w) => w.length >= 3 && !VAZIAS.has(w));
  const pontuados = cupons
    .map((c) => {
      const alvo = ` ${normalizar(c.vendedor)} ${normalizar(c.categoria)} `;
      const acertos = termos.filter((t) => alvo.includes(t) || alvo.includes(t.replace(/s$/, ""))).length;
      return { c, acertos, economia: economiaEm(c, 300) };
    })
    .filter((x) => x.acertos > 0)
    .sort((a, b) => b.acertos - a.acertos || b.economia - a.economia)
    .slice(0, 5);

  if (!pontuados.length) {
    return {
      escolhas: [],
      mensagem: "Não achei loja com cupom que combine com essas palavras. Tente o nome da loja ou uma categoria, como “tênis” ou “ferramentas”.",
      fonte: "calculo" as const,
    };
  }
  return {
    escolhas: pontuados.map(({ c }) => ({ id: c.id, motivo: descreverCupom(c) })),
    mensagem: `A melhor opção para o seu pedido é ${pontuados[0]!.c.vendedor}: escolhi pelas palavras que você digitou e pelo desconto real de cada cupom.`,
    fonte: "calculo" as const,
  };
}

type CupomComparado = CupomBase & { vence: string | null; qualidade: string | null };

/** Comparação de 2 a 3 cupons pela economia em compra pequena (R$ 150) e grande (R$ 1.000). */
export function compararSemIa(cupons: CupomComparado[], hoje = new Date()) {
  /* Dias de calendário no fuso de São Paulo: vence 26/09 visto em 23/09 = 3. */
  const hojeSP = Date.parse(hoje.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const dados = cupons.map((c) => ({
    c,
    pequena: economiaEm(c, 150),
    grande: economiaEm(c, 1000),
    dias: c.vence ? Math.round((Date.parse(c.vence.slice(0, 10)) - hojeSP) / 86_400_000) : null,
  }));
  const validos = dados.filter((d) => d.c.qualidade !== "armadilha");
  const base = validos.length ? validos : dados;
  const vencedor = [...base].sort((a, b) => b.pequena + b.grande - (a.pequena + a.grande))[0]!;
  const melhorPequena = [...base].sort((a, b) => b.pequena - a.pequena)[0]!;
  const melhorGrande = [...base].sort((a, b) => b.grande - a.grande)[0]!;

  const veredito =
    melhorPequena.c.id === melhorGrande.c.id
      ? `${vencedor.c.vendedor} compensa mais tanto em compras pequenas quanto em compras maiores.`
      : `${melhorPequena.c.vendedor} rende mais em compras pequenas, e ${melhorGrande.c.vendedor} rende mais em compras maiores. No geral, ${vencedor.c.vendedor} é a escolha mais equilibrada.`;

  const observacoes: string[] = [];
  for (const d of dados) {
    if (d.c.qualidade === "armadilha") observacoes.push(`O cupom da ${d.c.vendedor} desconta muito pouco para o que anuncia.`);
    else if (d.c.compra_min != null && d.c.compra_min >= 300) observacoes.push(`A ${d.c.vendedor} pede uma compra mínima alta.`);
  }
  if (melhorPequena.c.id !== melhorGrande.c.id) observacoes.push("A resposta muda conforme o tamanho da compra.");

  const urgentes = dados.filter((d) => d.dias != null && d.dias >= 0 && d.dias <= 7).sort((a, b) => a.dias! - b.dias!);
  const u = urgentes[0];
  return {
    vencedor_id: vencedor.c.id,
    veredito,
    observacoes: observacoes.slice(0, 3),
    chamada: `Entre as opções, ${vencedor.c.vendedor} é a escolha mais inteligente — garanta o cupom antes que a campanha acabe.`,
    urgencia: u ? `O cupom da ${u.c.vendedor} vence em ${u.dias === 0 ? "hoje" : `${u.dias} dia${u.dias === 1 ? "" : "s"}`}.`.replace("em hoje", "hoje") : null,
    fonte: "calculo" as const,
  };
}

/** Mensagem de venda montada com os números reais do cupom. */
export function textoSemIa(e: {
  vendedor: string;
  desconto: string;
  teto: number | null;
  compra_min: number | null;
  canal: "WhatsApp" | "Instagram";
}) {
  const linhas = [
    `🏷️ Cupom ${e.desconto} na loja ${e.vendedor}${e.teto != null ? `, com desconto de até ${moeda(e.teto)}` : ""}.`,
  ];
  if (e.compra_min != null && e.compra_min > 0) linhas.push(`Vale para compras a partir de ${moeda(e.compra_min)}.`);
  linhas.push(e.canal === "Instagram" ? "Link na bio para pegar o cupom." : "Me chama que eu te passo o código.");
  return linhas.join("\n");
}
