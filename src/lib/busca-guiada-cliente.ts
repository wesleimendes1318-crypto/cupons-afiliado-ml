/* Busca guiada no navegador (05/10; separada em 10/10 para o
   reconhecimento de links de outras lojas usar a mesma busca). */

export type Resultado = {
  produto: string;
  item: string;
  nome: string;
  imagem: string | null;
  preco: number | null;
  url: string;
};

export type Resposta = {
  resumo: string;
  buscas: string[];
  resultados: Resultado[];
  enfileirados: number;
  lidoEm?: string;
};

/** "agora" ou "às 14:05" (horário de Brasília): a busca fica guardada até
    6 h e o preço do cartão é o daquele momento. */
export function quandoFoiLido(lidoEm: string | undefined, agora = Date.now()): string {
  const t = lidoEm ? Date.parse(lidoEm) : NaN;
  if (!Number.isFinite(t) || agora - t < 10 * 60_000) return "agora";
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(t);
  return agora - t < 20 * 3_600_000 ? `às ${hora}` : "há mais de um dia";
}

export type ContextoBusca = "home" | "natal" | "criancas";

/* Busca no catálogo oficial (a mesma da busca guiada). Também usada pelo
   reconhecimento de links de outras lojas (LinkDeOutraLoja). */
export async function buscarProdutos(
  pergunta: string,
  contexto: ContextoBusca = "home",
): Promise<{ resposta: Resposta | null; erro: string | null }> {
  try {
    const r = await fetch("/api/public/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: pergunta.slice(0, 160), contexto }),
    });
    const j = (await r.json()) as Resposta & { erro?: string };
    if (!r.ok || j.erro)
      return { resposta: null, erro: j.erro ?? "A busca não respondeu agora. Tente de novo." };
    return { resposta: j, erro: null };
  } catch {
    return { resposta: null, erro: "Sem conexão agora. Tente de novo." };
  }
}
