/* MAIS VENDIDOS AGORA (09/10): a lista oficial de mais vendidos de cada
   categoria (em_alta_catalogo, agente operacao?tarefa=em_alta). Ainda não
   é comparação: o cartão mostra o preço de referência do catálogo com a
   data, o frete em linha própria e dois caminhos: "Comprar com segurança"
   (o link de afiliado é gerado no clique, VerNaLoja) e "Comparar preço"
   (abre a comparação com as outras lojas). Nada de desconto inventado:
   o selo é só "Entre os mais vendidos" (lista oficial). */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Flame } from "lucide-react";

import { VerNaLoja } from "@/components/BuscaPorLink";
import { LinhaAvaliacoes, SeloBemAvaliado } from "@/components/Avaliacoes";
import { itemDoEndereco, lerAvaliacoesPorItens, type MapaPorItem } from "@/lib/avaliacoes-detalhe";
import { bemAvaliadosPrimeiro, reprovadaPelaAvaliacao } from "@/lib/qualidade-avaliacao";
import { CATEGORIAS } from "@/content/categorias";
import { supabase } from "@/integrations/supabase/client";
import { propsFotoCartao } from "@/lib/foto";
import { FaixaArte } from "@/components/FaixaArte";
import { atributoProduto } from "@/lib/perfil-visitante";

export type ItemEmAlta = {
  produto: string;
  categoria_site: string;
  posicao: number | null;
  nome: string;
  imagem: string | null;
  /* Segunda foto real do catálogo (alterna no mouse/toque). */
  imagem2?: string | null;
  /* De onde veio (09/10): lista de mais vendidos, busca em alta (termo da
     lista oficial de mais buscados) ou busca fixa da curadoria. */
  origem?: "vendidos" | "tendencia" | "curadoria" | null;
  busca?: string | null;
  preco: number;
  frete_gratis: boolean | null;
  loja_oficial: boolean;
  url: string;
  atualizado_em: string;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "";
  }
};
const NOME: Record<string, string> = Object.fromEntries(CATEGORIAS.map((c) => [c.slug, c.nome]));

export function EmAltaCatalogo({
  categoria,
  naHome = false,
  limite = 24,
  grade = false,
  className = "",
}: {
  /* Página de categoria: só ela. Sem categoria: abas por categoria. */
  categoria?: string;
  naHome?: boolean;
  /* Teto por categoria (cada aba da home tem o seu). */
  limite?: number;
  /* Página de categoria: grade de 2 colunas também no celular (volume à
     vista), em vez da fileira com rolagem lateral. */
  grade?: boolean;
  className?: string;
}) {
  const [itens, setItens] = useState<ItemEmAlta[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<MapaPorItem>(() => new Map());
  /* Página de categoria: 24 de cada vez ("Ver mais"; 09/10, mais anúncios
     todo dia sem uma página infinita de uma vez). */
  const [mostrar, setMostrar] = useState(24);
  const [aba, setAba] = useState<string | null>(categoria ?? null);
  /* Home (Weslei, 26/10: "O site ainda não tem a quantidade olhando"):
     quantos cada categoria tem, na aba e no "Ver todos" da página dela. */
  const [totais, setTotais] = useState<Record<string, number>>({});
  useEffect(() => {
    if (categoria) return;
    void supabase.rpc("em_alta_contagem" as never).then(({ data }) => {
      if (Array.isArray(data))
        setTotais(
          Object.fromEntries(
            (data as Array<{ categoria_site: string; total: number }>).map((r) => [
              r.categoria_site,
              r.total,
            ]),
          ),
        );
    });
  }, [categoria]);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        /* Páginas de 1000 (teto de linhas do banco por leitura; 26/10: a
           categoria passa de 1000 com 200 novos por dia). */
        const lidos: ItemEmAlta[] = [];
        for (let de = 0; ; de += 1000) {
          const { data } = await supabase
            .rpc(
              "em_alta_por_categoria_v3" as never,
              { p_categoria: categoria ?? null, p_por_categoria: limite } as never,
            )
            .range(de, de + 999);
          const pagina = Array.isArray(data) ? (data as ItemEmAlta[]) : [];
          lidos.push(...pagina);
          if (pagina.length < 1000) break;
        }
        if (!vivo) return;
        /* Avaliações de cada anúncio (10/10), lidas pela extensão. */
        const mapa = await lerAvaliacoesPorItens(
          lidos.map((i) => itemDoEndereco(i.url)).filter((x): x is string => !!x),
        );
        if (!vivo) return;
        setAvaliacoes(mapa);
        setItens(lidos);
      } catch {
        /* sem a lista: a seção não aparece */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [categoria, limite]);

  const abas = useMemo(
    () => CATEGORIAS.map((c) => c.slug).filter((s) => itens.some((i) => i.categoria_site === s)),
    [itens],
  );
  const atual = categoria ?? aba ?? abas[0] ?? null;
  /* Informática (Weslei, 09/10): os mais buscados primeiro, depois os da
     curadoria (bonitos e coloridos) e então os mais vendidos. */
  const ordemOrigem = (i: ItemEmAlta) =>
    atual === "informatica"
      ? (({ tendencia: 0, curadoria: 1 } as Record<string, number>)[i.origem ?? ""] ?? 2)
      : 0;
  /* QUALIDADE PRIMEIRO (Weslei, 18/10): nota abaixo de 4,5 ou anúncio sem
     nenhuma avaliação sai; os bem avaliados vêm na frente e os que a
     extensão ainda não leu, depois (src/lib/qualidade-avaliacao.ts). */
  const resumoDe = (i: ItemEmAlta) => avaliacoes.get(itemDoEndereco(i.url) ?? "");
  const todos = bemAvaliadosPrimeiro(
    itens
      .filter((i) => i.categoria_site === atual && !reprovadaPelaAvaliacao(resumoDe(i)))
      .sort((a, b) => ordemOrigem(a) - ordemOrigem(b)),
    resumoDe,
  ).slice(0, limite);
  const lista = grade ? todos.slice(0, mostrar) : todos;
  if (!lista.length) return null;
  const quando = lista.reduce(
    (m, i) => (Date.parse(i.atualizado_em) > Date.parse(m) ? i.atualizado_em : m),
    lista[0]!.atualizado_em,
  );

  function comparar(url: string) {
    if (naHome) window.dispatchEvent(new CustomEvent("comparar-link", { detail: url }));
    else window.location.href = `/?link=${encodeURIComponent(url)}`;
  }

  return (
    <section
      aria-labelledby="em-alta-titulo"
      data-origem={`em_alta_${atual}`}
      className={"mt-8 " + className}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="em-alta-titulo"
            className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            <Flame className="size-5 text-[#ff6b00]" aria-hidden="true" />
            {categoria
              ? `Mais vendidos e mais buscados em ${NOME[categoria] ?? "esta categoria"} (${todos.length})`
              : "Mais vendidos e mais buscados agora"}
          </h2>
          <p className="mt-1 text-sm text-secondary-ink">
            Listas oficiais de mais vendidos e de buscas em alta do Mercado Livre de{" "}
            {dataCurta(quando)}, sem os que têm nota abaixo de 4,5 ou nenhuma avaliação. Compare
            antes de comprar: eu procuro o mesmo produto em outras lojas.
          </p>
        </div>
      </div>

      {/* Arte da categoria da aba (09/10: toda vitrine com arte). */}
      {!categoria && <FaixaArte slug={atual} />}

      {!categoria && abas.length > 1 && (
        <div
          role="tablist"
          aria-label="Categoria"
          className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {abas.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === atual}
              onClick={() => setAba(s)}
              className={
                "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition " +
                (s === atual
                  ? "border-[#0071e3] bg-[#0071e3] text-white"
                  : "border-border bg-card hover:border-[#0071e3]")
              }
            >
              {NOME[s] ?? s}
              {totais[s] ? ` (${totais[s]})` : ""}
            </button>
          ))}
        </div>
      )}

      <ul
        className={
          grade
            ? "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
            : "-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-6"
        }
      >
        {lista.map((i) => (
          <CartaoEmAlta
            key={i.produto}
            i={i}
            resumo={resumoDe(i)}
            grade={grade}
            onComparar={comparar}
          />
        ))}
      </ul>
      {!categoria && atual && (
        <div className="mt-4 text-center">
          <a
            href={`/categorias/${atual}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0071e3]/40 bg-card px-5 py-2.5 text-sm font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            Ver todos{totais[atual] ? ` os ${totais[atual]}` : ""} de{" "}
            {NOME[atual] ?? "esta categoria"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      )}
      {grade && todos.length > lista.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMostrar((m) => m + 24)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0071e3]/40 bg-card px-5 py-2.5 text-sm font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            Ver mais {Math.min(24, todos.length - lista.length)} produtos
          </button>
        </div>
      )}
    </section>
  );
}

/* Cartão de um produto da lista oficial (também na página de categoria,
   CatalogoCategoria). "Comprar com segurança" gera o link de afiliado no
   clique (VerNaLoja). */
export function CartaoEmAlta({
  i,
  resumo,
  grade,
  onComparar,
  trilho = false,
  selo = null,
}: {
  i: ItemEmAlta;
  resumo: ReturnType<MapaPorItem["get"]>;
  grade: boolean;
  onComparar: (url: string) => void;
  /* Trilho de recomendação (27/10): rolagem lateral também no PC. */
  trilho?: boolean;
  /* Chip extra na linha dos selos ("R$ 38 a menos"). */
  selo?: ReactNode;
}) {
  return (
    <li
      {...atributoProduto({
        chave: i.produto,
        titulo: i.nome,
        categoria: i.categoria_site,
        preco: i.preco,
        foto: i.imagem,
        url: i.url,
        freteGratis: i.frete_gratis,
      })}
      className={
        "group flex flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] " +
        (grade
          ? "min-w-0"
          : trilho
            ? "w-[58%] shrink-0 snap-start min-[480px]:w-[40%] sm:w-[30%] lg:w-[23%] xl:w-[18.5%]"
            : "w-[58%] shrink-0 snap-start min-[480px]:w-[40%] sm:w-auto")
      }
    >
      {/* Foto num quadro limpo, sem selo por cima (Weslei, 18/10: "não
          competindo com a foto"); os selos vão logo abaixo. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        <FotoComSegunda imagem={i.imagem} imagem2={i.imagem2 ?? null} />
      </div>
      <div className="flex flex-1 flex-col border-t border-border/60 p-3">
        <p className="flex min-h-5 flex-wrap items-center gap-1">
          {selo}
          {i.origem === "tendencia" ? (
            <span
              className="whitespace-nowrap rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-bold text-[#0058b0]"
              title={i.busca ? `Busca em alta: ${i.busca}` : undefined}
            >
              Em alta nas buscas
            </span>
          ) : (
            i.posicao != null &&
            i.posicao <= 20 && (
              <span className="whitespace-nowrap rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-bold text-[#a34700]">
                Entre os mais vendidos
              </span>
            )
          )}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug">{i.nome}</p>
        <p className="mt-2 text-[11px] text-secondary-ink">
          Preço de referência ({dataCurta(i.atualizado_em)})
          <span className="block text-base font-extrabold tabular-nums text-foreground">
            {brl(Number(i.preco))}
          </span>
        </p>
        <p className="text-[11px] text-secondary-ink">
          {i.frete_gratis ? "Frete grátis" : "Frete: confira no anúncio"}
        </p>
        {i.loja_oficial && <p className="text-[11px] font-semibold text-[#0058b0]">Loja oficial</p>}
        <LinhaAvaliacoes resumo={resumo} titulo={i.nome} className="mt-0.5" />
        <SeloBemAvaliado resumo={resumo} className="mt-1 self-start" />
        <div className="mt-auto space-y-1.5 pt-3">
          <VerNaLoja url={i.url} grande />
          <button
            type="button"
            onClick={() => onComparar(i.url)}
            className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#0071e3]/40 px-2 py-1.5 text-xs font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            Comparar preço
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}

/* Foto principal e, quando o catálogo tem, a segunda foto real: crossfade
   no mouse (PC) ou no toque na foto (celular). Caixa de altura fixa e
   imagens absolutas: nada muda de tamanho (sem salto de layout). */
function FotoComSegunda({ imagem, imagem2 }: { imagem: string | null; imagem2: string | null }) {
  const [alternada, setAlternada] = useState(false);
  if (!imagem) return null;
  const segunda = imagem2 && imagem2 !== imagem ? imagem2 : null;
  const classe =
    "absolute inset-0 h-full w-full object-contain px-3 pb-2 pt-8 transition-[opacity,transform] duration-300 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:transition-none";
  return (
    <span
      className="absolute inset-0"
      onClick={segunda ? () => setAlternada((a) => !a) : undefined}
      aria-hidden="true"
    >
      <img
        {...propsFotoCartao(imagem)}
        alt=""
        width={300}
        height={300}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={
          classe +
          (segunda
            ? alternada
              ? " opacity-0"
              : " [@media(hover:hover)]:group-hover:opacity-0"
            : "")
        }
      />
      {segunda && (
        <img
          {...propsFotoCartao(segunda)}
          alt=""
          width={300}
          height={300}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={
            classe +
            (alternada
              ? " opacity-100"
              : " opacity-0 [@media(hover:hover)]:group-hover:opacity-100")
          }
        />
      )}
    </span>
  );
}
