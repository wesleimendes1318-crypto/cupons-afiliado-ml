/* PAINEL DO FUNDADOR (/admin, Weslei 04/11). Os números vêm todos de
   painel_fundador(), que só responde à conta mestre confirmada (checagem no
   banco, eh_fundador). Sem número inventado: comissão sem leitura do portal
   de afiliado fica null e a tela diz "Aguardando sincronização". */
import { supabase } from "@/integrations/supabase/client";

export type Dia = {
  dia: string;
  visitas: number;
  buscas_link: number;
  buscas_texto: number;
  comparacoes: number;
  cliques_ml: number;
  cliques_amazon: number;
  cliques_shopee: number;
  favoritados: number;
  alertas_ativos: number;
  alertas_disparados: number;
};

export type Venda = {
  data: string;
  marketplace: "mercadolivre" | "amazon" | "shopee";
  pedidos: number | null;
  comissao_centavos: number | null;
  cliques: number | null;
  status: string | null;
  capturado_em: string;
};

export type Painel = {
  gerado_em: string;
  de: string;
  ate: string;
  serie: Dia[];
  vendas: Venda[];
  monitorados: number;
  seguidores: number;
  categorias: { nome: string; buscas: number }[];
  termos: { termo: string; vezes: number }[];
  top_produtos: {
    titulo: string;
    categoria: string | null;
    preco: number | null;
    melhor_loja: string | null;
    melhor_preco: number | null;
    vezes: number;
    cliques: number;
  }[];
  gaps: {
    titulo: string;
    categoria: string | null;
    preco: number | null;
    lojas: number;
    motivo: string;
  }[];
  falhas_busca: number;
  saude: {
    extensao_versao: string | null;
    extensao_visto_em: string | null;
    extensao_pausada: string | null;
    operacao_pausada: string | null;
    ia_esgotadas: { modelo: string; ate: string }[];
    cron: { tarefa: string; fim: string; resumo: unknown }[];
    ofertas_24h: number;
  };
  comando: ComandoSinc | null;
};

export type LeituraPortal = {
  marketplace: "mercadolivre" | "amazon" | "shopee";
  status: "lido" | "sem_numeros" | "sem_login" | "verificacao" | "pagina_inesperada" | "erro";
  achados?: { rotulo: string; valor: string }[];
};

export type ComandoSinc = {
  id: number;
  status: "pendente" | "executando" | "concluido" | "erro";
  etapa: string | null;
  resultado: { marketplaces?: LeituraPortal[]; gravados?: number } | null;
  criado_em: string;
  concluido_em: string | null;
};

/** null = não é o fundador (ou sem sessão). */
export async function carregarPainel(dias = 30): Promise<Painel | null> {
  const { data, error } = await supabase.rpc("painel_fundador" as never, { p_dias: dias } as never);
  if (error || !data) return null;
  return data as unknown as Painel;
}

const soma = (l: Dia[], f: (d: Dia) => number) => l.reduce((t, d) => t + f(d), 0);
export const buscasDoDia = (d: Dia) => d.buscas_link + d.buscas_texto;
export const cliquesDoDia = (d: Dia) => d.cliques_ml + d.cliques_amazon + d.cliques_shopee;

const somaComissao = (l: Venda[]) =>
  l.some((v) => v.comissao_centavos != null)
    ? l.reduce((t, v) => t + (v.comissao_centavos ?? 0), 0)
    : null;

export function resumo(p: Painel, hoje = p.ate) {
  const mes = hoje.slice(0, 7);
  const menosDias = (n: number) => {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const semana = p.vendas.filter((v) => v.data > menosDias(7));
  const anterior = p.vendas.filter((v) => v.data > menosDias(14) && v.data <= menosDias(7));
  const cSemana = somaComissao(semana);
  const cAnterior = somaComissao(anterior);
  const buscas = soma(p.serie, buscasDoDia);
  const cliques = {
    ml: soma(p.serie, (d) => d.cliques_ml),
    amazon: soma(p.serie, (d) => d.cliques_amazon),
    shopee: soma(p.serie, (d) => d.cliques_shopee),
  };
  const totalCliques = cliques.ml + cliques.amazon + cliques.shopee;
  return {
    comissaoMes: somaComissao(p.vendas.filter((v) => v.data.startsWith(mes))),
    variacaoSemana:
      cSemana != null && cAnterior != null && cAnterior > 0
        ? ((cSemana - cAnterior) / cAnterior) * 100
        : null,
    ultimaLeitura: p.vendas.reduce<string | null>(
      (m, v) => (!m || v.capturado_em > m ? v.capturado_em : m),
      null,
    ),
    cliques,
    totalCliques,
    buscas,
    taxaDecisao: buscas > 0 ? (totalCliques / buscas) * 100 : null,
    visitas: soma(p.serie, (d) => d.visitas),
    comparacoes: soma(p.serie, (d) => d.comparacoes),
    alertasDisparados: soma(p.serie, (d) => d.alertas_disparados),
    favoritados: soma(p.serie, (d) => d.favoritados),
  };
}

export const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const preco = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) => (v == null ? "sem base" : `${v.toFixed(1).replace(".", ",")}%`);
const celula = (t: string | null | undefined) =>
  (t ?? "—").replace(/\|/g, "/").replace(/\s+/g, " ").trim();

const NOME_MARKET = { mercadolivre: "Mercado Livre", amazon: "Amazon", shopee: "Shopee" } as const;

/** Dossiê estratégico em Markdown, para colar numa IA. */
export function dossie(p: Painel): string {
  const r = resumo(p);
  const l: string[] = [];
  l.push(`# Dossiê estratégico — Melhor Escolha`, "");
  l.push(`Período: ${p.de} a ${p.ate} (horário de Brasília). Gerado em ${p.gerado_em}.`, "");
  l.push(
    "> Visitas, buscas por texto e cliques contam só quem aceitou a medição de análise; buscas por link contam todas.",
    "",
  );

  l.push("## 1. RESUMO EXECUTIVO DO PERÍODO", "");
  l.push(`- Visitas: ${r.visitas}`);
  l.push(
    `- Buscas: ${r.buscas} (por link: ${soma(p.serie, (d) => d.buscas_link)}, por texto: ${soma(p.serie, (d) => d.buscas_texto)})`,
  );
  l.push(
    `- Comparações concluídas: ${r.comparacoes}; buscas por link que falharam: ${p.falhas_busca}`,
  );
  l.push(
    `- Cliques em links de afiliado: ${r.totalCliques} (ML ${r.cliques.ml}, Amazon ${r.cliques.amazon}, Shopee ${r.cliques.shopee})`,
  );
  l.push(`- Taxa de decisão (cliques / buscas): ${pct(r.taxaDecisao)}`);
  l.push(
    `- Produtos monitorados em Meus preços: ${p.monitorados}; alertas disparados no período: ${r.alertasDisparados}`,
  );
  l.push(
    `- Comissão estimada do mês: ${r.comissaoMes == null ? "aguardando sincronização com os portais de afiliado" : reais(r.comissaoMes)}`,
    "",
  );

  l.push("## 2. TOP 20 PRODUTOS DE MAIOR INTERESSE", "");
  if (!p.top_produtos.length) l.push("Sem produtos buscados no período.", "");
  else {
    l.push(
      "| # | Produto | Categoria | Preço colado | Melhor loja | Melhor preço | Buscas | Cliques |",
    );
    l.push("|---|---|---|---|---|---|---|---|");
    p.top_produtos.forEach((t, i) =>
      l.push(
        `| ${i + 1} | ${celula(t.titulo)} | ${celula(t.categoria)} | ${preco(t.preco)} | ${celula(t.melhor_loja)} | ${preco(t.melhor_preco)} | ${t.vezes} | ${t.cliques} |`,
      ),
    );
    l.push("");
  }

  l.push("## 3. DEMANDAS NÃO ATENDIDAS (GAPS DE BUSCA)", "");
  if (!p.gaps.length)
    l.push("Nenhum produto buscado ficou sem oferta ou sem economia no período.", "");
  else {
    l.push("| Produto | Categoria | Preço | Lojas comparadas | Motivo |", "|---|---|---|---|---|");
    p.gaps.forEach((g) =>
      l.push(
        `| ${celula(g.titulo)} | ${celula(g.categoria)} | ${preco(g.preco)} | ${g.lojas} | ${g.motivo} |`,
      ),
    );
    l.push("");
  }
  if (p.termos.length)
    l.push(
      "Termos mais buscados nos anúncios: " +
        p.termos.map((t) => `${t.termo} (${t.vezes})`).join(", "),
      "",
    );

  l.push("## 4. ANÁLISE DE MERCADO & CONCORRÊNCIA INTERNA", "");
  l.push(
    "| Marketplace | Cliques no site | Pedidos (portal) | Comissão (portal) |",
    "|---|---|---|---|",
  );
  (["mercadolivre", "amazon", "shopee"] as const).forEach((m) => {
    const vs = p.vendas.filter((v) => v.marketplace === m);
    const ped = vs.some((v) => v.pedidos != null)
      ? vs.reduce((t, v) => t + (v.pedidos ?? 0), 0)
      : null;
    const com = somaComissao(vs);
    const cl = m === "mercadolivre" ? r.cliques.ml : r.cliques[m];
    l.push(
      `| ${NOME_MARKET[m]} | ${cl} | ${ped ?? "aguardando sincronização"} | ${com == null ? "aguardando sincronização" : reais(com)} |`,
    );
  });
  l.push("");
  if (p.categorias.length)
    l.push(
      "Categorias com mais interesse: " +
        p.categorias.map((c) => `${c.nome} (${c.buscas})`).join(", "),
      "",
    );

  const campeoes = p.top_produtos
    .slice(0, 5)
    .map(
      (t) =>
        `- ${t.titulo} (${t.categoria ?? "sem categoria"}, ${preco(t.melhor_preco ?? t.preco)})`,
    );
  l.push("## 5. PROMPTS PRONTOS PARA ANÁLISE EXTERNA", "");
  l.push(
    "Cole o bloco abaixo no ChatGPT, Claude ou DeepSeek junto com este arquivo.",
    "",
    "```text",
    "Você é estrategista de conteúdo de um comparador de preços brasileiro (Melhor Escolha).",
    "Use SOMENTE os dados do dossiê anexo; não invente preços, descontos nem números.",
    "Todo link de compra deve ser o link de afiliado já existente (não crie links).",
    "",
    "Campeões da semana:",
    ...(campeoes.length ? campeoes : ["- (sem dados no período)"]),
    "",
    "Tarefas:",
    "1. Roteiro de 5 Shorts para o YouTube (até 45 s cada): gancho nos 3 primeiros segundos, comparação de preço entre lojas, chamada para o link na descrição.",
    "2. 5 textos de alta conversão para o canal do Telegram com os produtos de maior interesse: título curto, preço, por que vale, sem exageros.",
    "3. 15 palavras-chave para guias editoriais e SEO, agrupadas por intenção (comparar, melhor custo-benefício, vale a pena), usando as categorias e os gaps de busca.",
    "Responda em português do Brasil, em Markdown.",
    "```",
    "",
  );
  return l.join("\n");
}

export function baixarDossie(p: Painel) {
  const blob = new Blob([dossie(p)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dossie-melhorescolha-${p.ate}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
