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

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODELO_IA = "openai/gpt-6-astra";

function erroPorStatus(status: number): string {
  if (status === 429) return "Muitas solicitações à IA agora. Aguarde alguns instantes e tente novamente.";
  if (status === 402) return "Os créditos de IA do site acabaram. Avise o responsável pelo site.";
  if (status === 403) return "A IA não está disponível para este site no momento.";
  return "Não foi possível falar com a IA agora. Tente novamente em instantes.";
}

async function lerSse(resposta: Response) {
  const leitor = resposta.body?.getReader();
  if (!leitor) return "";
  const decodificador = new TextDecoder();
  let restante = "";
  let texto = "";
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    restante += decodificador.decode(value, { stream: true });
    const linhas = restante.split("\n");
    restante = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.startsWith("data:")) continue;
      const bruto = linha.slice(5).trim();
      if (!bruto || bruto === "[DONE]") continue;
      try {
        const evento = JSON.parse(bruto) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") {
          texto += evento.delta;
        } else if (evento.type === "response.completed" && typeof evento.response?.output_text === "string" && !texto) {
          texto = evento.response.output_text;
        }
      } catch {
        // evento incompleto ou desconhecido: segue o fluxo
      }
    }
  }
  return texto.trim();
}

/**
 * Chama o Lovable AI Gateway (streaming consumido no servidor).
 * A credencial é gerenciada pela plataforma; nunca chega ao navegador.
 * `formato` deve ser um JSON Schema estrito quando se espera JSON.
 */
export async function chamarIa(
  prompt: string,
  opcoes?: { formato?: { nome: string; schema: object }; esforco?: "low" | "medium" | "high" },
): Promise<ResultadoIa> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) return { ok: false, status: 503, erro: "O serviço de IA do site não está disponível agora." };

  const corpo: Record<string, unknown> = {
    model: MODELO_IA,
    input: prompt,
    stream: true,
    reasoning: { effort: opcoes?.esforco ?? "low" },
  };
  if (opcoes?.formato) {
    corpo['text'] = {
      format: {
        type: "json_schema",
        name: opcoes.formato.nome,
        strict: true,
        schema: opcoes.formato.schema,
      },
    };
  }

  let ultimoStatus = 502;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    let resposta: Response;
    try {
      resposta = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify(corpo),
      });
    } catch {
      ultimoStatus = 502;
      if (tentativa === 2) break;
      await new Promise((resolver) => setTimeout(resolver, 600 * (tentativa + 1)));
      continue;
    }

    if (resposta.ok) {
      const texto = await lerSse(resposta);
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
