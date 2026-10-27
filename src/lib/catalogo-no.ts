/* FILTROS DA PÁGINA DE CATEGORIA (Weslei, 27/10). Tudo no navegador, sem
   parâmetro na URL: combinação de filtro não vira página indexável. Só
   aparece filtro com 2 ou mais opções que tenham produto; opção sem
   produto não aparece. Os filtros vêm do título (src/content/taxonomia.ts,
   FILTROS) e nada é inventado: produto cujo título não diz a capacidade
   simplesmente não entra quando o filtro de capacidade está marcado. */
import { FILTROS, NOS, subarvore, type FiltroId } from "@/content/taxonomia";
import { semAcento } from "@/lib/classificar";

export type ItemNo = {
  nome: string;
  categoria_no: string;
  preco: number;
  frete_gratis: boolean | null;
  loja_oficial: boolean;
};

export type Escolha = {
  filtros: Partial<Record<FiltroId, string>>;
  faixa: string | null;
  freteGratis: boolean;
  lojaOficial: boolean;
};

export const ESCOLHA_VAZIA: Escolha = {
  filtros: {},
  faixa: null,
  freteGratis: false,
  lojaOficial: false,
};

export const FAIXAS = [
  { id: "ate-100", rotulo: "Até R$ 100", de: 0, ate: 100 },
  { id: "100-500", rotulo: "R$ 100 a R$ 500", de: 100, ate: 500 },
  { id: "500-2000", rotulo: "R$ 500 a R$ 2.000", de: 500, ate: 2000 },
  { id: "2000+", rotulo: "Acima de R$ 2.000", de: 2000, ate: Infinity },
] as const;

/* Faixa pelo id: "de-ate" ou "de+" (as fixas e as calculadas pela mediana). */
const naFaixa = (preco: number, id: string) => {
  const m = /^(\d+)(?:-(\d+)|\+)$/.exec(id.replace("ate-", "0-"));
  if (!m) return true;
  return preco >= Number(m[1]) && (m[2] == null || preco < Number(m[2]));
};

const brl0 = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
/* Arredonda para um valor "redondo" de vitrine (50, 100, 500, 1.000...). */
const redondo = (n: number) => {
  const passo = n < 200 ? 50 : n < 1000 ? 100 : n < 5000 ? 500 : 1000;
  return Math.max(passo, Math.round(n / passo) * passo);
};

/** 3 faixas pela distribuição real de preços da página (Weslei, 27/10:
    "faixas de preço automáticas calculadas pela mediana"): os cortes ficam
    em torno de 0,6x e 1,6x a mediana, arredondados. Com menos de 6 preços
    ou cortes iguais, as faixas fixas. */
export function faixasDePreco(precos: number[]): Array<{ id: string; rotulo: string }> {
  const v = precos.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  const fixas = FAIXAS.map((f) => ({ id: f.id, rotulo: f.rotulo }));
  if (v.length < 6) return fixas;
  const mediana = v[Math.floor(v.length / 2)]!;
  const a = redondo(mediana * 0.6);
  const b = redondo(mediana * 1.6);
  if (b <= a) return fixas;
  return [
    { id: `0-${a}`, rotulo: `Até ${brl0(a)}` },
    { id: `${a}-${b}`, rotulo: `${brl0(a)} a ${brl0(b)}` },
    { id: `${b}+`, rotulo: `Acima de ${brl0(b)}` },
  ];
}

const VAZIAS = new Set(["de", "da", "do", "das", "dos", "com", "para", "pra", "em", "no", "na"]);

/** Busca por texto dentro da página: toda palavra digitada tem de estar no
    título (sem acento; "4 cadeiras" casa "4 Cadeiras"; plural simples). */
export function buscarTexto<T extends Pick<ItemNo, "nome">>(itens: T[], termo: string): T[] {
  const palavras = semAcento(termo)
    .split(/[^a-z0-9]+/)
    .filter((p) => (p.length >= 2 && !VAZIAS.has(p)) || /^\d$/.test(p))
    .map((p) => (p.length > 3 ? p.replace(/(es|s)$/, "") : p));
  if (!palavras.length) return itens;
  return itens.filter((i) => {
    const n = ` ${semAcento(i.nome).replace(/[^a-z0-9]+/g, " ")} `;
    return palavras.every((p) => (/^\d+$/.test(p) ? n.includes(` ${p} `) : n.includes(p)));
  });
}

export type Faixa = "economico" | "custo-beneficio" | "premium";

/** DIVERSIDADE DE PREÇOS (Weslei, 27/10: "não concentrar todos os itens
    num mesmo valor estreito"). Os primeiros `topo` itens alternam entre o
    terço mais barato, o do meio e o mais caro, cada terço na ordem que já
    tinha (mais vendidos e bem avaliados primeiro). Com o preço médio do que
    o visitante abriu (perfil-visitante, ticketMedio), a faixa mais perto
    dele ganha 2 de cada 4 lugares; as outras continuam aparecendo. O resto
    da lista segue na ordem original. */
export function diversificarPorPreco<T extends Pick<ItemNo, "preco">>(
  itens: T[],
  ticketMedio = 0,
  topo = 18,
): T[] {
  if (itens.length < 6) return itens;
  const ordenados = itens.map((i) => Number(i.preco)).sort((a, b) => a - b);
  const c1 = ordenados[Math.floor(ordenados.length / 3)]!;
  const c2 = ordenados[Math.floor((ordenados.length * 2) / 3)]!;
  const faixa = (p: number): Faixa =>
    p < c1 ? "economico" : p < c2 ? "custo-beneficio" : "premium";
  const grupos: Record<Faixa, T[]> = { economico: [], "custo-beneficio": [], premium: [] };
  for (const i of itens) grupos[faixa(Number(i.preco))].push(i);
  const base: Faixa[] = ["custo-beneficio", "economico", "premium"];
  let giro: Faixa[] = base;
  if (ticketMedio > 0) {
    const perto = faixa(ticketMedio);
    const outras = base.filter((f) => f !== perto);
    giro = [perto, outras[0]!, perto, outras[1]!];
  }
  const saida: T[] = [];
  for (let k = 0; saida.length < Math.min(topo, itens.length); k++) {
    const g = grupos[giro[k % giro.length]!];
    if (g.length) saida.push(g.shift()!);
    else if (base.every((f) => !grupos[f].length)) break;
  }
  const usados = new Set(saida);
  return [...saida, ...itens.filter((i) => !usados.has(i))];
}

/** Quantos itens caem em cada filho direto do nó (filho sem item fica de fora). */
export function contarFilhos(slug: string, itens: Pick<ItemNo, "categoria_no">[]) {
  return (NOS[slug]?.filhos ?? [])
    .map((f) => {
      const nos = new Set(subarvore(f));
      return {
        slug: f,
        nome: NOS[f]!.nome,
        total: itens.filter((i) => nos.has(i.categoria_no)).length,
      };
    })
    .filter((f) => f.total > 0);
}

/** Filtros por título da subárvore que têm 2 ou mais opções com produto. */
export function filtrosDisponiveis(slug: string, itens: Pick<ItemNo, "nome">[]) {
  const ids = [...new Set(subarvore(slug).flatMap((s) => NOS[s]!.filtros))];
  const nomes = itens.map((i) => semAcento(i.nome));
  return ids
    .map((id) => ({
      ...FILTROS[id],
      opcoes: FILTROS[id].opcoes
        .map((o) => ({ ...o, total: nomes.filter((n) => o.re.test(n)).length }))
        .filter((o) => o.total > 0),
    }))
    .filter((f) => f.opcoes.length >= 2);
}

export function aplicarEscolha<T extends ItemNo>(itens: T[], e: Escolha): T[] {
  const marcados = Object.entries(e.filtros).flatMap(([id, opcao]) => {
    const re = FILTROS[id as FiltroId]?.opcoes.find((o) => o.id === opcao)?.re;
    return re ? [re] : [];
  });
  return itens.filter((i) => {
    if (e.freteGratis && !i.frete_gratis) return false;
    if (e.lojaOficial && !i.loja_oficial) return false;
    if (e.faixa && !naFaixa(Number(i.preco), e.faixa)) return false;
    if (!marcados.length) return true;
    const n = semAcento(i.nome);
    return marcados.every((re) => re.test(n));
  });
}

export type Ordem = "relevancia" | "menor-preco" | "maior-preco";

export function ordenar<T extends Pick<ItemNo, "preco">>(itens: T[], ordem: Ordem): T[] {
  if (ordem === "relevancia") return itens;
  const s = ordem === "menor-preco" ? 1 : -1;
  return [...itens].sort((a, b) => s * (Number(a.preco) - Number(b.preco)));
}
