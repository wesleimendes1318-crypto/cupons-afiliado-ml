/* ALERTA DE PREÇO POR E-MAIL (04/11). Só servidor. Quem entrou com o
   e-mail e marcou "Avisar também por e-mail" recebe a queda de preço: o
   gatilho do banco marca email_pendente (mesma regra do Telegram: chegou no
   alvo ou, sem alvo, caiu 1% ou mais desde o último aviso) e
   operacao?tarefa=alertas chama esta função.
   Envio pelo Resend (RESEND_API_KEY nos Secrets; remetente em
   ALERTA_EMAIL_DE, domínio verificado no Resend). Sem a chave, nada sai e o
   aviso fica pendente; quando a chave chegar, ele sai com o preço daquela
   hora, só se a queda ainda valer.
   Regra nº 1: botão de compra só com link de afiliado (meli.la); sem ele, o
   botão abre a comparação no site. */
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { html, SITE } from "@/lib/telegram";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A queda ainda vale? (puro, testável) */
export function quedaValeAviso(
  agora: number,
  s: {
    preco_alvo: number | null;
    aviso_email_preco: number | null;
    preco_ao_seguir: number | null;
  },
) {
  if (s.preco_alvo != null)
    return agora <= s.preco_alvo && (s.aviso_email_preco == null || agora < s.aviso_email_preco);
  const base = s.aviso_email_preco ?? s.preco_ao_seguir;
  return base != null && agora <= base * 0.99;
}

/** Botão do e-mail: link de afiliado ou, sem ele, a comparação no site. */
export function destinoDoBotao(link: string | null, url: string | null) {
  if (ehLinkDeAfiliado(link)) return { href: link as string, texto: "Comprar com segurança" };
  return { href: `${SITE}/?link=${encodeURIComponent(url ?? "")}`, texto: "Ver no Melhor Escolha" };
}

export function htmlDoAlerta(m: {
  titulo: string | null;
  agora: number;
  antes: number | null;
  alvo: number | null;
  imagem: string | null;
  botao: { href: string; texto: string };
}) {
  const titulo = m.alvo != null && m.agora <= m.alvo ? "Chegou no seu preço!" : "O preço caiu!";
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:32px 16px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif;color:#111827">
<table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
<tr><td align="center" style="padding-bottom:20px"><img src="${SITE}/logo.png" alt="Melhor Escolha" width="44" height="44" style="display:block;border-radius:12px"></td></tr>
<tr><td style="background:#fff;border:1px solid #e5e5ea;border-radius:24px;padding:28px 24px">
<h1 style="margin:0 0 12px;font-size:21px">${titulo}</h1>
${m.imagem ? `<img src="${html(m.imagem)}" alt="" width="120" style="display:block;margin:0 0 12px;max-width:120px">` : ""}
<p style="margin:0 0 8px;font-size:15px;line-height:21px">${html(m.titulo ?? "Produto")}</p>
<p style="margin:0 0 4px;font-size:22px;font-weight:800">${brl(m.agora)}${m.antes != null && m.antes > m.agora ? ` <span style="font-size:14px;font-weight:400;color:#6b7280;text-decoration:line-through">${brl(m.antes)}</span>` : ""}</p>
${m.alvo != null ? `<p style="margin:0 0 4px;font-size:13px;color:#4b5563">Seu preço-alvo: ${brl(m.alvo)}</p>` : ""}
<p style="margin:0 0 20px;font-size:13px;color:#4b5563">Frete: confira no anúncio antes de comprar. O preço pode mudar a qualquer momento.</p>
<a href="${html(m.botao.href)}" style="display:inline-block;background:#0071e3;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 28px;border-radius:9999px">${m.botao.texto}</a>
</td></tr>
<tr><td align="center" style="padding:20px 8px 0;font-size:11px;line-height:16px;color:#86868b">Você recebe este aviso porque marcou "Avisar também por e-mail" em Meus preços no melhorescolha.io. Para parar, desmarque lá. Comprando pelo botão o preço é o mesmo, e o site recebe uma comissão do programa de afiliados.</td></tr>
</table></body></html>`;
}

export async function enviarAlertasEmail(db: Db) {
  const chave = process.env["RESEND_API_KEY"];
  if (!chave) return { ok: false, erro: "sem RESEND_API_KEY" };
  const de = process.env["ALERTA_EMAIL_DE"] || "Melhor Escolha <avisos@melhorescolha.io>";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const { data: pendentes } = await t
    .from("monitor_seguidores")
    .select("monitor_id,navegador,usuario_id,preco_alvo,preco_ao_seguir,aviso_email_preco")
    .eq("email_pendente", true)
    .limit(30);
  let enviados = 0;
  for (const s of (pendentes ?? []) as Array<{
    monitor_id: number;
    navegador: string;
    usuario_id: string | null;
    preco_alvo: number | null;
    preco_ao_seguir: number | null;
    aviso_email_preco: number | null;
  }>) {
    const marcar = (extra: Record<string, unknown>) =>
      t
        .from("monitor_seguidores")
        .update({ email_pendente: false, ...extra })
        .eq("monitor_id", s.monitor_id)
        .eq("navegador", s.navegador);
    const { data: m } = await t
      .from("monitor_precos")
      .select("titulo,url,link,imagem,preco_atual,disponivel")
      .eq("id", s.monitor_id)
      .maybeSingle();
    const num = (v: unknown) => (v == null ? null : Number(v));
    const agora = num(m?.preco_atual);
    const regra = {
      preco_alvo: num(s.preco_alvo),
      aviso_email_preco: num(s.aviso_email_preco),
      preco_ao_seguir: num(s.preco_ao_seguir),
    };
    if (
      !m ||
      agora == null ||
      m.disponivel === false ||
      !s.usuario_id ||
      !quedaValeAviso(agora, regra)
    ) {
      await marcar({});
      continue;
    }
    const { data: u } = await t.auth.admin.getUserById(s.usuario_id);
    const para = u?.user?.email as string | undefined;
    if (!para) {
      await marcar({});
      continue;
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: de,
        to: [para],
        subject: `${regra.preco_alvo != null && agora <= regra.preco_alvo ? "Chegou no seu preço" : "O preço caiu"}: ${brl(agora)} · ${(m.titulo ?? "Produto").slice(0, 60)}`,
        html: htmlDoAlerta({
          titulo: m.titulo,
          agora,
          antes: regra.aviso_email_preco ?? regra.preco_ao_seguir,
          alvo: regra.preco_alvo,
          imagem: m.imagem,
          botao: destinoDoBotao(m.link, m.url),
        }),
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    /* Mandou ou não, não repete às cegas: o próximo aviso só com preço menor. */
    await marcar({ aviso_email_preco: agora, aviso_email_em: new Date().toISOString() });
    if (r?.ok) enviados += 1;
  }
  return { ok: true, pendentes: (pendentes ?? []).length, enviados };
}
