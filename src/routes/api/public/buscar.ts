import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  buscaGuiada,
  buscarMesmoProduto,
  normalizarBusca,
  type RespostaBusca,
} from "@/lib/busca-guiada";
import { NOS, subarvore } from "@/content/taxonomia";
import { classificar, departamentoDe } from "@/lib/classificar";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* Busca guiada do site (05/10). A mesma pergunta (normalizada) volta do
   cache por 6 h. "A cada busca, se fizer sentido, deixar na vitrine": o 1º
   produto de cada busca que ninguém comparou nos últimos 7 dias entra na
   fila de comparação, no máximo 2 por busca e 8 por hora no site todo
   (a extensão compara um por vez, com o freio de sempre). */

/* Teto só de proteção (cada página gasta até 18 leituras da API oficial):
   30 páginas são até 240 produtos para a mesma busca. */
const PAGINAS = 30;

const entradaSchema = z.object({
  q: z.string().trim().min(2).max(160),
  contexto: z.enum(["home", "natal", "criancas"]).optional(),
  /* "produto": o texto é o título de um anúncio (link de outra loja); busca
     o MESMO produto, sem interpretar, só na categoria prevista (11/10). */
  modo: z.enum(["guiada", "produto"]).optional(),
  /* Busca dentro de uma categoria (27/10, "Consultar opções com IA"): o
     slug do nó da árvore; o pedido é lido no contexto dele e o que for de
     outro departamento fica de fora. */
  no: z.string().trim().max(80).optional(),
  /* "Ver mais opções" (27/10): 0 é a 1ª página; cada uma traz até 8. */
  pagina: z
    .number()
    .int()
    .min(0)
    .max(PAGINAS - 1)
    .optional(),
});

const CONTEXTOS = {
  home: null,
  natal: "presentes de Natal",
  criancas: "presentes de Dia das Criancas, brinquedos e itens infantis",
} as const;

const CACHE_MS = 6 * 3600_000;
const FILA_POR_BUSCA = 2;
const FILA_POR_HORA = 8;

export const Route = createFileRoute("/api/public/buscar")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request))
          return json(request, { erro: "Muitas buscas seguidas. Aguarde um minuto." }, 429);
        let entrada: z.infer<typeof entradaSchema>;
        try {
          entrada = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Escreva o que você procura." }, 400);
        }
        const contexto = entrada.contexto ?? "home";
        const no = entrada.no ? (NOS[entrada.no] ?? null) : null;
        if (entrada.no && !no) return json(request, { erro: "Categoria não encontrada." }, 400);
        const contextoTexto = no
          ? `categoria ${no.caminho.map((s) => NOS[s]!.nome).join(" > ")}; busque so produtos dessa categoria`
          : CONTEXTOS[contexto];
        const modoProduto = entrada.modo === "produto";
        const pagina = entrada.pagina ?? 0;
        /* "v3" (28/10): respostas guardadas antes do filtro de marca/modelo não voltam. */
        const chave1 = `v3|${modoProduto ? "produto" : no ? `no:${no.slug}` : contexto}|${normalizarBusca(entrada.q)}`;
        const chave = pagina ? `${chave1}|p${pagina}` : chave1;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Tabela nova (fora dos tipos gerados): acesso sem tipo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const lerGuardada = async (c: string): Promise<RespostaBusca | null> => {
          const r: { data: { resposta: RespostaBusca } | null } = await db
            .from("busca_guiada")
            .select("resposta")
            .eq("chave", c)
            .gte("criado_em", new Date(Date.now() - CACHE_MS).toISOString())
            .order("criado_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          return r.data?.resposta ?? null;
        };
        const guardada = await lerGuardada(chave);
        if (guardada) return json(request, guardada);

        let achado: Awaited<ReturnType<typeof buscaGuiada>>;
        try {
          if (modoProduto) {
            const r = await buscarMesmoProduto(entrada.q, pagina);
            achado = {
              intencao: { buscas: r.buscas, precoMin: null, precoMax: null, resumo: "" },
              resultados: r.resultados,
            };
          } else {
            /* Páginas seguintes: as buscas e a faixa de preço da 1ª. */
            const primeira = pagina ? await lerGuardada(chave1) : null;
            achado = await buscaGuiada(
              entrada.q,
              contextoTexto,
              pagina,
              primeira?.buscas?.length
                ? {
                    buscas: primeira.buscas,
                    precoMin: primeira.precoMin ?? null,
                    precoMax: primeira.precoMax ?? null,
                    resumo: primeira.resumo,
                    tipoProduto: primeira.tipoProduto ?? null,
                    contextoUso: primeira.contextoUso ?? null,
                    termosNegativos: primeira.termosNegativos ?? [],
                    dominiosPermitidos: primeira.dominiosPermitidos ?? [],
                    marca: primeira.marca ?? null,
                    modelo: primeira.modelo ?? null,
                  }
                : null,
            );
          }
        } catch {
          return json(request, { erro: "A busca não respondeu agora. Tente de novo." }, 502);
        }

        /* Na categoria: só o mesmo departamento, a própria subárvore na frente. */
        if (no) {
          const dep = no.caminho[0]!;
          const daqui = new Set(subarvore(no.slug));
          achado.resultados = achado.resultados
            .map((r, k) => ({ r, k, c: classificar({ nome: r.nome, fonte: dep }).no }))
            .filter((x) => departamentoDe(x.c) === dep)
            .sort((a, b) => Number(daqui.has(b.c)) - Number(daqui.has(a.c)) || a.k - b.k)
            .map((x) => x.r);
        }

        /* Fila da vitrine: só produto com anúncio ativo, ainda não comparado
           na semana, dentro do teto por hora. */
        let enfileirados = 0;
        if (achado.resultados.length && !pagina) {
          const hora = new Date(Date.now() - 3600_000).toISOString();
          const { data: ultimas } = await db
            .from("busca_guiada")
            .select("enfileirados")
            .gte("criado_em", hora);
          let livres =
            FILA_POR_HORA -
            ((ultimas ?? []) as Array<{ enfileirados: number }>).reduce(
              (s, r) => s + (r.enfileirados || 0),
              0,
            );
          const semana = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
          for (const r of achado.resultados) {
            if (livres <= 0 || enfileirados >= FILA_POR_BUSCA) break;
            /* Sem anúncio (catálogo sem oferta destacada): não vai para a fila. */
            if (!r.item) continue;
            const { count } = await db
              .from("pedidos_link")
              .select("id", { count: "exact", head: true })
              .gte("criado_em", semana)
              .ilike("url_alvo", `%${r.produto}%`);
            if ((count ?? 0) > 0) continue;
            const { data: novo, error } = await db.rpc("pedir_link_agente", {
              p_url: r.url,
              p_fonte: "busca",
            });
            if (!error && novo != null) {
              enfileirados += 1;
              livres -= 1;
            }
          }
        }

        const { marca, modelo } = achado.intencao;
        const exato = [marca, modelo].filter(Boolean).join(" ");
        /* Modelo citado fora do catálogo oficial (28/10, Nike TC 7900: só
           anúncios avulsos, que a API não lista): a extensão busca nos
           anúncios como uma pessoa faria. */
        let anuncios: { id: number; chave: string } | null = null;
        if (exato && !achado.resultados.length && !pagina && !modoProduto) {
          const { data } = await db.rpc("pedir_busca_anuncios", {
            // O que a pessoa digitou: a busca do modelo pode trazer palavra a mais ("feminino").
            p_termo:
              entrada.q.trim().split(/\s+/).length <= 8
                ? entrada.q
                : [marca, modelo].filter(Boolean).join(" "),
            p_marca: marca ?? null,
            p_modelo: modelo ?? null,
          });
          const p = data as { ok?: boolean; id?: number; chave?: string } | null;
          if (p?.ok && p.id && p.chave) anuncios = { id: p.id, chave: p.chave };
        }
        const resposta: RespostaBusca = {
          /* Modelo citado e nada igual: diz isso em vez de mostrar outro. */
          resumo:
            exato && !achado.resultados.length && !pagina
              ? anuncios
                ? `O ${exato} não está no catálogo oficial. Estou procurando nos anúncios das lojas do Mercado Livre, só o modelo exato.`
                : `Não encontrei o ${exato} com anúncio ativo agora. Para não te mostrar outro produto, deixei de fora modelos diferentes.`
              : achado.intencao.resumo,
          buscas: achado.intencao.buscas,
          resultados: achado.resultados,
          enfileirados,
          lidoEm: new Date().toISOString(),
          precoMin: achado.intencao.precoMin,
          precoMax: achado.intencao.precoMax,
          tipoProduto: achado.intencao.tipoProduto ?? null,
          contextoUso: achado.intencao.contextoUso ?? null,
          termosNegativos: achado.intencao.termosNegativos ?? [],
          dominiosPermitidos: achado.intencao.dominiosPermitidos ?? [],
          marca: marca ?? null,
          modelo: modelo ?? null,
          anuncios,
        };
        /* Busca sem resultado não fica guardada (pode ter sido falha). */
        if (achado.resultados.length || enfileirados)
          await db.from("busca_guiada").insert({ chave, contexto, resposta, enfileirados });
        return json(request, resposta);
      },
    },
  },
});
