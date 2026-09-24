import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Calculator, Lightbulb } from "lucide-react";

import { AdInArticle } from "@/components/anuncios/Anuncio";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { buscarGuia, GUIAS, type Bloco } from "@/content/guias";

const BASE = "https://melhorescolha.io/guias";

export const Route = createFileRoute("/guias/$slug")({
  loader: ({ params }) => {
    const guia = buscarGuia(params.slug);
    if (!guia) throw notFound();
    return { guia };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Guia não encontrado" }, { name: "robots", content: "noindex" }],
      };
    }
    const { guia } = loaderData;
    const url = `${BASE}/${params.slug}`;
    return {
      meta: [
        { title: `${guia.titulo} — Guia` },
        { name: "description", content: guia.resumo },
        { property: "og:title", content: guia.titulo },
        { property: "og:description", content: guia.resumo },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guia.titulo,
            description: guia.resumo,
            inLanguage: "pt-BR",
            mainEntityOfPage: url,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Guias", item: BASE },
              { "@type": "ListItem", position: 2, name: guia.titulo, item: url },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: GuiaNaoEncontrado,
  component: PaginaGuia,
});

function GuiaNaoEncontrado() {
  return (
    <LayoutConteudo titulo="Guia não encontrado" resumo="Este endereço não corresponde a nenhum guia publicado.">
      <p>
        <Link to="/guias" className="font-semibold text-ml-blue hover:underline">
          Ver todos os guias
        </Link>
      </p>
    </LayoutConteudo>
  );
}

function RenderBloco({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === "h2") return <h2>{bloco.texto}</h2>;
  if (bloco.tipo === "p") return <p>{bloco.texto}</p>;
  if (bloco.tipo === "lista")
    return (
      <ul className="lista-marcada !list-none !pl-0 space-y-2">
        {bloco.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  if (bloco.tipo === "passos")
    return (
      <ol className="!list-none !pl-0 space-y-3">
        {bloco.itens.map((item, indice) => (
          <li key={item} className="flex gap-3 !ml-0">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradiente-conteudo)] text-xs font-extrabold text-white">
              {indice + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    );
  if (bloco.tipo === "destaque")
    return (
      <div className="not-prose overflow-hidden rounded-xl border border-ml-blue/25 bg-[color-mix(in_oklab,var(--ml-blue)_7%,var(--card))] p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          <Lightbulb className="size-4 text-ml-blue" aria-hidden="true" />
          {bloco.titulo}
        </p>
        <p className="mt-1.5 text-sm text-secondary-ink">{bloco.texto}</p>
      </div>
    );
  return (
    <div className="not-prose overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <p className="flex items-center gap-2 bg-[image:var(--gradiente-conteudo)] px-4 py-2.5 text-sm font-extrabold text-white">
        <Calculator className="size-4" aria-hidden="true" />
        {bloco.titulo}
      </p>
      <dl className="divide-y divide-border">
        {bloco.linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm"
          >
            <dt className="text-secondary-ink">{linha.rotulo}</dt>
            <dd className="font-bold text-foreground">{linha.valor}</dd>
          </div>
        ))}
      </dl>
      {bloco.nota && (
        <p className="border-t border-border bg-muted/50 px-4 py-2.5 text-xs text-secondary-ink">
          {bloco.nota}
        </p>
      )}
    </div>
  );
}

function PaginaGuia() {
  const { guia } = Route.useLoaderData();
  const outros = GUIAS.filter((item) => item.slug !== guia.slug).slice(0, 3);
  const meio = Math.ceil(guia.blocos.length / 2);

  return (
    <LayoutConteudo
      etiqueta="Guia"
      titulo={guia.titulo}
      resumo={guia.resumo}
      atualizacao={guia.atualizacao}
      trilha={
        <>
          <Link to="/guias" className="font-semibold text-white underline hover:opacity-80">
            Todos os guias
          </Link>
          <span>{guia.tempo}</span>
        </>
      }
    >
      {guia.blocos.slice(0, meio).map((bloco, indice) => (
        <RenderBloco key={indice} bloco={bloco} />
      ))}

      {/* Espaço de publicidade: fica entre parágrafos, longe de qualquer botão. */}
      <AdInArticle />

      {guia.blocos.slice(meio).map((bloco, indice) => (
        <RenderBloco key={meio + indice} bloco={bloco} />
      ))}

      <h2>Perguntas frequentes</h2>
      <div className="not-prose space-y-3">
        {guia.perguntas.map((item) => (
          <div
            key={item.pergunta}
            className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-secondary-ink"
          >
            <p className="font-bold text-foreground">{item.pergunta}</p>
            <p className="mt-1.5">{item.resposta}</p>
          </div>
        ))}
      </div>

      {outros.length > 0 && (
        <>
          <h2>Continue lendo</h2>
          <div className="not-prose grid gap-3 sm:grid-cols-3">
            {outros.map((item) => (
              <Link
                key={item.slug}
                to="/guias/$slug"
                params={{ slug: item.slug }}
                className="cartao-conteudo group block p-3"
              >
                <p className="text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-ml-blue">
                  {item.titulo}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-ml-blue">
                  Ler
                  <ArrowRight
                    className="size-3 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </LayoutConteudo>
  );
}
