/* Cabeçalho único do site (home-v2, Weslei 06/10): logo, "Meus preços",
   "Guias", "Sobre" e a pílula "Ofertas no Telegram". Fica no layout raiz,
   igual em todas as páginas (as campanhas mantêm o tema delas abaixo dele).
   Sem logo nem cores de outra marca.
   NAVEGAÇÃO SOFT (design de 10/10): fixo no topo, em vidro (desfoque) com uma
   linha fina; na tela inicial, depois que o campo do link sai da tela, aparece
   "Cole o link de outro produto" (PC) ou o ícone do link (celular), para
   comparar outro produto sem voltar ao topo. No celular (25/10) o topo é
   uma barra de app limpa (marca + Telegram): as páginas ficam nas abas de
   baixo (NavegacaoInferiorMobile). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Link2, Send } from "lucide-react";

import { SugestoesBusca, useSugestoesBusca } from "@/components/SugestoesBusca";
import { LINK_CANAL } from "@/lib/telegram-publico";

/* "Categorias" (23/10, navegação mais completa): no PC só a partir de
   1280 px (em 1024 px o campo "Cole o link de outro produto" ocupa o
   espaço); no celular, nas abas de baixo. */
const LINKS = [
  { to: "/categorias", rotulo: "Categorias", pc: "xl:inline-flex" },
  { to: "/meus-precos", rotulo: "Meus preços", pc: "sm:inline-flex" },
  { to: "/guias", rotulo: "Guias", pc: "sm:inline-flex" },
  { to: "/sobre", rotulo: "Sobre", pc: "sm:inline-flex" },
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

export function irAoCampo() {
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

  /* Link ou texto: a caixa da home compara ou busca (mesma busca universal). */
  const enviar = (alvo: string) => {
    window.dispatchEvent(new CustomEvent("comparar-link", { detail: alvo }));
    setValor("");
  };
  const sugestoes = useSugestoesBusca(valor, enviar);

  const comparar = (e: FormEvent) => {
    e.preventDefault();
    const alvo = valor.trim();
    sugestoes.fechar();
    if (!alvo) {
      irAoCampo();
      return;
    }
    enviar(alvo);
  };

  return (
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

        {/* PC: comparar outro produto direto do cabeçalho (a partir de 1024 px;
              no tablet o campo não cabe ao lado dos links, 18/10). */}
        {naInicial && (
          <form
            ref={sugestoes.caixa}
            role="search"
            onSubmit={comparar}
            aria-hidden={!mostrarCampo}
            className={
              "relative hidden h-10 min-w-0 max-w-[460px] flex-1 items-center gap-2 rounded-full border border-[#e4e4e7] bg-white pl-3.5 pr-1 transition-opacity duration-200 ease-out motion-reduce:transition-none dark:border-white/15 dark:bg-white/5 lg:flex " +
              (mostrarCampo ? "opacity-100" : "pointer-events-none opacity-0")
            }
          >
            <label htmlFor="link-topo" className="sr-only">
              Link ou nome de outro produto
            </label>
            <Link2 className="size-4 shrink-0 text-[#6b6b70]" aria-hidden="true" />
            <input
              id="link-topo"
              type="text"
              value={valor}
              {...sugestoes.propsCampo}
              onChange={(e) => {
                setValor(e.target.value);
                sugestoes.abrir();
              }}
              onKeyDown={(e) => void sugestoes.teclar(e)}
              tabIndex={mostrarCampo ? 0 : -1}
              placeholder="Cole o link ou digite o produto que procura..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#0f1729] outline-none placeholder:text-[#6b6b70] dark:text-white"
            />
            <button
              type="submit"
              tabIndex={mostrarCampo ? 0 : -1}
              className="h-8 shrink-0 rounded-full bg-[#0071e3] px-3.5 text-xs font-semibold text-white transition duration-150 ease-out hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transition-none"
            >
              Buscar
            </button>
            <SugestoesBusca estado={sugestoes} />
          </form>
        )}

        <nav aria-label="Páginas do site" className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Tablet: o ícone do link leva ao campo (alvo de 44 px); no celular
                ele fica nas abas de baixo. */}
          {naInicial && mostrarCampo && (
            <button
              type="button"
              onClick={irAoCampo}
              aria-label="Colar link de outro produto"
              title="Colar link de outro produto"
              className="hidden size-11 items-center justify-center rounded-full text-[#0f1729] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white sm:inline-flex lg:hidden"
            >
              <Link2 className="size-5" aria-hidden="true" />
            </button>
          )}
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={
                "hidden rounded-full px-3 py-2 text-sm font-medium text-[#1d1d1f] whitespace-nowrap transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white/90 dark:hover:bg-white/10 " +
                l.pc
              }
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
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#7547E8]/50 px-2.5 text-sm font-semibold text-[#21134A] transition-colors hover:bg-[#7547E8]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white min-[360px]:px-3 sm:px-4"
          >
            <Send className="size-4 text-[#7547E8]" aria-hidden="true" />
            <span className="hidden min-[400px]:inline">Ofertas no Telegram</span>
            {/* Telas de 320 px (18/10): só o ícone, para caber ao lado da marca. */}
            <span className="hidden min-[360px]:inline min-[400px]:hidden">Ofertas</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
