import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Link2 } from "lucide-react";

import { AdInArticle } from "@/components/anuncios/Anuncio";
import { BannerArte } from "@/components/BannerArte";
import { CartaoCategoria } from "@/components/CartaoCategoria";
import { CatalogoCategoria } from "@/components/CatalogoCategoria";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { AvisoAfiliado, RodapeInstitucional } from "@/components/RodapeInstitucional";
import { Vitrine } from "@/components/Vitrine";
import { buscarCategoria } from "@/content/categorias";
import { buscarNo, DEPARTAMENTOS, NOS, subarvore } from "@/content/taxonomia";
import { useVisitaCategoria } from "@/lib/perfil-visitante";
import { supabase } from "@/integrations/supabase/client";
import { ARTE_NEUTRA, arteDaCategoria, arteSalva, srcArte, type Arte } from "@/lib/artes";

const BASE = "https://melhorescolha.io/categorias";

export const Route = createFileRoute("/categorias/$slug")({
  /* Qualquer nó da árvore (src/content/taxonomia.ts, 27/10); os 10 slugs
     antigos são nós, então os endereços antigos continuam iguais. O texto
     editorial (dicas, perguntas) só existe para os antigos. */
  loader: async ({ params }) => {
    const no = buscarNo(params.slug);
    if (!no) throw notFound();
    let contagem: Record<string, number> | null = null;
    try {
      const { data } = await supabase.rpc("em_alta_contagem_nos" as never);
      if (Array.isArray(data))
        contagem = Object.fromEntries(
          (data as Array<{ categoria_no: string; total: number }>).map((r) => [
            r.categoria_no,
            r.total,
          ]),
        );
    } catch {
      /* sem contagem: a página abre igual, só sem os números iniciais */
    }
    /* Arte gerada do departamento sem arte no acervo (27/10), no HTML. */
    let arteDep: string | null = null;
    try {
      const { data } = await supabase.rpc("artes_campanhas" as never);
      const r = Array.isArray(data)
        ? (data as Array<{ tema: string; url: string }>).find(
            (x) => x.tema === `dep:${no.caminho[0]}`,
          )
        : null;
      if (r && /^https:\/\//.test(r.url)) arteDep = r.url;
    } catch {
      /* sem arte salva: a da categoria antiga ou a neutra */
    }
    return { no, categoria: buscarCategoria(params.slug), contagem, arteDep };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Categoria não encontrada" }, { name: "robots", content: "noindex" }],
      };
    }
    const { no, categoria, contagem, arteDep } = loaderData;
    const url = `${BASE}/${params.slug}`;
    const titulo = `${no.nome}: compare preços antes de comprar`;
    const descricao =
      categoria?.chamada ??
      `Os mais vendidos de ${no.nome.toLowerCase()} no Mercado Livre, só com nota 4,5 ou mais, com filtros e comparação de preço antes de comprar.`;
    const arte = arteDoNo(no.caminho, arteDep);
    /* Página vazia não entra no Google (some sozinha quando ganha produto). */
    const vazia = contagem !== null && totalDe(no.slug, contagem) === 0;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        ...(vazia ? [{ name: "robots", content: "noindex, follow" }] : []),
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        ...(arte
          ? [
              {
                property: "og:image",
                content: arte.src ?? `https://melhorescolha.io${srcArte(arte.id)}`,
              },
            ]
          : []),
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
              ...no.caminho.map((s, k) => ({
                "@type": "ListItem",
                position: k + 2,
                name: NOS[s]!.nome,
                item: `${BASE}/${s}`,
              })),
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

/* PÁGINA DE CATEGORIA (09/10, artes novas; Weslei: "ajuste as vitrines e
   categorias, inclua as artes. cuidado com todo design"). Antes listava
   cupons (fora do ar desde 24/09) e dizia "nenhum cupom"; agora mostra o que
   o site faz: banner com a arte da categoria, os produtos já comparados
   dela (a mesma vitrine da home, com as mesmas regras) e o que conferir
   antes de comprar. Texto sobre cupom do conteúdo antigo fica de fora. */
const semCupom = (t: string) => !/cupo/i.test(t);

const totalDe = (slug: string, contagem: Record<string, number>) =>
  subarvore(slug).reduce((s, x) => s + (contagem[x] ?? 0), 0);
/* Arte do próprio nó ou do ancestral mais próximo que tenha uma. */
/* 27/10 (nenhuma vitrine sem arte): sem arte na linhagem, a da categoria
   antiga equivalente e, por fim, a neutra de economia. */
/* 27/10: antes da antiga, a arte gerada para o próprio departamento. */
const arteDoNo = (caminho: string[], arteDep: string | null = null): Arte =>
  [...caminho].reverse().map(arteDaCategoria).find(Boolean) ??
  (arteDep ? arteSalva(arteDep, NOS[caminho[0] ?? ""]?.nome ?? "") : null) ??
  arteDaCategoria(NOS[caminho[caminho.length - 1] ?? ""]?.legado) ??
  ARTE_NEUTRA;

const BOTAO_PRIMARIO =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110";
const BOTAO_SECUNDARIO =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-[#7547E8]";

function PaginaCategoria() {
  const { no, categoria, contagem, arteDep } = Route.useLoaderData();
  /* Perfil local: a aba antiga equivalente (as da vitrine). */
  useVisitaCategoria(no.legado ?? no.slug);
  const arte = arteDoNo(no.caminho, arteDep);
  const avaliar = categoria?.comoAvaliar.filter(semCupom) ?? [];
  const cuidados = categoria?.cuidados.filter(semCupom) ?? [];
  const perguntas =
    categoria?.perguntas.filter((p) => semCupom(p.pergunta) && semCupom(p.resposta)) ?? [];
  const titulo = `${no.nome}: compare antes de comprar`;
  const chamada =
    categoria?.chamada ??
    `Os mais vendidos de ${no.nome.toLowerCase()} no Mercado Livre, só com nota 4,5 ou mais. Compare antes de comprar.`;
  const departamentos = DEPARTAMENTOS.filter(
    (d) => d.slug !== no.caminho[0] && (!contagem || totalDe(d.slug, contagem) > 0),
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <nav aria-label="Você está em" className="mb-3 text-xs text-secondary-ink">
          <Link to="/" className="hover:underline">
            Início
          </Link>
          <span aria-hidden="true"> › </span>
          <Link to="/categorias" className="hover:underline">
            Categorias
          </Link>
          {no.caminho.map((s) => (
            <span key={s}>
              <span aria-hidden="true"> › </span>
              {s === no.slug ? (
                <span aria-current="page" className="font-semibold text-foreground">
                  {no.nome}
                </span>
              ) : (
                <Link to="/categorias/$slug" params={{ slug: s }} className="hover:underline">
                  {NOS[s]!.nome}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {arte ? (
          <BannerArte arte={arte} etiqueta="Categoria" titulo={titulo} resumo={chamada} prioridade>
            <Link to="/" hash="colar-link" className={BOTAO_PRIMARIO}>
              <Link2 className="size-4" aria-hidden="true" />
              Colar o link e comparar
            </Link>
            {(avaliar.length > 0 || cuidados.length > 0) && (
              <a href="#dicas" className={BOTAO_SECUNDARIO}>
                O que conferir
              </a>
            )}
          </BannerArte>
        ) : (
          <header className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <h1 className="text-3xl font-extrabold tracking-tight">{titulo}</h1>
            <p className="mt-2 text-secondary-ink">{chamada}</p>
          </header>
        )}

        {categoria && (
          <Vitrine
            categoriaFixa={categoria.slug}
            vazio={
              <div className="mt-8 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
                <h2 className="text-xl font-extrabold tracking-tight">
                  Ainda não comparei produtos de {categoria.nome.toLowerCase()} por aqui
                </h2>
                <p className="mt-1 text-sm text-secondary-ink">
                  Cole o link de um anúncio e eu mostro o mesmo produto em outras lojas, do mais
                  barato ao mais caro.
                </p>
                <Link to="/" hash="colar-link" className={`${BOTAO_PRIMARIO} mt-4`}>
                  <Link2 className="size-4" aria-hidden="true" />
                  Colar o link e comparar
                </Link>
              </div>
            }
          />
        )}

        {/* Mais vendidos da lista oficial da subárvore, com subcategorias,
            filtros e ordem (27/10). */}
        <CatalogoCategoria key={no.slug} slug={no.slug} contagemInicial={contagem ?? {}} />

        <AdInArticle />

        {(avaliar.length > 0 || cuidados.length > 0) && (
          <section id="dicas" className="mt-10 scroll-mt-20" aria-labelledby="dicas-titulo">
            <h2 id="dicas-titulo" className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Antes de comprar {no.nome.toLowerCase()}
            </h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {avaliar.length > 0 && (
                <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <CheckCircle2 className="size-5 text-success" aria-hidden="true" />O que
                    conferir
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary-ink">
                    {avaliar.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-success"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cuidados.length > 0 && (
                <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <AlertTriangle className="size-5 text-urgency-warning" aria-hidden="true" />
                    Erros que custam caro
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary-ink">
                    {cuidados.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-urgency-warning"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {perguntas.length > 0 && (
          <section className="mt-8" aria-labelledby="faq-titulo">
            <h2 id="faq-titulo" className="text-xl font-extrabold tracking-tight">
              Perguntas frequentes
            </h2>
            <div className="mt-3 space-y-3">
              {perguntas.map((item) => (
                <div
                  key={item.pergunta}
                  className="rounded-3xl bg-card p-5 text-sm leading-relaxed text-secondary-ink shadow-[var(--shadow-card)]"
                >
                  <p className="font-bold text-foreground">{item.pergunta}</p>
                  <p className="mt-1.5">{item.resposta}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10" aria-labelledby="outras-titulo">
          <h2 id="outras-titulo" className="text-xl font-extrabold tracking-tight">
            Outros departamentos
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {departamentos.map((item) => (
              <li key={item.slug}>
                <CartaoCategoria slug={item.slug} nome={item.nome} />
              </li>
            ))}
          </ul>
        </section>

        <AvisoAfiliado className="mt-8 text-xs text-secondary-ink" />
      </main>
      <RodapeInstitucional />
    </div>
  );
}
