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