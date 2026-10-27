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

const naFaixa = (preco: number, id: string) => {
  const f = FAIXAS.find((x) => x.id === id);
  return !f || (preco >= f.de && preco < f.ate);
};

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
