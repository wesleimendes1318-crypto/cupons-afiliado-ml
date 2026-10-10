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
};

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
