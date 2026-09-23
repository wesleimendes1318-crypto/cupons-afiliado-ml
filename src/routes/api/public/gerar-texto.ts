import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { textoSemIa } from "@/lib/ia-reserva";
import { chamarIa, excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

const entradaSchema = z.object({
  vendedor: z.string().trim().min(1).max(160),
  desconto: z.string().trim().min(1).max(80),
  teto: z.number().finite().nonnegative().nullable(),
  compra_min: z.number().finite().nonnegative().nullable(),
  canal: z.enum(["WhatsApp", "Instagram"]),
  qualidade: z.enum(["bom", "armadilha"]),
});

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export const Route = createFileRoute("/api/public/gerar-texto")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        return respostaOptions(request);
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

        const teto = entrada.teto == null ? "não informado" : moeda(entrada.teto);
        const compraMinima = entrada.compra_min == null ? "não informada" : moeda(entrada.compra_min);
        const prompt = `Escreva uma mensagem curta de venda em português do Brasil para ${entrada.canal}.
Use no máximo 4 linhas, tom direto e honesto, sem exagero e no máximo 2 emojis.
Vendedor: ${entrada.vendedor}.
Desconto anunciado: ${entrada.desconto}.
Teto máximo de desconto: ${teto}.
Compra mínima: ${compraMinima}.
REGRA CRÍTICA: informe o benefício REAL, nunca destaque o percentual isoladamente e nunca prometa desconto maior que o teto. Se houver teto, diga claramente o limite, como “20% OFF com desconto de até R$ 100”. Informe a compra mínima quando existir. Não invente características de produtos, estoque, frete ou prazo de entrega. Entregue somente a mensagem final.`;

        const resultado = await chamarIa(prompt, { esforco: "low" });
        /* IA fora (cota ou credito): mensagem montada com os numeros reais. */
        if (!resultado.ok) {
          return json(request, { texto: textoSemIa(entrada), aviso: false, fonte: "calculo" });
        }
        return json(request, { texto: resultado.texto, aviso: false });
      },
    },
  },
});