import { decisaoDaTela, opcoesDaAnalise, totalDaOpcao, type Opcao } from "@/lib/ajudar-escolher";
import { textoDoPagamento, type Precos } from "@/lib/pagamento";
import { qualidadeDoParecido, textoDaQualidade } from "@/lib/qualidade";

/* Bot do Telegram (02/10): mensagens com as mesmas regras da tela. */

export const TELEGRAM = "https://api.telegram.org/bot";
export const SITE = "https://melhorescolha.io";

export async function segredoDoWebhook(token: string) {
  const dados = new TextEncoder().encode(`melhorescolha-telegram:${token}`);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 48);
}

export async function telegram(token: string, metodo: string, corpo: Record<string, unknown>) {
  try {
    const r = await fetch(`${TELEGRAM}${token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(10_000),
    });
    return (await r.json().catch(() => null)) as {
      ok?: boolean;
      result?: unknown;
      description?: string;
    } | null;
  } catch {
    return null;
  }
}

export const html = (t: string | null | undefined) =>
  String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function linkDoAnuncio(texto: string): string | null {
  const m =
    /https?:\/\/(?:[a-z0-9-]+\.)*(?:mercadolivre\.com\.br|mercadolibre\.com|meli\.la)\/[^\s<>"]+/i.exec(
      texto,
    );
  return m ? m[0] : null;
}

/* Frete sempre em linha própria (pedido 563): nunca "R$ X a menos + frete". */
export function linhaDoFrete(o: Opcao) {
  if (o.freteGratis === true) return "🚚 Frete grátis";
  if (o.freteGratis === false)
    return o.custoFrete != null && o.custoFrete > 0
      ? `🚚 (frete de ${brl(o.custoFrete)} à parte)`
      : "🚚 (frete à parte)";
  return null;
}

function linhasDaOpcao(o: Opcao) {
  const pagamento = textoDoPagamento(o.preco, o.precos as Precos | null);
  return [
    `💰 <b>${brl(o.preco)}</b>${pagamento ? ` ${html(pagamento)}` : ""}`,
    o.loja ? `🏪 Vendido por ${html(o.loja)}${o.lojaOficial ? " ⭐ (Loja oficial)" : ""}` : null,
    linhaDoFrete(o),
  ].filter(Boolean) as string[];
}

/** Mensagem da comparação, com as mesmas regras da tela. */
export function mensagemDaComparacao(
  analise: Record<string, unknown>,
  link: string | null,
  urlColado: string,
) {
  const opcoes = opcoesDaAnalise(analise, link);
  const { colado, melhorMesmo, alternativa } = decisaoDaTela(opcoes);
  const titulo =
    typeof analise["titulo"] === "string" ? analise["titulo"] : "Produto que você enviou";
  const linhas: string[] = [`✨ <b>${html(titulo)}</b>`, ""];
  if (melhorMesmo) {
    const tMelhor = totalDaOpcao(melhorMesmo) ?? melhorMesmo.preco;
    const tColado = colado ? (totalDaOpcao(colado) ?? colado.preco) : null;
    const menos = colado && melhorMesmo !== colado && tColado != null ? tColado - tMelhor : 0;
    const comFrete = melhorMesmo.freteGratis === false && totalDaOpcao(melhorMesmo) != null;
    linhas.push(
      melhorMesmo.tipo === "colado"
        ? "🏆 <b>Melhor opção: o anúncio que você enviou já é o melhor preço do mesmo produto</b>"
        : `🏆 <b>Melhor opção: o mesmo produto por ${brl(menos)} a menos${comFrete ? ", já com o frete" : " no produto"}</b>`,
      ...linhasDaOpcao(melhorMesmo),
      "",
      "🛒 <b>Compre com segurança:</b>",
      `👉 ${html(melhorMesmo.link)}`,
    );
  }
  if (alternativa && melhorMesmo) {
    /* Economia contra o anúncio enviado, no produto (Weslei, 03/10). */
    const tC = colado ? totalDaOpcao(colado) : null;
    const tA = totalDaOpcao(alternativa);
    const comFrete =
      tC != null &&
      tA != null &&
      ((colado?.freteGratis === false && (colado?.custoFrete ?? 0) > 0) ||
        (alternativa.freteGratis === false && (alternativa.custoFrete ?? 0) > 0));
    const menosAlt = comFrete
      ? (tC as number) - (tA as number)
      : (colado?.preco ?? melhorMesmo.preco) - alternativa.preco;
    linhas.push(
      "",
      "🔥 <b>Melhor alternativa (não é idêntico ao que você enviou)</b>",
      `📌 ${html(alternativa.titulo)}`,
      ...linhasDaOpcao(alternativa),
      `💸 ${brl(menosAlt)} a menos ${comFrete ? "no custo final, já com o frete," : "no produto"} que o anúncio que você enviou`,
      alternativa.muda
        ? `ℹ️ Muda: ${html(alternativa.muda)}`
        : "ℹ️ Muda um detalhe: confira antes de comprar",
      /* Premissa (05/10): a alternativa só existe com qualidade equivalente ou melhor. */
      `✅ ${html(
        textoDaQualidade(
          qualidadeDoParecido(alternativa, { titulo: colado?.titulo, detalhes: colado?.detalhes }),
        ),
      ).replace("à do seu", "à do que você enviou")}`,
      `👉 ${html(alternativa.link)}`,
    );
  }
  const outras = opcoes
    .filter((o) => (o.tipo === "mesmo" || o.tipo === "colado") && o !== melhorMesmo)
    .sort((x, y) => x.preco - y.preco)
    .slice(0, 4);
  if (outras.length) {
    linhas.push("", "📊 <b>Outras lojas do mesmo produto:</b>");
    for (const o of outras) {
      const frete =
        o.freteGratis === true
          ? " · frete grátis"
          : o.freteGratis === false
            ? o.custoFrete != null && o.custoFrete > 0
              ? ` (frete de ${brl(o.custoFrete)} à parte)`
              : " (frete à parte)"
            : "";
      const nome =
        o.tipo === "colado"
          ? `${o.loja ?? "Anúncio"} (o que você enviou)`
          : (o.loja ?? "Outra loja");
      linhas.push(`• ${html(nome)}: ${brl(o.preco)}${frete}`);
    }
  }
  linhas.push(
    "",
    `🔎 Comparação completa: ${SITE}/?link=${encodeURIComponent(urlColado)}`,
    "💡 Compare qualquer produto em melhorescolha.io",
  );
  return {
    texto: linhas.join("\n"),
    imagem: typeof analise["imagem"] === "string" ? analise["imagem"] : null,
  };
}

/* ------------------------------------------------ conversa (02/10)
   Weslei: "o bot precisa ser mais amigável na primeira mensagem do cliente.
   Conecte com api das inteligências artificiais para entender a mensagem.
   Inicialmente sempre deve indicar como funciona, mas no primeiro acesso
   apenas. Se possível, disponibilize o vídeo que está no site." */

export const VIDEO_COMO_FUNCIONA = `${SITE}/video/como-funciona-v4-vertical.mp4`;

/** Boas-vindas do primeiro acesso (e de /start, /ajuda). */
export function boasVindas(nome: string | null) {
  return (
    `👋 <b>Oi${nome ? `, ${html(nome)}` : ""}! Que bom te ver por aqui.</b>\n\n` +
    "Eu sou o <b>Melhor Escolha</b> e te ajudo a pagar menos no mesmo produto. É assim:\n\n" +
    "1️⃣ Você me manda o <b>link</b> de um produto vendido no Mercado Livre.\n" +
    "2️⃣ Eu procuro o <b>mesmo produto</b> em outras lojas e confiro pela foto, descrição e características.\n" +
    "3️⃣ Te mostro a <b>melhor opção</b>, do mais barato ao mais caro, com a loja oficial (quando houver), o frete e o Pix x parcelado. Parecidos vêm separados, com o que muda.\n\n" +
    "📲 <b>Como pegar o link:</b> no app ou no site, abra o produto, toque em <b>Compartilhar</b> e depois em <b>Copiar link</b>. É só colar aqui.\n\n" +
    "Sem custo para você: recebo comissão do programa de afiliados, não de quem compra. 💚"
  );
}

/** Resposta quando não dá para usar o modelo (sem cota, fora do ar). */
export function respostaSemModelo(nome: string | null) {
  return (
    `😊 ${nome ? `${html(nome)}, ` : ""}para eu comparar, preciso do <b>link do produto</b>.\n\n` +
    "📲 No app ou no site: abra o produto → <b>Compartilhar</b> → <b>Copiar link</b> e cole aqui.\n" +
    "Exemplo: https://meli.la/..."
  );
}

const PROMPT_CONVERSA = `Voce responde no Telegram pelo Melhor Escolha, um site independente que compara precos de produtos vendidos no Mercado Livre (sem vinculo com o Mercado Livre).
O que o servico faz: a pessoa manda o LINK de um anuncio; ele procura o mesmo produto em outras lojas dentro do Mercado Livre, confere pela foto, descricao e caracteristicas, e mostra a melhor opcao (do mais barato ao mais caro, com a loja oficial quando houver), o frete e o Pix x parcelado. Parecidos aparecem separados, com o que muda. A comissao vem do programa de afiliados, sem custo para quem compra.
Como pegar o link: no app ou no site, abrir o produto, tocar em Compartilhar e em Copiar link.
Regras:
- Portugues do Brasil, tom de amigo, curto (ate 400 caracteres), no maximo 2 emojis.
- Entenda o que a pessoa quer e responda a isso. Se ela citou um produto pelo NOME, diga que voce compara pelo link e explique como pegar o link desse produto.
- Nunca invente preco, loja, estoque, prazo, cupom ou caracteristica. Voce NAO tem os precos agora: so depois de receber o link.
- Nao prometa cupom. Nao fale de inteligencia artificial nem de como voce funciona por dentro. Nao mande nenhum link.
- Assunto fora de compras: responda com gentileza em uma frase e volte para o link do produto.
Responda SO com JSON: {"resposta": "texto"}.
Mensagem da pessoa`;

/** Entende a mensagem sem link e responde (GPT primeiro; reserva Gemini
 *  flash-lite/Gemma, que não disputam a cota diária dos modelos maiores). */
export async function responderConversa(texto: string, nome: string | null) {
  const prompt = `${PROMPT_CONVERSA}${nome ? ` (nome: ${nome})` : ""}: ${JSON.stringify(texto.slice(0, 600))}`;
  const { perguntarAoGpt } = await import("@/lib/gpt");
  let bruto: string | null = null;
  const gpt = await perguntarAoGpt(prompt, 12_000);
  if (gpt.ok) bruto = gpt.texto;
  else {
    const { gerarComModelos } = await import("@/lib/conferir-produto");
    const r = await gerarComModelos([{ text: prompt }], {
      ordem: ["gemini-flash-lite-latest", "gemma-4-26b-a4b-it", "gemma-4-31b-it"],
      prazo: 12_000,
    });
    if (r.ok) bruto = r.texto;
  }
  if (!bruto) return null;
  const { lerJson } = await import("@/lib/conferir-produto");
  const j = lerJson<{ resposta?: string }>(bruto);
  const resposta = String(j?.resposta ?? "").trim();
  /* Nada de link vindo do modelo: só o bot manda link, e só de afiliado. */
  if (!resposta || /https?:\/\/|www\./i.test(resposta)) return null;
  return html(resposta.slice(0, 600));
}
