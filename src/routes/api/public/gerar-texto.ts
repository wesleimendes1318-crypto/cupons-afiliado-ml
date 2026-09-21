import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const entradaSchema = z.object({
  vendedor: z.string().trim().min(1).max(160),
  desconto: z.string().trim().min(1).max(80),
  teto: z.number().finite().nonnegative().nullable(),
  compra_min: z.number().finite().nonnegative().nullable(),
  canal: z.enum(["WhatsApp", "Instagram"]),
  qualidade: z.enum(["bom", "armadilha"]),
});

const LIMITE_POR_MINUTO = 8;
const JANELA_MS = 60_000;
const requisicoes = new Map<string, number[]>();

function origemPermitida(request: Request) {
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

function cabecalhosCors(origem: string | null) {
  return {
    ...(origem ? { "Access-Control-Allow-Origin": origem } : {}),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(request: Request, body: object, status = 200) {
  return Response.json(body, { status, headers: cabecalhosCors(origemPermitida(request)) });
}

function excedeuLimite(request: Request) {
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

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export const Route = createFileRoute("/api/public/gerar-texto")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origem = origemPermitida(request);
        if (!origem) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: cabecalhosCors(origem) });
      },
      POST: async ({ request }) => {
        if (!origemPermitida(request)) {
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        }
        if (excedeuLimite(request)) {
          return json(request, { erro: "Muitas solicitações. Aguarde um minuto e tente novamente." }, 429);
        }

        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Os dados do cupom estão incompletos ou inválidos." }, 400);
        }

        if (entrada.qualidade === "armadilha") {
          const limite = entrada.teto == null ? "o teto informado" : moeda(entrada.teto);
          return json(request, {
            texto: `Atenção: este cupom desconta no máximo ${limite} e não vale como argumento de venda.`,
            aviso: true,
          });
        }

        const apiKey = process.env['GEMINI_API_KEY'];
        if (!apiKey) {
          return json(request, { erro: "O gerador ainda não foi configurado pelo responsável do site." }, 503);
        }

        const teto = entrada.teto == null ? "não informado" : moeda(entrada.teto);
        const compraMinima = entrada.compra_min == null ? "não informada" : moeda(entrada.compra_min);
        const prompt = `Escreva uma mensagem curta de venda em português do Brasil para ${entrada.canal}.
Use no máximo 4 linhas, tom direto e honesto, sem exagero e no máximo 2 emojis.
Vendedor: ${entrada.vendedor}.
Desconto anunciado: ${entrada.desconto}.
Teto máximo de desconto: ${teto}.
Compra mínima: ${compraMinima}.
REGRA CRÍTICA: informe o benefício REAL, nunca destaque o percentual isoladamente e nunca prometa desconto maior que o teto. Se houver teto, diga claramente o limite, como “20% OFF com desconto de até R$ 100”. Informe a compra mínima quando existir. Não invente características de produtos, estoque, frete ou prazo de entrega. Entregue somente a mensagem final.`;

        const controlador = new AbortController();
        const timeout = setTimeout(() => controlador.abort(), 15_000);
        try {
          const resposta = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 180, temperature: 0.5 },
              }),
              signal: controlador.signal,
            },
          );
          if (!resposta.ok) {
            return json(request, { erro: "Não foi possível gerar o texto agora. Tente novamente em instantes." }, 502);
          }
          const resultado = (await resposta.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const texto = resultado.candidates?.[0]?.content?.parts?.map((parte) => parte.text ?? "").join("").trim();
          if (!texto) {
            return json(request, { erro: "O gerador não retornou um texto. Tente novamente." }, 502);
          }
          return json(request, { texto, aviso: false });
        } catch {
          return json(request, { erro: "O gerador demorou para responder. Tente novamente." }, 504);
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});