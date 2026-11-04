/* ASSISTENTE DE COMPRA DEPOIS DA BUSCA (Weslei, 02/11: "atender melhor a
   solicitação do cliente mesmo após a busca"). A pessoa diz o que importa
   ("até R$ 3.000", "127V", "a mais bem avaliada", "cabe em apartamento") e o
   assistente escolhe e ordena entre os produtos QUE JÁ ESTÃO NA TELA. Nunca
   inventa produto, preço, frete ou nota: só usa os dados enviados, e todo
   valor em reais do texto tem de ser o preço de um produto escolhido. Sem o
   modelo, a leitura local (preço, voltagem, frete, loja oficial, nota,
   capacidade) faz o mesmo. Os textos públicos não citam IA. */

export type ItemAssistente = {
  id: string;
  nome: string;
  preco: number | null;
  freteGratis?: boolean | null | undefined;
  lojaOficial?: boolean | undefined;
  nota?: number | null | undefined;
  avaliacoes?: number | null | undefined;
  maisVendido?: number | null | undefined;
};

export type RespostaAssistente = {
  resposta: string;
  /** Produtos escolhidos, na ordem indicada (só ids recebidos). */
  ids: string[];
  /** Termo para uma nova busca quando o pedido pede outro produto. */
  buscar: string | null;
};

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const reais = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** "até R$ 3.000", "no máximo 2500", "abaixo de 3 mil". */
export function precoMaximoDoPedido(pedido: string): number | null {
  const t = semAcento(pedido);
  const m =
    /\b(?:ate|maximo|max|abaixo de|menos de|no maximo|nao passe de|limite de)\s*(?:r\$\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d{1,2})?)\s*(mil|k)?\b/.exec(
      t,
    );
  if (!m) return null;
  let v = Number(m[1]!.replace(/[.\s]/g, "").replace(",", "."));
  if (m[2]) v *= 1000;
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** "a partir de R$ 1.000", "acima de 2 mil". */
export function precoMinimoDoPedido(pedido: string): number | null {
  const t = semAcento(pedido);
  const m =
    /\b(?:a partir de|acima de|mais de|minimo de|pelo menos)\s*(?:r\$\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d{1,2})?)\s*(mil|k)?\b/.exec(
      t,
    );
  if (!m) return null;
  let v = Number(m[1]!.replace(/[.\s]/g, "").replace(",", "."));
  if (m[2]) v *= 1000;
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Voltagem pedida: "127v", "110", "220v", "bivolt". */
export function voltagemDoPedido(pedido: string): "127" | "220" | "bivolt" | null {
  const t = semAcento(pedido);
  if (/\bbivolt\b/.test(t)) return "bivolt";
  if (/\b(110|127) ?v?\b/.test(t)) return "127";
  if (/\b220 ?v?\b/.test(t)) return "220";
  return null;
}

function voltagemDoNome(nome: string): "127" | "220" | "bivolt" | null {
  const t = semAcento(nome);
  if (/\bbivolt\b/.test(t)) return "bivolt";
  const a = /\b(110|127) ?v\b/.test(t);
  const b = /\b220 ?v\b/.test(t);
  if (a && b) return "bivolt";
  if (a) return "127";
  if (b) return "220";
  return null;
}

/** Medida pedida: "11kg", "12 kg", "400 litros", "55 polegadas". */
function medidaDoPedido(pedido: string): { valor: number; unidade: "kg" | "l" | "pol" } | null {
  const t = semAcento(pedido);
  const m = /\b(\d{1,4}(?:[.,]\d)?)\s*(kg|quilos?|l|litros?|pol|polegadas|")(?=\s|$|[^a-z])/.exec(
    t,
  );
  if (!m) return null;
  const u =
    m[2]!.startsWith("k") || m[2]!.startsWith("q") ? "kg" : m[2]!.startsWith("l") ? "l" : "pol";
  return { valor: Number(m[1]!.replace(",", ".")), unidade: u };
}

function medidaDoNome(nome: string, unidade: "kg" | "l" | "pol"): number | null {
  const t = semAcento(nome);
  const re =
    unidade === "kg"
      ? /\b(\d{1,3}(?:[.,]\d)?)\s*(kg|quilos?)\b/
      : unidade === "l"
        ? /\b(\d{1,4})\s*(l|litros?)\b/
        : /\b(\d{2,3})\s*(pol|polegadas|")/;
  const m = re.exec(t);
  return m ? Number(m[1]!.replace(",", ".")) : null;
}

/** Leitura local do pedido (sem modelo): filtra e ordena só pelo que os
    dados dizem. Item sem o dado pedido sai do filtro (nunca é "suposto"). */
export function assistenteLocal(pedido: string, itens: ItemAssistente[]): RespostaAssistente {
  const t = semAcento(pedido);
  const max = precoMaximoDoPedido(pedido);
  const min = precoMinimoDoPedido(pedido);
  const volt = voltagemDoPedido(pedido);
  const medida = medidaDoPedido(pedido);
  const frete = /\bfrete gratis\b|\bsem frete\b/.test(t);
  const oficial = /\bloja oficial\b|\boficial\b|\boriginal\b/.test(t);
  const avaliada = /\b(bem avaliad|melhor avaliad|mais avaliad|qualidade|confiavel|nota)\w*/.test(
    t,
  );
  const barato = /\b(barat|economic|em conta|menor preco|mais em conta)\w*/.test(t);
  const vendido = /\b(mais vendid|popular|famos)\w*/.test(t);

  const criterios: string[] = [];
  let lista = itens.filter((i) => i.preco != null);
  if (max != null) {
    lista = lista.filter((i) => i.preco! <= max);
    criterios.push(`até ${reais(max)}`);
  }
  if (min != null) {
    lista = lista.filter((i) => i.preco! >= min);
    criterios.push(`a partir de ${reais(min)}`);
  }
  if (volt) {
    lista = lista.filter((i) => {
      const v = voltagemDoNome(i.nome);
      return v === volt || v === "bivolt";
    });
    criterios.push(volt === "bivolt" ? "bivolt" : `${volt}V (ou bivolt) no anúncio`);
  }
  if (medida) {
    lista = lista.filter((i) => {
      const v = medidaDoNome(i.nome, medida.unidade);
      return v != null && Math.abs(v - medida.valor) <= Math.max(0.5, medida.valor * 0.05);
    });
    criterios.push(
      `${medida.valor.toLocaleString("pt-BR")} ${medida.unidade === "pol" ? "polegadas" : medida.unidade === "l" ? "litros" : "kg"}`,
    );
  }
  if (frete) {
    lista = lista.filter((i) => i.freteGratis === true);
    criterios.push("frete grátis confirmado");
  }
  if (oficial) {
    lista = lista.filter((i) => i.lojaOficial === true);
    criterios.push("loja oficial");
  }
  if (avaliada) {
    lista = lista.filter((i) => (i.nota ?? 0) >= 4.5 && (i.avaliacoes ?? 0) >= 5);
    criterios.push("nota 4,5 ou mais");
  }
  const ordenar = (a: ItemAssistente, b: ItemAssistente) => {
    if (avaliada && !barato)
      return (b.nota ?? 0) - (a.nota ?? 0) || (b.avaliacoes ?? 0) - (a.avaliacoes ?? 0);
    if (vendido && !barato) return (a.maisVendido ?? 999) - (b.maisVendido ?? 999);
    return a.preco! - b.preco!;
  };
  lista = [...lista].sort(ordenar);
  const ids = lista.map((i) => i.id).slice(0, 20);
  if (!criterios.length && !barato && !vendido)
    return {
      resposta:
        "Me diga o que é importante para você: faixa de preço, voltagem, tamanho, frete grátis, loja oficial ou nota de quem comprou.",
      ids: [],
      buscar: null,
    };
  if (!ids.length)
    return {
      resposta: `Nenhum dos produtos desta busca tem ${criterios.join(", ") || "o que você pediu"} confirmado no anúncio. Tente outra busca ou afrouxe um dos pedidos.`,
      ids: [],
      buscar: null,
    };
  const primeiro = lista[0]!;
  const ordem =
    avaliada && !barato
      ? "da mais bem avaliada"
      : vendido && !barato
        ? "do mais vendido"
        : "do mais barato";
  return {
    resposta: `Separei ${ids.length === 1 ? "1 opção" : `${ids.length} opções`}${criterios.length ? ` com ${criterios.join(", ")}` : ""}, ${ordem} para a menos indicada. A primeira sai por ${reais(primeiro.preco!)}.`,
    ids,
    buscar: null,
  };
}

/** Trava final do que o modelo respondeu: só ids recebidos, sem endereço,
    sem citar IA e todo "R$" tem de ser o preço de um escolhido. */
export function limparRespostaDoModelo(
  bruto: { resposta?: unknown; ids?: unknown; buscar?: unknown } | null,
  itens: ItemAssistente[],
): RespostaAssistente | null {
  if (!bruto || typeof bruto.resposta !== "string") return null;
  const validos = new Map(itens.map((i) => [i.id, i]));
  const ids = [
    ...new Set(
      (Array.isArray(bruto.ids) ? bruto.ids : [])
        .map((x) => String(x))
        .filter((x) => validos.has(x)),
    ),
  ].slice(0, 20);
  let resposta = bruto.resposta
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
  if (
    !resposta ||
    /\b(ia|inteligencia artificial|chatgpt|gpt|gemini|modelo de linguagem)\b/i.test(
      semAcento(resposta),
    )
  )
    return null;
  const precos = ids.flatMap((id) =>
    validos.get(id)?.preco != null ? [validos.get(id)!.preco!] : [],
  );
  for (const m of resposta.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g)) {
    const v = Number(m[1]!.replace(/\./g, "").replace(",", "."));
    if (!precos.some((p) => Math.abs(p - v) < 1)) return null;
  }
  const buscar =
    typeof bruto.buscar === "string" && bruto.buscar.trim().length >= 3
      ? bruto.buscar
          .replace(/https?:\/\/\S+/g, "")
          .trim()
          .slice(0, 80)
      : null;
  if (!ids.length && !buscar) resposta = resposta.slice(0, 400);
  return { resposta, ids, buscar };
}

export function promptDoAssistente(consulta: string, pedido: string, itens: ItemAssistente[]) {
  const linhas = itens.map((i) =>
    JSON.stringify({
      id: i.id,
      nome: i.nome,
      preco: i.preco,
      frete_gratis: i.freteGratis ?? null,
      loja_oficial: i.lojaOficial ?? false,
      nota: i.nota ?? null,
      avaliacoes: i.avaliacoes ?? null,
      posicao_mais_vendidos: i.maisVendido ?? null,
    }),
  );
  return `Voce e o assistente de compra de um comparador de precos brasileiro. A pessoa buscou ${JSON.stringify(consulta.slice(0, 160))} e agora pediu: ${JSON.stringify(pedido.slice(0, 300))}.
Produtos encontrados (use SOMENTE estes dados; nunca invente preco, frete, nota, especificacao ou produto):
${linhas.join("\n")}
Regras:
- Escolha os produtos que atendem ao pedido e ordene do mais indicado ao menos indicado: primeiro custo-beneficio (mais barato com boa nota e popularidade), os mais caros no fim.
- So considere uma especificacao (voltagem, capacidade, cor, tamanho) se ela estiver no nome. Sem o dado, nao afirme.
- Nota abaixo de 4,5 com 5+ avaliacoes nunca e a primeira.
- "resposta": 1 a 3 frases curtas em portugues, tom amigavel e honesto, explicando a escolha; pode citar preco SO copiando o preco de um produto escolhido no formato R$ 1.234,56. Sem links, sem citar inteligencia artificial, sem prometer cupom ou desconto.
- Se nenhum produto atende, ids vazio e diga isso; se o pedido for de OUTRO produto, preencha "buscar" com o termo de busca (ate 6 palavras), senao null.
Responda SO JSON: {"resposta": "...", "ids": ["id", ...], "buscar": null}`;
}

/** Pergunta ao modelo (motor do site, com reserva) e cai na leitura local. */
export async function responderAssistente(
  consulta: string,
  pedido: string,
  itens: ItemAssistente[],
  prazo = 9_000,
): Promise<RespostaAssistente & { fonte: "modelo" | "local" }> {
  const prompt = promptDoAssistente(consulta, pedido, itens);
  const inicio = Date.now();
  let bruto: string | null = null;
  try {
    const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
    const r = await perguntarAoLlm(prompt, prazo);
    if (r.ok) bruto = r.texto;
    else {
      const resta = prazo - (Date.now() - inicio);
      if (resta > 1_500) {
        const { gerarComModelos } = await import("@/lib/conferir-produto");
        const g = await gerarComModelos([{ text: prompt }], {
          ordem: ["gemini-flash-lite-latest", "gemma-4-26b-a4b-it"],
          prazo: resta,
        });
        if (g.ok) bruto = g.texto;
      }
    }
  } catch {
    bruto = null;
  }
  if (bruto) {
    const { lerJson } = await import("@/lib/conferir-produto");
    const limpa = limparRespostaDoModelo(
      lerJson<{ resposta?: unknown; ids?: unknown; buscar?: unknown }>(bruto),
      itens,
    );
    if (limpa) return { ...limpa, fonte: "modelo" };
  }
  return { ...assistenteLocal(pedido, itens), fonte: "local" };
}

/* TRÊS ESCOLHAS DA TELA (Weslei, 04/11): só entre os produtos recebidos.
   Menor custo total só com frete grátis confirmado (frete desconhecido não
   vira grátis). Bem avaliado = nota 4,5+ com 20+ opiniões. */
export type TresEscolhas = {
  menorCusto: ItemAssistente | null;
  custoBeneficio: ItemAssistente | null;
  premium: ItemAssistente | null;
};

export function tresEscolhas(itens: ItemAssistente[]): TresEscolhas {
  const comPreco = itens.filter((i) => i.preco != null && i.preco > 0);
  const porPreco = (a: ItemAssistente, b: ItemAssistente) => a.preco! - b.preco!;
  const bemAvaliado = (i: ItemAssistente) => (i.nota ?? 0) >= 4.5 && (i.avaliacoes ?? 0) >= 20;
  const menorCusto = comPreco.filter((i) => i.freteGratis === true).sort(porPreco)[0] ?? null;
  const custoBeneficio =
    comPreco
      .filter((i) => bemAvaliado(i) && i.lojaOficial && i.id !== menorCusto?.id)
      .sort(porPreco)[0] ?? null;
  const usados = new Set([menorCusto?.id, custoBeneficio?.id]);
  const premium =
    comPreco
      .filter((i) => bemAvaliado(i) && !usados.has(i.id))
      .sort(porPreco)
      .at(-1) ?? null;
  /* Premium só quando custa mais que as outras escolhas. */
  const piso = Math.max(menorCusto?.preco ?? 0, custoBeneficio?.preco ?? 0);
  return { menorCusto, custoBeneficio, premium: premium && premium.preco! > piso ? premium : null };
}
