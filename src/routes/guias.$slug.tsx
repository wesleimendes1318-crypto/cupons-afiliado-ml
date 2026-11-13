import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Calculator, Lightbulb } from "lucide-react";

import { Anuncio, ADSENSE_SLOT_GUIA_MEIO, ADSENSE_SLOT_GUIA_FIM } from "@/components/Anuncio";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { buscarCategoria } from "@/content/categorias";
import { buscarGuia, GUIAS, type Bloco, type Guia } from "@/content/guias";
import { AUTOR_LD, dataIso, EDITORA_LD } from "@/lib/autor";
import { AssinaturaAutor } from "@/components/AssinaturaAutor";

const BASE = "https://melhorescolha.io/guias";

/** Title tag: append the brand only while it stays within 60 characters. */
const tituloSeo = (titulo: string) => (titulo.length <= 43 ? `${titulo} | Melhor Escolha` : titulo);

/** Hub-and-spoke: declared siblings first, then guides of the same category, then the rest. */
function continuarLendo(guia: Guia): Guia[] {
  const outros = GUIAS.filter((g) => g.slug !== guia.slug);
  const rel = (guia.relacionados ?? [])
    .map((s) => outros.find((g) => g.slug === s))
    .filter((g): g is Guia => !!g);
  const resto = outros.filter((g) => !rel.includes(g));
  const mesmaCategoria = resto.filter((g) => guia.categoria && g.categoria === guia.categoria);
  return [...rel, ...mesmaCategoria, ...resto.filter((g) => !mesmaCategoria.includes(g))].slice(
    0,
    3,
  );
}

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
        { title: tituloSeo(guia.titulo) },
        { name: "description", content: guia.descricao ?? guia.resumo },
        { property: "og:title", content: guia.titulo },
        { property: "og:description", content: guia.descricao ?? guia.resumo },
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
            author: AUTOR_LD,
            publisher: EDITORA_LD,
            datePublished: dataIso(guia.publicado ?? guia.atualizacao),
            dateModified: dataIso(guia.atualizacao),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: guia.perguntas.map((item) => ({
              "@type": "Question",
              name: item.pergunta,
              acceptedAnswer: { "@type": "Answer", text: item.resposta },
            })),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Início",
                item: "https://melhorescolha.io/",
              },
              { "@type": "ListItem", position: 2, name: "Guias", item: BASE },
              { "@type": "ListItem", position: 3, name: guia.titulo, item: url },
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
    <LayoutConteudo
      titulo="Guia não encontrado"
      resumo="Este endereço não corresponde a nenhum guia publicado."
    >
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
  const outros = continuarLendo(guia);
  const categoria = guia.categoria ? buscarCategoria(guia.categoria) : undefined;
  /* Anúncio depois do 2º bloco do texto (ou do 1º, em guia curto). */
  const meio = Math.min(2, Math.max(1, guia.blocos.length - 1));

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
          {categoria && (
            <Link
              to="/categorias/$slug"
              params={{ slug: categoria.slug }}
              className="font-semibold text-white underline hover:opacity-80"
            >
              {categoria.nome}
            </Link>
          )}
          <span>{guia.tempo}</span>
        </>
      }
    >
      <AssinaturaAutor publicado={guia.publicado} atualizado={guia.atualizacao} />

      {guia.blocos.slice(0, meio).map((bloco, indice) => (
        <RenderBloco key={indice} bloco={bloco} />
      ))}

      {/* Publicidade: só nos artigos dos Guias, entre parágrafos (docs/adsense.md). */}
      <Anuncio key={`meio-${guia.slug}`} slot={ADSENSE_SLOT_GUIA_MEIO} />

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

      <p className="not-prose text-xs leading-relaxed text-secondary-ink">
        Por Weslei Mendes Silva, atualizado em {guia.atualizacao}.{" "}
        <Link to="/sobre" className="font-semibold text-ml-blue hover:underline">
          Como comparamos
        </Link>
        {" · "}
        <Link to="/divulgacao-de-afiliados" className="font-semibold text-ml-blue hover:underline">
          Divulgação de afiliados
        </Link>
        {" · "}
        <Link to="/contato" className="font-semibold text-ml-blue hover:underline">
          Contato
        </Link>
      </p>

      <Anuncio key={`fim-${guia.slug}`} slot={ADSENSE_SLOT_GUIA_FIM} />

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
