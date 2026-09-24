import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Car,
  Laptop,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Tv,
  type LucideIcon,
} from "lucide-react";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { CATEGORIAS } from "@/content/categorias";

const URL = "https://melhorescolha.io/categorias";

export const ICONE_CATEGORIA: Record<string, LucideIcon> = {
  eletronicos: Tv,
  celulares: Smartphone,
  informatica: Laptop,
  casa: Sofa,
  moda: Shirt,
  beleza: Sparkles,
  automotivo: Car,
};

/** Um tom por categoria, para a página não ser um bloco único de cor. */
export const TOM_CATEGORIA: Record<string, string> = {
  eletronicos: "oklch(0.58 0.16 264)",
  celulares: "oklch(0.60 0.15 200)",
  informatica: "oklch(0.58 0.14 175)",
  casa: "oklch(0.62 0.14 145)",
  moda: "oklch(0.62 0.17 350)",
  beleza: "oklch(0.63 0.16 320)",
  automotivo: "oklch(0.60 0.15 40)",
};

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
      etiqueta="Curadoria por tipo de produto"
      titulo="Categorias"
      resumo="O que muda na hora de avaliar uma oferta dependendo do tipo de produto."
      atualizacao="23/09/2026"
      trilha={<span>{CATEGORIAS.length} categorias com orientação própria</span>}
    >
      <p>
        O mesmo cupom rende de formas muito diferentes conforme o que você compra. Em moda,
        onde a compra é menor, o percentual quase todo se realiza. Em eletrônicos, o teto trava
        o desconto em poucos reais. Cada página abaixo explica esse comportamento e o que
        conferir antes de fechar a compra.
      </p>

      <div className="not-prose grid gap-4 sm:grid-cols-2">
        {CATEGORIAS.map((categoria, indice) => {
          const Icone = ICONE_CATEGORIA[categoria.slug] ?? Sparkles;
          const tom = TOM_CATEGORIA[categoria.slug] ?? "var(--ml-blue)";
          return (
            <Link
              key={categoria.slug}
              to="/categorias/$slug"
              params={{ slug: categoria.slug }}
              className="cartao-conteudo animate-conteudo group block p-4"
              style={{ animationDelay: `${indice * 55}ms` }}
            >
              <span
                className="inline-flex size-9 items-center justify-center rounded-lg text-white"
                style={{ background: tom }}
              >
                <Icone className="size-5" aria-hidden="true" />
              </span>
              <h2
                className="mt-3 text-base font-bold text-foreground transition-colors"
                style={{ color: undefined }}
              >
                {categoria.nome}
              </h2>
              <p className="mt-1 text-sm text-secondary-ink">{categoria.resumo}</p>
              <p
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: tom }}
              >
                Ver orientações
                <ArrowRight
                  className="size-3.5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </p>
            </Link>
          );
        })}
      </div>
    </LayoutConteudo>
  );
}
