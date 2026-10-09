/* CHEAPER INFERENCE (Weslei, 09/10): gateway compatível com a API da OpenAI
   (https://api.cheaperinference.com/v1, chave nos Secrets em
   CHEAPER_INFERENCE_API_KEY; OMNI_ROUTER também vale). Motor prioritário da
   busca guiada e do "Me ajude a escolher"; qualquer falha (sem chave, cota,
   rede, modelo sem visão) passa para o GPT e depois para a Gemini/Gemma, como
   antes. A chave nunca sai do servidor: só se diz SE existe.
   Modelos: CHEAPER_INFERENCE_MODEL (lista separada por vírgula); sem ele, o
   catálogo da própria conta (GET /models, guardado 6 h) com preferência
   pelos de custo baixo. */
import { perguntarAoGpt, type RespostaGpt } from "@/lib/gpt";

const BASE = (
  process.env["CHEAPER_INFERENCE_BASE_URL"]?.trim() || "https://api.cheaperinference.com/v1"
).replace(/\/+$/, "");
/* Os do conector que o Weslei escreveu em 06/10, usados só se o catálogo
   não responder. */
const PADRAO = ["deepseek-v4.1-flash", "gemini-3.8-flash"];
const NAO_CHAT = /embed|whisper|tts|speech|audio|image|dall|rerank|moderation|transcri/i;
const BARATOS = [/flash/i, /mini/i, /lite/i, /haiku/i, /small/i];

export function chaveCheaperInference(): string | null {
  const v =
    process.env["CHEAPER_INFERENCE_API_KEY"]?.trim() || process.env["OMNI_ROUTER"]?.trim() || "";
  return v.length > 5 ? v : null;
}

let catalogo: { em: number; ids: string[] } | null = null;

async function modelos(chave: string): Promise<string[]> {
  const escolhidos = (process.env["CHEAPER_INFERENCE_MODEL"] ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (escolhidos.length) return escolhidos.slice(0, 3);
  if (catalogo && Date.now() - catalogo.em < 6 * 3600_000) return catalogo.ids;
  try {
    const r = await fetch(`${BASE}/models`, {
      headers: { Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(4_000),
    });
    const j = (await r.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null;
    const ids = (j?.data ?? [])
      .map((m) => String(m.id ?? ""))
      .filter((id) => id && !NAO_CHAT.test(id));
    const baratos = BARATOS.flatMap((re) => ids.filter((id) => re.test(id)));
    const ordem = [...new Set(baratos)].slice(0, 3);
    if (r.ok && ordem.length) {
      catalogo = { em: Date.now(), ids: ordem };
      return ordem;
    }
  } catch {
    /* sem catálogo: os padrões */
  }
  return PADRAO;
}

/** Pergunta que responde em JSON. Mesmo formato de resposta do GPT. */
export async function perguntarAoCheaper(
  prompt: string,
  prazo = 15_000,
  /* Fotos (endereços do mlstatic ou data:image/jpeg), anexadas na ordem. */
  imagens: string[] = [],
  detalhe: "low" | "high" | "auto" = "low",
): Promise<RespostaGpt> {
  const chave = chaveCheaperInference();
  if (!chave) return { ok: false, status: 503, erro: "sem chave da Cheaper Inference" };
  const fim = Date.now() + prazo;
  let ultimo: RespostaGpt = { ok: false, status: 504, erro: "tempo esgotado" };
  for (const modelo of await modelos(chave)) {
    const resta = fim - Date.now();
    if (resta < 2_000) break;
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
        body: JSON.stringify({
          model: modelo,
          messages: [
            {
              role: "user",
              content: imagens.length
                ? [
                    { type: "text", text: prompt },
                    ...imagens.map((url) => ({
                      type: "image_url",
                      image_url: { url: url.replace(/\.webp$/i, ".jpg"), detail: detalhe },
                    })),
                  ]
                : prompt,
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(resta),
      });
      const j = (await r.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      } | null;
      const texto = j?.choices?.[0]?.message?.content ?? "";
      if (r.ok && texto) return { ok: true, texto, modelo: `cheaper:${modelo}` };
      ultimo = {
        ok: false,
        status: r.status,
        erro: `${modelo}: ${(j?.error?.message ?? "sem resposta").slice(0, 140)}`,
      };
      /* Chave errada ou sem crédito não melhora com outro modelo. */
      if (r.status === 401 || r.status === 402 || r.status === 403) break;
    } catch (e) {
      ultimo = {
        ok: false,
        status: 504,
        erro: `${modelo}: ${String((e as Error)?.message ?? e).slice(0, 100)}`,
      };
    }
  }
  void registrarFalha(ultimo);
  return ultimo;
}

/** Motor prioritário (Cheaper Inference) com reserva no GPT. Quem chama
    continua com a fila Gemini/Gemma se os dois falharem. */
export async function perguntarAoLlm(
  prompt: string,
  prazo = 15_000,
  imagens: string[] = [],
  detalhe: "low" | "high" | "auto" = "low",
): Promise<RespostaGpt> {
  const inicio = Date.now();
  if (chaveCheaperInference()) {
    /* Metade do prazo para a Cheaper Inference: sobra tempo para a reserva. */
    const r = await perguntarAoCheaper(
      prompt,
      Math.max(4_000, Math.floor(prazo / 2)),
      imagens,
      detalhe,
    );
    if (r.ok) return r;
  }
  const resta = Math.max(4_000, prazo - (Date.now() - inicio));
  return perguntarAoGpt(prompt, resta, imagens, detalhe);
}

/* Última falha (status e mensagem, nunca a chave). */
async function registrarFalha(r: RespostaGpt) {
  if (r.ok) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sinc_config").upsert({
      chave: "cheaper_diagnostico",
      valor: JSON.stringify({ quando: new Date().toISOString(), status: r.status, erro: r.erro }),
    });
  } catch {
    /* só diagnóstico */
  }
}
