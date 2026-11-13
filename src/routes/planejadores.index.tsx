/* PLANNERS HUB (Weslei, 06/11/2026): one card per life moment.
   07/11 ("precisa de um espaço no site facil de ver e acessar essas
   ferramentas"): it is also the tools page of the "Planejar" tab, so Amigo
   Secreto and the wish list sit on top. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Gift, Heart } from "lucide-react";

import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { SITE } from "@/lib/lista-publica";
import { PLANEJADORES } from "@/lib/planejadores";

const TITULO = "Planejadores de compras: casa nova, enxoval e casamento";
const DESCRICAO =
  "Listas por prioridade para casa nova, enxoval do bebê, casamento e home office, com ofertas comparadas e lista de presentes para mandar no WhatsApp.";

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
            Planeje e presenteie
            <span className="block text-[#0071e3]">sem esquecer nada.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-secondary-ink">
            Amigo Secreto, lista de desejos e listas prontas para cada momento, num só lugar. Em
            cada momento você vê o que comprar primeiro, o que pode esperar e o que costuma ser
            esquecido.
          </p>
        </header>
        <ul aria-label="Para presentes" className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                to: "/amigo-secreto",
                Icone: Gift,
                cor: "#0071e3",
                titulo: "Amigo Secreto",
                texto: "Sorteio, perfil de cada amigo e presentes que combinam com ele.",
              },
              {
                to: "/favoritos",
                Icone: Heart,
                cor: "#ff2d55",
                titulo: "Lista de desejos",
                texto: "Guarde o que você quer e mande a lista no WhatsApp.",
              },
            ] as const
          ).map(({ to, Icone, cor, titulo, texto }, k) => (
            <li key={to} className="animate-cartao" style={{ animationDelay: `${k * 40}ms` }}>
              <Link
                to={to}
                className="group flex min-h-20 items-center gap-4 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] sm:p-5"
              >
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-2xl transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transform-none"
                  style={{ background: `${cor}1a`, color: cor }}
                  aria-hidden="true"
                >
                  <Icone className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold tracking-tight">{titulo}</span>
                  <span className="mt-0.5 block text-sm text-secondary-ink">{texto}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-secondary-ink" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <h2 className="-mb-2 text-xl font-extrabold tracking-tight">Planeje um momento</h2>
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
