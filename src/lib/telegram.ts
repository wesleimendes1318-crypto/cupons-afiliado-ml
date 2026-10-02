import { decisaoDaTela, opcoesDaAnalise, totalDaOpcao, type Opcao } from "@/lib/ajudar-escolher";
import { textoDoPagamento, type Precos } from "@/lib/pagamento";

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
    return (await r.json().catch(() => null)) as { ok?: boolean } | null;
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
function linhaDoFrete(o: Opcao) {
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
    const base = totalDaOpcao(melhorMesmo) ?? melhorMesmo.preco;
    linhas.push(
      "",
      "🔥 <b>Melhor alternativa (não é idêntico ao que você enviou)</b>",
      `📌 ${html(alternativa.titulo)}`,
      ...linhasDaOpcao(alternativa),
      `💸 ${brl(base - alternativa.preco)} a menos que o melhor preço do mesmo produto${
        melhorMesmo.freteGratis === false && totalDaOpcao(melhorMesmo) != null
          ? " (já com o frete dele)"
          : ""
      }`,
      alternativa.muda
        ? `ℹ️ Muda: ${html(alternativa.muda)}`
        : "ℹ️ Muda um detalhe: confira antes de comprar",
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
