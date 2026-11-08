import { guardarNoAcervo } from "@/lib/acervo";
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
import {
  buscasDeRoupa,
  extrairIntencaoRapida,
  generoDoPedido,
  MENSAGEM_SEM_OPCOES,
} from "@/lib/busca-intencao";
import {
  cabecalhosCors,
  excedeuLimite,
  json,
  origemPermitida,
  respostaOptions,
} from "@/lib/public-ai-api";

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
  /* "Carregar mais" (02/11): de onde a página anterior parou e o que já está
     na tela (não gasta leitura com produto repetido). */
  cursor: z.number().int().min(0).max(400).optional(),
  vistos: z
    .array(z.string().regex(/^MLB\d{4,14}$/))
    .max(400)
    .optional(),
  /* Streamed quick preview before the full search (06/11). */
  previa: z.boolean().optional(),
});

const CONTEXTOS = {
  home: null,
  natal: "presentes de Natal",
  criancas: "presentes de Dia das Criancas, brinquedos e itens infantis",
} as const;

const CACHE_MS = 6 * 3600_000;

/* Memory cache per worker (05/11, response time): a repeated search answers
   without touching the database. Small and short-lived; the DB stays the
   source of truth for 6 h. */
const MEMORIA = new Map<string, { em: number; r: RespostaBusca }>();
const MEMORIA_MS = 30 * 60_000;
function lerMemoria(c: string): RespostaBusca | null {
  const m = MEMORIA.get(c);
  if (!m) return null;
  if (Date.now() - m.em > MEMORIA_MS) {
    MEMORIA.delete(c);
    return null;
  }
  return m.r;
}
function gravarMemoria(c: string, r: RespostaBusca) {
  if (MEMORIA.size >= 300) MEMORIA.delete(MEMORIA.keys().next().value!);
  MEMORIA.set(c, { em: Date.now(), r });
}
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
        /* Key version bump drops answers cached before a filter change (v28, 08/11: brand off ML falls back to the same type). */
        const chave1 = `v28|${modoProduto ? "produto" : no ? `no:${no.slug}` : contexto}|${normalizarBusca(entrada.q)}`;
        const chave = pagina
          ? `${chave1}|p${pagina}|c${entrada.cursor ?? ""}|n${(entrada.vistos ?? []).length}`
          : chave1;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Tabela nova (fora dos tipos gerados): acesso sem tipo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const lerGuardada = async (c: string): Promise<RespostaBusca | null> => {
          const mem = lerMemoria(c);
          if (mem) return mem;
          const r: { data: { resposta: RespostaBusca } | null } = await db
            .from("busca_guiada")
            .select("resposta")
            .eq("chave", c)
            .gte("criado_em", new Date(Date.now() - CACHE_MS).toISOString())
            .order("criado_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (r.data?.resposta) gravarMemoria(c, r.data.resposta);
          return r.data?.resposta ?? null;
        };
        const guardada = await lerGuardada(chave);
        if (guardada) return json(request, guardada);

        const completar = async (): Promise<{ corpo: object; status: number }> => {
          let achado: {
            intencao: Awaited<ReturnType<typeof buscaGuiada>>["intencao"];
            resultados: Awaited<ReturnType<typeof buscaGuiada>>["resultados"];
            variantes?: string[];
            proximo?: number | null;
          };
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
                primeira
                  ? {
                      variantes: primeira.variantes ?? [],
                      excluir: [
                        ...primeira.resultados.map((r) => r.produto),
                        ...(entrada.vistos ?? []),
                      ],
                      cursor: entrada.cursor,
                    }
                  : { excluir: entrada.vistos ?? [], cursor: entrada.cursor },
              );
            }
          } catch {
            return { corpo: { erro: "A busca não respondeu agora. Tente de novo." }, status: 502 };
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

          /* Acervo (05/11): what this search read with price and shipping is kept
           for the showcases (Amigo Secreto reads it before the catalog). */
          if (!modoProduto) await guardarNoAcervo(db, entrada.q, achado.resultados);

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
          /* 08/11: brand off the catalog still asks the listings (Insider may sell there). */
          const semAMarca = !!achado.intencao.ignorarMarca;
          if (exato && (!achado.resultados.length || semAMarca) && !pagina && !modoProduto) {
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
          /* ROUPA NOS ANÚNCIOS (Weslei, 07/11: "roupa de academia masculino"
             voltou com 1 item: quase nenhuma roupa do catálogo tem oferta).
             Poucos achados: a extensão lê a busca de anúncios de cada peça,
             travada na peça e no gênero digitado (os dois no título). */
          const anunciosPecas: { id: number; chave: string; marca: string; modelo: string }[] = [];
          const genero = generoDoPedido(entrada.q.toLowerCase());
          if (genero && achado.resultados.length < 12 && !pagina && !modoProduto && !exato) {
            const trava = genero === "m" ? "masculin" : "feminin";
            for (const termo of buscasDeRoupa(entrada.q)) {
              const peca = termo.split(" ")[0]!;
              const { data } = await db.rpc("pedir_busca_anuncios", {
                p_termo: termo,
                p_marca: trava,
                p_modelo: peca,
              });
              const p = data as { ok?: boolean; id?: number; chave?: string } | null;
              if (p?.ok && p.id && p.chave)
                anunciosPecas.push({ id: p.id, chave: p.chave, marca: trava, modelo: peca });
            }
          }
          const resposta: RespostaBusca = {
            /* Modelo citado e nada igual: diz isso em vez de mostrar outro. */
            resumo:
              exato && !achado.resultados.length && !pagina
                ? anuncios
                  ? "Conferindo opções disponíveis compatíveis com o seu pedido…"
                  : MENSAGEM_SEM_OPCOES
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
            ...(semAMarca ? { ignorarMarca: true } : {}),
            anuncios,
            ...(anunciosPecas.length ? { anunciosPecas } : {}),
            variantes: achado.variantes ?? [],
            ...(achado.proximo !== undefined ? { proximo: achado.proximo } : {}),
          };
          /* Busca sem resultado não fica guardada (pode ter sido falha). */
          if (achado.resultados.length || enfileirados)
            await db.from("busca_guiada").insert({ chave, contexto, resposta, enfileirados });
          gravarMemoria(chave, resposta);
          return { corpo: resposta, status: 200 };
        };

        /* TWO STAGES (Weslei, 06/11: "3-6 s esperando"): the interpretation
           takes up to 3.5 s before any read. With previa, one streamed answer
           (one JSON per line): first the catalog read with the words as typed,
           then the full search, which replaces it. Same request, so the memo of
           offers keeps the reads shared. */
        const comPrevia =
          entrada.previa === true && !pagina && !modoProduto && !no && entrada.cursor == null;
        if (!comPrevia) {
          const f = await completar();
          return json(request, f.corpo, f.status);
        }
        const codificar = new TextEncoder();
        let terminou = false;
        const fluxo = new ReadableStream<Uint8Array>({
          async start(controle) {
            const enviar = (o: object) =>
              controle.enqueue(codificar.encode(`${JSON.stringify(o)}\n`));
            /* 08/11: stage 0 = own stock only (DB, no ML read), usually < 1 s;
               the catalog preview and the full answer replace it. */
            let previaDoCatalogo = false;
            const parcial = (r: Awaited<ReturnType<typeof buscaGuiada>>) => ({
              previa: true,
              resumo: "",
              buscas: r.intencao.buscas,
              resultados: r.resultados,
              enfileirados: 0,
              lidoEm: new Date().toISOString(),
              proximo: null,
            });
            const instantanea = buscaGuiada(
              entrada.q,
              contextoTexto,
              0,
              extrairIntencaoRapida(entrada.q),
              { instantaneo: true },
            )
              .then((r) => {
                if (terminou || previaDoCatalogo || !r.resultados.length) return;
                enviar(parcial(r));
              })
              .catch(() => {});
            const previa = buscaGuiada(
              entrada.q,
              contextoTexto,
              0,
              extrairIntencaoRapida(entrada.q),
              {
                previa: true,
              },
            )
              .then(async (r) => {
                await instantanea;
                if (terminou || !r.resultados.length) return;
                previaDoCatalogo = true;
                enviar(parcial(r));
              })
              .catch(() => {});
            const f = await completar().catch(() => ({
              corpo: { erro: "A busca não respondeu agora. Tente de novo." },
              status: 502,
            }));
            terminou = true;
            await Promise.all([instantanea, previa.catch(() => {})]);
            enviar(f.corpo);
            controle.close();
          },
        });
        return new Response(fluxo, {
          headers: {
            ...cabecalhosCors(origemPermitida(request)),
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
