/* CLASSIFICAÇÃO CONTÍNUA DOS MAIS VENDIDOS (Weslei, 27/10). Só servidor,
   operacao?tarefa=classificar (pg_cron a cada 10 min). Para cada produto de
   em_alta_catalogo ainda sem classificação (novo) ou classificado com uma
   versão antiga da taxonomia:
   1. sem domínio: pergunta ao classificador público do Mercado Livre
      (/sites/MLB/domain_discovery/search) o domínio e a categoria folha, e
      lê o caminho da categoria (/categories/{id}, guardado 30 dias em
      em_alta_vistos como cat:<id>);
   2. classifica pela taxonomia (src/lib/classificar.ts);
   3. grava as colunas da classificação e a aba antiga (categoria_site)
      pela classificação, guardando a anterior em _categoria_site_antes
      (gravar_classificacao). Nunca muda preço nem link.
   Sem modelo de linguagem e sem custo: só endereços públicos da API. */
import { classificar, VERSAO_TAXONOMIA } from "@/lib/classificar";
import { mlGet } from "@/lib/ml-api";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* Por execução: até 600 classificados (sem chamada) e 40 consultas de
   domínio (cada produto novo gasta 1, às vezes 2 com a categoria). */
const POR_EXECUCAO = 600;
const CONSULTAS = 40;
const CATEGORIA_MS = 30 * 24 * 3600_000;
/* "v1_" no começo do motivo: a versão da taxonomia que classificou. */
const prefixo = `v${VERSAO_TAXONOMIA}_`;

type Linha = {
  produto: string;
  nome: string;
  categoria_site: string;
  dominio_ml: string | null;
  categoria_ml_folha: string | null;
  categoria_ml_caminho: string | null;
};

export async function classificarCatalogo(db: Db, opcoes: { limite?: number | undefined } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const erros: string[] = [];
  const { data, error } = await t
    .from("em_alta_catalogo")
    .select("produto,nome,categoria_site,dominio_ml,categoria_ml_folha,categoria_ml_caminho")
    .or(`classificado_em.is.null,classificacao_motivo.not.like.${prefixo}*`)
    .order("atualizado_em", { ascending: false })
    .limit(Math.min(opcoes.limite ?? POR_EXECUCAO, 1000));
  if (error) return { ok: false, erro: String(error.message).slice(0, 120) };
  const linhas = (data ?? []) as Linha[];

  /* Caminhos de categoria já conhecidos (memória do agente). */
  const cats = new Map<string, string>();
  const folhas = [...new Set(linhas.map((l) => l.categoria_ml_folha).filter(Boolean))] as string[];
  if (folhas.length) {
    const { data: mem } = await t
      .from("em_alta_vistos")
      .select("chave,motivo,visto_em")
      .in(
        "chave",
        folhas.map((f) => `cat:${f}`),
      );
    for (const m of (mem ?? []) as Array<{
      chave: string;
      motivo: string | null;
      visto_em: string;
    }>)
      if (m.motivo && Date.now() - Date.parse(m.visto_em) < CATEGORIA_MS)
        cats.set(m.chave.slice(4), m.motivo);
  }
  const lembrar: Array<{ chave: string; motivo: string; visto_em: string }> = [];
  let consultas = 0;
  async function caminhoDe(cat: string): Promise<string | null> {
    if (cats.has(cat)) return cats.get(cat)!;
    if (consultas >= CONSULTAS) return null;
    consultas += 1;
    try {
      const c = await mlGet<{ path_from_root?: Array<{ name?: string }> }>(`/categories/${cat}`);
      const caminho = (c.path_from_root ?? [])
        .map((p) => p.name ?? "")
        .filter(Boolean)
        .join(" > ");
      if (caminho) {
        cats.set(cat, caminho);
        lembrar.push({ chave: `cat:${cat}`, motivo: caminho, visto_em: new Date().toISOString() });
      }
      return caminho || null;
    } catch (e) {
      erros.push(`categoria ${cat}: ${String((e as Error).message).slice(0, 60)}`);
      return null;
    }
  }

  const gravar: Array<Record<string, unknown>> = [];
  const contagem = { alta: 0, media: 0, baixa: 0, fora: 0, semDominio: 0 };
  for (const l of linhas) {
    let { dominio_ml: dominio, categoria_ml_folha: folha, categoria_ml_caminho: caminho } = l;
    if (!dominio && consultas < CONSULTAS) {
      consultas += 1;
      try {
        const r = await mlGet<Array<{ domain_id?: string; category_id?: string }>>(
          `/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(l.nome.slice(0, 120))}`,
        );
        dominio = r[0]?.domain_id ?? "-";
        folha = r[0]?.category_id ?? null;
      } catch (e) {
        erros.push(`dominio ${l.produto}: ${String((e as Error).message).slice(0, 60)}`);
      }
    }
    if (folha && !caminho) caminho = await caminhoDe(folha);
    /* Sem domínio ainda (teto de consultas): espera a próxima execução,
       para não classificar só pelo título o que o Mercado Livre sabe. */
    if (!dominio) {
      contagem.semDominio += 1;
      continue;
    }
    const r = classificar({
      nome: l.nome,
      dominio: dominio === "-" ? null : dominio,
      caminho,
      fonte: l.categoria_site,
    });
    contagem[r.no === "fora" ? "fora" : r.confianca] += 1;
    gravar.push({
      produto: l.produto,
      dominio_ml: dominio,
      categoria_ml_folha: folha,
      categoria_ml_caminho: caminho,
      categoria_no: r.no,
      confianca_categoria: r.confianca,
      classificacao_motivo: `${prefixo} ${r.motivo}`,
      /* Aba antiga segue a classificação (Weslei, 27/10: "Todos os 702"). */
      categoria_site: r.no === "fora" ? null : r.legado,
    });
  }

  for (let i = 0; i < gravar.length; i += 500) {
    const { error: e } = await t.rpc("gravar_classificacao", {
      p_linhas: gravar.slice(i, i + 500),
    });
    if (e) erros.push(`gravar: ${String(e.message).slice(0, 80)}`);
  }
  if (lembrar.length) {
    const { error: e } = await t.from("em_alta_vistos").upsert(lembrar, { onConflict: "chave" });
    if (e) erros.push(`memoria: ${String(e.message).slice(0, 80)}`);
  }
  return {
    ok: erros.length === 0,
    lidos: linhas.length,
    classificados: gravar.length,
    consultas,
    ...contagem,
    erros: erros.slice(0, 5),
  };
}
