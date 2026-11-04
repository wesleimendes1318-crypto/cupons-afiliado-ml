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
});

/** Só os números consolidados: nada de link, chave ou dado pessoal. */
export function contextoDoPainel(p: Painel, agora = new Date()) {
  const r = resumo(p);
  return {
    periodo: { de: p.de, ate: p.ate },
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
    produtos_em_alta: p.top_produtos.slice(0, 12).map((t) => ({
      titulo: t.titulo,
      categoria: t.categoria,
      preco_colado: t.preco,
      melhor_preco: t.melhor_preco,
      buscas: t.vezes,
      cliques: t.cliques,
    })),
    demandas_nao_atendidas: p.gaps
      .slice(0, 10)
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

export function promptDoCopiloto(contexto: unknown, historico: MensagemCopiloto[]) {
  return [
    "Você é o copiloto do painel do fundador do Melhor Escolha (melhorescolha.io), comparador de preços",
    "de produtos vendidos no Mercado Livre, com Amazon e Shopee sob demanda. Fala com o Weslei, o dono.",
    "Regras:",
    "- Use SOMENTE os números do CONTEXTO. Sem dado, diga que não há dado. Nunca invente preço, desconto, comissão ou venda.",
    "- Clique não é venda. Comissão só vem dos portais de afiliado; se estiver 'aguardando sincronização', diga isso.",
    "- Nunca escreva links nem endereços: na hora de publicar, o link é sempre o de afiliado do Weslei.",
    "- Textos para Telegram ou anúncios: curtos, sem exagero, sem prometer cupom, sem citar IA, frete em frase própria.",
    "- Qualidade primeiro: sugira produtos bem avaliados e que já foram comparados; nunca réplica, usado ou peça.",
    "- Responda em português do Brasil, direto e em tópicos curtos quando ajudar.",
    "",
    "CONTEXTO (últimos 7 dias, horário de Brasília):",
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
    const { data: painel, error } = await context.supabase.rpc(
      "painel_fundador" as never,
      { p_dias: 7 } as never,
    );
    if (error || !painel) return { erro: "indisponivel" as const };
    const prompt = promptDoCopiloto(contextoDoPainel(painel as unknown as Painel), data.historico);
    const { perguntarAoLlm } = await import("@/lib/cheaper-inference");
    const r = await perguntarAoLlm(prompt, 25_000);
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
