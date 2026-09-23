import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { AdInArticle } from "@/components/anuncios/Anuncio";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { AvisoAfiliado } from "@/components/RodapeInstitucional";
import { buscarCategoria, CATEGORIAS } from "@/content/categorias";
import { supabase } from "@/integrations/supabase/client";

const BASE = "https://cupons-afiliado-ml.lovable.app/categorias";

export const Route = createFileRoute("/categorias/$slug")({
  loader: ({ params }) => {
    const categoria = buscarCategoria(params.slug);
    if (!categoria) throw notFound();
    return { categoria };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Categoria não encontrada" }, { name: "robots", content: "noindex" }],
      };
    }
    const { categoria } = loaderData;
    const url = `${BASE}/${params.slug}`;
    return {
      meta: [
        { title: `${categoria.nome}: como avaliar ofertas e cupons` },
        { name: "description", content: categoria.resumo },
        { property: "og:title", content: `${categoria.nome}: como avaliar ofertas e cupons` },
        { property: "og:description", content: categoria.resumo },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Categorias", item: BASE },
              { "@type": "ListItem", position: 2, name: categoria.nome, item: url },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: CategoriaNaoEncontrada,
  component: PaginaCategoria,
});

function CategoriaNaoEncontrada() {
  return (
    <LayoutConteudo
      titulo="Categoria não encontrada"
      resumo="Este endereço não corresponde a nenhuma categoria publicada."
    >
      <p>
        <Link to="/categorias" className="font-semibold text-ml-blue hover:underline">
          Ver todas as categorias
        </Link>
      </p>
    </LayoutConteudo>
  );
}

type CupomResumo = {
  id: number;
  vendedor: string;
  desconto: string | null;
  teto: number | null;
  sem_teto: boolean;
  compra_min: number | null;
  vence: string | null;
  categoria: string | null;
  updated_at: string;
};

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dataBr(iso: string | null) {
  if (!iso) return null;
  const data = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleDateString("pt-BR");
}

function PaginaCategoria() {
  const { categoria } = Route.useLoaderData();

  const { data, isLoading } = useQuery({
    queryKey: ["cupons-categoria", categoria.slug],
    staleTime: 120_000,
    retry: 5,
    retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 15_000),
    queryFn: async (): Promise<CupomResumo[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("cupons")
        .select("id,vendedor,desconto,teto,sem_teto,compra_min,vence,categoria,updated_at")
        .eq("qualidade", "bom")
        .or(`vence.is.null,vence.gte.${hoje}`)
        .order("teto", { ascending: false, nullsFirst: false })
        .limit(400);
      if (error) throw error;
      const termos = categoria.termos.map((termo) => termo.toLowerCase());
      return ((data ?? []) as CupomResumo[])
        .filter((cupom) => {
          const rotulo = (cupom.categoria ?? "").toLowerCase();
          return rotulo !== "" && termos.some((termo) => rotulo.includes(termo));
        })
        .slice(0, 12);
    },
  });

  const cupons = data ?? [];

  return (
    <LayoutConteudo
      titulo={`${categoria.nome}: como avaliar ofertas e cupons`}
      resumo={categoria.resumo}
      atualizacao={categoria.atualizacao}
    >
      <nav aria-label="Trilha" className="!mt-0 text-xs">
        <Link to="/categorias" className="font-semibold text-ml-blue hover:underline">
          Categorias
        </Link>
      </nav>

      {categoria.introducao.map((paragrafo) => (
        <p key={paragrafo}>{paragrafo}</p>
      ))}

      <h2>O que conferir antes de comprar</h2>
      <ul>
        {categoria.comoAvaliar.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>Erros que custam caro</h2>
      <ul>
        {categoria.cuidados.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <AdInArticle />

      <h2>Cupons desta categoria conferidos por aqui</h2>
      {isLoading ? (
        <p>Carregando os cupons desta categoria...</p>
      ) : cupons.length === 0 ? (
        <p>
          Não há, neste momento, cupom confirmado para esta categoria na nossa base. Isso não
          significa que não existam ofertas: significa apenas que nada foi verificado por aqui,
          e preferimos dizer isso a inventar uma lista.{" "}
          <Link to="/" className="font-semibold text-ml-blue hover:underline">
            Ver todos os cupons conferidos
          </Link>
          .
        </p>
      ) : (
        <>
          <p>
            Cada linha mostra as condições lidas da própria campanha do vendedor, com a data da
            última conferência. Condições mudam sem aviso — confirme no carrinho antes de pagar.
          </p>
          <div className="not-prose space-y-2">
            {cupons.map((cupom) => (
              <div key={cupom.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">{cupom.vendedor}</p>
                  <p className="text-sm font-bold text-ml-blue">{cupom.desconto ?? "—"}</p>
                </div>
                <p className="mt-1 text-xs text-secondary-ink">
                  {cupom.sem_teto
                    ? "Desconto sem limite informado"
                    : cupom.teto != null
                      ? `Desconta no máximo ${reais.format(Number(cupom.teto))}`
                      : "Limite de desconto não verificado"}
                  {cupom.compra_min != null
                    ? ` · compra mínima de ${reais.format(Number(cupom.compra_min))}`
                    : ""}
                  {dataBr(cupom.vence) ? ` · válido até ${dataBr(cupom.vence)}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-secondary-ink">
                  Última atualização: {dataBr(cupom.updated_at) ?? "não informada"}
                </p>
              </div>
            ))}
          </div>
          <AvisoAfiliado className="mt-3 text-xs text-secondary-ink" />
        </>
      )}

      <h2>Perguntas frequentes</h2>
      <div className="space-y-4">
        {categoria.perguntas.map((item) => (
          <div key={item.pergunta}>
            <p className="font-bold text-foreground">{item.pergunta}</p>
            <p className="mt-1">{item.resposta}</p>
          </div>
        ))}
      </div>

      <h2>Outras categorias</h2>
      <ul>
        {CATEGORIAS.filter((item) => item.slug !== categoria.slug)
          .slice(0, 4)
          .map((item) => (
            <li key={item.slug}>
              <Link
                to="/categorias/$slug"
                params={{ slug: item.slug }}
                className="font-semibold text-ml-blue hover:underline"
              >
                {item.nome}
              </Link>
            </li>
          ))}
      </ul>
    </LayoutConteudo>
  );
}
