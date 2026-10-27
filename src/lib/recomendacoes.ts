/* TRILHOS DE RECOMENDAÇÃO DA HOME (Weslei, 27/10: "6 módulos de inteligência
   de recomendação"). Seleção pura, sem rede: recebe os mais vendidos que o
   site já lê (em_alta_catalogo), as notas lidas nos anúncios e o perfil local
   do visitante (src/lib/perfil-visitante.ts). Nada é inventado: sem nota lida,
   a nota não conta; "recompra" é produto de reposição (categoria de consumo)
   entre os mais vendidos ou muito bem avaliado, não uma taxa medida. */

import type { ItemEmAlta } from "@/components/EmAltaCatalogo";
import { NOS, subarvore } from "@/content/taxonomia";
import type { ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";
import { ehPecaOuAcessorio, normalizar } from "@/lib/busca-sugestoes";
import { classificar } from "@/lib/classificar";
import { RE_PECA_PARTE } from "@/lib/conferir-produto";
import { pareceFalso } from "@/lib/falsificado";
import {
  categoriaFavorita,
  palavrasDe,
  pontuarItem,
  type PerfilVisitante,
} from "@/lib/perfil-visitante";
import {
  NOTA_MINIMA,
  SELO_NOTA,
  SELO_TOTAL,
  reprovadaPelaAvaliacao,
} from "@/lib/qualidade-avaliacao";
import { combinaComTemporada, type Temporada } from "@/lib/sazonal";

export type ItemRec = ItemEmAlta & { categoria_no?: string | null };
export type NotaDe = (i: ItemRec) => ResumoAvaliacoes | undefined;

const POR_TRILHO = 12;
const RE_USADO = /\b(usad[oa]s?|seminov[oa]s?|recondicionad[oa]s?|vitrine|sem caixa|open box)\b/i;

/* Nós de reposição frequente (higiene, beleza de uso diário, limpeza, pet,
   mercado, fraldas, suplementos). */
export const NOS_RECOMPRA = [
  "higiene-pessoal",
  "shampoos",
  "mascaras-capilares",
  "cuidados-corporais",
  "cuidados-faciais",
  "protetores-solares",
  "perfumes",
  "produtos-de-limpeza",
  "lavanderia-produtos",
  "descartaveis",
  "fraldas",
  "lencos-umedecidos",
  "suplementos",
  "pet",
  "mercado",
].flatMap((s) => (NOS[s] ? subarvore(s) : []));

/* Complementos de cada categoria do site (as abas da vitrine). */
export const COMPLEMENTOS: Record<string, string[]> = {
  celulares: ["fones-bluetooth", "fones-tws", "carregadores", "power-banks", "smartwatches"],
  eletronicos: [
    "fones-bluetooth",
    "caixas-bluetooth",
    "power-banks",
    "suportes-de-tv",
    "cabos-usb",
  ],
  informatica: ["mouses", "teclados", "hubs-usb", "acessorios-notebook", "mousepads", "webcams"],
  eletrodomesticos: [
    "airfryers",
    "organizadores-de-cozinha",
    "liquidificadores",
    "utensilios-de-cozinha",
  ],
  casa: ["organizadores-de-cozinha", "caixas-organizadoras", "airfryers", "utensilios-de-cozinha"],
  moda: ["relogios", "bolsas", "mochilas", "oculos", "perfumes"],
  beleza: ["secadores", "chapinhas-e-escovas", "cuidados-faciais", "perfumes"],
  ferramentas: ["acessorios-de-ferramentas", "ferramentas-manuais", "medicao", "epi"],
  automotivo: [
    "acessorios-internos",
    "limpeza-automotiva",
    "suportes-de-celular",
    "ferramentas-automotivas",
  ],
  brinquedos: ["jogos-de-tabuleiro", "blocos-de-montar", "jogos-educativos", "pilhas-e-baterias"],
};

/* Nó pelo título, com memória (cada trilho reavalia centenas de nomes). */
const noPorTitulo = new Map<string, string>();
const noPeloTitulo = (nome: string) => {
  let no = noPorTitulo.get(nome);
  if (no == null) {
    if (noPorTitulo.size > 5000) noPorTitulo.clear();
    no = classificar({ nome }).no;
    noPorTitulo.set(nome, no);
  }
  return no;
};

export const noDoItem = (i: ItemRec) =>
  i.categoria_no && NOS[i.categoria_no] ? i.categoria_no : noPeloTitulo(i.nome);

const nota = (r: ResumoAvaliacoes | undefined) => r?.avaliacoes ?? null;
const muitoBemAvaliado = (r: ResumoAvaliacoes | undefined) => {
  const a = nota(r);
  return !!a && a.nota >= SELO_NOTA && a.total >= SELO_TOTAL;
};
const notaBoa = (r: ResumoAvaliacoes | undefined) => (nota(r)?.nota ?? 0) >= NOTA_MINIMA;

const paraPontuar = (i: ItemRec) => ({
  chave: i.produto,
  titulo: i.nome,
  categoria_site: i.categoria_site,
  preco: Number(i.preco),
  freteGratis: i.frete_gratis,
});

/** Base comum: sem falso, usado, peça no lugar do aparelho, nota reprovada
    ou repetido; ordena bem avaliados e aderentes ao perfil primeiro. */
function filtrarOrdenar(
  itens: ItemRec[],
  notaDe: NotaDe,
  perfil: PerfilVisitante | null,
  aceita: (i: ItemRec) => boolean,
  /* Complementos SÃO acessórios (carregador, suporte): só a peça avulsa sai. */
  aceitaAcessorio = false,
): ItemRec[] {
  const vistos = new Set<string>();
  return itens
    .filter((i) => {
      const k = normalizar(i.nome);
      if (!k || vistos.has(k) || !i.url) return false;
      vistos.add(k);
      return (
        !pareceFalso(i.nome) &&
        /* "fora" do site: digital, tela/peça compatível, adulto. */
        noPeloTitulo(i.nome) !== "fora" &&
        !RE_USADO.test(i.nome) &&
        !(aceitaAcessorio ? RE_PECA_PARTE.test(i.nome) : ehPecaOuAcessorio(i.nome)) &&
        !reprovadaPelaAvaliacao(notaDe(i)) &&
        aceita(i)
      );
    })
    .map((i, k) => ({
      i,
      k,
      boa: notaBoa(notaDe(i)) ? 1 : 0,
      p: perfil ? pontuarItem(paraPontuar(i), perfil) : 0,
    }))
    .sort((a, b) => b.boa - a.boa || b.p - a.p || a.k - b.k)
    .map((x) => x.i)
    .slice(0, POR_TRILHO);
}

/** 1. Recompra: reposição entre os mais vendidos (top 20) ou muito bem
    avaliada (4,8+ com 50+ avaliações lidas). */
export function selecionarRecompra(
  itens: ItemRec[],
  notaDe: NotaDe,
  perfil: PerfilVisitante | null,
) {
  const nos = new Set(NOS_RECOMPRA);
  return filtrarOrdenar(
    itens,
    notaDe,
    perfil,
    (i) =>
      nos.has(noDoItem(i)) &&
      (muitoBemAvaliado(notaDe(i)) || (i.posicao != null && i.posicao <= 20)),
  );
}

/** Nós dos produtos e termos recentes do visitante (o "tipo" que ele procura). */
export function nosDoVisitante(perfil: PerfilVisitante | null): string[] {
  if (!perfil) return [];
  const nos = [
    ...perfil.produtosInteragidos.map((p) => noPeloTitulo(p.titulo)),
    ...perfil.termosRecentes.map((t) => noPeloTitulo(t.termo)),
  ].filter((n) => n !== "fora" && NOS[n]);
  return nos;
}

/** Nós complementares à categoria favorita, sem o tipo que ele já busca. */
export function nosComplementares(perfil: PerfilVisitante | null): string[] {
  const fav = categoriaFavorita(perfil);
  if (!fav || !COMPLEMENTOS[fav]) return [];
  const proprios = new Set(nosDoVisitante(perfil));
  return COMPLEMENTOS[fav].filter((s) => NOS[s] && !proprios.has(s)).flatMap((s) => subarvore(s));
}

/** 2. Você também pode se interessar: complementos, frete grátis primeiro. */
export function selecionarComplementos(
  itens: ItemRec[],
  notaDe: NotaDe,
  perfil: PerfilVisitante | null,
) {
  const nos = new Set(nosComplementares(perfil));
  if (!nos.size) return [];
  const lista = filtrarOrdenar(itens, notaDe, perfil, (i) => nos.has(noDoItem(i)), true);
  return [...lista.filter((i) => i.frete_gratis), ...lista.filter((i) => !i.frete_gratis)];
}

/** Nicho do visitante para "Pensados para você em ...": o nó de 2º nível
    mais frequente entre o que ele viu e buscou (volume suficiente). */
export function nichoDoVisitante(perfil: PerfilVisitante | null): string | null {
  const contagem = new Map<string, number>();
  for (const n of nosDoVisitante(perfil)) {
    const c = NOS[n]!.caminho;
    const nicho = c[1] ?? c[0]!;
    contagem.set(nicho, (contagem.get(nicho) ?? 0) + 1);
  }
  let melhor: string | null = null;
  let maior = 0;
  for (const [n, q] of contagem)
    if (q > maior) {
      maior = q;
      melhor = n;
    }
  return melhor;
}

/** 3. Pensados para você: nota 4,5+ lida e frete grátis confirmado. */
export function selecionarPensados(
  itens: ItemRec[],
  notaDe: NotaDe,
  perfil: PerfilVisitante | null,
) {
  return filtrarOrdenar(
    itens,
    notaDe,
    perfil,
    (i) => i.frete_gratis === true && notaBoa(notaDe(i)),
  );
}

export type Referencia = { titulo: string; preco: number; url?: string | null };

/** Produto de referência para os semelhantes: o último visto com preço. */
export function referenciaDoVisitante(perfil: PerfilVisitante | null): Referencia | null {
  const p = perfil?.produtosInteragidos.find((x) => x.preco != null && x.preco > 0);
  return p ? { titulo: p.titulo, preco: p.preco!, url: p.url ?? null } : null;
}

/* Medida que os dois títulos dizem igual (650W, 128GB, 4L...). */
const RE_MEDIDA = /^\d+(?:[.,]\d+)?(?:w|gb|tb|l|ml|v|mah|pol|hz|kg|g|mm|cm|m)$/;

/** Chip do semelhante: o que é igual e quanto custa a menos. */
export function chipDoSemelhante(ref: Referencia, i: ItemRec, r: ResumoAvaliacoes | undefined) {
  const medidasRef = new Set(palavrasDe(ref.titulo).filter((w) => RE_MEDIDA.test(w)));
  const iguais = palavrasDe(i.nome)
    .filter((w) => medidasRef.has(w))
    .slice(0, 2)
    .map((w) => `Mesmo ${w.toUpperCase().replace(/(\d)L$/, "$1 L")}`);
  const menos = ref.preco - Number(i.preco);
  const partes = [...iguais];
  if (menos >= 1)
    partes.push(
      `${menos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} a menos`,
    );
  else if (muitoBemAvaliado(r)) partes.push("Muito bem avaliado");
  else partes.push("Mesmo preço");
  return partes.join(" · ");
}

/** 4. Semelhantes: mesmo tipo, palavras em comum, preço igual ou menor. */
export function selecionarSemelhantes(
  itens: ItemRec[],
  notaDe: NotaDe,
  perfil: PerfilVisitante | null,
  ref: Referencia | null,
) {
  if (!ref) return [];
  const no = noPeloTitulo(ref.titulo);
  const palavrasRef = new Set(palavrasDe(ref.titulo).filter((w) => !/^\d/.test(w)));
  const tituloRef = normalizar(ref.titulo);
  const parecido = (i: ItemRec) => palavrasDe(i.nome).filter((w) => palavrasRef.has(w)).length;
  return filtrarOrdenar(
    itens,
    notaDe,
    null,
    (i) =>
      normalizar(i.nome) !== tituloRef &&
      Number(i.preco) <= ref.preco &&
      (noDoItem(i) === no || parecido(i) >= 2) &&
      parecido(i) >= 1,
    ehPecaOuAcessorio(ref.titulo),
  )
    .map((i, k) => ({ i, k, p: parecido(i) }))
    .sort((a, b) => b.p - a.p || a.k - b.k)
    .map((x) => x.i);
}

/** 5. Sazonal: combina com a temporada (ou está no nó dela), frete grátis
    confirmado, ordenado pelo gosto e faixa de preço do visitante. */
export function selecionarSazonal(
  itens: ItemRec[],
  notaDe: NotaDe,
  perfil: PerfilVisitante | null,
  t: Temporada | null,
) {
  if (!t) return [];
  const nos = new Set(NOS[t.id] ? subarvore(t.id) : []);
  return filtrarOrdenar(
    itens,
    notaDe,
    perfil,
    (i) => i.frete_gratis === true && (combinaComTemporada(t, i.nome) || nos.has(noDoItem(i))),
  );
}

export type ItemHistorico = {
  titulo: string;
  url: string;
  imagem: string | null;
  preco: number | null;
  em: number;
};

/** 6. Seu histórico: comparações do aparelho (me_historico_v1) e produtos
    abertos/clicados, sem repetir, o mais recente primeiro. */
export function montarHistorico(
  comparados: Array<{
    titulo?: string;
    url?: string;
    imagem?: string | null;
    melhor?: number | null;
    quando?: number;
  }>,
  perfil: PerfilVisitante | null,
  limite = 8,
): ItemHistorico[] {
  const todos: ItemHistorico[] = [
    ...comparados
      .filter((c) => typeof c?.titulo === "string" && typeof c.url === "string")
      .map((c) => ({
        titulo: c.titulo!,
        url: c.url!,
        imagem: c.imagem ?? null,
        preco: c.melhor ?? null,
        em: c.quando ?? 0,
      })),
    ...(perfil?.produtosInteragidos ?? [])
      .filter((p) => !!p.url)
      .map((p) => ({ titulo: p.titulo, url: p.url!, imagem: p.foto, preco: p.preco, em: p.em })),
  ].sort((a, b) => b.em - a.em);
  const vistos = new Set<string>();
  return todos
    .filter((h) => {
      const k = normalizar(h.titulo);
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .slice(0, limite);
}
