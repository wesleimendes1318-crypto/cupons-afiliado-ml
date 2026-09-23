import { createFileRoute, Link } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { CATEGORIAS } from "@/content/categorias";

const URL = "https://cupons-afiliado-ml.lovable.app/categorias";

export const Route = createFileRoute("/categorias/")({
  component: Categorias,
  head: () => ({
    meta: [
      { title: "Categorias — como avaliar ofertas em cada tipo de produto" },
      {
        name: "description",
        content:
          "Orientações por categoria: onde o cupom rende, o que conferir antes de comprar e os erros mais comuns em cada tipo de produto.",
      },
      { property: "og:title", content: "Categorias — como avaliar ofertas" },
      {
        property: "og:description",
        content: "O que muda na avaliação de uma oferta em eletrônicos, moda, casa, automotivo e mais.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Categorias() {
  return (
    <LayoutConteudo
      titulo="Categorias"
      resumo="O que muda na hora de avaliar uma oferta dependendo do tipo de produto."
      atualizacao="23/09/2026"
    >
      <p>
        O mesmo cupom rende de formas muito diferentes conforme o que você compra. Em moda,
        onde a compra é menor, o percentual quase todo se realiza. Em eletrônicos, o teto trava
        o desconto em poucos reais. Cada página abaixo explica esse comportamento e o que
        conferir antes de fechar a compra.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CATEGORIAS.map((categoria) => (
          <Link
            key={categoria.slug}
            to="/categorias/$slug"
            params={{ slug: categoria.slug }}
            className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <h2 className="!mt-0 text-base font-bold text-foreground group-hover:text-ml-blue">
              {categoria.nome}
            </h2>
            <p className="mt-1 text-sm text-secondary-ink">{categoria.resumo}</p>
          </Link>
        ))}
      </div>
    </LayoutConteudo>
  );
}
