import { createFileRoute, Link } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { GUIAS } from "@/content/guias";

const URL = "https://cupons-afiliado-ml.lovable.app/guias";

export const Route = createFileRoute("/guias/")({
  component: Guias,
  head: () => ({
    meta: [
      { title: "Guias de cupons e economia real — Cupons de Lojas Afiliadas" },
      {
        name: "description",
        content:
          "Guias práticos para calcular a economia real de um cupom, entender tetos e valores mínimos e evitar ofertas falsas.",
      },
      { property: "og:title", content: "Guias de cupons e economia real" },
      {
        property: "og:description",
        content: "Como cupons funcionam de verdade, com as contas e os limites explicados.",
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
          name: "Guias de cupons e economia real",
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
      titulo="Guias"
      resumo="Como cupons funcionam de verdade: as contas, os limites e as armadilhas, explicados sem enrolação."
      atualizacao="23/09/2026"
    >
      <p>
        Todo guia aqui nasceu de uma dúvida concreta de quem estava prestes a comprar. São
        textos curtos, com exemplos numéricos, e nenhum deles precisa que você clique em nada
        para ser útil.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {GUIAS.map((guia) => (
          <Link
            key={guia.slug}
            to="/guias/$slug"
            params={{ slug: guia.slug }}
            className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <h2 className="!mt-0 text-base font-bold text-foreground group-hover:text-ml-blue">
              {guia.titulo}
            </h2>
            <p className="mt-1 text-sm text-secondary-ink">{guia.resumo}</p>
            <p className="mt-2 text-xs text-secondary-ink">{guia.tempo}</p>
          </Link>
        ))}
      </div>
    </LayoutConteudo>
  );
}
