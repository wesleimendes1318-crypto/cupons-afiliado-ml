const LIMITE_POR_MINUTO = 8;
const JANELA_MS = 60_000;
const requisicoes = new Map<string, number[]>();

export function origemPermitida(request: Request) {
  const origem = request.headers.get("origin");
  if (!origem) return null;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const origemUrl = new URL(origem);
    const mesmaOrigem = host != null && origemUrl.host === host;
    const local = origemUrl.hostname === "localhost" || origemUrl.hostname === "127.0.0.1";
    return mesmaOrigem || local ? origem : null;
  } catch {
    return null;
  }
}

export function cabecalhosCors(origem: string | null) {
  return {
    ...(origem ? { "Access-Control-Allow-Origin": origem } : {}),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

export function json(request: Request, body: object, status = 200) {
  return Response.json(body, { status, headers: cabecalhosCors(origemPermitida(request)) });
}

export function excedeuLimite(request: Request) {
  const identificador =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido";
  const agora = Date.now();
  const recentes = (requisicoes.get(identificador) ?? []).filter((momento) => agora - momento < JANELA_MS);
  if (recentes.length >= LIMITE_POR_MINUTO) {
    requisicoes.set(identificador, recentes);
    return true;
  }
  recentes.push(agora);
  requisicoes.set(identificador, recentes);
  if (requisicoes.size > 2_000) {
    for (const [chave, momentos] of requisicoes) {
      if (!momentos.some((momento) => agora - momento < JANELA_MS)) requisicoes.delete(chave);
    }
  }
  return false;
}

export function respostaOptions(request: Request) {
  const origem = origemPermitida(request);
  if (!origem) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: cabecalhosCors(origem) });
}

export function textoGemini(resultado: unknown) {
  const resposta = resultado as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return resposta.candidates?.[0]?.content?.parts?.map((parte) => parte.text ?? "").join("").trim() ?? "";
}

export function limparJson(texto: string) {
  return texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

type ResultadoIa = { ok: true; texto: string } | { ok: false; status: number; erro: string };

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

function erroPorStatus(status: number): string {
  if (status === 429) return "Muitas solicitações à IA agora. Aguarde alguns instantes e tente novamente.";
  if (status === 400 || status === 403) return "A chave da IA parece inválida. Avise o responsável pelo site.";
  return "Não foi possível falar com a IA agora. Tente novamente em instantes.";
}

/** Remove chaves que o Gemini não aceita no responseSchema (ex.: additionalProperties). */
function esquemaGemini(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(esquemaGemini);
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
      if (chave === "additionalProperties") continue;
      saida[chave] = esquemaGemini(item);
    }
    return saida;
  }
  return valor;
}

/**
 * Chama o Gemini com a chave GEMINI_API_KEY, que fica somente no servidor
 * (Cloud → Secrets) e nunca chega ao navegador.
 * `formato` deve ser um JSON Schema estrito quando se espera JSON.
 */
export async function chamarIa(
  prompt: string,
  opcoes?: { formato?: { nome: string; schema: object }; esforco?: "low" | "medium" | "high" },
): Promise<ResultadoIa> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) return { ok: false, status: 503, erro: "O serviço de IA do site não está configurado. Avise o responsável pelo site." };

  const corpo: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      ...(opcoes?.formato
        ? { responseMimeType: "application/json", responseSchema: esquemaGemini(opcoes.formato.schema) }
        : {}),
    },
  };

  let ultimoStatus = 502;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    let resposta: Response;
    try {
      resposta = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body: JSON.stringify(corpo),
      });
    } catch {
      ultimoStatus = 502;
      if (tentativa === 2) break;
      await new Promise((resolver) => setTimeout(resolver, 600 * (tentativa + 1)));
      continue;
    }

    if (resposta.ok) {
      const texto = textoGemini(await resposta.json());
      if (!texto) return { ok: false, status: 502, erro: "A IA não retornou uma resposta. Tente novamente." };
      return { ok: true, texto };
    }

    ultimoStatus = resposta.status;
    const recuperavel = resposta.status === 429 || resposta.status >= 500;
    if (!recuperavel || tentativa === 2) {
      return { ok: false, status: resposta.status === 429 ? 429 : 502, erro: erroPorStatus(resposta.status) };
    }
    await new Promise((resolver) => setTimeout(resolver, 800 * (tentativa + 1)));
  }
  return { ok: false, status: ultimoStatus === 429 ? 429 : 502, erro: erroPorStatus(ultimoStatus) };
}
