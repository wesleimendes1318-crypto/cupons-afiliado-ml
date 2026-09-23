import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { AdInArticle } from "@/components/anuncios/Anuncio";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { AvisoAfiliado } from "@/components/RodapeInstitucional";
import { ArrowRight, AlertTriangle, CheckCircle2, Tag } from "lucide-react";
import { buscarCategoria, CATEGORIAS } from "@/content/categorias";
import { ICONE_CATEGORIA, TOM_CATEGORIA } from "@/routes/categorias.index";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  calcularScore,
  CondicoesModal,
  CupomCard,
  diasAte,
  type Cupom,
  type CupomIndexado,
} from "@/routes/index";

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

const CAMPOS =
  "id,vendedor,desconto,tipo,valor,orcamento,vence,busca,compra_min,teto,sem_teto,qualidade,categoria,updated_at,codigo_cupom,vitrine_ok,link_afiliado,link_origem";

function PaginaCategoria() {
  const { categoria } = Route.useLoaderData();
  const tom = TOM_CATEGORIA[categoria.slug] ?? "var(--ml-blue)";
  const [agora, setAgora] = useState<number | null>(null);
  const [cupomAberto, setCupomAberto] = useState<CupomIndexado | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const id = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["cupons-categoria", categoria.slug],
    staleTime: 120_000,
    retry: 5,
    retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 15_000),
    queryFn: async (): Promise<Cupom[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("cupons")
        .select(CAMPOS)
        .eq("qualidade", "bom")
        .or(`vence.is.null,vence.gte.${hoje}`)
        .order("teto", { ascending: false, nullsFirst: false })
        .limit(600);
      if (error) throw error;
      const termos = categoria.termos.map((termo) => termo.toLowerCase());
      return ((data ?? []) as unknown as Cupom[])
        .filter((cupom) => cupom.vitrine_ok !== false)
        .filter((cupom) => {
          const rotulo = (cupom.categoria ?? "").toLowerCase();
          return rotulo !== "" && termos.some((termo) => rotulo.includes(termo));
        })
        .slice(0, 24);
    },
  });

  /* O mesmo cartão da tela inicial: a pessoa vê contagem, economia e o botão
     no lugar de sempre, sem precisar reaprender a ler a página. */
  const cupons: CupomIndexado[] = useMemo(
    () =>
      (data ?? []).map((cupom) => ({
        ...cupom,
        chave: `${cupom.vendedor}|${cupom.desconto ?? ""}`,
        dias: diasAte(cupom.vence),
        score: calcularScore(cupom, agora),
      })),
    [data, agora],
  );

  return (
    <LayoutConteudo
      etiqueta={categoria.nome}
      titulo={`Cupons de ${categoria.nome}`}
      resumo={categoria.resumo}
      atualizacao={categoria.atualizacao}
      trilha={
        <Link to="/categorias" className="font-semibold text-white underline hover:opacity-80">
          Todas as categorias
        </Link>
      }
    >
      <h2 className="flex items-center gap-2">
        <Tag className="size-5" style={{ color: tom }} aria-hidden="true" />
        {isLoading
          ? "Carregando os cupons desta categoria"
          : cupons.length === 1
            ? "1 cupom conferido nesta categoria"
            : `${cupons.length} cupons conferidos nesta categoria`}
      </h2>

      {isLoading ? (
        <p>Buscando os cupons desta categoria...</p>
      ) : cupons.length === 0 ? (
        <p>
          Não há, neste momento, cupom confirmado para esta categoria na nossa base. Isso não
          significa que não existam ofertas: significa apenas que nada foi verificado por aqui, e
          preferimos dizer isso a inventar uma lista.{" "}
          <Link to="/" className="font-semibold text-ml-blue hover:underline">
            Ver todos os cupons conferidos
          </Link>
          .
        </p>
      ) : (
        <>
          <p>
            Cada cartão mostra as condições lidas da própria campanha do vendedor. Condições mudam
            sem aviso — confirme no carrinho antes de pagar.
          </p>
          <div className="not-prose grid gap-4 sm:grid-cols-2">
            {cupons.map((cupom) => (
              <CupomCard
                key={cupom.id}
                cupom={cupom}
                agora={agora}
                abrirCondicoes={setCupomAberto}
                selecionado={false}
                alternarSelecao={() => {}}
                permitirComparar={false}
              />
            ))}
          </div>
          <CondicoesModal cupom={cupomAberto} fechar={() => setCupomAberto(null)} />
          <p className="text-sm">
            <Link to="/" className="font-semibold text-ml-blue hover:underline">
              Ver todos os cupons e comparar economia
            </Link>
          </p>
          <AvisoAfiliado className="mt-3 text-xs text-secondary-ink" />
        </>
      )}

      <AdInArticle />

      <h2>Dicas para comprar em {categoria.nome.toLowerCase()}</h2>
      {categoria.introducao.map((paragrafo) => (
        <p key={paragrafo}>{paragrafo}</p>
      ))}

      <h3 className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
        O que conferir antes de comprar
      </h3>
      <ul className="lista-marcada !list-none !pl-0 space-y-2">
        {categoria.comoAvaliar.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h3 className="flex items-center gap-2">
        <AlertTriangle className="size-5 text-urgency-warning" aria-hidden="true" />
        Erros que custam caro
      </h3>
      <ul className="lista-alerta !list-none !pl-0 space-y-2">
        {categoria.cuidados.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>Perguntas frequentes</h2>
      <div className="not-prose space-y-3">
        {categoria.perguntas.map((item) => (
          <div
            key={item.pergunta}
            className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-secondary-ink"
          >
            <p className="font-bold text-foreground">{item.pergunta}</p>
            <p className="mt-1.5">{item.resposta}</p>
          </div>
        ))}
      </div>

      <h2>Outras categorias</h2>
      <div className="not-prose grid gap-3 sm:grid-cols-2">
        {CATEGORIAS.filter((item) => item.slug !== categoria.slug)
          .slice(0, 4)
          .map((item) => {
            const Icone = ICONE_CATEGORIA[item.slug];
            const cor = TOM_CATEGORIA[item.slug] ?? "var(--ml-blue)";
            return (
              <Link
                key={item.slug}
                to="/categorias/$slug"
                params={{ slug: item.slug }}
                className="cartao-conteudo group flex items-center gap-3 p-3"
              >
                <span
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: cor }}
                >
                  {Icone ? <Icone className="size-4" aria-hidden="true" /> : null}
                </span>
                <span className="text-sm font-bold text-foreground">{item.nome}</span>
                <ArrowRight
                  className="ml-auto size-4 text-secondary-ink transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
      </div>
    </LayoutConteudo>
  );
}
