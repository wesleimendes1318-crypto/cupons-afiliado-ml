import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { chamarIa, excedeuLimite, json, limparJson, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

const entradaSchema = z.object({
  cupons: z
    .array(
      z.object({
        id: z.number().int(),
        vendedor: z.string().max(160),
        categoria: z.string().nullable(),
        desconto: z.string().nullable(),
        teto: z.number().nullable(),
        compra_min: z.number().nullable(),
        vence: z.string().nullable(),
        qualidade: z.string().nullable(),
      }),
    )
    .min(2)
    .max(3),
});

const saidaSchema = z.object({
  vencedor_id: z.number().int(),
  veredito: z.string().trim().min(1).max(600),
  observacoes: z.array(z.string().trim().min(1).max(240)).max(4),
  chamada: z.string().trim().min(1).max(200),
  urgencia: z.string().trim().max(200).nullable(),
});

const formatoSaida = {
  nome: "comparacao_cupons",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      vencedor_id: { type: "integer" },
      veredito: { type: "string" },
      observacoes: { type: "array", items: { type: "string" } },
      chamada: { type: "string" },
      urgencia: { type: ["string", "null"] },
    },
    required: ["vencedor_id", "veredito", "observacoes", "chamada", "urgencia"],
  },
} as const;

export const Route = createFileRoute("/api/public/comparar")({
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
          return json(request, { erro: "Selecione de 2 a 3 cupons para comparar." }, 400);
        }

        const hoje = new Date().toISOString().slice(0, 10);
        const prompt = `Você é um especialista em marketing de afiliados e vendas, com tom consultivo, confiante e honesto. Compare estes cupons do Mercado Livre e explique, em português do Brasil, qual oferece a melhor economia e por quê, ajudando o cliente a decidir agora.
Hoje é ${hoje}.
Dados de cada cupom: "teto" é a economia máxima em reais, "compra_min" é a compra mínima em reais, "vence" é a data final e "qualidade" igual a "armadilha" significa cupom com teto muito baixo.
REGRAS CRÍTICAS: use somente os dados enviados; nunca invente loja, produto, preço ou prazo; nunca prometa desconto acima do teto; a categoria é apenas uma estimativa feita pelo nome da loja; nunca diga que o cupom só funciona por um link específico, pois ele se aplica sozinho no carrinho.
No campo "veredito", escreva de 2 a 3 frases curtas e muito fáceis de entender dizendo qual loja compensa mais e por quê. NÃO cite valores em reais, não use a palavra "teto" nem fale de limite de desconto: a tabela ao lado já mostra todos os números e repetir isso confunde o cliente. Fale em termos simples, como "rende mais em compras maiores" ou "vale mais para compras pequenas". Sempre se refira a cada cupom pelo nome da loja; nunca cite o número de id. Se duas lojas tiverem o mesmo nome, diferencie pelo desconto ou pela data.
No campo "observacoes", escreva de 1 a 3 avisos curtos e úteis, também sem citar valores em reais, como quando a resposta muda conforme o tamanho da compra, compra mínima alta, prazo curto ou cupom armadilha.
O campo "vencedor_id" deve ser o id do cupom que compensa mais entre os enviados.
No campo "chamada", escreva UMA frase curta de estímulo à ação, em tom de especialista em vendas de afiliados, indicando a melhor escolha e convidando o cliente a garantir o cupom agora (exemplo de tom: "Entre as três, a loja X é a escolha mais inteligente — garanta esse cupom antes que a campanha acabe."). Sem exagero, sem promessa falsa, sem caixa alta, no máximo 1 emoji e apenas se combinar.
No campo "urgencia", escreva UMA frase curta sobre prazo somente quando algum cupom enviado vencer em até 7 dias a partir de hoje, citando a loja e quantos dias faltam (exemplo: "O cupom da loja X vence em 3 dias."). Se nenhum vencer nesse prazo, devolva null. Nunca invente prazos.
Cupons: ${JSON.stringify(entrada.cupons)}`;

        const resultado = await chamarIa(prompt, { formato: formatoSaida, esforco: "low" });
        if (!resultado.ok) return json(request, { erro: resultado.erro }, resultado.status);

        try {
          const comparacao = saidaSchema.parse(JSON.parse(limparJson(resultado.texto)));
          const idsPermitidos = new Set(entrada.cupons.map((cupom) => cupom.id));
          return json(request, {
            ...comparacao,
            vencedor_id: idsPermitidos.has(comparacao.vencedor_id) ? comparacao.vencedor_id : null,
          });
        } catch {
          return json(request, { erro: "A comparação retornou um formato inválido. Tente novamente." }, 502);
        }
      },
    },
  },
});
