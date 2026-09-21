import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { excedeuLimite, json, limparJson, origemPermitida, respostaOptions, textoGemini } from "@/lib/public-ai-api";

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

const saidaSchema = z.array(z.object({ vendedor: z.string(), categoria: z.enum(CATEGORIAS) }));

export const Route = createFileRoute("/api/public/classificar")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request)) return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request)) return json(request, { erro: "Muitas solicitações. Aguarde um minuto e tente novamente." }, 429);
        const apiKey = process.env['GEMINI_API_KEY'];
        if (!apiKey) return json(request, { erro: "A classificação ainda não foi configurada pelo responsável do site." }, 503);

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
Responda somente JSON, como uma lista de objetos {"vendedor":"nome exato","categoria":"categoria exata"}.
Lojas: ${JSON.stringify(lote)}`;
          const resposta = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0 },
            }),
          });
          if (!resposta.ok) return json(request, { erro: "Não foi possível classificar as lojas agora. Tente novamente em instantes." }, 502);
          const texto = textoGemini(await resposta.json());
          let categorias: z.infer<typeof saidaSchema>;
          try {
            categorias = saidaSchema.parse(JSON.parse(limparJson(texto)));
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