import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { excedeuLimite, json, limparJson, origemPermitida, respostaOptions, textoGemini } from "@/lib/public-ai-api";

const entradaSchema = z.object({
  pedido: z.string().trim().min(3).max(500),
  cupons: z.array(z.object({
    id: z.number().int(),
    vendedor: z.string().max(160),
    categoria: z.string().nullable(),
    desconto: z.string().nullable(),
    teto: z.number().nullable(),
    compra_min: z.number().nullable(),
  })).max(500),
});
const saidaSchema = z.object({
  escolhas: z.array(z.object({ id: z.number().int(), motivo: z.string().trim().min(1).max(240) })).max(5),
  mensagem: z.string().trim().min(1).max(300),
});

export const Route = createFileRoute("/api/public/recomendar")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request)) return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request)) return json(request, { erro: "Muitas solicitações. Aguarde um minuto e tente novamente." }, 429);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Informe o que procura para receber recomendações." }, 400);
        }
        if (!entrada.cupons.length) return json(request, { escolhas: [], mensagem: "Nenhum cupom recomendado combina com os filtros atuais." });
        const apiKey = process.env['GEMINI_API_KEY'];
        if (!apiKey) return json(request, { erro: "O assistente ainda não foi configurado pelo responsável do site." }, 503);
        const prompt = `Ajude uma pessoa a escolher cupons para este pedido: ${JSON.stringify(entrada.pedido)}.
Escolha no máximo 5 opções que realmente combinem. REGRA CRÍTICA: escolha somente entre os cupons enviados; nunca invente loja, cupom, produto ou benefício. Se nenhum combinar, devolva escolhas vazias e uma frase dizendo isso.
A categoria é somente uma estimativa baseada no nome da loja. Para cada escolha, escreva uma frase curta, direta e honesta.
Responda somente JSON no formato {"escolhas":[{"id":123,"motivo":"frase"}],"mensagem":"resumo curto"}.
Cupons: ${JSON.stringify(entrada.cupons)}`;
        const resposta = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
        });
        if (!resposta.ok) return json(request, { erro: "Não foi possível buscar recomendações agora. Tente novamente em instantes." }, 502);
        const texto = textoGemini(await resposta.json());
        try {
          const resultado = saidaSchema.parse(JSON.parse(limparJson(texto)));
          const idsPermitidos = new Set(entrada.cupons.map((cupom) => cupom.id));
          return json(request, { ...resultado, escolhas: resultado.escolhas.filter((item) => idsPermitidos.has(item.id)).slice(0, 5) });
        } catch {
          return json(request, { erro: "O assistente retornou um formato inválido. Tente novamente." }, 502);
        }
      },
    },
  },
});