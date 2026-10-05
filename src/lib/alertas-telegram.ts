/* ALERTA DE PREÇO NO TELEGRAM (05/10). Só servidor.
   - ligarAlerta: "/start alerta_<codigo>" no bot liga o aviso daquele
     produto na conversa (código criado pelo site para o navegador que segue
     o preço; ver a migração 20261005190000_alerta_preco_telegram.sql).
   - enviarAlertas: o gatilho do banco marca o aviso como pendente quando a
     leitura do preço chega no preço-alvo (ou, sem alvo, cai 1% ou mais) e
     chama operacao?tarefa=alertas, que manda a mensagem.
   Regras de sempre: botão de compra só com link de afiliado (meli.la);
   sem ele, o botão abre a comparação no site. Frete em linha própria e sem
   valor inventado: a leitura do preço não traz o frete. */
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { html, SITE, telegram } from "@/lib/telegram";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const RE_START_ALERTA = /^\/start(?:@\w+)?\s+alerta_([a-f0-9]{20})\b/i;

export async function ligarAlerta(db: Db, token: string, chatId: number, codigo: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).rpc("ligar_alerta_telegram", {
    p_codigo: codigo,
    p_chat: chatId,
  });
  const d = data as { titulo?: string; preco?: number; alvo?: number | null } | null;
  if (!d) {
    await telegram(token, "sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text: "Não achei esse aviso. Abra o produto em <b>Meus preços</b> no site e toque em <b>Avisar no Telegram</b> de novo.",
    });
    return;
  }
  const linhas = [
    "🔔 <b>Aviso de preço ligado!</b>",
    "",
    `📦 ${html(d.titulo ?? "Produto")}`,
    d.preco != null ? `💰 Preço agora: <b>${brl(Number(d.preco))}</b>` : null,
    d.alvo != null
      ? `🎯 Eu aviso aqui quando chegar em <b>${brl(Number(d.alvo))}</b> ou menos.`
      : "📉 Eu aviso aqui quando o preço cair.",
  ].filter((l): l is string => l != null);
  await telegram(token, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text: linhas.join("\n"),
    disable_web_page_preview: true,
  });
}

export async function enviarAlertas(db: Db) {
  const token = process.env["API_TELEGRAM"];
  if (!token) return { ok: false, erro: "sem token do bot" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const { data: pendentes } = await t
    .from("monitor_telegram")
    .select("codigo,monitor_id,navegador,chat_id,aviso_preco")
    .eq("pendente", true)
    .not("chat_id", "is", null)
    .limit(30);
  let enviados = 0;
  for (const p of (pendentes ?? []) as Array<{
    codigo: string;
    monitor_id: number;
    navegador: string;
    chat_id: number;
    aviso_preco: number | null;
  }>) {
    const { data: m } = await t
      .from("monitor_precos")
      .select("titulo,url,link,preco_atual,preco_pix,ultima_leitura,disponivel")
      .eq("id", p.monitor_id)
      .maybeSingle();
    const { data: s } = await t
      .from("monitor_seguidores")
      .select("preco_alvo,preco_ao_seguir")
      .eq("monitor_id", p.monitor_id)
      .eq("navegador", p.navegador)
      .maybeSingle();
    if (!m || m.preco_atual == null || m.disponivel === false) {
      await t.from("monitor_telegram").update({ pendente: false }).eq("codigo", p.codigo);
      continue;
    }
    const agora = Number(m.preco_atual);
    const antes = p.aviso_preco ?? s?.preco_ao_seguir ?? null;
    const alvo = s?.preco_alvo != null ? Number(s.preco_alvo) : null;
    const hora = m.ultima_leitura
      ? new Date(m.ultima_leitura).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        })
      : null;
    const linhas = [
      alvo != null && agora <= alvo ? "🎯 <b>Chegou no seu preço!</b>" : "📉 <b>O preço caiu!</b>",
      "",
      `📦 ${html(m.titulo ?? "Produto")}`,
      `💰 Agora: <b>${brl(agora)}</b>` +
        (antes != null && Number(antes) > agora ? ` (era ${brl(Number(antes))})` : ""),
      alvo != null ? `🎯 Seu preço-alvo: ${brl(alvo)}` : null,
      "🚚 Frete: confira no anúncio antes de comprar",
      hora ? `🕒 Preço lido em ${hora}` : null,
    ].filter((l): l is string => l != null);
    const botoes: Array<Array<{ text: string; url: string }>> = [];
    if (ehLinkDeAfiliado(m.link)) botoes.push([{ text: "🛡️ Comprar com segurança", url: m.link }]);
    if (m.url)
      botoes.push([
        {
          text: "🔍 Comparar com outras lojas",
          url: `${SITE}/?link=${encodeURIComponent(m.url)}`,
        },
      ]);
    const r = await telegram(token, "sendMessage", {
      chat_id: p.chat_id,
      parse_mode: "HTML",
      text: linhas.join("\n"),
      disable_web_page_preview: true,
      ...(botoes.length ? { reply_markup: { inline_keyboard: botoes } } : {}),
    }).catch(() => null);
    /* Mandou ou não, não repete às cegas: o próximo aviso só com preço menor. */
    await t
      .from("monitor_telegram")
      .update({ pendente: false, aviso_preco: agora, aviso_em: new Date().toISOString() })
      .eq("codigo", p.codigo);
    if (r?.ok) enviados += 1;
  }
  return { ok: true, pendentes: (pendentes ?? []).length, enviados };
}
