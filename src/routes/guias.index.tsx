import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { GUIAS } from "@/content/guias";

const URL = "https://melhorescolha.io/guias";

export const Route = createFileRoute("/guias/")({
  component: Guias,
  head: () => ({
    meta: [
      { title: "Guias para comparar preços — Melhor Escolha" },
      {
        name: "description",
        content:
          "Guias práticos para achar o mesmo produto mais barato, diferenciar produto igual de parecido e conferir a loja antes de pagar.",
      },
      { property: "og:title", content: "Guias para comparar preços" },
      {
        property: "og:description",
        content: "Como achar o mesmo produto mais barato e não cair em anúncio parecido.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Guias para comparar preços",
          itemListElement: GUIAS.map((guia, indice) => ({
            "@type": "ListItem",
            position: indice + 1,
            name: guia.titulo,
            url: `${URL}/${guia.slug}`,
          })),
        }),
      },
    ],
  }),
});

function Guias() {
  return (
    <LayoutConteudo
      etiqueta="Conteúdo próprio"
      titulo="Guias"
      resumo="Como achar o mesmo produto mais barato, diferenciar igual de parecido e comprar com segurança. Os guias de cupom continuam aqui, mais abaixo."
      atualizacao="25/09/2026"
      trilha={
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="size-3.5" aria-hidden="true" />
          {GUIAS.length} guias publicados
        </span>
      }
    >
      <p>
        Todo guia aqui nasceu de uma dúvida concreta de quem estava prestes a comprar. São textos
        curtos, com exemplos numéricos, e nenhum deles precisa que você clique em nada para ser
        útil.
      </p>

      <div className="not-prose grid gap-4 sm:grid-cols-2">
        {GUIAS.map((guia, indice) => (
          <Link
            key={guia.slug}
            to="/guias/$slug"
            params={{ slug: guia.slug }}
            className="cartao-conteudo animate-conteudo group block p-4"
            style={{ animationDelay: `${indice * 60}ms` }}
          >
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[image:var(--gradiente-conteudo)] text-sm font-extrabold text-white">
              {indice + 1}
            </span>
            <h2 className="mt-3 text-base font-bold leading-snug text-foreground transition-colors group-hover:text-ml-blue">
              {guia.titulo}
            </h2>
            <p className="mt-1 text-sm text-secondary-ink">{guia.resumo}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ml-blue">
              {guia.tempo}
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </p>
          </Link>
        ))}
      </div>
    </LayoutConteudo>
  );
}
