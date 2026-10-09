/* PÁGINA DO FACEBOOK (Weslei, 09/10): cada oferta publicada no canal do
   Telegram também vai para a página, pela Graph API (POST /{page-id}/photos
   com a foto grande e a legenda do canal em texto simples, com o link de
   afiliado, já que no Facebook não há botões). Secrets: FACEBOOK_PAGE_ID e
   FACEBOOK_PAGE_ACCESS_TOKEN (token de página com pages_manage_posts);
   FACEBOOK_GRAPH_VERSION opcional. Sem os dois, não faz nada. Falha aqui
   nunca derruba o Telegram. O token vai no corpo do POST, nunca na URL. */

const VERSAO_PADRAO = "v23.0";

export function facebookConfigurado() {
  return Boolean(
    process.env["FACEBOOK_PAGE_ID"]?.trim() && process.env["FACEBOOK_PAGE_ACCESS_TOKEN"]?.trim(),
  );
}

const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Legenda do Telegram (HTML) em texto simples para o Facebook. */
export function textoSimples(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ResultadoFacebook =
  { ok: true; postId: string } | { ok: false; erro: string; ignorado?: boolean };

/** Publica uma foto com legenda na página. Nunca lança erro. */
export async function publicarNoFacebook(
  foto: string | null,
  legenda: string,
): Promise<ResultadoFacebook> {
  const pagina = process.env["FACEBOOK_PAGE_ID"]?.trim();
  const token = process.env["FACEBOOK_PAGE_ACCESS_TOKEN"]?.trim();
  if (!pagina || !token) return { ok: false, erro: "sem configuração", ignorado: true };
  if (!/^\d{5,30}$/.test(pagina)) return { ok: false, erro: "FACEBOOK_PAGE_ID inválido" };
  const versao = /^v\d{1,2}\.\d$/.test(process.env["FACEBOOK_GRAPH_VERSION"]?.trim() ?? "")
    ? (process.env["FACEBOOK_GRAPH_VERSION"] as string).trim()
    : VERSAO_PADRAO;
  const texto = legenda.slice(0, 2_000);
  /* Sem foto: post de texto no feed (o link vira prévia). */
  const destino = foto
    ? `https://graph.facebook.com/${versao}/${pagina}/photos`
    : `https://graph.facebook.com/${versao}/${pagina}/feed`;
  const enviar = async (campo: "caption" | "message") => {
    const corpo = new URLSearchParams({ access_token: token });
    if (foto) {
      corpo.set("url", foto);
      corpo.set("published", "true");
      corpo.set(campo, texto);
    } else corpo.set("message", texto);
    const r = await fetch(destino, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corpo.toString(),
      signal: AbortSignal.timeout(12_000),
    });
    const j = (await r.json().catch(() => null)) as {
      id?: string;
      post_id?: string;
      error?: { message?: string; code?: number };
    } | null;
    return { r, j };
  };
  try {
    let { r, j } = await enviar("caption");
    /* Versão da Graph API que não aceita "caption" na foto: tenta "message". */
    if (foto && !r.ok && /caption|param/i.test(j?.error?.message ?? ""))
      ({ r, j } = await enviar("message"));
    const id = j?.post_id ?? j?.id ?? null;
    if (r.ok && id) return { ok: true, postId: String(id) };
    return {
      ok: false,
      erro: `${r.status}: ${(j?.error?.message ?? "sem resposta").replace(/access_token=[^&\s]+/g, "").slice(0, 160)}`,
    };
  } catch (e) {
    return { ok: false, erro: String((e as Error)?.message ?? e).slice(0, 160) };
  }
}
