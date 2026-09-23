import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { AdInArticle } from "@/components/anuncios/Anuncio";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { buscarGuia, GUIAS, type Bloco } from "@/content/guias";

const BASE = "https://cupons-afiliado-ml.lovable.app/guias";

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
      <ul>
        {bloco.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  if (bloco.tipo === "passos")
    return (
      <ol>
        {bloco.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  if (bloco.tipo === "destaque")
    return (
      <div className="rounded-xl border-l-4 border-ml-blue bg-card p-4">
        <p className="text-sm font-bold text-foreground">{bloco.titulo}</p>
        <p className="mt-1 text-sm">{bloco.texto}</p>
      </div>
    );
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-foreground">{bloco.titulo}</p>
      <dl className="mt-2 space-y-1">
        {bloco.linhas.map((linha) => (
          <div key={linha.rotulo} className="flex flex-wrap justify-between gap-2 text-sm">
            <dt className="text-secondary-ink">{linha.rotulo}</dt>
            <dd className="font-semibold text-foreground">{linha.valor}</dd>
          </div>
        ))}
      </dl>
      {bloco.nota && <p className="mt-2 text-xs text-secondary-ink">{bloco.nota}</p>}
    </div>
  );
}

function PaginaGuia() {
  const { guia } = Route.useLoaderData();
  const outros = GUIAS.filter((item) => item.slug !== guia.slug).slice(0, 3);
  const meio = Math.ceil(guia.blocos.length / 2);

  return (
    <LayoutConteudo titulo={guia.titulo} resumo={guia.resumo} atualizacao={guia.atualizacao}>
      <nav aria-label="Trilha" className="!mt-0 text-xs">
        <Link to="/guias" className="font-semibold text-ml-blue hover:underline">
          Guias
        </Link>{" "}
        · {guia.tempo}
      </nav>

      {guia.blocos.slice(0, meio).map((bloco, indice) => (
        <RenderBloco key={indice} bloco={bloco} />
      ))}

      {/* Espaço de publicidade: fica entre parágrafos, longe de qualquer botão. */}
      <AdInArticle />

      {guia.blocos.slice(meio).map((bloco, indice) => (
        <RenderBloco key={meio + indice} bloco={bloco} />
      ))}

      <h2>Perguntas frequentes</h2>
      <div className="space-y-4">
        {guia.perguntas.map((item) => (
          <div key={item.pergunta}>
            <p className="font-bold text-foreground">{item.pergunta}</p>
            <p className="mt-1">{item.resposta}</p>
          </div>
        ))}
      </div>

      {outros.length > 0 && (
        <>
          <h2>Continue lendo</h2>
          <ul>
            {outros.map((item) => (
              <li key={item.slug}>
                <Link
                  to="/guias/$slug"
                  params={{ slug: item.slug }}
                  className="font-semibold text-ml-blue hover:underline"
                >
                  {item.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </LayoutConteudo>
  );
}
