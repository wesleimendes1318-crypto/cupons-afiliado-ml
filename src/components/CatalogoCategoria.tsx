/* PRODUTOS DE UM NÓ DA ÁRVORE (Weslei, 27/10: "navegação hierárquica,
   contagens reais, subcategorias, filtros dinâmicos, ordenação"). Lê os
   mais vendidos da subárvore (em_alta_por_no), aplica a mesma regra de
   qualidade da home (nota abaixo de 4,5 ou sem avaliação sai) e mostra:
   subcategorias com a contagem do que está na tela (links reais, para o
   Google seguir), filtros que só aparecem quando há o que filtrar e a
   ordem. Filtro e ordem ficam no navegador, fora da URL. Nada flutua por
   cima do conteúdo.
   27/10 (e-commerce completo): busca por texto dentro da página (título,
   instantânea), "Consultar opções com IA" quando a busca acha pouco, faixas
   de preço pela mediana, preços variados no topo (perto do que o visitante
   costuma abrir) e, em subcategoria com menos de 8 produtos, mais opções do
   catálogo oficial e da categoria de cima: página nunca vazia. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";

import { ResultadosDaBusca, type ConsultaBusca } from "@/components/BuscaGuiada";
import { CartaoEmAlta, type ItemEmAlta } from "@/components/EmAltaCatalogo";
import { useTicketMedio } from "@/hooks/use-ticket-medio";
import { buscarProdutos, type Resposta } from "@/lib/busca-guiada-cliente";
import { NOS, subarvore } from "@/content/taxonomia";
import { supabase } from "@/integrations/supabase/client";
import { itemDoEndereco, lerAvaliacoesPorItens, type MapaPorItem } from "@/lib/avaliacoes-detalhe";
import {
  aplicarEscolha,
  buscarTexto,
  contarFilhos,
  diversificarPorPreco,
  ESCOLHA_VAZIA,
  faixasDePreco,
  filtrosDisponiveis,
  ordenar,
  type Escolha,
  type Ordem,
} from "@/lib/catalogo-no";
import { bemAvaliadosPrimeiro, reprovadaPelaAvaliacao } from "@/lib/qualidade-avaliacao";

type Item = ItemEmAlta & { categoria_no: string };

/* Abaixo disto a página ganha os blocos complementares (Weslei, 27/10). */
const POUCOS = 8;
/* Busca interna que acha menos que isto oferece a consulta ao catálogo. */
const POUCOS_NA_BUSCA = 6;

async function lerNos(nos: string[], limite = 5000): Promise<Item[]> {
  const lidos: Item[] = [];
  for (let de = 0; de < limite; de += 1000) {
    const { data } = await supabase
      .rpc("em_alta_por_no" as never, { p_nos: nos, p_limite: limite } as never)
      .range(de, de + 999);
    const pagina = Array.isArray(data) ? (data as Item[]) : [];
    lidos.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return lidos;
}

const comparar = (url: string) => {
  window.location.href = `/?link=${encodeURIComponent(url)}`;
};

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
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  /* Mais da categoria de cima (página com poucos produtos). */
  const [doPai, setDoPai] = useState<Item[]>([]);
  const [consulta, setConsulta] = useState<ConsultaBusca | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const ticket = useTicketMedio();

  /* Filtro instantâneo com folga de 150 ms entre as teclas. */
  useEffect(() => {
    const t = setTimeout(() => setTermo(texto.trim()), 150);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    let vivo = true;
    setItens(null);
    setEscolha(ESCOLHA_VAZIA);
    setMostrar(24);
    void (async () => {
      try {
        const lidos = await lerNos(subarvore(slug));
        /* Poucos produtos: os da categoria de cima entram no bloco de baixo. */
        const proprios = new Set(subarvore(slug));
        /* Folga para os que saem pela nota. */
        const pai =
          no.pai && lidos.length < POUCOS * 3
            ? (await lerNos(subarvore(no.pai), 200)).filter((i) => !proprios.has(i.categoria_no))
            : [];
        const mapa = await lerAvaliacoesPorItens(
          [...lidos, ...pai].map((i) => itemDoEndereco(i.url)).filter((x): x is string => !!x),
        );
        if (!vivo) return;
        setAvaliacoes(mapa);
        setDoPai(pai);
        setItens(lidos);
      } catch {
        if (vivo) setItens([]);
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function consultar(q: string) {
    const c: ConsultaBusca = { q, contexto: "home", modo: "guiada", no: slug };
    setConsulta(c);
    setResposta(null);
    setErroConsulta(null);
    setConsultando(true);
    const r = await buscarProdutos(c.q, c.contexto, c.modo, 0, slug);
    setResposta(r.resposta);
    setErroConsulta(r.erro);
    setConsultando(false);
  }

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
  const doServidor = (nos: string[]) =>
    nos
      .map((f) => ({
        slug: f,
        nome: NOS[f]!.nome,
        /* A própria página: o que está na tela, quando já carregou. */
        total:
          f === slug && itens
            ? aprovados.length
            : subarvore(f).reduce((s, x) => s + (contagemInicial[x] ?? 0), 0),
      }))
      .filter((f) => f.total > 0 || f.slug === slug);
  /* Trilho: as subcategorias do nó; numa folha, as irmãs (a atual marcada). */
  const filhos = no.filhos.length
    ? itens
      ? contarFilhos(slug, aprovados)
      : doServidor(no.filhos)
    : no.pai
      ? doServidor(NOS[no.pai]!.filhos)
      : [];
  const filtros = useMemo(() => filtrosDisponiveis(slug, aprovados), [slug, aprovados]);
  const faixas = useMemo(() => faixasDePreco(aprovados.map((i) => Number(i.preco))), [aprovados]);
  const algumFiltro =
    escolha.faixa ||
    escolha.freteGratis ||
    escolha.lojaOficial ||
    Object.keys(escolha.filtros).length;
  const encontrados = buscarTexto(aprovados, termo);
  const filtrados = ordenar(aplicarEscolha(encontrados, escolha), ordem);
  /* Preços variados no topo só na ordem padrão, sem busca nem filtro. */
  const visiveis =
    ordem === "relevancia" && !termo && !algumFiltro
      ? diversificarPorPreco(filtrados, ticket)
      : filtrados;
  const lista = visiveis.slice(0, mostrar);
  const poucos = itens !== null && aprovados.length < POUCOS;
  const pai = no.pai ? NOS[no.pai]! : null;
  const paiAprovados = useMemo(
    () =>
      diversificarPorPreco(
        bemAvaliadosPrimeiro(
          doPai.filter((i) => !reprovadaPelaAvaliacao(resumoDe(i))),
          resumoDe,
        ),
        ticket,
      ).slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doPai, avaliacoes, ticket],
  );
  /* Página com poucos produtos: o catálogo oficial completa a vitrine
     (resposta guardada 6 h no servidor, a mesma para todos). */
  useEffect(() => {
    if (poucos && !termo && consulta?.q !== no.nome) void consultar(no.nome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poucos, termo]);
  const consultaDaBusca = consulta && consulta.q !== no.nome;
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
              aria-current={f.slug === slug ? "page" : undefined}
              className={chip(f.slug === slug)}
            >
              {f.nome}
              <span
                className={
                  f.slug === slug ? "font-normal text-white/80" : "font-normal text-secondary-ink"
                }
              >
                ({f.total})
              </span>
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

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setTermo(texto.trim());
        }}
        className="relative mt-4"
      >
        <label htmlFor="busca-na-categoria" className="sr-only">
          Buscar em {no.nome}
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-secondary-ink"
          aria-hidden="true"
        />
        <input
          id="busca-na-categoria"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setMostrar(24);
          }}
          placeholder={`Buscar em ${no.nome}... (ex: ${exemploDaBusca(slug)})`}
          className="min-h-12 w-full rounded-full border border-border bg-card pl-11 pr-12 text-[16px] shadow-[var(--shadow-card)] outline-none placeholder:text-secondary-ink/80 focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/25 [&::-webkit-search-cancel-button]:hidden"
        />
        {texto && (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              setTermo("");
            }}
            aria-label="Limpar a busca"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-secondary-ink hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#0071e3]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </form>
      {itens && termo.length >= 2 && encontrados.length < POUCOS_NA_BUSCA && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-3 dark:bg-white/5">
          <p className="text-sm">
            {encontrados.length
              ? `Só ${encontrados.length === 1 ? "1 produto" : `${encontrados.length} produtos`} com “${termo}” por aqui.`
              : `Nenhum produto com “${termo}” por aqui ainda.`}
          </p>
          <button
            type="button"
            onClick={() => void consultar(`${no.nome}: ${termo}`)}
            disabled={consultando && consulta?.q === `${no.nome}: ${termo}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Consultar opções de “{termo}” com IA
          </button>
        </div>
      )}
      {consultaDaBusca && (
        <section aria-label={`Opções de ${termo || consulta.q} no catálogo`} className="mt-4">
          <ResultadosDaBusca
            compacto
            soCatalogo
            consulta={consulta}
            carregando={consultando}
            erro={erroConsulta}
            resposta={resposta}
            comparar={comparar}
            semResultado="O catálogo oficial não tem anúncio ativo para essa busca nesta categoria. Tente outras palavras."
          />
        </section>
      )}

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
                {/* "Maior economia" e "Preço imbatível" pedem o preço do mesmo
                    produto em outras lojas, que esta lista não tem: ficam de
                    fora até haver o dado (nada inventado). */}
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
                opcoes={faixas}
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
              ? termo
                ? `Nenhum produto com “${termo}” nesses filtros.`
                : "Nenhum produto com esses filtros."
              : `Ainda não há produtos bem avaliados em ${no.nome.toLowerCase()}: veja abaixo as opções do catálogo.`}
          </p>
          {aprovados.length > 0 && (
            <button
              type="button"
              onClick={() => {
                marcar(ESCOLHA_VAZIA);
                setTexto("");
                setTermo("");
              }}
              className="mt-2 text-sm font-semibold text-[#0058b0] hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {lista.map((i) => (
            <CartaoEmAlta key={i.produto} i={i} resumo={resumoDe(i)} grade onComparar={comparar} />
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

      {poucos && consulta?.q === no.nome && (
        <section aria-labelledby="mais-opcoes-titulo" className="mt-8">
          <h2 id="mais-opcoes-titulo" className="text-lg font-extrabold tracking-tight sm:text-xl">
            Mais opções de {no.nome.toLowerCase()} no Mercado Livre
          </h2>
          <ResultadosDaBusca
            compacto
            soCatalogo
            consulta={consulta}
            carregando={consultando}
            erro={erroConsulta}
            resposta={resposta}
            comparar={comparar}
            semResultado="O catálogo oficial não respondeu com anúncios ativos agora."
          />
        </section>
      )}

      {poucos && pai && paiAprovados.length > 0 && (
        <section aria-labelledby="do-pai-titulo" className="mt-8">
          <h2 id="do-pai-titulo" className="text-lg font-extrabold tracking-tight sm:text-xl">
            Outras opções em{" "}
            <Link
              to="/categorias/$slug"
              params={{ slug: pai.slug }}
              className="text-[#0058b0] hover:underline"
            >
              {pai.nome}
            </Link>
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {paiAprovados.map((i) => (
              <CartaoEmAlta
                key={i.produto}
                i={i}
                resumo={resumoDe(i)}
                grade
                onComparar={comparar}
              />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/* Exemplo do campo de busca pelo tipo da página. */
function exemploDaBusca(slug: string) {
  const caminho = NOS[slug]?.caminho ?? [];
  if (caminho.includes("mesas")) return "4 cadeiras, madeira, tampo de vidro";
  if (caminho.includes("moveis")) return "madeira, branco, 3 lugares";
  if (caminho.includes("eletrodomesticos")) return "inox, 110v, digital";
  if (caminho.includes("informatica")) return "sem fio, 1tb, rgb";
  if (caminho.includes("moda")) return "preto, couro, masculino";
  return "marca, cor, tamanho";
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
