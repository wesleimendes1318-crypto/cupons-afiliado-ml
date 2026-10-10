/* Cabeçalho único do site (home-v2, Weslei 06/10): logo, "Meus preços",
   "Guias", "Sobre" e a pílula "Ofertas no Telegram". Fica no layout raiz,
   igual em todas as páginas (as campanhas mantêm o tema delas abaixo dele).
   Sem logo nem cores de outra marca.
   NAVEGAÇÃO SOFT (design de 10/10): fixo no topo, em vidro (desfoque) com uma
   linha fina; na tela inicial, depois que o campo do link sai da tela, aparece
   "Cole o link de outro produto" (PC) ou o ícone do link (celular), para
   comparar outro produto sem voltar ao topo. No celular os links das páginas
   ficam numa linha própria logo abaixo, que rola com a página (sem menu
   escondido). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Link2, Send } from "lucide-react";

import { LINK_CANAL } from "@/lib/telegram-publico";

const LINKS = [
  { to: "/meus-precos", rotulo: "Meus preços" },
  { to: "/guias", rotulo: "Guias" },
  { to: "/sobre", rotulo: "Sobre" },
] as const;

/* O campo do link da tela inicial está escondido atrás do cabeçalho? */
function useCampoForaDaTela(ativo: boolean) {
  const [fora, setFora] = useState(false);
  useEffect(() => {
    if (!ativo) {
      setFora(false);
      return;
    }
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const campo = document.getElementById("campo-link-produto");
      setFora(Boolean(campo && campo.getBoundingClientRect().bottom < 64));
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [ativo]);
  return fora;
}

function irAoCampo() {
  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById("colar-link")
    ?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
  window.setTimeout(() => document.getElementById("campo-link-produto")?.focus(), 450);
}

export function CabecalhoSite() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const naInicial = caminho === "/";
  const mostrarCampo = useCampoForaDaTela(naInicial);
  const [valor, setValor] = useState("");

  const comparar = (e: FormEvent) => {
    e.preventDefault();
    const alvo = valor.trim();
    if (!alvo) {
      irAoCampo();
      return;
    }
    window.dispatchEvent(new CustomEvent("comparar-link", { detail: alvo }));
    setValor("");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-neutral-950/90">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:h-[60px] sm:gap-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="Melhor Escolha, página inicial"
            className="flex shrink-0 items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
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

          {/* PC: comparar outro produto direto do cabeçalho. */}
          {naInicial && (
            <form
              role="search"
              onSubmit={comparar}
              aria-hidden={!mostrarCampo}
              className={
                "hidden h-10 max-w-[460px] flex-1 items-center gap-2 rounded-full border border-[#e4e4e7] bg-white pl-3.5 pr-1 transition-opacity duration-200 ease-out motion-reduce:transition-none dark:border-white/15 dark:bg-white/5 md:flex " +
                (mostrarCampo ? "opacity-100" : "pointer-events-none opacity-0")
              }
            >
              <label htmlFor="link-topo" className="sr-only">
                Link de outro produto
              </label>
              <Link2 className="size-4 shrink-0 text-[#6b6b70]" aria-hidden="true" />
              <input
                id="link-topo"
                type="text"
                inputMode="url"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                tabIndex={mostrarCampo ? 0 : -1}
                placeholder="Cole o link de outro produto"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[#0f1729] outline-none placeholder:text-[#6b6b70] dark:text-white"
              />
              <button
                type="submit"
                tabIndex={mostrarCampo ? 0 : -1}
                className="h-8 shrink-0 rounded-full bg-[#0071e3] px-3.5 text-xs font-semibold text-white transition duration-150 ease-out hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transition-none"
              >
                Comparar
              </button>
            </form>
          )}

          <nav aria-label="Páginas do site" className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Celular: o ícone do link leva ao campo (alvo de 44 px). */}
            {naInicial && mostrarCampo && (
              <button
                type="button"
                onClick={irAoCampo}
                aria-label="Colar link de outro produto"
                title="Colar link de outro produto"
                className="inline-flex size-11 items-center justify-center rounded-full text-[#0f1729] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white md:hidden"
              >
                <Link2 className="size-5" aria-hidden="true" />
              </button>
            )}
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white/90 dark:hover:bg-white/10 sm:inline-flex"
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
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#7547E8]/50 px-3 text-sm font-semibold text-[#21134A] transition-colors hover:bg-[#7547E8]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white sm:px-4"
            >
              <Send className="size-4 text-[#7547E8]" aria-hidden="true" />
              <span className="hidden min-[400px]:inline">Ofertas no Telegram</span>
              <span className="min-[400px]:hidden">Ofertas</span>
            </a>
          </nav>
        </div>
      </header>
      {/* Celular: os links numa linha própria, sem menu escondido (rola com a
          página; só o cabeçalho fica fixo). */}
      <nav
        aria-label="Páginas do site (celular)"
        className="flex justify-center gap-1 border-b border-black/5 bg-white/90 px-2 py-1 sm:hidden dark:border-white/10 dark:bg-neutral-950/90"
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
    </>
  );
}
