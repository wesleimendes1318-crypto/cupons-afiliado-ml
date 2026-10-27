/* BUSCA UNIVERSAL (Weslei, 27/10: "busca universal inteligente, autocomplete
   em tempo real"). Sugestões enquanto a pessoa digita, só com o que o site JÁ
   tem (nada de rede aqui): histórico do aparelho, produtos já comparados
   (vitrine), catálogo em alta e a árvore de categorias. A partir de 2
   letras; link colado não tem sugestão (o selo da loja aparece no lugar).

   Regras: o produto mais próximo das palavras digitadas vem primeiro (marca
   e modelo exatos: "echo dot 5" não traz "Echo Pop"), e peça/acessório só
   aparece quando a busca é pela peça (capinha, carcaça, tela, refil nunca
   entram como o aparelho buscado: RE_PECA_PARTE). */

import { ACESSORIO, NOS, ORDEM } from "@/content/taxonomia";
import { analisarLink } from "@/lib/analisar-link";
import { RE_PECA_PARTE } from "@/lib/conferir-produto";
import { termoDoProduto } from "@/lib/termo-busca";
import { pareceFalso } from "@/lib/falsificado";

export const MIN_CARACTERES = 2;

export type ProdutoConhecido = {
  titulo: string;
  imagem: string | null;
  preco: number | null;
  url: string;
  /** Link de afiliado guardado do anúncio (vitrine). */
  link?: string | null;
  /** Link da melhor loja na comparação (outro marketplace = "2+ lojas"). */
  outroLink?: string | null;
  /** Quando o preço foi lido. */
  vistoEm?: string | null;
  freteGratis?: boolean | null;
};

export type RecenteConhecido = { titulo: string; url: string; imagem: string | null };

export type Sugestao =
  | { tipo: "recente"; texto: string; url: string; imagem: string | null }
  | { tipo: "termo"; texto: string }
  /* Campo vazio (27/10): últimos termos do perfil local e recomendados. */
  | { tipo: "historico"; texto: string }
  | { tipo: "recomendado"; texto: string; url: string; imagem: string | null; preco: number | null }
  | { tipo: "produto"; texto: string; url: string; imagem: string | null; preco: number | null }
  | { tipo: "categoria"; texto: string; slug: string };

/** Minúsculas, sem acento nem pontuação; "5ª" e "5a" viram "5". */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d)\s*[ªºao]\b/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const palavras = (s: string) => normalizar(s).split(" ").filter(Boolean);

/** A busca é pela peça/acessório? (aí a capinha pode aparecer). */
export function buscaDeAcessorio(consulta: string): boolean {
  const n = normalizar(consulta);
  return (
    ACESSORIO.test(n) ||
    RE_PECA_PARTE.test(consulta) ||
    /\b(capas?|capinhas?|cases?|peliculas?|carcacas?|telas?|display|refil|refis|pecas?|suportes?|cabos?|carregador(es)?|controles?|tampas?)\b/.test(
      n,
    )
  );
}

/** Peça, carcaça, tela avulsa, refil ou acessório no lugar do aparelho. */
export function ehPecaOuAcessorio(titulo: string): boolean {
  return RE_PECA_PARTE.test(titulo) || ACESSORIO.test(normalizar(titulo));
}

/** Pontuação do título para a consulta; null quando falta alguma palavra.
    A última palavra vale pelo começo (a pessoa ainda está digitando); as
    outras também, menos as que têm número (modelo: "5" não casa com "50"). */
export function pontuar(consulta: string, titulo: string): number | null {
  const q = palavras(consulta);
  const t = palavras(titulo);
  if (!q.length || !t.length) return null;
  let soma = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i]!;
    const ultima = i === q.length - 1;
    const pos = t.findIndex((w) =>
      w === p ? true : !ultima && /\d/.test(p) ? false : w.startsWith(p),
    );
    if (pos < 0) return null;
    soma += (t[pos] === p ? 3 : 2) - Math.min(pos, 10) * 0.1;
  }
  const comeca = normalizar(titulo).startsWith(normalizar(consulta)) ? 4 : 0;
  return soma + comeca - t.length * 0.05;
}

/** Ordena pela intenção: o mais próximo das palavras digitadas na frente
    e, se a busca não é pela peça, peça/acessório fora. Estável para os
    empatados (mantém a ordem de quem chamou). */
export function ordenarPelaIntencao<T>(consulta: string, itens: T[], nome: (i: T) => string): T[] {
  const acessorio = buscaDeAcessorio(consulta);
  const q = palavras(consulta);
  return itens
    .filter((i) => acessorio || !ehPecaOuAcessorio(nome(i)))
    .map((i, k) => {
      const t = new Set(palavras(nome(i)));
      /* Todas as palavras com número (modelo) presentes valem mais que o resto. */
      const modelo = q.filter((p) => /\d/.test(p)).every((p) => t.has(p)) ? 1 : 0;
      const casadas = q.filter((p) => t.has(p)).length;
      return { i, k, modelo, casadas };
    })
    .sort((a, b) => b.modelo - a.modelo || b.casadas - a.casadas || a.k - b.k)
    .map((x) => x.i);
}

function melhores<T>(consulta: string, itens: T[], texto: (i: T) => string, limite: number) {
  return itens
    .map((i) => ({ i, p: pontuar(consulta, texto(i)) }))
    .filter((x): x is { i: T; p: number } => x.p != null)
    .sort((a, b) => b.p - a.p)
    .slice(0, limite)
    .map((x) => x.i);
}

/** Produtos já conhecidos (vitrine e em alta) que casam com todas as
    palavras da busca: a resposta imediata da busca por texto (27/10). Sem
    repetidos, sem falso e sem peça quando a busca é pelo aparelho. */
export function produtosDaBusca(
  consulta: string,
  produtos: ProdutoConhecido[],
  limite = 16,
): ProdutoConhecido[] {
  const acessorio = buscaDeAcessorio(consulta);
  const vistos = new Set<string>();
  const unicos = produtos.filter((p) => {
    const chave = normalizar(p.titulo ?? "");
    if (!chave || !p.url || vistos.has(chave) || pareceFalso(p.titulo)) return false;
    if (!acessorio && ehPecaOuAcessorio(p.titulo)) return false;
    vistos.add(chave);
    return true;
  });
  return melhores(consulta, unicos, (p) => p.titulo, limite);
}

/** Sugestões para o que está digitado, na ordem da lista: recentes, buscas
    sugeridas, produtos e categorias. */
export function obterSugestoes(
  termo: string,
  fontes: { produtos?: ProdutoConhecido[]; recentes?: RecenteConhecido[] } = {},
): Sugestao[] {
  const consulta = termo.trim();
  if (normalizar(consulta).length < MIN_CARACTERES) return [];
  if (analisarLink(consulta).origem !== "invalido") return [];
  const acessorio = buscaDeAcessorio(consulta);
  const aceito = (titulo: string) => acessorio || !ehPecaOuAcessorio(titulo);

  const recentes = melhores(
    consulta,
    (fontes.recentes ?? []).filter((r) => r.titulo && aceito(r.titulo)),
    (r) => r.titulo,
    2,
  ).map((r): Sugestao => ({ tipo: "recente", texto: r.titulo, url: r.url, imagem: r.imagem }));

  const vistos = new Set<string>();
  const produtosUnicos = (fontes.produtos ?? []).filter((p) => {
    const chave = normalizar(p.titulo);
    if (!p.titulo || !p.url || vistos.has(chave) || !aceito(p.titulo)) return false;
    vistos.add(chave);
    return true;
  });
  const casados = melhores(consulta, produtosUnicos, (p) => p.titulo, 12);

  /* Buscas sugeridas: o nome curto (tipo, marca, modelo) dos produtos que
     casam, completando o que foi digitado. */
  const termos: Sugestao[] = [];
  const termosVistos = new Set([normalizar(consulta)]);
  for (const p of casados) {
    const t = termoDoProduto(p.titulo, 4);
    const n = normalizar(t);
    if (!n || termosVistos.has(n) || pontuar(consulta, t) == null) continue;
    termosVistos.add(n);
    termos.push({ tipo: "termo", texto: t });
    if (termos.length >= 3) break;
  }

  const produtos = casados.slice(0, 4).map((p): Sugestao => ({
    tipo: "produto",
    texto: p.titulo,
    url: p.url,
    imagem: p.imagem,
    preco: p.preco,
  }));

  const categorias = melhores(
    consulta,
    ORDEM.map((s) => NOS[s]!).sort((a, b) => a.nivel - b.nivel),
    (n) => n.nome,
    3,
  ).map((n): Sugestao => ({ tipo: "categoria", texto: n.nome, slug: n.slug }));

  return [...recentes, ...termos, ...produtos, ...categorias];
}
