/* PRODUTOS DE UM NÓ DA ÁRVORE (Weslei, 27/10: "navegação hierárquica,
   contagens reais, subcategorias, filtros dinâmicos, ordenação"). Lê os
   mais vendidos da subárvore (em_alta_por_no), aplica a mesma regra de
   qualidade da home (nota abaixo de 4,5 ou sem avaliação sai) e mostra:
   subcategorias com a contagem do que está na tela (links reais, para o
   Google seguir), filtros que só aparecem quando há o que filtrar e a
   ordem. Filtro e ordem ficam no navegador, fora da URL. Nada flutua por
   cima do conteúdo. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, SlidersHorizontal } from "lucide-react";

import { CartaoEmAlta, type ItemEmAlta } from "@/components/EmAltaCatalogo";
import { NOS, subarvore } from "@/content/taxonomia";
import { supabase } from "@/integrations/supabase/client";
import { itemDoEndereco, lerAvaliacoesPorItens, type MapaPorItem } from "@/lib/avaliacoes-detalhe";
import {
  aplicarEscolha,
  contarFilhos,
  ESCOLHA_VAZIA,
  FAIXAS,
  filtrosDisponiveis,
  ordenar,
  type Escolha,
  type Ordem,
} from "@/lib/catalogo-no";
import { bemAvaliadosPrimeiro, reprovadaPelaAvaliacao } from "@/lib/qualidade-avaliacao";

type Item = ItemEmAlta & { categoria_no: string };

const CHIP =
  "inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]";
const chip = (ativo: boolean) =>
  CHIP +
  (ativo
    ? " border-[#0071e3] bg-[#0071e3] text-white"
    : " border-border bg-card text-foreground hover:border-[#0071e3]");

export function CatalogoCategoria({
  slug,
  contagemInicial = {},
}: {
  slug: string;
  /* Contagem do servidor por nó (antes do filtro de qualidade): mostra as
     subcategorias já no HTML, antes dos produtos carregarem. */
  contagemInicial?: Record<string, number>;
}) {
  const no = NOS[slug]!;
  const [itens, setItens] = useState<Item[] | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<MapaPorItem>(() => new Map());
  const [escolha, setEscolha] = useState<Escolha>(ESCOLHA_VAZIA);
  const [ordem, setOrdem] = useState<Ordem>("relevancia");
  const [mostrar, setMostrar] = useState(24);

  useEffect(() => {
    let vivo = true;
    setItens(null);
    setEscolha(ESCOLHA_VAZIA);
    setMostrar(24);
    void (async () => {
      try {
        const lidos: Item[] = [];
        for (let de = 0; ; de += 1000) {
          const { data } = await supabase
            .rpc("em_alta_por_no" as never, { p_nos: subarvore(slug), p_limite: 5000 } as never)
            .range(de, de + 999);
          const pagina = Array.isArray(data) ? (data as Item[]) : [];
          lidos.push(...pagina);
          if (pagina.length < 1000) break;
        }
        const mapa = await lerAvaliacoesPorItens(
          lidos.map((i) => itemDoEndereco(i.url)).filter((x): x is string => !!x),
        );
        if (!vivo) return;
        setAvaliacoes(mapa);
        setItens(lidos);
      } catch {
        if (vivo) setItens([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [slug]);

  const resumoDe = (i: Item) => avaliacoes.get(itemDoEndereco(i.url) ?? "");
  /* Informática (Weslei, 09/10): os mais buscados primeiro, depois a
     curadoria e então os mais vendidos. */
  const ordemOrigem = (i: Item) =>
    slug === "informatica"
      ? (({ tendencia: 0, curadoria: 1 } as Record<string, number>)[i.origem ?? ""] ?? 2)
      : 0;
  const aprovados = useMemo(
    () =>
      itens
        ? bemAvaliadosPrimeiro(
            itens
              .filter((i) => !reprovadaPelaAvaliacao(resumoDe(i)))
              .sort((a, b) => ordemOrigem(a) - ordemOrigem(b)),
            resumoDe,
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itens, avaliacoes],
  );
  const filhos = itens
    ? contarFilhos(slug, aprovados)
    : no.filhos
        .map((f) => ({
          slug: f,
          nome: NOS[f]!.nome,
          total: subarvore(f).reduce((s, x) => s + (contagemInicial[x] ?? 0), 0),
        }))
        .filter((f) => f.total > 0);
  const filtros = useMemo(() => filtrosDisponiveis(slug, aprovados), [slug, aprovados]);
  const visiveis = ordenar(aplicarEscolha(aprovados, escolha), ordem);
  const lista = visiveis.slice(0, mostrar);
  const algumFiltro =
    escolha.faixa ||
    escolha.freteGratis ||
    escolha.lojaOficial ||
    Object.keys(escolha.filtros).length;
  const marcar = (e: Partial<Escolha>) => {
    setEscolha((x) => ({ ...x, ...e }));
    setMostrar(24);
  };

  return (
    <section aria-labelledby="produtos-titulo" data-origem={`categoria_${slug}`} className="mt-8">
      {filhos.length > 0 && (
        <nav
          aria-label={`Subcategorias de ${no.nome}`}
          className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {filhos.map((f) => (
            <Link
              key={f.slug}
              to="/categorias/$slug"
              params={{ slug: f.slug }}
              className={chip(false)}
            >
              {f.nome}
              <span className="font-normal text-secondary-ink">({f.total})</span>
            </Link>
          ))}
        </nav>
      )}

      <h2
        id="produtos-titulo"
        className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"
      >
        <Flame className="size-5 text-[#ff6b00]" aria-hidden="true" />
        Mais vendidos em {no.nome}
        {itens && ` (${visiveis.length})`}
      </h2>
      <p className="mt-1 text-sm text-secondary-ink">
        Listas oficiais de mais vendidos e de buscas em alta do Mercado Livre, sem os que têm nota
        abaixo de 4,5 ou nenhuma avaliação. Preço de referência do dia; confira no anúncio.
      </p>

      {itens && aprovados.length > 1 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold">
              Ordenar
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
                className="min-h-9 rounded-full border border-border bg-card px-3 text-xs font-semibold"
              >
                <option value="relevancia">Mais vendidos e bem avaliados</option>
                <option value="menor-preco">Menor preço</option>
                <option value="maior-preco">Maior preço</option>
              </select>
            </label>
            <button
              type="button"
              aria-pressed={escolha.freteGratis}
              onClick={() => marcar({ freteGratis: !escolha.freteGratis })}
              className={chip(escolha.freteGratis)}
            >
              Frete grátis
            </button>
            <button
              type="button"
              aria-pressed={escolha.lojaOficial}
              onClick={() => marcar({ lojaOficial: !escolha.lojaOficial })}
              className={chip(escolha.lojaOficial)}
            >
              Loja oficial
            </button>
            {algumFiltro ? (
              <button
                type="button"
                onClick={() => marcar(ESCOLHA_VAZIA)}
                className="text-xs font-semibold text-[#0058b0] underline-offset-2 hover:underline"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          <details className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
            <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-bold">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Preço
              {filtros.length ? ` e ${filtros.map((f) => f.nome.toLowerCase()).join(", ")}` : ""}
            </summary>
            <div className="mt-3 space-y-3">
              <Grupo
                nome="Preço"
                opcoes={FAIXAS.map((f) => ({ id: f.id, rotulo: f.rotulo }))}
                atual={escolha.faixa}
                onEscolher={(id) => marcar({ faixa: id })}
              />
              {filtros.map((f) => (
                <Grupo
                  key={f.id}
                  nome={f.nome}
                  opcoes={f.opcoes.map((o) => ({ id: o.id, rotulo: `${o.rotulo} (${o.total})` }))}
                  atual={escolha.filtros[f.id] ?? null}
                  onEscolher={(id) => {
                    const filtrosNovos = { ...escolha.filtros };
                    if (id) filtrosNovos[f.id] = id;
                    else delete filtrosNovos[f.id];
                    marcar({ filtros: filtrosNovos });
                  }}
                />
              ))}
            </div>
          </details>
        </div>
      )}

      {itens === null ? (
        <p className="mt-6 text-sm text-secondary-ink">Carregando produtos…</p>
      ) : lista.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <p className="font-bold">
            {aprovados.length
              ? "Nenhum produto com esses filtros."
              : `Ainda não há produtos bem avaliados em ${no.nome.toLowerCase()}.`}
          </p>
          {aprovados.length > 0 && (
            <button
              type="button"
              onClick={() => marcar(ESCOLHA_VAZIA)}
              className="mt-2 text-sm font-semibold text-[#0058b0] hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {lista.map((i) => (
            <CartaoEmAlta
              key={i.produto}
              i={i}
              resumo={resumoDe(i)}
              grade
              onComparar={(url) => {
                window.location.href = `/?link=${encodeURIComponent(url)}`;
              }}
            />
          ))}
        </ul>
      )}
      {visiveis.length > lista.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMostrar((m) => m + 24)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#0071e3]/40 bg-card px-5 py-2.5 text-sm font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            Ver mais {Math.min(24, visiveis.length - lista.length)} produtos
          </button>
        </div>
      )}
    </section>
  );
}

function Grupo({
  nome,
  opcoes,
  atual,
  onEscolher,
}: {
  nome: string;
  opcoes: Array<{ id: string; rotulo: string }>;
  atual: string | null;
  onEscolher: (id: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-bold text-secondary-ink">{nome}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={atual === o.id}
            onClick={() => onEscolher(atual === o.id ? null : o.id)}
            className={chip(atual === o.id)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
