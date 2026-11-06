/* PLANNERS HUB (Weslei, 06/11/2026): one card per life moment. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { SITE } from "@/lib/lista-publica";
import { PLANEJADORES } from "@/lib/planejadores";

const TITULO = "Planejadores de compras: casa nova, enxoval, casamento e mais | Melhor Escolha";
const DESCRICAO =
  "Listas prontas por prioridade para casa nova, enxoval do bebê, casamento, home office e outros momentos, com ofertas para escolher e lista de presentes para o WhatsApp.";

export const Route = createFileRoute("/planejadores/")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:url", content: `${SITE}/planejadores` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/planejadores` }],
  }),
  component: Hub,
});

function Hub() {
  return (
    <div className="fundo-conteudo min-h-screen overflow-x-clip">
      <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
        <header className="animate-conteudo">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-[40px]">
            Um momento novo,
            <span className="block text-[#0071e3]">uma lista pronta.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-secondary-ink">
            Escolha o momento e veja o que comprar primeiro, o que pode esperar e o que costuma ser
            esquecido. O que você quiser ganhar vira uma lista de presentes.
          </p>
        </header>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PLANEJADORES.map((p, k) => (
            <li key={p.slug} className="animate-cartao" style={{ animationDelay: `${k * 40}ms` }}>
              <Link
                to="/planejadores/$slug"
                params={{ slug: p.slug }}
                className="group flex min-h-24 items-center gap-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
              >
                <span
                  className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f5f5f7] text-3xl transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transform-none dark:bg-white/5"
                  aria-hidden="true"
                >
                  {p.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold tracking-tight">{p.titulo}</span>
                  <span className="mt-0.5 block text-sm text-secondary-ink">{p.resumo}</span>
                  <span className="mt-1 block text-xs font-semibold text-[#0071e3]">
                    {p.itens.length} itens em 3 fases
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-secondary-ink" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <RodapeInstitucional />
    </div>
  );
}
