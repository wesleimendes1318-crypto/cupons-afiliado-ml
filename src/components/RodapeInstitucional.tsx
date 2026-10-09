/* Rodapé (home-v2, Weslei 06/10, mockup "para o rodapé"): faixa em degradê
   "Continue escolhendo melhor." com o canal e o bot do Telegram, marca,
   três colunas (Explore, Institucional, Sua privacidade) e o quadro
   "Transparência em cada escolha" (afiliado + site independente). */
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Info, Send } from "lucide-react";

import { abrirPreferencias } from "@/lib/consentimento";
import { LINK_CANAL, linkDoBot } from "@/lib/telegram-publico";

const COLUNAS = [
  {
    titulo: "Explore",
    links: [
      { to: "/guias", rotulo: "Guias" },
      { to: "/natal", rotulo: "Natal" },
      { to: "/dia-das-criancas", rotulo: "Dia das Crianças" },
      { to: "/brinquedos", rotulo: "Brinquedos por idade" },
      { to: "/telegram", rotulo: "Canal de ofertas" },
    ],
  },
  {
    titulo: "Institucional",
    links: [
      { to: "/sobre", rotulo: "Sobre o site" },
      { to: "/contato", rotulo: "Contato" },
      { to: "/divulgacao-de-afiliados", rotulo: "Divulgação de afiliados" },
    ],
  },
  {
    titulo: "Sua privacidade",
    links: [
      { to: "/politica-de-privacidade", rotulo: "Privacidade" },
      { to: "/politica-de-cookies", rotulo: "Cookies" },
      { to: "/termos-de-uso", rotulo: "Termos de uso" },
    ],
  },
] as const;

/** Aviso curto de relação comercial. Aparece perto de qualquer lista de ofertas. */
export function AvisoAfiliado({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-xs text-secondary-ink"}>
      Este site pode receber comissão por compras feitas através de determinados links. O preço que
      você paga não aumenta por causa disso.{" "}
      <Link to="/divulgacao-de-afiliados" className="font-semibold text-ml-blue hover:underline">
        Saiba como funciona
      </Link>
      .
    </p>
  );
}

const LINK =
  "text-sm text-[#5b5870] transition-colors hover:text-[#7547E8] dark:text-white/70 dark:hover:text-white";

export function RodapeInstitucional() {
  return (
    <footer className="mt-12 bg-[#F7F5FC] dark:bg-neutral-950">
      <div className="mx-auto max-w-[1400px] px-4 pb-8 pt-10 sm:px-6 lg:px-8">
        {/* Faixa do Telegram */}
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(105deg,#3d8bfd_0%,#5b6cf5_45%,#a77ff0_100%)] px-6 py-7 text-white shadow-[0_18px_40px_-20px_rgba(117,71,232,0.6)] sm:px-10 sm:py-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 right-24 size-72 rounded-full bg-white/10"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-extrabold tracking-tight sm:text-4xl">
                Continue escolhendo melhor.
              </p>
              <p className="mt-1 text-sm text-white/90 sm:text-lg">
                Acompanhe as ofertas comparadas no nosso Telegram.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-center">
              <a
                href={LINK_CANAL}
                target="_blank"
                rel="noopener noreferrer"
                data-origem="rodape"
                className="inline-flex items-center gap-2 rounded-full bg-ml-yellow px-6 py-3 text-sm font-bold text-[#21134A] shadow-lg shadow-black/10 transition hover:brightness-95 sm:text-base"
              >
                <Send className="size-5" aria-hidden="true" />
                Ver ofertas no Telegram
              </a>
              <a
                href={linkDoBot("rodape")}
                target="_blank"
                rel="noopener noreferrer"
                data-origem="rodape"
                className="inline-flex items-center gap-1 text-sm text-white/90 underline underline-offset-4 hover:text-white"
              >
                Abrir bot <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        {/* Marca e colunas */}
        <div className="mt-10 grid gap-8 md:grid-cols-[1.3fr_1fr_1fr_1fr] md:gap-0 md:divide-x md:divide-[#21134A]/10 dark:md:divide-white/10">
          <div className="md:pr-8">
            <Link
              to="/"
              className="inline-flex items-center gap-3"
              aria-label="Melhor Escolha, página inicial"
            >
              <img
                src="/logo.png"
                alt=""
                width={56}
                height={56}
                className="size-14 rounded-[22%] shadow-sm"
              />
              <span className="text-2xl font-extrabold tracking-tight text-[#21134A] dark:text-white">
                Melhor Escolha
              </span>
            </Link>
            <p className="mt-4 font-bold text-[#21134A] dark:text-white">
              Compare antes. Escolha melhor.
            </p>
            <p className="mt-1 text-sm text-[#5b5870] dark:text-white/70">
              Compare preços em diferentes lojas do Mercado Livre.
            </p>
          </div>
          {COLUNAS.map((c) => (
            <nav key={c.titulo} aria-label={c.titulo} className="md:px-8">
              <p className="font-bold text-[#21134A] dark:text-white">{c.titulo}</p>
              <ul className="mt-3 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className={LINK}>
                      {l.rotulo}
                    </Link>
                  </li>
                ))}
                {c.titulo === "Sua privacidade" && (
                  <li>
                    <button type="button" onClick={abrirPreferencias} className={LINK}>
                      Preferências de cookies
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          ))}
        </div>

        {/* Transparência */}
        <section
          aria-label="Transparência em cada escolha"
          className="mt-10 rounded-3xl border border-[#C8B6FF]/60 bg-white/70 p-5 sm:p-7 dark:border-white/10 dark:bg-white/5"
        >
          <p className="flex items-center gap-3 text-lg font-extrabold text-[#21134A] dark:text-white">
            <Info className="size-7 text-[#7547E8]" aria-hidden="true" />
            Transparência em cada escolha
          </p>
          <div className="mt-4 grid gap-5 md:grid-cols-2 md:gap-0 md:divide-x md:divide-[#21134A]/10 dark:md:divide-white/10">
            <div className="md:pr-8">
              <p className="font-bold text-[#21134A] dark:text-white">Links de afiliado</p>
              <p className="mt-1 text-sm text-[#5b5870] dark:text-white/70">
                Podemos receber comissão por compras feitas pelos nossos links, sem aumentar o preço
                para você.
              </p>
              <Link
                to="/divulgacao-de-afiliados"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#7547E8] underline underline-offset-4"
              >
                Saiba como funciona <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="md:pl-8">
              <p className="font-bold text-[#21134A] dark:text-white">Site independente</p>
              <p className="mt-1 text-sm text-[#5b5870] dark:text-white/70">
                Somos participantes do programa de afiliados. Não somos o site oficial do Mercado
                Livre nem das lojas anunciadas, e não temos patrocínio ou aprovação deles.
              </p>
            </div>
          </div>
          <div className="mt-5 border-t border-[#21134A]/10 pt-4 dark:border-white/10">
            <p className="text-sm text-[#5b5870] dark:text-white/70">
              Preços, estoque e frete podem mudar. Confira as condições na página da loja antes de
              comprar.
            </p>
            <p className="mt-1 text-xs text-[#5b5870]/80 dark:text-white/50">
              As marcas pertencem aos seus respectivos titulares.
            </p>
          </div>
        </section>

        <p className="mt-8 border-t border-[#21134A]/10 pt-5 text-sm text-[#5b5870] dark:border-white/10 dark:text-white/60">
          Melhor Escolha · Compare com clareza.
        </p>
      </div>
    </footer>
  );
}
