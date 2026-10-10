/* COLETOR MULTI-MARKETPLACE (Weslei, 09/10). A partir do título do anúncio
   colado (sem ruído de venda), busca em paralelo na Amazon e na Shopee
   (Promise.allSettled, prazo de 10 s por loja: se uma cair, a outra e o
   Mercado Livre seguem). MESMA ANÁLISE EM CADA MARKETPLACE (Weslei, 09/10:
   "deve fazer a mesma analise em cada player e por fim comparar os 3"): de
   cada loja, até 4 candidatos (os 3 mais parecidos pelo título e o mais
   barato bem parecido, escolherCandidatos) vão para a MESMA conferência
   pela foto do comparador (conferirMesmoProduto, com a segunda
   conferência): só vira "mesmo" com o veredito de igual; parecido vai como
   parecido (com o que muda, qualidade e desvantagens); o resto é
   descartado. Sem conferência, nada entra. */
import { conferirMesmoProduto, pecaNoLugarDoAparelho } from "@/lib/conferir-produto";
import { amazonConfigurada, buscarNaAmazon } from "@/lib/integracoes/amazon";
import { buscarNaShopee, shopeeConfigurada } from "@/lib/integracoes/shopee";
import type { MarketplaceExterno, OfertaExterna } from "@/lib/integracoes/tipos";
import { termoDeBuscaExterna } from "@/lib/termo-busca-externa";

export { termoDeBuscaExterna };

export type LojaExterna = OfertaExterna & {
  relacao: "mesmo" | "parecido";
  muda: string | null;
  semelhanca: number | null;
  qualidade: string | null;
  qualidadeMotivo?: string | null;
  desvantagens?: string[] | null;
  mesmaFoto?: boolean | null;
};

/* O que cada marketplace leu e conferiu (a tela diz "li N, conferi M"). */
export type ResumoMarketplace = { lidas: number; conferidas: number; motivo: string | null };

/** Os candidatos de um marketplace para a conferência pela foto: na faixa
    de preço, sem peça no lugar do aparelho nem usado, os 3 mais parecidos
    pelo título e, entre os bem parecidos (>= 0,5), o mais barato que ainda
    não entrou. Igual à extensão (extensao/multiloja.js). */
export function escolherCandidatos<T extends { titulo: string; preco: number }>(
  lista: T[],
  original: { titulo: string; preco: number | null },
  n = 4,
): T[] {
  const notas = lista
    .filter((o) => o && o.titulo && Number.isFinite(o.preco) && o.preco > 0)
    .filter((o) => !RE_CONDICAO_RUIM.test(o.titulo))
    .filter((o) => !pecaNoLugarDoAparelho(original.titulo, o.titulo))
    .filter(
      (o) =>
        original.preco == null ||
        (o.preco >= original.preco * 0.3 && o.preco <= original.preco * 3),
    )
    .map((o) => ({ o, nota: parecencaDoTitulo(original.titulo, o.titulo) }))
    .filter((x) => x.nota >= 0.25)
    .sort((a, b) => b.nota - a.nota || a.o.preco - b.o.preco);
  const escolhidos = notas.slice(0, Math.max(0, n - 1));
  const barato = notas
    .filter((x) => x.nota >= 0.5 && !escolhidos.includes(x))
    .sort((a, b) => a.o.preco - b.o.preco)[0];
  const ultimo = barato ?? notas[n - 1];
  if (ultimo && escolhidos.length < n) escolhidos.push(ultimo);
  return escolhidos.map((x) => x.o);
}

const RE_CONDICAO_RUIM =
  /\b(usad[oa]s?|recondicionad[oa]s?|seminov[oa]s?|renovad[oa]s?|vitrine|open ?box|mostru[aá]rio)\b/i;

export const multilojaConfigurada = () => ({
  amazon: amazonConfigurada(),
  shopee: shopeeConfigurada(),
});

const palavras = (s: string) =>
  new Set(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 2),
  );

function parecencaDoTitulo(a: string, b: string) {
  const x = palavras(a);
  const y = palavras(b);
  if (!x.size || !y.size) return 0;
  let comum = 0;
  for (const p of x) if (y.has(p)) comum += 1;
  return comum / Math.min(x.size, y.size);
}

async function comPrazo<T>(p: Promise<T>, ms: number, nome: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, erro) => {
        t = setTimeout(() => erro(new Error(`${nome}: tempo esgotado`)), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export async function coletarMultiloja(titulo: string, prazo = 10_000) {
  const termo = termoDeBuscaExterna(titulo);
  const [amazon, shopee] = await Promise.allSettled([
    amazonConfigurada() ? comPrazo(buscarNaAmazon(termo, prazo - 500), prazo, "amazon") : [],
    shopeeConfigurada() ? comPrazo(buscarNaShopee(termo, prazo - 500), prazo, "shopee") : [],
  ]);
  const erros: string[] = [];
  const lista = (r: PromiseSettledResult<OfertaExterna[]>, nome: string) => {
    if (r.status === "fulfilled") return r.value;
    erros.push(`${nome}: ${String((r.reason as Error)?.message ?? r.reason).slice(0, 80)}`);
    return [];
  };
  return { termo, amazon: lista(amazon, "amazon"), shopee: lista(shopee, "shopee"), erros };
}

/** Coleta e confere pela foto contra o anúncio colado. */
export async function compararMultiloja(
  original: {
    titulo: string;
    imagem: string | null;
    preco: number | null;
    categoria: string | null;
    chave: string;
  },
  prazoColeta = 10_000,
) {
  const coleta = await coletarMultiloja(original.titulo, prazoColeta);
  const deAmazon = escolherCandidatos(coleta.amazon, original);
  const deShopee = escolherCandidatos(coleta.shopee, original);
  const candidatos = [...deAmazon, ...deShopee];
  const resumo: Record<MarketplaceExterno, ResumoMarketplace> = {
    amazon: { lidas: coleta.amazon.length, conferidas: deAmazon.length, motivo: null },
    shopee: { lidas: coleta.shopee.length, conferidas: deShopee.length, motivo: null },
  };
  if (!candidatos.length || !original.imagem)
    return { lojas: [] as LojaExterna[], resumo, ...coleta };
  const conf = await conferirMesmoProduto(
    {
      titulo: original.titulo,
      imagem: original.imagem,
      preco: original.preco,
      categoria: original.categoria,
      chave: original.chave,
    },
    candidatos.map((c) => ({
      titulo: c.titulo,
      imagem: c.imagem,
      preco: c.preco,
      chave: `${c.marketplace}:${c.id}`,
    })),
  );
  /* Sem conferência pela foto, nenhum outro marketplace entra. */
  if (!conf.ok) {
    coleta.erros.push(`conferencia: ${conf.erro.slice(0, 80)}`);
    return { lojas: [] as LojaExterna[], resumo, ...coleta };
  }
  const lojas: LojaExterna[] = [];
  candidatos.forEach((c, i) => {
    const av = conf.avaliacao.find((a) => a.indice === i);
    const mesmo = conf.iguais.includes(i);
    if (!mesmo && av?.parecido !== true) return;
    lojas.push({
      ...c,
      relacao: mesmo ? "mesmo" : "parecido",
      muda: mesmo ? null : (av?.motivo ?? null),
      semelhanca: av?.semelhanca ?? null,
      qualidade: av?.qualidade ?? null,
      qualidadeMotivo: mesmo ? null : (av?.qualidadeMotivo ?? null),
      desvantagens: mesmo ? null : (av?.desvantagens ?? null),
      mesmaFoto: av?.mesmaFoto ?? null,
    });
  });
  lojas.sort(
    (a, b) =>
      (a.relacao === "mesmo" ? 0 : 1) - (b.relacao === "mesmo" ? 0 : 1) || a.preco - b.preco,
  );
  return { lojas, resumo, ...coleta };
}

export const marketplacesDe = (l: LojaExterna[]) =>
  [...new Set(l.map((x) => x.marketplace))] as MarketplaceExterno[];
