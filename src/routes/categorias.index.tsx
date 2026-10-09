import { createFileRoute } from "@tanstack/react-router";
import {
  Car,
  Laptop,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Tv,
  type LucideIcon,
  Blocks,
} from "lucide-react";

import { CartaoCategoria } from "@/components/CartaoCategoria";
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
  brinquedos: Blocks,
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
  brinquedos: "oklch(0.64 0.16 75)",
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
        content:
          "O que muda na avaliação de uma oferta em eletrônicos, moda, casa, automotivo e mais.",
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
      etiqueta="Explore por categoria"
      titulo="Categorias"
      resumo="Os produtos que já comparei em cada categoria e o que conferir antes de comprar."
      atualizacao="09/10/2026"
      trilha={<span>{CATEGORIAS.length} categorias</span>}
    >
      <p>
        Cole o link do produto e eu mostro o mesmo produto em outras lojas dentro do Mercado Livre,
        do mais barato ao mais caro. Em cada categoria você vê o que já foi comparado e os cuidados
        que mais pesam na hora de escolher.
      </p>

      {/* div, não ul: o estilo de texto da página põe marcador e recuo em
          listas. */}
      <div className="not-prose grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIAS.map((categoria) => (
          <CartaoCategoria key={categoria.slug} slug={categoria.slug} nome={categoria.nome} />
        ))}
      </div>
    </LayoutConteudo>
  );
}
