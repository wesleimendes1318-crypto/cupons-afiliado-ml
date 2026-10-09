/* Cabeçalho único do site (home-v2, Weslei 06/10): barra branca com o logo,
   "Meus preços", "Guias", "Sobre" e a pílula "Ofertas no Telegram". Fica no
   layout raiz, igual em todas as páginas (as campanhas mantêm o tema delas
   abaixo dele). Sem logo nem cores de outra marca. */
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";

import { LINK_CANAL } from "@/lib/telegram-publico";

const LINKS = [
  { to: "/meus-precos", rotulo: "Meus preços" },
  { to: "/guias", rotulo: "Guias" },
  { to: "/sobre", rotulo: "Sobre" },
] as const;

export function CabecalhoSite() {
  return (
    <header className="relative z-30 border-b border-black/5 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="Melhor Escolha, página inicial"
          className="flex shrink-0 items-center gap-2"
        >
          <img
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className="size-9 rounded-[22%] shadow-sm sm:size-10"
          />
          <span className="text-base font-extrabold tracking-tight text-[#21134A] dark:text-white sm:text-lg">
            Melhor Escolha
          </span>
        </Link>
        <nav aria-label="Páginas do site" className="ml-auto flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/10 sm:inline-flex"
              activeProps={{ className: "font-semibold text-[#7547E8]" }}
            >
              {l.rotulo}
            </Link>
          ))}
          <a
            href={LINK_CANAL}
            target="_blank"
            rel="noopener noreferrer"
            data-origem="topo"
            aria-label="Ofertas no Telegram: abrir o canal de ofertas comparadas (abre em nova aba)"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#7547E8]/50 px-3 text-sm font-semibold text-[#21134A] transition-colors hover:bg-[#7547E8]/10 dark:text-white sm:min-h-10 sm:px-4"
          >
            <Send className="size-4 text-[#7547E8]" aria-hidden="true" />
            <span className="hidden min-[400px]:inline">Ofertas no Telegram</span>
            <span className="min-[400px]:hidden">Ofertas</span>
          </a>
        </nav>
      </div>
      {/* Celular: os links numa linha própria, sem menu escondido. */}
      <nav
        aria-label="Páginas do site (celular)"
        className="flex justify-center gap-1 border-t border-black/5 px-2 py-1 sm:hidden dark:border-white/10"
      >
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f] dark:text-white/90"
            activeProps={{ className: "font-semibold text-[#7547E8]" }}
          >
            {l.rotulo}
          </Link>
        ))}
      </nav>
    </header>
  );
}
