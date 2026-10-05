import { createFileRoute } from "@tanstack/react-router";

import { PaginaTemporada } from "@/components/PaginaTemporada";

const URL = "https://melhorescolha.io/dia-das-criancas";
const TITULO = "Dia das Crianças: brinquedos com o menor preço conferido — Melhor Escolha";
const DESCRICAO =
  "Brinquedos e presentes do Dia das Crianças já comparados: o mesmo produto mais barato em outra loja ou o menor preço confirmado.";

export const Route = createFileRoute("/dia-das-criancas")({
  component: () => <PaginaTemporada id="criancas" />,
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://melhorescolha.io/sazonal/criancas.jpg" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: TITULO,
          url: URL,
          inLanguage: "pt-BR",
          description: DESCRICAO,
          isPartOf: {
            "@type": "WebSite",
            name: "Melhor Escolha",
            url: "https://melhorescolha.io/",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: "https://melhorescolha.io/" },
            { "@type": "ListItem", position: 2, name: "Dia das Crianças", item: URL },
          ],
        }),
      },
    ],
  }),
});
