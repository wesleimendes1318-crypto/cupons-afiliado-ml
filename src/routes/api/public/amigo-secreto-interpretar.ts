import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { interpretacaoDoModelo, interpretarLocal } from "@/lib/amigo-secreto-parser-local";
import type { Interpretacao } from "@/lib/amigo-secreto-tipos";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* AMIGO SECRETO (05/11): one person's wish text -> showcases + sizes. The
   model only splits the wishes and writes search terms; it never names a
   product, brand or price. Slower than 3 s or invalid: the local reader. */

const entradaSchema = z.object({ texto: z.string().trim().min(2).max(600) });

const PRAZO_MS = 3_000;

const PROMPT = `Voce ajuda a escolher presente de amigo secreto no Brasil (produtos do Mercado Livre).
Leia a lista de desejos de UMA pessoa e separe em 2 a 6 vitrines tematicas distintas, na ordem do texto.
Para cada vitrine: "titulo" curto em portugues (ex.: "Roupas de academia (shorts M e tops G)",
"Decoração Star Wars e Marvel", "Bijuterias e anéis (prata e dourado)"), "icone" (1 emoji) e
"termos": 3 a 6 buscas curtas de produto (2 a 4 palavras, sem tamanho, sem preco, sem marca
inventada), cobrindo variedade dentro do tema. Use feminino/masculino nos termos so quando o
texto indicar (ex.: "tops", "bolsa" -> feminino). Roupa citada so com tamanho ("Roupa P") nao e
vitrine: vai em tamanhos. A ULTIMA vitrine e sempre {"titulo": "Ideias criativas e semelhantes",
"icone": "💡", "termos": [...]} com itens complementares ao estilo da pessoa.
tamanhos: {"roupa": "P|M|G|GG" ou null, "calcado": "33".."44" ou null,
"observacoes": "Shorts: M · Tops: G" ou null}.
Nunca invente produto, preco ou loja. Nunca fale de inteligencia artificial.
Responda SO com JSON minificado: {"tamanhos": {...}, "vitrines": [{"titulo": "...", "icone": "...", "termos": ["..."]}]}
Lista`;

async function comModelo(texto: string): Promise<Interpretacao | null> {
  const prompt = `${PROMPT}: ${JSON.stringify(texto)}`;
  try {
    const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
    const r = await perguntarAoLlm(prompt, PRAZO_MS);
    if (!r.ok) return null;
    const { lerJson } = await import("@/lib/conferir-produto");
    return interpretacaoDoModelo(lerJson<unknown>(r.texto));
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/amigo-secreto-interpretar")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Escreva o que a pessoa gostaria de ganhar." }, 400);
        }
        const local = interpretarLocal(entrada.texto);
        /* Over the limit: the local reading answers (no model call). */
        if (excedeuLimite(request, 20, "amigo-i:")) return json(request, { ...local, fonte: "local" });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const lida = await Promise.race([
          comModelo(entrada.texto),
          new Promise<null>((r) => {
            timer = setTimeout(() => r(null), PRAZO_MS);
          }),
        ]);
        clearTimeout(timer);
        if (!lida) return json(request, { ...local, fonte: "local" });
        /* Sizes the text states win over the model's reading. */
        return json(request, {
          tamanhos: {
            roupa: local.tamanhos.roupa ?? lida.tamanhos.roupa ?? null,
            calcado: local.tamanhos.calcado ?? lida.tamanhos.calcado ?? null,
            observacoes: local.tamanhos.observacoes ?? lida.tamanhos.observacoes ?? null,
          },
          vitrines: lida.vitrines,
          fonte: "modelo",
        });
      },
    },
  },
});
