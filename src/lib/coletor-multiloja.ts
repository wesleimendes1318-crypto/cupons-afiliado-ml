/* COLETOR MULTI-MARKETPLACE (Weslei, 09/10). A partir do título do anúncio
   colado (sem ruído de venda), busca em paralelo na Amazon e na Shopee
   (Promise.allSettled, prazo de 10 s por loja: se uma cair, a outra e o
   Mercado Livre seguem). Dos achados, os 2 mais parecidos pelo título de
   cada loja vão para a MESMA conferência pela foto do comparador
   (conferirMesmoProduto): só vira "mesmo" com o veredito de igual; parecido
   vai como parecido (com o que muda); o resto é descartado. Sem
   conferência (IA fora do ar), nada entra. */
import { conferirMesmoProduto, pecaNoLugarDoAparelho } from "@/lib/conferir-produto";
import { amazonConfigurada, buscarNaAmazon } from "@/lib/integracoes/amazon";
import { buscarNaShopee, shopeeConfigurada } from "@/lib/integracoes/shopee";
import type { MarketplaceExterno, OfertaExterna } from "@/lib/integracoes/tipos";

export type LojaExterna = OfertaExterna & {
  relacao: "mesmo" | "parecido";
  muda: string | null;
  semelhanca: number | null;
  qualidade: string | null;
};

export const multilojaConfigurada = () => ({
  amazon: amazonConfigurada(),
  shopee: shopeeConfigurada(),
});

const RUIDO =
  /\b(original|originais|lacrad[oa]s?|novo|nova|lan[cç]amento|promo[cç][aã]o|oferta|frete gr[aá]tis|envio (imediato|r[aá]pido)|pronta entrega|nota fiscal|com nf|nf|garantia|12x|sem juros|super|top|premium|melhor pre[cç]o|barato)\b/gi;

/** Título do anúncio em termo de busca limpo (até 8 palavras). */
export function termoDeBuscaExterna(titulo: string) {
  return titulo
    .replace(RUIDO, " ")
    .replace(/[^\p{L}\p{N}\s.,/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

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
  const escolher = (l: OfertaExterna[]) =>
    l
      .filter((o) => !pecaNoLugarDoAparelho(original.titulo, o.titulo))
      .filter(
        (o) =>
          original.preco == null ||
          (o.preco >= original.preco * 0.3 && o.preco <= original.preco * 3),
      )
      .map((o) => ({ o, nota: parecencaDoTitulo(original.titulo, o.titulo) }))
      .filter((x) => x.nota >= 0.25)
      .sort((a, b) => b.nota - a.nota)
      .slice(0, 2)
      .map((x) => x.o);
  const candidatos = [...escolher(coleta.amazon), ...escolher(coleta.shopee)];
  if (!candidatos.length || !original.imagem) return { lojas: [] as LojaExterna[], ...coleta };
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
    return { lojas: [] as LojaExterna[], ...coleta };
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
    });
  });
  lojas.sort(
    (a, b) =>
      (a.relacao === "mesmo" ? 0 : 1) - (b.relacao === "mesmo" ? 0 : 1) || a.preco - b.preco,
  );
  return { lojas, ...coleta };
}

export const marketplacesDe = (l: LojaExterna[]) =>
  [...new Set(l.map((x) => x.marketplace))] as MarketplaceExterno[];
