/* AJUDA PARA ESCOLHER (Weslei, 28/09): pesa valor, características,
   vantagens e diferenças de cada produto encontrado contra o anúncio que o
   cliente colou e aponta a melhor escolha. Só entram opções com o link de
   afiliado do Weslei, e o botão da resposta leva a esse link. Sem modelo
   (cota, fora do ar), a escolha é calculada: nunca fica sem resposta. */

import { naoEAlternativa } from "@/lib/alternativa";
import { gerarComModelos, lerJson } from "@/lib/conferir-produto";
import { perguntarAoGpt } from "@/lib/gpt";

type Detalhes = {
  caracteristicas?: { nome: string; valor: string }[];
  destaques?: string[];
  descricao?: string | null;
} | null;

type Bruto = Record<string, unknown>;

export type Opcao = {
  n: number;
  tipo: "colado" | "mesmo" | "parecido";
  titulo: string;
  loja: string | null;
  preco: number;
  freteGratis: boolean | null;
  lojaOficial: boolean;
  link: string;
  muda: string | null;
  vantagem: string | null;
  semelhanca: number | null;
  detalhes: Detalhes;
};

export type Ajuda = {
  escolha: Opcao;
  resumo: string;
  pontos: {
    n: number;
    titulo: string;
    loja: string | null;
    preco: number;
    aFavor: string;
    contra: string;
  }[];
  calculada: boolean;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Opções com link de afiliado próprio: o anúncio colado, as lojas do mesmo
 *  produto e os parecidos mais próximos. */
export function opcoesDaAnalise(a: Bruto, linkColado: string | null): Opcao[] {
  const out: Opcao[] = [];
  const titulo = txt(a["titulo"]) ?? "Produto do link colado";
  const detalhesColado = (a["detalhes"] as Detalhes) ?? null;
  const preco = num(a["preco"]);
  if (preco != null && linkColado && a["linkFalhou"] !== true) {
    out.push({
      n: 0,
      tipo: "colado",
      titulo,
      loja: txt(a["vendedor"]),
      preco,
      freteGratis: (a["freteGratis"] as boolean | null) ?? null,
      lojaOficial: a["lojaOficial"] === true,
      link: linkColado,
      muda: null,
      vantagem: null,
      semelhanca: 100,
      detalhes: detalhesColado,
    });
  }
  const vistos = new Set(out.map((o) => o.link));
  const mesmo = [
    ...((a["outrasLojas"] as Bruto[] | undefined) ?? []),
    ...((a["referencias"] as Bruto[] | undefined) ?? []),
  ];
  for (const o of mesmo) {
    const link = txt(o["link"]);
    const p = num(o["final"]) ?? num(o["preco"]);
    if (
      !link ||
      p == null ||
      o["semAfiliado"] === true ||
      o["mesmaPagina"] === true ||
      vistos.has(link)
    )
      continue;
    vistos.add(link);
    out.push({
      n: out.length,
      tipo: "mesmo",
      titulo,
      loja: txt(o["vendedor"]),
      preco: p,
      freteGratis: (o["freteGratis"] as boolean | null) ?? null,
      lojaOficial: o["lojaOficial"] === true,
      link,
      muda: null,
      vantagem: null,
      semelhanca: 100,
      detalhes: (o["detalhes"] as Detalhes) ?? null,
    });
  }
  const parecidos = [...((a["parecidos"] as Bruto[] | undefined) ?? [])]
    .filter((p) => txt(p["link"]) && num(p["preco"]) != null)
    .sort(
      (x, y) =>
        (num(y["semelhanca"]) ?? (y["mesmaFoto"] === true ? 90 : 0)) -
          (num(x["semelhanca"]) ?? (x["mesmaFoto"] === true ? 90 : 0)) ||
        (num(x["preco"]) ?? 0) - (num(y["preco"]) ?? 0),
    )
    .slice(0, 5);
  for (const p of parecidos) {
    const link = txt(p["link"]) as string;
    if (vistos.has(link)) continue;
    vistos.add(link);
    out.push({
      n: out.length,
      tipo: "parecido",
      titulo: txt(p["titulo"]) ?? "Produto parecido",
      loja: txt(p["vendedor"]),
      preco: num(p["preco"]) as number,
      freteGratis: (p["freteGratis"] as boolean | null) ?? null,
      lojaOficial: p["lojaOficial"] === true || p["daBuscaOficial"] === true,
      link,
      muda: txt(p["muda"]),
      vantagem: txt(p["vantagem"]),
      semelhanca: num(p["semelhanca"]),
      detalhes: (p["detalhes"] as Detalhes) ?? null,
    });
  }
  return out.slice(0, 12);
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Escolha calculada: o mesmo produto mais barato sem frete pago (em empate,
 *  a loja oficial); o colado quando nada é mais barato. */
export function escolhaCalculada(opcoes: Opcao[]): Ajuda | null {
  const mesmo = opcoes.filter((o) => o.tipo !== "parecido" && o.freteGratis !== false);
  const base = opcoes.find((o) => o.tipo === "colado") ?? null;
  const ordem = (mesmo.length ? mesmo : opcoes.filter((o) => o.tipo !== "parecido")).sort((x, y) =>
    Math.abs(x.preco - y.preco) >= 0.5
      ? x.preco - y.preco
      : Number(y.lojaOficial) - Number(x.lojaOficial),
  );
  const escolha = ordem[0] ?? base ?? opcoes[0];
  if (!escolha) return null;
  const menos = base && escolha !== base ? base.preco - escolha.preco : 0;
  const partes = [
    escolha.tipo === "colado"
      ? "O anúncio que você colou já é o melhor preço do mesmo produto"
      : `Mesmo produto por ${moeda(escolha.preco)}${menos >= 0.5 ? `, ${moeda(menos)} a menos` : ""}`,
    escolha.freteGratis === true ? "com frete grátis" : null,
    escolha.lojaOficial ? "vendido pela loja oficial da marca" : null,
  ].filter(Boolean);
  return {
    escolha,
    resumo: partes.join(", ") + ".",
    pontos: [],
    calculada: true,
  };
}

function resumoDaOpcao(o: Opcao) {
  const d = o.detalhes;
  return {
    n: o.n,
    tipo:
      o.tipo === "colado"
        ? "anuncio colado pelo cliente"
        : o.tipo === "mesmo"
          ? "MESMO produto em outra loja (conferido pela foto)"
          : "PARECIDO, nao e o mesmo produto",
    titulo: o.titulo,
    loja: o.loja,
    preco: o.preco,
    frete: o.freteGratis === true ? "gratis" : o.freteGratis === false ? "pago" : "nao informado",
    loja_oficial_da_marca: o.lojaOficial,
    o_que_muda: o.muda,
    vantagem: o.vantagem,
    semelhanca: o.semelhanca,
    caracteristicas: (d?.caracteristicas ?? []).slice(0, 12).map((c) => `${c.nome}: ${c.valor}`),
    destaques: (d?.destaques ?? []).slice(0, 4),
    descricao: d?.descricao ? d.descricao.slice(0, 350) : null,
  };
}

type Resposta = {
  escolha?: number;
  resumo?: string;
  pontos?: { n?: number; a_favor?: string; contra?: string }[];
};

/** Pede a análise; qualquer falha devolve a escolha calculada. */
export async function ajudarAEscolher(opcoes: Opcao[]): Promise<Ajuda | null> {
  const calculada = escolhaCalculada(opcoes);
  if (opcoes.length < 2) return calculada;
  const prompt = `Voce e um consultor de compras honesto. Um cliente colou o link de um produto e o comparador achou as opcoes abaixo (JSON). Ajude-o a decidir a MELHOR ESCOLHA pesando: preco final, frete (frete pago pesa contra; "nao informado" nao pesa), loja oficial da marca, caracteristicas, vantagens (o que tem a mais) e diferencas (o_que_muda) em relacao ao anuncio colado.
Regras:
- Use SO o que esta nos dados. Nunca invente caracteristica, garantia, prazo ou beneficio.
- "MESMO produto" e o mesmo item do anuncio colado. "PARECIDO" NAO e o mesmo produto: so escolha um parecido se ele for claramente melhor para o cliente (mais barato E sem diferenca que piore o produto, ou com vantagem real), e diga o que muda.
- Mais barato porque vem MENOS (menos unidades, menor tamanho/volume, sem acessorio) nao e vantagem.
- Portugues do Brasil, frases curtas, sem exagero, sem caixa alta, sem citar inteligencia artificial.
Responda SO com JSON: {"escolha": n da opcao, "resumo": "ate 220 caracteres explicando por que e a melhor escolha", "pontos": [{"n": n, "a_favor": "ate 90 caracteres", "contra": "ate 90 caracteres ou vazio"}]} com ate 4 pontos (inclua a escolhida e o anuncio colado).
Opcoes: ${JSON.stringify(opcoes.map(resumoDaOpcao))}`;
  /* GPT primeiro (chave própria, não gasta a cota gratuita da Gemini que a
     conferência pela foto usa); sem ele, a fila Gemini/Gemma. */
  let texto: string | null = null;
  const gpt = await perguntarAoGpt(prompt, 15_000);
  if (gpt.ok) texto = gpt.texto;
  else {
    const r = await gerarComModelos([{ text: prompt }], { prazo: 18_000 });
    if (r.ok) texto = r.texto;
  }
  if (!texto) return calculada;
  const j = lerJson<Resposta>(texto);
  const escolha = opcoes.find((o) => o.n === j?.escolha);
  const resumo = txt(j?.resumo);
  if (!escolha || !resumo) return calculada;
  /* Parecido que sai mais caro que o melhor mesmo produto nunca é escolhido
     (frete pago idem): a resposta cai para a escolha calculada. */
  if (
    calculada &&
    escolha.tipo === "parecido" &&
    (escolha.preco >= calculada.escolha.preco ||
      escolha.freteGratis === false ||
      naoEAlternativa(escolha.muda))
  )
    return calculada;
  if (
    calculada &&
    escolha.tipo !== "parecido" &&
    escolha.freteGratis === false &&
    calculada.escolha !== escolha
  )
    return calculada;
  const pontos = (j?.pontos ?? [])
    .map((p) => {
      const o = opcoes.find((x) => x.n === p.n);
      return o
        ? {
            n: o.n,
            titulo: o.titulo,
            loja: o.loja,
            preco: o.preco,
            aFavor: (txt(p.a_favor) ?? "").slice(0, 140),
            contra: (txt(p.contra) ?? "").slice(0, 140),
          }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => p != null && (p.aFavor !== "" || p.contra !== ""))
    .slice(0, 4);
  return { escolha, resumo: resumo.slice(0, 320), pontos, calculada: false };
}
