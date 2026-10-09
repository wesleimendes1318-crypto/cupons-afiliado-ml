/* GPT (chave da OpenAI que o Weslei colocou nos Secrets do Lovable, 28/09).
   Usado na "Ajuda para escolher"; a conferência pela foto continua na Gemini
   (regra do produto). A chave nunca sai do servidor: só se diz SE existe.
   Nome do secret: o primeiro destes que estiver preenchido. */

const NOMES_DA_CHAVE = [
  "OPENAI_API_KEY",
  "OPENAI_KEY",
  "GPT_API_KEY",
  "CHATGPT_API_KEY",
  "CHAT_GPT_API_KEY",
  "CHAT_GPT_KEY",
  "OPEN_AI_API_KEY",
  "ASTRA_API_KEY",
  "ASTRA_GPT_API_KEY",
];

export function chaveGpt(): string | null {
  for (const nome of NOMES_DA_CHAVE) {
    const v = process.env[nome]?.trim();
    if (v) return v;
  }
  return null;
}

/* Modelo pelo secret OPENAI_MODEL; sem ele, os de custo baixo, em ordem. */
function modelos(): string[] {
  const escolhido = process.env["OPENAI_MODEL"]?.trim();
  const padrao = ["gpt-4.1-mini", "gpt-4o-mini"];
  return escolhido ? [escolhido, ...padrao.filter((m) => m !== escolhido)] : padrao;
}

export type RespostaGpt =
  { ok: true; texto: string; modelo: string } | { ok: false; status: number; erro: string };

/** Uma pergunta que responde em JSON. Modelo inexistente passa ao próximo. */
export async function perguntarAoGpt(
  prompt: string,
  prazo = 15_000,
  /* Fotos (endereços do mlstatic ou data:image/jpeg), anexadas na ordem. */
  imagens: string[] = [],
  /* "low" para conferir (barato); "high" para ler modelo/rótulo na busca
     por foto. */
  detalhe: "low" | "high" | "auto" = "low",
): Promise<RespostaGpt> {
  const chave = chaveGpt();
  if (!chave) return { ok: false, status: 503, erro: "sem chave do GPT nos secrets" };
  const fim = Date.now() + prazo;
  let ultimo: RespostaGpt = { ok: false, status: 504, erro: "tempo esgotado" };
  for (const modelo of modelos()) {
    const resta = fim - Date.now();
    if (resta < 2_000) break;
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
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
        error?: { message?: string; code?: string };
      } | null;
      const texto = j?.choices?.[0]?.message?.content ?? "";
      if (r.ok && texto) return { ok: true, texto, modelo };
      ultimo = {
        ok: false,
        status: r.status,
        erro: `${modelo}: ${(j?.error?.message ?? "sem resposta").slice(0, 140)}`,
      };
      /* Só troca de modelo quando o problema é o modelo; chave errada,
         sem crédito ou limite não melhoram com outro modelo. */
      const doModelo = r.status === 404 || j?.error?.code === "model_not_found";
      if (!doModelo) break;
    } catch (e) {
      ultimo = {
        ok: false,
        status: 504,
        erro: `${modelo}: ${String((e as Error)?.message ?? e).slice(0, 100)}`,
      };
      break;
    }
  }
  void registrarFalha(ultimo);
  return ultimo;
}

/* Última falha (status e mensagem, nunca a chave) para conferir de longe se
   a chave funciona. */
async function registrarFalha(r: RespostaGpt) {
  if (r.ok) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sinc_config").upsert({
      chave: "gpt_diagnostico",
      valor: JSON.stringify({ quando: new Date().toISOString(), status: r.status, erro: r.erro }),
    });
  } catch {
    /* só diagnóstico */
  }
}
