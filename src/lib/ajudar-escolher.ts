/* AJUDA PARA ESCOLHER (Weslei, 28/09): pesa valor, características,
   vantagens e diferenças de cada produto encontrado contra o anúncio que o
   cliente colou e aponta a melhor escolha. Só entram opções com o link de
   afiliado do Weslei, e o botão da resposta leva a esse link. Sem modelo
   (cota, fora do ar), a escolha é calculada: nunca fica sem resposta. */

import {
  custoBeneficio,
  notaDeAlternativa,
  podeSerAlternativa,
  rotuloDaUnidade,
} from "@/lib/alternativa";
import { baixarFoto, gerarComModelos, lerJson } from "@/lib/conferir-produto";
import { mudaCompleta } from "@/lib/ficha";
import { qualidadeAceita, qualidadeDoParecido } from "@/lib/qualidade";
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
  /* Frete para o CEP do cliente, quando simulado (02/10). */
  custoFrete?: number | null;
  lojaOficial: boolean;
  link: string;
  muda: string | null;
  vantagem: string | null;
  semelhanca: number | null;
  mesmaFoto: boolean;
  /* Veredito de qualidade da conferência (05/10): superior | equivalente |
     inferior | incerta. A regra final é qualidadeDoParecido. */
  qualidade?: string | null;
  qualidadeMotivo?: string | null;
  detalhes: Detalhes;
  /* Foto do anúncio e { cheio, pix, parcelas } lidos na página (28/09). */
  imagem: string | null;
  precos: Bruto | null;
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
      custoFrete: num(a["custoFrete"]),
      lojaOficial: a["lojaOficial"] === true,
      link: linkColado,
      muda: null,
      vantagem: null,
      semelhanca: 100,
      mesmaFoto: true,
      detalhes: detalhesColado,
      imagem: txt(a["imagem"]),
      precos: (a["precos"] as Bruto) ?? null,
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
      custoFrete: num(o["custoFrete"]),
      lojaOficial: o["lojaOficial"] === true,
      link,
      muda: null,
      vantagem: null,
      semelhanca: 100,
      mesmaFoto: false,
      detalhes: (o["detalhes"] as Detalhes) ?? null,
      imagem: txt(o["imagem"]),
      precos: (o["precos"] as Bruto) ?? null,
    });
  }
  const parecidos = [...((a["parecidos"] as Bruto[] | undefined) ?? [])]
    .filter((p) => txt(p["link"]) && num(p["preco"]) != null && p["semAfiliado"] !== true)
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
      custoFrete: num(p["custoFrete"]),
      lojaOficial: p["lojaOficial"] === true || p["daBuscaOficial"] === true,
      link,
      muda: mudaCompleta(txt(p["muda"]), detalhesColado, (p["detalhes"] as Detalhes) ?? null),
      vantagem: txt(p["vantagem"]),
      semelhanca: num(p["semelhanca"]),
      mesmaFoto: p["mesmaFoto"] === true,
      qualidade: txt(p["qualidade"]),
      qualidadeMotivo: txt(p["qualidadeMotivo"]),
      detalhes: (p["detalhes"] as Detalhes) ?? null,
      imagem: txt(p["imagem"]),
      precos: (p["precos"] as Bruto) ?? null,
    });
  }
  return out.slice(0, 12);
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Melhor preço do MESMO produto e Melhor alternativa, pela MESMA regra da
 *  tela (BuscaPorLink: recomendada + alternativa). Coerência (Weslei, 02/10,
 *  pedido 550: a tela destacava a alternativa de R$ 4.223 e a análise
 *  indicava o anúncio de R$ 5.051,58): a análise nunca contradiz a tela. */
/** Total que o cliente paga: produto + frete para o CEP (quando simulado);
 *  frete pago sem valor conhecido: null. Mesma conta da tela. */
export function totalDaOpcao(o: Opcao): number | null {
  if (o.freteGratis !== false) return o.preco;
  return o.custoFrete != null && o.custoFrete > 0
    ? Math.round((o.preco + o.custoFrete) * 100) / 100
    : null;
}

export function decisaoDaTela(opcoes: Opcao[]) {
  const colado = opcoes.find((o) => o.tipo === "colado") ?? null;
  /* Colado com frete pago e valor desconhecido: compara pelo preço. */
  const totalColado = colado ? (totalDaOpcao(colado) ?? colado.preco) : null;
  /* Mesmo produto mais barato que o colado (>= R$ 0,50), sem frete pago; em
     empate de preço, a loja oficial. Nenhum: o próprio colado. */
  const mesmo = opcoes
    .filter(
      (o) =>
        o.tipo === "mesmo" &&
        totalDaOpcao(o) != null &&
        (totalColado == null || (totalDaOpcao(o) as number) <= totalColado - 0.5),
    )
    .sort((x, y) => {
      const d = (totalDaOpcao(x) ?? 0) - (totalDaOpcao(y) ?? 0);
      return Math.abs(d) >= 0.5 ? d : Number(y.lojaOficial) - Number(x.lojaOficial);
    });
  const melhorMesmo =
    mesmo[0] ??
    colado ??
    opcoes.filter((o) => o.tipo !== "parecido").sort((x, y) => x.preco - y.preco)[0] ??
    null;
  const tituloColado = colado?.titulo ?? null;
  const base = {
    preco: melhorMesmo ? (totalDaOpcao(melhorMesmo) ?? melhorMesmo.preco) : null,
    titulo: tituloColado,
  };
  const nota = (o: Opcao) =>
    notaDeAlternativa(o, tituloColado) - (podeSerAlternativa(o, base).cb ? 5 : 0);
  const alternativa =
    melhorMesmo == null
      ? null
      : (opcoes
          .filter(
            (o) =>
              o.tipo === "parecido" &&
              o.freteGratis !== false &&
              ((o.semelhanca ?? 0) >= 85 || o.mesmaFoto) &&
              podeSerAlternativa(o, base).ok &&
              /* Premissa (05/10): qualidade equivalente ou superior. */
              qualidadeAceita(
                qualidadeDoParecido(o, { titulo: tituloColado, detalhes: colado?.detalhes }),
              ),
          )
          .sort((x, y) => nota(y) - nota(x) || x.preco - y.preco)[0] ?? null);
  return { colado, melhorMesmo, alternativa };
}

/** Escolha calculada (e a que vale na tela): a Melhor alternativa quando há
 *  (mais barata, muito parecida, sem frete pago, sem "vem menos"); senão o
 *  mesmo produto mais barato. O resumo sempre cita a outra opção. */
export function escolhaCalculada(opcoes: Opcao[]): Ajuda | null {
  const { colado, melhorMesmo, alternativa } = decisaoDaTela(opcoes);
  const escolha = alternativa ?? melhorMesmo ?? opcoes[0];
  if (!escolha) return null;
  const frasesDoMesmo = (o: Opcao) =>
    [
      o.tipo === "colado"
        ? `o anúncio que você colou, ${moeda(o.preco)}`
        : `${o.loja ?? "outra loja"}, ${moeda(o.preco)}`,
      o.freteGratis === true ? "com frete grátis" : null,
      o.freteGratis === false && totalDaOpcao(o) != null
        ? `frete de ${moeda(o.custoFrete as number)} à parte, total ${moeda(totalDaOpcao(o) as number)}`
        : null,
      o.lojaOficial ? "loja oficial" : null,
    ]
      .filter(Boolean)
      .join(", ");
  let resumo: string;
  if (alternativa && melhorMesmo) {
    /* Economia contra o anúncio colado, no produto (Weslei, 03/10: "a
       diferença é comparada com o original"; ajuste global). */
    /* Custo real (03/10): com frete conhecido, produto + frete dos dois. */
    const tC = colado ? totalDaOpcao(colado) : null;
    const tA = totalDaOpcao(alternativa);
    const comFrete =
      tC != null &&
      tA != null &&
      ((colado?.freteGratis === false && (colado?.custoFrete ?? 0) > 0) ||
        (alternativa.freteGratis === false && (alternativa.custoFrete ?? 0) > 0));
    const menos = comFrete
      ? (tC as number) - (tA as number)
      : (colado?.preco ?? melhorMesmo.preco) - alternativa.preco;
    resumo =
      `Mais em conta: ${moeda(alternativa.preco)}, ${moeda(menos)} a menos ${comFrete ? "no custo final, já com o frete," : "no produto"} que o anúncio que você colou` +
      `${alternativa.freteGratis === true ? ", com frete grátis" : ""}` +
      `${alternativa.lojaOficial ? ", loja oficial da marca" : ""}. ` +
      `Não é idêntico: ${alternativa.muda ?? "muda um detalhe"}. ` +
      `Se fizer questão de exatamente o que você colou, o melhor é ${frasesDoMesmo(melhorMesmo)}.`;
  } else {
    const tEscolha = totalDaOpcao(escolha) ?? escolha.preco;
    const tColado = colado ? (totalDaOpcao(colado) ?? colado.preco) : null;
    const menos = tColado != null && escolha !== colado ? tColado - tEscolha : 0;
    const comFrete = escolha.freteGratis === false && totalDaOpcao(escolha) != null;
    resumo =
      [
        escolha.tipo === "colado"
          ? "O anúncio que você colou já é o melhor preço do mesmo produto"
          : `Mesmo produto por ${moeda(escolha.preco)}${menos >= 0.5 ? `, ${moeda(menos)} a menos${comFrete ? " já com o frete" : ""}` : ""}`,
        escolha.freteGratis === true ? "com frete grátis" : null,
        comFrete
          ? `frete de ${moeda(escolha.custoFrete as number)} para o seu CEP à parte (total ${moeda(tEscolha)})`
          : null,
        escolha.lojaOficial ? "vendido pela loja oficial da marca" : null,
      ]
        .filter(Boolean)
        .join(", ") + ".";
  }
  return { escolha, resumo, pontos: [], calculada: true };
}

function resumoDaOpcao(
  o: Opcao,
  colado: Opcao | null,
  foto: number | null,
  decisao?: ReturnType<typeof decisaoDaTela>,
) {
  const d = o.detalhes;
  const pr = o.precos;
  const pix = pr ? num(pr["pix"]) : null;
  const cheio = pr ? num(pr["cheio"]) : null;
  const parc = (pr?.["parcelas"] as Bruto | null) ?? null;
  const cb = colado && o !== colado ? custoBeneficio(colado, o) : null;
  return {
    foto,
    preco_no_pix: pix,
    preco_cheio_cartao: cheio,
    parcelado: parc
      ? `${num(parc["vezes"])}x de ${num(parc["valor"])}${parc["semJuros"] === true ? " sem juros" : " com juros"}`
      : null,
    custo_por_unidade: cb
      ? `${cb.unitOutro.toFixed(2)} ${rotuloDaUnidade(cb.tipo)} (colado: ${cb.unitColado.toFixed(2)})`
      : null,
    n: o.n,
    tipo:
      o.tipo === "colado"
        ? "anuncio colado pelo cliente"
        : o.tipo === "mesmo"
          ? "MESMO produto em outra loja (conferido pela foto)"
          : "PARECIDO, nao e o mesmo produto",
    papel_na_tela:
      decisao?.alternativa === o
        ? "MELHOR ALTERNATIVA (mais barata, muito parecida; destaque na tela)"
        : decisao?.melhorMesmo === o
          ? "MELHOR PRECO DO MESMO PRODUTO"
          : null,
    titulo: o.titulo,
    loja: o.loja,
    preco: o.preco,
    frete:
      o.freteGratis === true
        ? "gratis"
        : o.freteGratis === false
          ? totalDaOpcao(o) != null
            ? `pago, ${o.custoFrete} para o CEP do cliente (total com frete ${totalDaOpcao(o)})`
            : "pago, valor nao informado"
          : "nao informado",
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
  const colado = opcoes.find((o) => o.tipo === "colado") ?? null;
  const decisao = decisaoDaTela(opcoes);
  /* FOTOS (Weslei, 28/09: "veja a foto, descrição, detalhes,
     características, preço"): até 7, o colado primeiro; a foto N do pedido é
     a opção de "foto": N. */
  const comFoto = opcoes.filter((o) => o.imagem).slice(0, 7);
  const fotoDe = new Map(comFoto.map((o, i) => [o.n, i + 1] as const));
  const prompt = `Voce e um consultor de compras honesto e criterioso. Um cliente colou o link de um produto e o comparador achou as opcoes abaixo (JSON, com FOTOS anexadas na ordem do campo "foto"). Objetivo do cliente: o produto MAIS PROXIMO possivel do que ele colou, pelo melhor custo-beneficio.
Analise, para cada opcao: a foto (modelo, cor, pecas, acessorios, estado), a descricao, as caracteristicas, o preco (no Pix e parcelado quando houver), o frete (pago pesa contra; "nao informado" nao pesa), a loja oficial da marca e o que muda em relacao ao anuncio colado.
Regras:
- Use SO o que esta nos dados e nas fotos. Nunca invente caracteristica, garantia, prazo ou beneficio. Na duvida, diga que nao da para confirmar.
- "MESMO produto" e o mesmo item do anuncio colado. "PARECIDO" NAO e o mesmo produto: so escolha um parecido se ele for quase igual ao colado (a foto e as caracteristicas confirmam) e sair mais barato, ou tiver vantagem real; diga o que muda.
- Quantidade diferente: compare o custo_por_unidade. Mais barato no total mas mais caro por unidade nao e vantagem; mais caro no total e mais barato por unidade pode ser, se o cliente precisar da quantidade (diga isso).
- Compare o preco no Pix com o preco no Pix e o parcelado com o parcelado.
- A tela ja destaca a opcao marcada em papel_na_tela. A escolha e a MELHOR ALTERNATIVA quando ela existe; senao, o MELHOR PRECO DO MESMO PRODUTO. Nos pontos, diga com clareza o que muda e quanto se economiza, e cite a opcao do mesmo produto para quem faz questao de exatamente o que colou.
- Seja especialista na categoria do produto: diga o que realmente importa nela (ex.: voltagem, capacidade, cor/acabamento, modelo, compatibilidade), sem especular.
- Portugues do Brasil, frases curtas, sem exagero, sem caixa alta, sem citar inteligencia artificial.
Responda SO com JSON: {"escolha": n da opcao, "resumo": "ate 240 caracteres explicando por que e a melhor escolha", "pontos": [{"n": n, "a_favor": "ate 90 caracteres", "contra": "ate 90 caracteres ou vazio"}]} com ate 4 pontos (inclua a escolhida e o anuncio colado).
Opcoes: ${JSON.stringify(opcoes.map((o) => resumoDaOpcao(o, colado, fotoDe.get(o.n) ?? null, decisao)))}`;
  /* GPT primeiro (chave própria, não gasta a cota gratuita da Gemini que a
     conferência pela foto usa); sem ele, a fila Gemini/Gemma, com as fotos. */
  let texto: string | null = null;
  const gpt = await perguntarAoGpt(
    prompt,
    20_000,
    comFoto.map((o) => o.imagem as string),
  );
  if (gpt.ok) texto = gpt.texto;
  else {
    const fotos = (await Promise.all(comFoto.map((o) => baixarFoto(o.imagem)))).filter(
      (f): f is NonNullable<typeof f> => f != null,
    );
    const partes =
      fotos.length === comFoto.length ? [{ text: prompt }, ...fotos] : [{ text: prompt }];
    const r = await gerarComModelos(partes, { prazo: 20_000 });
    if (r.ok) texto = r.texto;
  }
  if (!texto) return calculada;
  const j = lerJson<Resposta>(texto);
  const resumoModelo = txt(j?.resumo);
  /* COERENCIA (02/10): a escolha e sempre a da tela (alternativa ou melhor
     preco do mesmo produto). O modelo contribui com os pontos; o resumo dele
     so vale quando escolheu a mesma opcao. */
  if (!calculada) return null;
  const escolha = calculada.escolha;
  const resumo = j?.escolha === escolha.n && resumoModelo ? resumoModelo : calculada.resumo;
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
