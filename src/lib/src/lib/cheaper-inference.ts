/* Conector Cheaper Inference / OmniRouter (chave OMNI_ROUTER nos Secrets).
   Roda múltiplos modelos econômicos (DeepSeek v4.1, Gemini 3.8, Claude)
   com saída JSON e compatibilidade OpenAI. */

export function chaveCheaperInference(): string | null {
  const v =
    process.env["OMNI_ROUTER"]?.trim() ||
    process.env["CHEAPER_INFERENCE_API_KEY"]?.trim();
  return v && v.length > 5 ? v : null;
}

export type RespostaCheaper =
  | { ok: true; texto: string; modelo: string }
  | { ok: false; status: number; erro: string };

/** Chamada à Cheaper Inference com fallback entre modelos rápidos. */
export async function perguntarCheaperInference(
  prompt: string,
  prazo = 15_000,
  imagens: string[] = [],
  modeloPreferencia?: string,
): Promise<RespostaCheaper> {
  const chave = chaveCheaperInference();
  if (!chave) {
    return { ok: false, status: 503, erro: "sem chave OMNI_ROUTER configurada" };
  }

  /* Modelos em ordem de prioridade e custo-benefício */
  const modelos = modeloPreferencia
    ? [modeloPreferencia, "deepseek-v4.1-flash", "gemini-3.8-flash"]
    : ["deepseek-v4.1-flash", "gemini-3.8-flash"];

  const fim = Date.now() + prazo;
  let ultimo: RespostaCheaper = { ok: false, status: 504, erro: "tempo esgotado" };

  for (const modelo of modelos) {
    const resta = fim - Date.now();
    if (resta < 2_000) break;

    try {
      const corpoMensagem = imagens.length
        ? [
            { type: "text", text: prompt },
            ...imagens.map((url) => ({
              type: "image_url",
              image_url: { url: url.replace(/\.webp$/i, ".jpg"), detail: "low" },
            })),
          ]
        : prompt;

      const r = await fetch("https://api.cheaperinference.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chave}`,
        },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: "user", content: corpoMensagem }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(resta),
      });

      const j = (await r.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      } | null;

       try {
    /* 1. Tenta Cheaper Inference (DeepSeek / Gemini) com chave OMNI_ROUTER */
    const { perguntarCheaperInference } = await import("@/lib/cheaper-inference");
    const ci = await perguntarCheaperInference(prompt, 9_000);
    if (ci.ok) {
      bruto = ci.texto;
    } else {
      /* 2. Reserva: GPT */
      const { perguntarAoGpt } = await import("@/lib/gpt");
      const gpt = await perguntarAoGpt(prompt, 9_000);
      if (gpt.ok) bruto = gpt.texto;
      else {
        /* 3. Reserva: Gemini do backend */
        const { gerarComModelos } = await import("@/lib/conferir-produto");
        const r = await gerarComModelos([{ text: prompt }], {
          ordem: ["gemini-flash-lite-latest", "gemma-4-26b-a4b-it"],
          prazo: 9_000,
        });
        if (r.ok) bruto = r.texto;
      }
    }
  } catch {
    bruto = null;
  }

      };
    }
  }

  return ultimo;
}

