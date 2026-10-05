import { createFileRoute } from "@tanstack/react-router";

import { PaginaTemporada } from "@/components/PaginaTemporada";

const URL = "https://melhorescolha.io/natal";
const TITULO = "Presentes de Natal com o menor preço conferido — Melhor Escolha";
const DESCRICAO =
  "Presentes de Natal já comparados: o mesmo produto mais barato em outra loja, alternativas de qualidade igual ou melhor e o menor preço confirmado. Comprar antes é economizar.";

export const Route = createFileRoute("/natal")({
  component: () => <PaginaTemporada id="natal" />,
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://melhorescolha.io/sazonal/natal.jpg" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});
