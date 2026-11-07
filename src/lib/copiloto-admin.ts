/* COPILOTO DO PAINEL (/admin, Weslei 04/11). Não é rota pública: é uma
   server function com o token da sessão, e o contexto vem de
   painel_fundador(7), que só responde à conta mestre (checagem no banco).
   Sem a conta mestre, nada de modelo nem de número. Links na resposta só os
   de afiliado do Weslei (Regra nº 1); qualquer outro endereço é trocado. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ehLinkDeCompra } from "@/lib/afiliado";
import { resumo, type Painel } from "@/lib/painel-fundador";
import { diasAte, rotuloDa, temporadasEmDestaque } from "@/lib/sazonal";

export type MensagemCopiloto = { papel: "voce" | "copiloto"; texto: string };

const entradaSchema = z.object({
  historico: z
    .array(z.object({ papel: z.enum(["voce", "copiloto"]), texto: z.string().max(4000) }))
    .min(1)
    .max(12),
  dias: z.number().int().min(1).max(90).default(30),
});

/** Leitura do hub de afiliados do ML (metricas_hub_ml), como o /admin mostra. */
export type HubParaCopiloto = {
  capturado_em: string;
  comissao_estimada_centavos: number | null;
  comissao_aprovada_centavos: number | null;
  comissao_pendente_centavos: number | null;
  faturamento_gerado_centavos: number | null;
  pedidos_totais: number | null;
  cliques_totais: number | null;
  taxa_conversao: number | null;
  itens: ItemHub[] | null;
  receita?: ReceitaML | null;
};
/** Tela "Minha receita" do hub (extensão 1.183.0). */
export type ReceitaML = {
  saldo_pendente_centavos: number | null;
  em_revisao_centavos: number | null;
  em_pagamento_centavos: number | null;
  a_pagar: { data: string; centavos: number }[];
  historico: { periodo: string; atual: boolean; status: string | null; centavos: number | null }[];
};
export type ItemHub = {
  produto: string | null;
  valor_centavos: number | null;
  comissao_centavos: number | null;
  comissao_pct: number | null;
  tipo: string | null;
  status: string | null;
  data: string | null;
  liberacao: string | null;
  quantidade: number | null;
};

const RE_A_RECEBER = /pendente|a liberar|em an[aá]lise|retid|aguard|processamento|a receber/i;

/** Comissão ainda não liberada, somada por data de liberação (vendas lidas). */
export function aReceberPorData(itens: ItemHub[]) {
  const mapa = new Map<string, number>();
  for (const i of itens) {
    if (i.comissao_centavos == null || !RE_A_RECEBER.test(i.status ?? "")) continue;
    const k = i.liberacao || "sem data";
    mapa.set(k, (mapa.get(k) ?? 0) + i.comissao_centavos);
  }
  return [...mapa].map(([data, centavos]) => ({ data, centavos }));
}

const emReais = (c: number | null | undefined) => (c == null ? null : c / 100);

/** Hub do ML para o copiloto: última leitura completa, vendas por produto e
    o histórico curto (para ver a evolução). Valor não lido = null. */
export function contextoDoHub(leituras: HubParaCopiloto[]) {
  const [ultima] = leituras;
  if (!ultima)
    return { status: "nenhuma leitura do hub ainda (tocar em Sincronizar vendas agora)" };
  return {
    lido_em: ultima.capturado_em,
    periodo: "mês atual, acumulado como o hub mostra",
    ganho_estimado_reais: emReais(ultima.comissao_estimada_centavos),
    comissao_aprovada_reais: emReais(ultima.comissao_aprovada_centavos),
    comissao_pendente_a_receber_reais: emReais(ultima.comissao_pendente_centavos),
    vendas_geradas_reais: emReais(ultima.faturamento_gerado_centavos),
    pedidos: ultima.pedidos_totais,
    cliques: ultima.cliques_totais,
    conversao_pct: ultima.taxa_conversao,
    vendas_por_produto: (ultima.itens ?? []).slice(0, 80).map((i) => ({
      produto: i.produto,
      valor_reais: emReais(i.valor_centavos),
      comissao_reais: emReais(i.comissao_centavos),
      comissao_pct: i.comissao_pct,
      tipo: i.tipo,
      status: i.status,
      data: i.data,
      liberacao: i.liberacao,
      quantidade: i.quantidade,
    })),
    vendas_por_produto_lidas: (ultima.itens ?? []).length,
    minha_receita: ultima.receita
      ? {
          saldo_pendente_reais: emReais(ultima.receita.saldo_pendente_centavos),
          em_revisao_reais: emReais(ultima.receita.em_revisao_centavos),
          em_processo_de_pagamento_reais: emReais(ultima.receita.em_pagamento_centavos),
          a_pagar: ultima.receita.a_pagar.map((a) => ({ data: a.data, reais: a.centavos / 100 })),
          historico: ultima.receita.historico.map((h) => ({
            ...h,
            centavos: undefined,
            reais: emReais(h.centavos),
          })),
        }
      : "tela Minha receita ainda não lida (extensão 1.183.0 + Sincronizar vendas agora)",
    historico: leituras.slice(0, 10).map((l) => ({
      lido_em: l.capturado_em,
      ganho_estimado_reais: emReais(l.comissao_estimada_centavos),
      pedidos: l.pedidos_totais,
      cliques: l.cliques_totais,
    })),
  };
}

/** Só os números consolidados: nada de link, chave ou dado pessoal. */
export function contextoDoPainel(p: Painel, agora = new Date()) {
  const r = resumo(p);
  return {
    periodo: { de: p.de, ate: p.ate },
    portais_de_afiliado_mes_atual: p.vendas.map((v) => ({
      marketplace: v.marketplace,
      comissao_reais: emReais(v.comissao_centavos),
      pedidos: v.pedidos,
      cliques: v.cliques,
      lido_em: v.capturado_em,
    })),
    ultima_sincronizacao: p.comando
      ? {
          status: p.comando.status,
          etapa: p.comando.etapa,
          pedida_em: p.comando.criado_em,
          concluida_em: p.comando.concluido_em,
          portais: (p.comando.resultado?.marketplaces ?? []).map((m) => ({
            marketplace: m.marketplace,
            leitura: m.status,
          })),
        }
      : null,
    totais: {
      visitas: r.visitas,
      buscas: r.buscas,
      comparacoes_concluidas: r.comparacoes,
      buscas_por_link_que_falharam: p.falhas_busca,
      cliques_afiliado: r.cliques,
      taxa_decisao_pct: r.taxaDecisao == null ? null : Math.round(r.taxaDecisao * 10) / 10,
      monitorados_meus_precos: p.monitorados,
      alertas_disparados: r.alertasDisparados,
      comissao_mes_reais: r.comissaoMes == null ? "aguardando sincronização" : r.comissaoMes / 100,
    },
    por_dia: p.serie.map((d) => ({
      dia: d.dia,
      visitas: d.visitas,
      buscas: d.buscas_link + d.buscas_texto,
      cliques: d.cliques_ml + d.cliques_amazon + d.cliques_shopee,
    })),
    produtos_em_alta: p.top_produtos.slice(0, 25).map((t) => ({
      titulo: t.titulo,
      categoria: t.categoria,
      preco_colado: t.preco,
      melhor_preco: t.melhor_preco,
      buscas: t.vezes,
      cliques: t.cliques,
    })),
    demandas_nao_atendidas: p.gaps
      .slice(0, 20)
      .map((g) => ({ titulo: g.titulo, motivo: g.motivo })),
    categorias: p.categorias,
    termos: p.termos,
    alertas_do_robo: {
      extensao_versao: p.saude.extensao_versao,
      extensao_ultimo_ping: p.saude.extensao_visto_em,
      extensao_pausada: p.saude.extensao_pausada === "true",
      operacao_pausada: p.saude.operacao_pausada === "true",
      cotas_ia_esgotadas: p.saude.ia_esgotadas.map((c) => c.modelo),
      ultimo_cron: p.saude.cron[0] ?? null,
      ofertas_atualizadas_24h: p.saude.ofertas_24h,
    },
    temporadas: temporadasEmDestaque(agora).map((t) => ({
      nome: t.nome,
      rotulo: rotuloDa(t, agora),
      dia: t.dia,
      faltam_dias: diasAte(t, agora),
    })),
  };
}

export function promptDoCopiloto(contexto: unknown, historico: MensagemCopiloto[], dias = 7) {
  return [
    "Você é o analista do painel do fundador do Melhor Escolha (melhorescolha.io), comparador de preços",
    "de produtos vendidos no Mercado Livre, com Amazon e Shopee sob demanda. Fala com o Weslei, o dono.",
    "Seja assertivo, como um analista de negócios sênior:",
    "- Abra com a resposta direta em uma frase, com o número exato (R$, %, quantidade) e a data do dado.",
    "- Depois, no máximo 5 tópicos: o que o número mostra, comparação (dia a dia, histórico do hub, marketplaces) e 1 a 3 ações concretas com o produto/categoria/termo pelo nome.",
    "- Faça as contas você mesmo (somas, médias, % de variação, ranking) a partir do CONTEXTO, e diga de onde veio cada número (ex.: 'hub do ML lido em 07/11 00:25').",
    "- Dinheiro a receber do ML: use hub_mercado_livre.minha_receita (saldo pendente, em revisão, em processo de pagamento, a pagar em <data>, histórico por período).",
    "- Comissão, a receber, aprovada, vendas por produto, tipo de venda (direta/indireta) e datas de liberação estão em hub_mercado_livre e portais_de_afiliado_mes_atual: use-os.",
    "- Se um campo está null ou a lista vem vazia, diga em uma linha qual campo falta e o que fazer (ex.: 'tocar em Sincronizar vendas agora com a extensão aberta'). Não repita avisos genéricos e não diga 'não há dados no contexto' quando o dado existe.",
    "Regras:",
    "- Use SOMENTE os números do CONTEXTO. Nunca invente preço, desconto, comissão, venda ou data.",
    "- Clique não é venda. Comissão só vem dos portais de afiliado.",
    "- Nunca escreva links nem endereços: na hora de publicar, o link é sempre o de afiliado do Weslei.",
    "- Textos para Telegram ou anúncios: curtos, sem exagero, sem prometer cupom, sem citar IA, frete em frase própria.",
    "- Qualidade primeiro: sugira produtos bem avaliados e que já foram comparados; nunca réplica, usado ou peça.",
    "- Responda em português do Brasil, direto e em tópicos curtos quando ajudar.",
    "",
    `CONTEXTO (últimos ${dias} dias do site; hub e portais = mês atual; horário de Brasília):`,
    JSON.stringify(contexto),
    "",
    "CONVERSA:",
    ...historico.map((m) => `${m.papel === "voce" ? "Weslei" : "Copiloto"}: ${m.texto}`),
    "",
    'Responda só em JSON: {"resposta": "<texto em Markdown simples>"}',
  ].join("\n");
}

/** Troca todo endereço que não é link de afiliado do Weslei. */
export function limparResposta(texto: string) {
  return texto
    .replace(/https?:\/\/[^\s)\]>"']+/gi, (url) =>
      ehLinkDeCompra(url) ? url : "[link de afiliado]",
    )
    .trim();
}

export const perguntarAoCopiloto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entradaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: painel, error }, { data: hub }] = await Promise.all([
      context.supabase.rpc("painel_fundador" as never, { p_dias: data.dias } as never),
      /* RLS: só a conta mestre lê metricas_hub_ml. */
      context.supabase
        .from("metricas_hub_ml" as never)
        .select(
          "capturado_em, comissao_estimada_centavos, comissao_aprovada_centavos, comissao_pendente_centavos, faturamento_gerado_centavos, pedidos_totais, cliques_totais, taxa_conversao, itens, receita",
        )
        .order("capturado_em", { ascending: false })
        .limit(10),
    ]);
    if (error || !painel) return { erro: "indisponivel" as const };
    const contexto = {
      ...contextoDoPainel(painel as unknown as Painel),
      hub_mercado_livre: contextoDoHub((hub ?? []) as unknown as HubParaCopiloto[]),
    };
    const prompt = promptDoCopiloto(contexto, data.historico, data.dias);
    const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
    const r = await perguntarAoLlm(prompt, 30_000);
    if (!r.ok) return { erro: "modelo" as const };
    let texto = "";
    try {
      texto = String((JSON.parse(r.texto) as { resposta?: unknown }).resposta ?? "");
    } catch {
      texto = r.texto;
    }
    texto = limparResposta(texto);
    return texto ? { resposta: texto } : { erro: "modelo" as const };
  });
