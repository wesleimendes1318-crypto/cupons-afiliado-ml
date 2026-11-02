/* Resultados da busca por texto (27/10): o mesmo anúncio uma vez só, e a
   nota lida decide quem vai na frente. */
import type { ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";
import { FILTROS, type FiltroId } from "@/content/taxonomia";
import { filtrosDisponiveis, naFaixa } from "@/lib/catalogo-no";
import { classificar, semAcento } from "@/lib/classificar";

/** Todos os MLB do endereço: o mesmo anúncio ou produto é um cartão só. */
export const idsDoEndereco = (u: string) =>
  (
    u
      .toUpperCase()
      .replace(/-/g, "")
      .match(/MLB\d{6,}/g) ?? []
  ).filter(Boolean);

/** Junta as listas na ordem, sem repetir anúncio ou produto. */
export function mesclarSemRepetir<T>(listas: T[][], url: (i: T) => string): T[] {
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const lista of listas)
    for (const i of lista) {
      const ids = idsDoEndereco(url(i));
      const chave = ids.length ? ids : [url(i)];
      if (chave.some((k) => vistos.has(k))) continue;
      chave.forEach((k) => vistos.add(k));
      saida.push(i);
    }
  return saida;
}

/** Nota acima de 4,5 na frente, sem nota no meio, nota menor no fim. */
export function faixaDaNota(r: ResumoAvaliacoes | undefined): 0 | 1 | 2 {
  const nota = r?.avaliacoes?.nota;
  if (nota == null) return 1;
  return nota > 4.5 ? 0 : 2;
}

/* ORDENAR E FILTRAR O RESULTADO (Weslei, 02/11: "filtrar de acordo com a
   busca e ordenar por preço, economia, mais vendidos"). Tudo no navegador,
   sobre o que já veio, e nada inventado: sem o dado, o cartão vai para o
   fim da ordem e não entra no filtro. */
export type OrdemBusca =
  "relevancia" | "menor-preco" | "maior-preco" | "economia" | "mais-vendidos" | "melhor-avaliados";

export const ORDENS_BUSCA: Array<{ id: OrdemBusca; rotulo: string }> = [
  { id: "relevancia", rotulo: "Mais relevantes" },
  { id: "menor-preco", rotulo: "Menor preço" },
  { id: "maior-preco", rotulo: "Maior preço" },
  { id: "economia", rotulo: "Maior economia" },
  { id: "mais-vendidos", rotulo: "Mais vendidos" },
  { id: "melhor-avaliados", rotulo: "Melhor avaliados" },
];

type Ordenavel = {
  nome: string;
  preco: number | null;
  economia?: number | null;
  maisVendido?: number | null;
  avaliacao: string | null;
};

const fim = Number.POSITIVE_INFINITY;

/** Ordena mantendo a ordem de chegada entre os empatados. "Mais vendidos":
    posição na lista oficial e, depois, quantidade de avaliações. "Melhor
    avaliados": nota (com 5 ou mais avaliações) e quantidade. */
export function ordenarResultados<T extends Ordenavel>(
  itens: T[],
  ordem: OrdemBusca,
  notas: Map<string, ResumoAvaliacoes> = new Map(),
): T[] {
  if (ordem === "relevancia") return itens;
  const nota = (i: T) => (i.avaliacao ? notas.get(i.avaliacao)?.avaliacoes : null) ?? null;
  const chave = (i: T): number[] => {
    const a = nota(i);
    switch (ordem) {
      case "menor-preco":
        return [i.preco ?? fim];
      case "maior-preco":
        return [i.preco != null ? -i.preco : fim];
      case "economia":
        return [i.economia ? -i.economia : fim, i.preco ?? fim];
      case "mais-vendidos":
        return [i.maisVendido ?? fim, a ? -a.total : fim];
      case "melhor-avaliados":
        return a && a.total >= 5 ? [-a.nota, -a.total] : [fim, fim];
    }
  };
  return itens
    .map((i, k) => ({ i, k, c: chave(i) }))
    .sort((x, y) => {
      for (let n = 0; n < x.c.length; n++) {
        const d = x.c[n]! - y.c[n]!;
        if (d && !Number.isNaN(d)) return d;
      }
      return x.k - y.k;
    })
    .map((x) => x.i);
}

/** "barata", "em conta", "mais barato": a tela já abre no menor preço. */
export const ordemInicial = (q: string): OrdemBusca =>
  /\b(barat[oa]s?|em conta|economic[oa]s?|menor pre[cç]o)\b/i.test(
    q.normalize("NFD").replace(/[̀-ͯ]/g, ""),
  )
    ? "menor-preco"
    : "relevancia";

/* Marcas conhecidas pelo título (a 1ª que aparecer). */
const MARCAS = [
  "Samsung",
  "LG",
  "Electrolux",
  "Brastemp",
  "Consul",
  "Midea",
  "Philco",
  "Panasonic",
  "Philips",
  "Mondial",
  "Britânia",
  "Arno",
  "Oster",
  "Cadence",
  "Black+Decker",
  "WAP",
  "Kärcher",
  "Xiaomi",
  "Apple",
  "Motorola",
  "Realme",
  "Positivo",
  "Lenovo",
  "Dell",
  "Acer",
  "Asus",
  "HP",
  "Multilaser",
  "TCL",
  "AOC",
  "Sony",
  "JBL",
  "Gree",
  "Elgin",
  "Springer",
  "Fujitsu",
  "Daikin",
  "Agratto",
  "Tramontina",
  "Fischer",
  "Esmaltec",
  "Atlas",
  "Continental",
  "Mueller",
  "Colormaq",
  "Suggar",
  "Hisense",
  "Toshiba",
  "Semp",
  "Roku",
  "Nike",
  "Adidas",
  "Mizuno",
  "Olympikus",
  "Puma",
  "Fila",
  "Asics",
  "Under Armour",
  "Akibra",
  "Nespresso",
  "Dolce Gusto",
  "Tefal",
  "Rowenta",
];
const RE_MARCAS = MARCAS.map((m) => ({
  m,
  re: new RegExp(
    `(^|[^a-z0-9])${m.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[+]/g, "\\+")}([^a-z0-9]|$)`,
  ),
}));

export function marcaDoTitulo(nome: string): string | null {
  const t = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let melhor: { m: string; pos: number } | null = null;
  for (const { m, re } of RE_MARCAS) {
    const r = re.exec(t);
    if (r && (!melhor || r.index < melhor.pos)) melhor = { m, pos: r.index };
  }
  return melhor?.m ?? null;
}

/** Marcas dos resultados, da mais frequente; só com 2 ou mais marcas. */
export function marcasDosResultados(itens: Array<{ nome: string }>) {
  const conta = new Map<string, number>();
  for (const i of itens) {
    const m = marcaDoTitulo(i.nome);
    if (m) conta.set(m, (conta.get(m) ?? 0) + 1);
  }
  const lista = [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return lista.length >= 2 ? lista.map(([marca, total]) => ({ marca, total })) : [];
}

export type EscolhaBusca = {
  faixa: string | null;
  freteGratis: boolean;
  lojaOficial: boolean;
  marca: string | null;
  filtros: Partial<Record<FiltroId, string>>;
};
export const ESCOLHA_BUSCA_VAZIA: EscolhaBusca = {
  faixa: null,
  freteGratis: false,
  lojaOficial: false,
  marca: null,
  filtros: {},
};
export const temEscolha = (e: EscolhaBusca) =>
  !!(e.faixa || e.freteGratis || e.lojaOficial || e.marca || Object.keys(e.filtros).length);

/** Filtros da categoria da busca (voltagem, polegadas, litros...): a
    categoria mais comum entre os resultados; só os que têm 2+ opções. */
export function filtrosDaBusca(itens: Array<{ nome: string }>) {
  const conta = new Map<string, number>();
  for (const i of itens) {
    const no = classificar({ nome: i.nome }).no;
    if (no !== "fora") conta.set(no, (conta.get(no) ?? 0) + 1);
  }
  const no = [...conta].sort((a, b) => b[1] - a[1])[0]?.[0];
  return no ? filtrosDisponiveis(no, itens) : [];
}

export function filtrarResultados<
  T extends {
    nome: string;
    preco: number | null;
    freteGratis: boolean | null;
    lojaOficial: boolean;
  },
>(itens: T[], e: EscolhaBusca): T[] {
  const marcados = Object.entries(e.filtros).flatMap(([id, opcao]) => {
    const re = FILTROS[id as FiltroId]?.opcoes.find((o) => o.id === opcao)?.re;
    return re ? [re] : [];
  });
  return itens.filter((i) => {
    if (e.freteGratis && i.freteGratis !== true) return false;
    if (e.lojaOficial && !i.lojaOficial) return false;
    if (e.faixa && (i.preco == null || !naFaixa(i.preco, e.faixa))) return false;
    if (e.marca && marcaDoTitulo(i.nome) !== e.marca) return false;
    const n = semAcento(i.nome);
    return marcados.every((re) => re.test(n));
  });
}
