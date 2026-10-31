import { createFileRoute, Link } from "@tanstack/react-router";
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
import { DEPARTAMENTOS, NOS, subarvore } from "@/content/taxonomia";
import { supabase } from "@/integrations/supabase/client";

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
  /* Contagem por nó (27/10): departamento e subcategoria sem produto não
     aparecem. Sem contagem (falha de leitura), mostra todos sem número. */
  loader: async () => {
    try {
      const { data } = await supabase.rpc("em_alta_contagem_nos" as never);
      if (!Array.isArray(data)) return { contagem: null };
      return {
        contagem: Object.fromEntries(
          (data as Array<{ categoria_no: string; total: number }>).map((r) => [
            r.categoria_no,
            r.total,
          ]),
        ) as Record<string, number>,
      };
    } catch {
      return { contagem: null };
    }
  },
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
  const { contagem } = Route.useLoaderData();
  const total = (slug: string) =>
    contagem ? subarvore(slug).reduce((s, x) => s + (contagem[x] ?? 0), 0) : undefined;
  const departamentos = DEPARTAMENTOS.filter((d) => total(d.slug) !== 0);
  return (
    <LayoutConteudo
      etiqueta="Explore por categoria"
      titulo="Categorias"
      resumo="Os produtos que já comparei em cada categoria e o que conferir antes de comprar."
      atualizacao="09/10/2026"
      trilha={<span>{departamentos.length} departamentos</span>}
    >
      <p>
        Cole o link do produto e eu mostro o mesmo produto em outras lojas dentro do Mercado Livre,
        do mais barato ao mais caro. Em cada categoria você vê o que já foi comparado e os cuidados
        que mais pesam na hora de escolher.
      </p>

      {/* div, não ul: o estilo de texto da página põe marcador e recuo em
          listas. */}
      <div className="not-prose grid grid-cols-2 gap-3 sm:grid-cols-4">
        {departamentos.map((d) => (
          <CartaoCategoria key={d.slug} slug={d.slug} nome={d.nome} total={total(d.slug)} />
        ))}
      </div>

      {/* Mapa da árvore: cada departamento com as subcategorias que têm
          produto (links reais, para quem procura e para o Google). */}
      <div className="not-prose mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {departamentos.map((d) => {
          const filhos = d.filhos.filter((f) => total(f) !== 0);
          if (!filhos.length) return null;
          return (
            <section key={d.slug} aria-labelledby={`mapa-${d.slug}`}>
              <h2 id={`mapa-${d.slug}`} className="text-base font-extrabold tracking-tight">
                <Link
                  to="/categorias/$slug"
                  params={{ slug: d.slug }}
                  className="inline-flex min-h-8 items-center hover:underline"
                >
                  {d.nome}
                </Link>
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {filhos.map((f) => (
                  <li key={f}>
                    <Link
                      to="/categorias/$slug"
                      params={{ slug: f }}
                      className="inline-flex min-h-8 items-center text-secondary-ink hover:text-foreground hover:underline"
                    >
                      {NOS[f]!.nome}
                      {total(f) ? ` (${total(f)})` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </LayoutConteudo>
  );
}
