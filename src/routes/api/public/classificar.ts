import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { chamarIa, excedeuLimite, json, limparJson, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

export const CATEGORIAS = [
  "Autopeças e Acessórios",
  "Casa e Decoração",
  "Moda e Calçados",
  "Beleza e Cuidados",
  "Saúde e Suplementos",
  "Eletrônicos e Informática",
  "Ferramentas e Construção",
  "Esporte e Fitness",
  "Pet Shop",
  "Bebês e Brinquedos",
  "Alimentos e Bebidas",
  "Joias e Relógios",
  "Música e Instrumentos",
  "Variedades",
] as const;

const formatoSaida = {
  nome: "categorias_lojas",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      itens: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            vendedor: { type: "string" },
            categoria: { type: "string", enum: [...CATEGORIAS] },
          },
          required: ["vendedor", "categoria"],
        },
      },
    },
    required: ["itens"],
  },
} as const;

const saidaSchema = z.object({ itens: z.array(z.object({ vendedor: z.string(), categoria: z.enum(CATEGORIAS) })) });

export const Route = createFileRoute("/api/public/classificar")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request)) return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request)) return json(request, { erro: "Muitas solicitações. Aguarde um minuto e tente novamente." }, 429);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("cupons").select("vendedor").is("categoria", null);
        if (error) return json(request, { erro: "Não foi possível consultar as lojas sem categoria." }, 500);
        const vendedores = [...new Set((data ?? []).map((item) => item.vendedor))];
        if (!vendedores.length) return json(request, { classificados: 0, total: 0 });

        let classificados = 0;
        for (let inicio = 0; inicio < vendedores.length; inicio += 40) {
          const lote = vendedores.slice(inicio, inicio + 40);
          const prompt = `Classifique cada nome de loja em exatamente uma categoria permitida.
Use apenas o nome da loja como pista. Se o nome não der pista clara e forte, como “Bb20250428120426”, use “Variedades”. Não invente informações.
Categorias permitidas: ${CATEGORIAS.join("; ")}.
Devolva um item para cada loja enviada, com o nome exato da loja e a categoria exata.
Lojas: ${JSON.stringify(lote)}`;
          const resultado = await chamarIa(prompt, { formato: formatoSaida, esforco: "low" });
          if (!resultado.ok) return json(request, { erro: resultado.erro }, resultado.status);
          const texto = resultado.texto;
          let categorias: z.infer<typeof saidaSchema>["itens"];
          try {
            categorias = saidaSchema.parse(JSON.parse(limparJson(texto))).itens;
          } catch {
            return json(request, { erro: "A classificação retornou um formato inválido. Tente novamente." }, 502);
          }
          const nomesDoLote = new Set(lote);
          for (const item of categorias) {
            if (!nomesDoLote.has(item.vendedor)) continue;
            const { error: updateError } = await supabaseAdmin
              .from("cupons")
              .update({ categoria: item.categoria })
              .eq("vendedor", item.vendedor)
              .is("categoria", null);
            if (updateError) return json(request, { erro: "Não foi possível salvar todas as categorias." }, 500);
            classificados += 1;
          }
        }
        return json(request, { classificados, total: vendedores.length });
      },
    },
  },
});