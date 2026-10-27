/* PERFIL ANÔNIMO DO VISITANTE (Weslei, 05/10; motor de recomendação 27/10):
   o que a pessoa busca, abre e compra, para a vitrine mostrar primeiro o que
   combina com o gosto e a faixa de preço dela.

   - Só no navegador (localStorage "melhorescolha_perfil"); nada vai para o
     servidor nem para terceiros. Sem nome, e-mail, telefone, IP ou endereço:
     só pontos por categoria, termos e produtos recentes, preço médio e se a
     pessoa prefere frete grátis.
   - 27/10 (Weslei: "separar o rastreamento externo de analytics da
     inteligência interna de personalização"): é dado funcional local, como
     o histórico de buscas (me_historico_v1); não depende do consentimento de
     análise. "Limpar preferências" na vitrine apaga tudo na hora.
   - Armazenamento bloqueado (janela anônima, Safari restrito): o perfil vive
     só na memória da aba, sem erro na tela. */

import { useEffect } from "react";

import { classificar } from "@/lib/classificar";
import {
  ehPecaOuAcessorio,
  normalizar,
  type ProdutoConhecido,
  type Sugestao,
} from "@/lib/busca-sugestoes";
import { pareceFalso } from "@/lib/falsificado";

export type ProdutoInteragido = {
  chave: string;
  titulo: string;
  categoria: string | null;
  preco: number | null;
  foto: string | null;
  em: number;
};

export type PerfilVisitante = {
  versao: 2;
  idAnonimo: string;
  /** slug da categoria do site -> afinidade 0 a 100 (cai pela metade a cada 7 dias). */
  categorias: Record<string, number>;
  termosRecentes: { termo: string; em: number }[];
  ticketMedio: number;
  /** Quantos preços entraram na média (até 20: o gosto recente pesa mais). */
  precosNaMedia: number;
  produtosInteragidos: ProdutoInteragido[];
  sensivelAFreteGratis: boolean;
  atualizadoEm: number;
};

export type ProdutoDaAcao = {
  chave?: string | null;
  titulo: string;
  categoria?: string | null;
  preco?: number | null;
  foto?: string | null;
  freteGratis?: boolean | null;
};

export type AcaoVisitante =
  | {
      tipo: "busca";
      termo: string;
      /** Caminho/categoria do anúncio quando a busca foi por link. */
      categoria?: string | null;
      preco?: number | null;
      freteGratis?: boolean;
      /** Produto comparado (busca por link). */
      produto?: ProdutoDaAcao;
    }
  | { tipo: "categoria"; slug: string }
  | { tipo: "detalhes" | "compra"; produto: ProdutoDaAcao };

const CHAVE_PERFIL = "melhorescolha_perfil";
export const EVENTO_PERFIL = "perfil-visitante-atualizado";
const PESOS = { busca: 3, categoria: 2, detalhes: 4, compra: 5 } as const;
const MEIA_VIDA_MS = 7 * 24 * 3600 * 1000;
const MAX_TERMOS = 10;
const MAX_PRODUTOS = 20;
const MAX_PRECOS = 20;
const JANELA_REPETICAO_MS = 10 * 60 * 1000;

/* Perfil da aba quando o armazenamento não abre. */
let memoria: PerfilVisitante | null = null;

const idNovo = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

function vazio(agora: number): PerfilVisitante {
  return {
    versao: 2,
    idAnonimo: idNovo(),
    categorias: {},
    termosRecentes: [],
    ticketMedio: 0,
    precosNaMedia: 0,
    produtosInteragidos: [],
    sensivelAFreteGratis: false,
    atualizadoEm: agora,
  };
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* Formato estranho (versão 1, editado à mão) vira null em vez de quebrar a tela. */
function validar(p: Partial<PerfilVisitante> | null): PerfilVisitante | null {
  if (!p || p.versao !== 2 || typeof p.categorias !== "object" || !p.categorias) return null;
  const categorias: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.categorias)) {
    const n = num(v);
    if (n > 0) categorias[k] = Math.min(100, n);
  }
  return {
    versao: 2,
    idAnonimo: typeof p.idAnonimo === "string" ? p.idAnonimo : idNovo(),
    categorias,
    termosRecentes: Array.isArray(p.termosRecentes)
      ? p.termosRecentes.filter((t) => typeof t?.termo === "string").slice(0, MAX_TERMOS)
      : [],
    ticketMedio: num(p.ticketMedio),
    precosNaMedia: num(p.precosNaMedia),
    produtosInteragidos: Array.isArray(p.produtosInteragidos)
      ? p.produtosInteragidos.filter((x) => typeof x?.titulo === "string").slice(0, MAX_PRODUTOS)
      : [],
    sensivelAFreteGratis: p.sensivelAFreteGratis === true,
    atualizadoEm: num(p.atualizadoEm) || Date.now(),
  };
}

/** Afinidade de categoria cai pela metade a cada 7 dias sem uso. */
export function comDecaimento(p: PerfilVisitante, agora: number): PerfilVisitante {
  const fator = Math.pow(0.5, Math.max(0, agora - p.atualizadoEm) / MEIA_VIDA_MS);
  if (fator >= 0.999) return p;
  const categorias: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.categorias)) {
    const n = Math.round(v * fator * 100) / 100;
    if (n >= 0.5) categorias[k] = n;
  }
  return { ...p, categorias };
}

function ler(): PerfilVisitante | null {
  if (typeof window === "undefined") return null;
  try {
    const salvo = window.localStorage.getItem(CHAVE_PERFIL);
    return salvo ? validar(JSON.parse(salvo) as Partial<PerfilVisitante>) : null;
  } catch {
    return memoria;
  }
}

function avisar() {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_PERFIL));
  } catch {
    /* sem CustomEvent (navegador muito antigo): os componentes leem na próxima montagem */
  }
}

function gravar(p: PerfilVisitante) {
  memoria = p;
  try {
    window.localStorage.setItem(CHAVE_PERFIL, JSON.stringify(p));
  } catch {
    /* armazenamento bloqueado: fica na memória da aba */
  }
  avisar();
}

export function obterPerfil(agora = Date.now()): PerfilVisitante | null {
  const p = ler();
  return p ? comDecaimento(p, agora) : null;
}

/** O visitante já fez algo que diga o gosto dele? */
export const temInteracoes = (p: PerfilVisitante | null): p is PerfilVisitante =>
  !!p &&
  (p.produtosInteragidos.length > 0 ||
    p.termosRecentes.length > 0 ||
    Object.keys(p.categorias).length > 0);

/* Categoria do site (slug antigo das abas: eletronicos, casa...) pelo título
   e, quando houver, pelo caminho do anúncio. Memória por título: a vitrine
   classifica centenas de produtos a cada leitura. */
const cacheCategoria = new Map<string, string | null>();
export function categoriaDoTitulo(titulo: string, caminho?: string | null): string | null {
  const k = `${titulo}|${caminho ?? ""}`;
  if (!cacheCategoria.has(k)) {
    if (cacheCategoria.size > 3000) cacheCategoria.clear();
    cacheCategoria.set(k, classificar({ nome: titulo, caminho: caminho ?? null }).legado);
  }
  return cacheCategoria.get(k) ?? null;
}

const precoValido = (n: number | null | undefined): n is number =>
  n != null && Number.isFinite(n) && n > 0;

function somarCategoria(p: PerfilVisitante, slug: string | null, pontos: number) {
  if (!slug) return;
  p.categorias[slug] = Math.min(100, (p.categorias[slug] ?? 0) + pontos);
}

function somarPreco(p: PerfilVisitante, preco: number | null | undefined) {
  if (!precoValido(preco)) return;
  const n = Math.min(p.precosNaMedia, MAX_PRECOS - 1);
  p.ticketMedio = Math.round(((p.ticketMedio * n + preco) / (n + 1)) * 100) / 100;
  p.precosNaMedia = n + 1;
}

function lembrarTermo(p: PerfilVisitante, termo: string, agora: number) {
  const t = termo.trim().slice(0, 120);
  if (t.length < 2) return;
  const n = normalizar(t);
  p.termosRecentes = [
    { termo: t, em: agora },
    ...p.termosRecentes.filter((x) => normalizar(x.termo) !== n),
  ].slice(0, MAX_TERMOS);
}

function lembrarProduto(
  p: PerfilVisitante,
  prod: ProdutoDaAcao,
  slug: string | null,
  agora: number,
) {
  const chave = prod.chave || normalizar(prod.titulo);
  p.produtosInteragidos = [
    {
      chave,
      titulo: prod.titulo.slice(0, 200),
      categoria: slug,
      preco: precoValido(prod.preco) ? prod.preco : null,
      foto: prod.foto ?? null,
      em: agora,
    },
    ...p.produtosInteragidos.filter((x) => x.chave !== chave),
  ].slice(0, MAX_PRODUTOS);
}

/** Captura de um sinal do visitante (busca, categoria, detalhes, compra). */
export function registrarAcaoVisitante(acao: AcaoVisitante, agora = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    const p = obterPerfil(agora) ?? vazio(agora);
    if (acao.tipo === "categoria") {
      somarCategoria(p, acao.slug, PESOS.categoria);
    } else if (acao.tipo === "busca") {
      const titulo = acao.produto?.titulo ?? acao.termo;
      const slug = acao.produto?.categoria ?? categoriaDoTitulo(titulo, acao.categoria);
      somarCategoria(p, slug, PESOS.busca);
      lembrarTermo(p, acao.termo, agora);
      somarPreco(p, acao.preco ?? acao.produto?.preco);
      if (acao.produto) lembrarProduto(p, acao.produto, slug, agora);
      if (acao.freteGratis) p.sensivelAFreteGratis = true;
    } else {
      const prod = acao.produto;
      if (!prod.titulo) return;
      const slug = prod.categoria ?? categoriaDoTitulo(prod.titulo);
      somarCategoria(p, slug, PESOS[acao.tipo]);
      somarPreco(p, prod.preco);
      lembrarProduto(p, prod, slug, agora);
      /* Comprar algo com frete grátis confirmado diz a preferência. */
      if (acao.tipo === "compra" && prod.freteGratis === true) p.sensivelAFreteGratis = true;
    }
    p.atualizadoEm = agora;
    gravar(p);
  } catch {
    /* perfil é extra: nunca atrapalha a navegação */
  }
}

export function limparPerfil(): void {
  if (typeof window === "undefined") return;
  memoria = null;
  try {
    window.localStorage.removeItem(CHAVE_PERFIL);
  } catch {
    /* ignora */
  }
  avisar();
}

/** Categoria com mais afinidade (pelo menos uma visita ativa: 2 pontos). */
export function categoriaFavorita(perfil: PerfilVisitante | null): string | null {
  if (!perfil) return null;
  let melhor: string | null = null;
  let maior = 1.99;
  for (const [slug, n] of Object.entries(perfil.categorias)) {
    if (n > maior) {
      maior = n;
      melhor = slug;
    }
  }
  return melhor;
}

/* Palavras que não dizem o produto. */
const VAZIAS = new Set(
  "de da do das dos para com sem e o a os as em no na um uma kit novo nova original".split(" "),
);
const palavrasDe = (s: string) =>
  normalizar(s)
    .split(" ")
    .filter((w) => w.length >= 2 && !VAZIAS.has(w));

export type ItemRecomendavel = {
  chave?: string | null;
  titulo: string;
  categoria_site?: string | null;
  preco?: number | null;
  freteGratis?: boolean | null;
};

/** Pontuação 0 a 100 de um item para o perfil: categoria 40, palavras 35,
    faixa de preço 15, frete grátis 10. */
export function pontuarItem(item: ItemRecomendavel, perfil: PerfilVisitante): number {
  const slug =
    item.categoria_site && item.categoria_site !== "outros"
      ? item.categoria_site
      : categoriaDoTitulo(item.titulo);
  const maxCat = Math.max(0, ...Object.values(perfil.categorias));
  const cat = slug && maxCat > 0 ? (perfil.categorias[slug] ?? 0) / maxCat : 0;

  /* Termo recente com mais palavras no título; o mais novo pesa mais. */
  const titulo = new Set(palavrasDe(item.titulo));
  let pal = 0;
  perfil.termosRecentes.forEach((t, k) => {
    const ws = palavrasDe(t.termo).slice(0, 8);
    if (!ws.length) return;
    const casadas = ws.filter((w) => titulo.has(w)).length;
    pal = Math.max(pal, (casadas / ws.length) * Math.pow(0.9, k));
  });

  const preco = item.preco;
  const faixa =
    perfil.ticketMedio > 0 && precoValido(preco)
      ? Math.abs(preco - perfil.ticketMedio) <= perfil.ticketMedio * 0.35
        ? 1
        : 0
      : 0;
  const frete = perfil.sensivelAFreteGratis && item.freteGratis === true ? 1 : 0;
  return cat * 40 + pal * 35 + faixa * 15 + frete * 10;
}

/** Vitrine reordenada para o visitante: só itens com alguma afinidade, do
    mais aderente ao menos. Produto que ele já viu/comparou nos últimos 10
    minutos sai, abrindo espaço para os parecidos (que sobem pelas mesmas
    palavras e categoria). Sem perfil, lista vazia. */
export function calcularRecomendados<T extends ItemRecomendavel>(
  catalogo: T[],
  perfil: PerfilVisitante | null,
  agora = Date.now(),
): T[] {
  if (!temInteracoes(perfil)) return [];
  const recentes = perfil.produtosInteragidos.filter((x) => agora - x.em < JANELA_REPETICAO_MS);
  const vistoAgora = (i: T) =>
    recentes.some(
      (r) => (i.chave && r.chave === i.chave) || normalizar(r.titulo) === normalizar(i.titulo),
    );
  const vistos = new Set<string>();
  return catalogo
    .filter((i) => {
      const k = normalizar(i.titulo);
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return !vistoAgora(i);
    })
    .map((i, k) => ({ i, k, p: pontuarItem(i, perfil) }))
    .filter((x) => x.p >= 15)
    .sort((a, b) => b.p - a.p || a.k - b.k)
    .map((x) => x.i);
}

/** Atributo do cartão que diz ao clique de compra qual é o produto. */
export const atributoProduto = (prod: ProdutoDaAcao) => ({
  "data-perfil-produto": JSON.stringify(prod),
});

/** Escuta, na página toda, cliques de compra dentro de um cartão marcado
    com atributoProduto: link de afiliado ou o "Comprar com segurança" que
    gera o link no clique (botao-seguro). É a intenção mais forte (+5). */
export function ouvirComprasDoVisitante(ehCompra: (href: string) => boolean): () => void {
  let ultimo = { k: "", em: 0 };
  const aoClicar = (ev: MouseEvent) => {
    const alvo = (ev.target as Element | null)?.closest?.("a[href], button.botao-seguro");
    if (!alvo || (alvo instanceof HTMLAnchorElement && !ehCompra(alvo.href))) return;
    const bruto = (alvo.closest("[data-perfil-produto]") as HTMLElement | null)?.dataset[
      "perfilProduto"
    ];
    if (!bruto) return;
    /* Gerar o link e abri-lo logo depois é a mesma compra. */
    if (ultimo.k === bruto && Date.now() - ultimo.em < 30_000) return;
    ultimo = { k: bruto, em: Date.now() };
    try {
      const produto = JSON.parse(bruto) as ProdutoDaAcao;
      if (typeof produto?.titulo === "string") registrarAcaoVisitante({ tipo: "compra", produto });
    } catch {
      /* atributo estragado: ignora */
    }
  };
  document.addEventListener("click", aoClicar, { capture: true });
  return () => document.removeEventListener("click", aoClicar, { capture: true });
}

/** Visita a uma página de categoria (+2), uma vez por slug aberto. */
export function useVisitaCategoria(slug: string | null | undefined) {
  useEffect(() => {
    if (slug) registrarAcaoVisitante({ tipo: "categoria", slug });
  }, [slug]);
}

/** Campo de busca vazio: os últimos termos do visitante e 2 produtos da
    categoria favorita (ou os 2 mais aderentes, sem favorita). */
export function sugestoesDoPerfil(
  perfil: PerfilVisitante | null,
  produtos: ProdutoConhecido[],
  agora = Date.now(),
): Sugestao[] {
  if (!temInteracoes(perfil)) return [];
  const termos = perfil.termosRecentes
    .slice(0, 5)
    .map((t): Sugestao => ({ tipo: "historico", texto: t.termo }));
  const favorita = categoriaFavorita(perfil);
  const candidatos = produtos
    .filter((p) => !pareceFalso(p.titulo) && !ehPecaOuAcessorio(p.titulo))
    .map((p) => ({ ...p, chave: p.url }));
  const recomendados = calcularRecomendados(candidatos, perfil, agora)
    .filter((p) => !favorita || categoriaDoTitulo(p.titulo) === favorita)
    .slice(0, 2)
    .map((p): Sugestao => ({
      tipo: "recomendado",
      texto: p.titulo,
      url: p.url,
      imagem: p.imagem,
      preco: p.preco,
    }));
  return [...termos, ...recomendados];
}
