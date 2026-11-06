import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { generoDaPessoa } from "@/lib/amigo-secreto-curadoria";
import { interpretacaoDoModelo, interpretarLocal } from "@/lib/amigo-secreto-parser-local";
import type { Interpretacao } from "@/lib/amigo-secreto-tipos";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* AMIGO SECRETO (05/11): one person's wish text -> showcases + sizes. The
   model only splits the wishes and writes search terms; it never names a
   product, brand or price. Slower than 3 s or invalid: the local reader. */

const entradaSchema = z.object({ texto: z.string().trim().min(2).max(600), nome: z.string().trim().max(40).optional() });

const PRAZO_MS = 5_000;

const PROMPT = `Voce e curador de presentes de amigo secreto no Brasil (produtos do Mercado Livre).
Leia a lista de desejos de UMA pessoa, entenda o perfil completo (idade provavel, estilo, gostos,
o que ela valoriza) e separe em 2 a 6 vitrines tematicas distintas, na ordem do texto, com itens
que despertem desejo e parecam presente escolhido com carinho.
Para cada vitrine: "titulo" curto em portugues (ex.: "Roupas de academia (shorts M e tops G)",
"Decoração Star Wars e Marvel", "Bijuterias e anéis (prata e dourado)"), "icone" (1 emoji) e
"termos": 6 a 10 buscas curtas de produto (2 a 5 palavras, sem tamanho, sem preco, sem marca
inventada), cobrindo variedade dentro do tema.
REGRAS: tamanhos adultos (PP a GG, 34 a 46) ou itens adultos = pessoa ADULTA: em roupas use sempre
"feminino"/"masculino"/"adulto" nos termos, nunca termos que tragam roupa infantil. Use
feminino/masculino so quando o texto indicar (ex.: "tops", "bolsa" -> feminino); sem indicacao,
use termos neutros ou "unissex". Adultos podem gostar de brinquedos e colecionaveis (Lego, Funko,
action figure, jogos de tabuleiro): com franquia citada, TODO termo leva o nome da franquia.
Livros: so leituras prazerosas (romance best seller, ficcao, suspense, fantasia, edicao especial,
autores em alta coerentes com o estilo da pessoa); nunca livros tecnicos, de impostos, direito
ou concurso. Beleza: itens universais (serum, hidratante, lip balm, kits), nunca base ou corretivo.
Pedido vago: itens de alto valor percebido (copo termico, kit chocolates, luminaria, kit cafe).
Roupa citada so com tamanho ("Roupa P") nao e vitrine: vai em tamanhos. A ULTIMA vitrine e sempre
{"titulo": "Ideias da época", "icone": "💡", "termos": [...]} com itens da estacao (fim de ano no
Brasil = Natal e verao: copo termico, praia, viagem, confraternizacao) que combinem com a pessoa.
tamanhos: {"roupa": "P|M|G|GG" ou null, "calcado": "33".."44" ou null,
"observacoes": "Shorts: M · Tops: G" ou null}.
Nunca invente produto, preco ou loja. Nunca fale de inteligencia artificial.
Responda SO com JSON minificado: {"tamanhos": {...}, "vitrines": [{"titulo": "...", "icone": "...", "termos": ["..."]}]}
Lista`;

async function comModelo(texto: string, nome?: string): Promise<Interpretacao | null> {
  /* 06/11: the first name tells the gender when the text does not (Vinicius got women's jewelry). */
  const genero = generoDaPessoa(texto, nome);
  const dica = genero ? ` (pessoa do genero ${genero}: TODO termo de roupa, joia ou acessorio leva "${genero}"/"${genero === "masculino" ? "masculina" : "feminina"}")` : "";
  const prompt = `${PROMPT}${dica}: ${JSON.stringify(texto)}`;
  try {
    const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
    const { lerJson } = await import("@/lib/conferir-produto");
    const r = await perguntarAoLlm(prompt, PRAZO_MS);
    const a = r.ok ? interpretacaoDoModelo(lerJson<unknown>(r.texto)) : null;
    if (a) return a;
    const { chamarIa } = await import("@/lib/public-ai-api");
    const g = await chamarIa(prompt, { esforco: "low", escopo: "Voce e curador de presentes do site Melhor Escolha, em portugues do Brasil. Responda so com o JSON pedido. Nunca invente produto ou preco." });
    return g.ok ? interpretacaoDoModelo(lerJson<unknown>(g.texto)) : null;
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
        const local = interpretarLocal(entrada.texto, entrada.nome);
        /* Over the limit: the local reading answers (no model call). */
        if (excedeuLimite(request, 20, "amigo-i:")) return json(request, { ...local, fonte: "local" });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const lida = await Promise.race([
          comModelo(entrada.texto, entrada.nome),
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
