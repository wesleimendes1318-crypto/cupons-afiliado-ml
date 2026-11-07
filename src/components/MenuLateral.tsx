/* SaaS-style navigation (Weslei, 07/11 "Layer 6"): desktop gets a fixed
   sidebar under the header (icon rail at 1280-1439 px, full width from
   1440 px, collapsible to the rail and remembered); phones/tablets get a
   glass drawer from the header menu button. Same links in both. The bottom
   tabs (NavegacaoInferiorMobile) stay as they are. The width lives in
   --largura-menu (styles.css), which pads the page content. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Gift,
  Heart,
  Home,
  Info,
  LayoutGrid,
  ListChecks,
  CircleUser,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Tag,
  X,
} from "lucide-react";

import { abrirComparacao } from "@/components/BotoesCartao";
import { LINK_CANAL } from "@/lib/telegram-publico";

const ITENS = [
  { to: "/", rotulo: "Comparar preços", icone: Home },
  { to: "/categorias", rotulo: "Categorias", icone: LayoutGrid },
  { to: "/amigo-secreto", rotulo: "Amigo Secreto", icone: Gift },
  { to: "/planejadores", rotulo: "Planejadores", icone: ListChecks },
  { to: "/favoritos", rotulo: "Lista de desejos", icone: Heart },
  { to: "/meus-precos", rotulo: "Meus preços", icone: Tag },
  { to: "/painel", rotulo: "Meu painel", icone: CircleUser },
  { to: "/guias", rotulo: "Guias", icone: BookOpen },
  { to: "/sobre", rotulo: "Sobre", icone: Info },
] as const;

const CHAVE = "menu-recolhido";

/** Item is active on its page and below it ("/" only on the home). */
export const itemAtivo = (destino: string, caminho: string) =>
  destino === "/" ? caminho === "/" : caminho === destino || caminho.startsWith(destino + "/");

function Itens({ caminho, aoEscolher, gaveta }: { caminho: string; aoEscolher?: () => void; gaveta?: boolean }) {
  /* Rail (lg, or collapsed at xl): icon only, label kept for screen readers. */
  const rotulo = gaveta
    ? ""
    : "sr-only min-[1440px]:not-sr-only [[data-menu-recolhido]_&]:sr-only";
  return (
    <ul className="flex flex-col gap-1">
      {ITENS.map(({ to, rotulo: texto, icone: Icone }) => {
        const ativo = itemAtivo(to, caminho);
        return (
          <li key={to}>
            <Link
              to={to}
              onClick={aoEscolher}
              title={texto}
              aria-current={ativo ? "page" : undefined}
              className={
                "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transition-none " +
                (gaveta ? "" : "justify-center min-[1440px]:justify-start [[data-menu-recolhido]_&]:justify-center ") +
                (ativo
                  ? "bg-[#7547E8]/10 font-semibold text-[#7547E8] dark:bg-white/10 dark:text-white"
                  : "text-[#1d1d1f] hover:bg-black/5 dark:text-white/85 dark:hover:bg-white/10")
              }
            >
              {ativo && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#7547E8]"
                />
              )}
              <Icone className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className={rotulo + " truncate"}>{texto}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Desktop sidebar (from 1280 px). */
export function BarraLateral() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => {
    setRecolhido(document.documentElement.hasAttribute("data-menu-recolhido"));
  }, []);

  const alternar = () => {
    const novo = !recolhido;
    setRecolhido(novo);
    document.documentElement.toggleAttribute("data-menu-recolhido", novo);
    try {
      localStorage.setItem(CHAVE, novo ? "1" : "0");
    } catch {
      /* private window: only this visit */
    }
  };

  return (
    <aside
      aria-label="Menu do site"
      className="fixed bottom-0 left-0 top-[60px] z-30 hidden w-[var(--largura-menu)] flex-col border-r border-black/[0.06] vidro-barra px-3 py-4 transition-[width] duration-200 ease-out motion-reduce:transition-none xl:flex dark:border-white/10"
    >
      <nav aria-label="Páginas do site" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Itens caminho={caminho} />
      </nav>
      <a
        href={LINK_CANAL}
        target="_blank"
        rel="noopener noreferrer"
        data-origem="menu-lateral"
        title="Ofertas no Telegram (abre em nova aba)"
        className="mt-2 flex min-h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#21134A] transition-colors hover:bg-[#7547E8]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] min-[1440px]:justify-start dark:text-white [[data-menu-recolhido]_&]:justify-center"
      >
        <Send className="size-5 shrink-0 text-[#7547E8]" strokeWidth={1.8} aria-hidden="true" />
        <span className="sr-only min-[1440px]:not-sr-only [[data-menu-recolhido]_&]:sr-only">Ofertas no Telegram</span>
      </a>
      {/* Collapse only from 1440 px: below it the bar is already the rail. */}
      <button
        type="button"
        onClick={alternar}
        aria-pressed={recolhido}
        title={recolhido ? "Abrir o menu" : "Recolher o menu"}
        className="mt-1 hidden min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#6b6b70] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] min-[1440px]:flex dark:text-white/60 dark:hover:bg-white/10 [[data-menu-recolhido]_&]:justify-center"
      >
        {recolhido ? (
          <PanelLeftOpen className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <PanelLeftClose className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        )}
        <span className={recolhido ? "sr-only" : ""}>{recolhido ? "Abrir o menu" : "Recolher menu"}</span>
      </button>
    </aside>
  );
}

/** Header menu button + glass drawer (below 1280 px). */
export function BotaoGaveta() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const dialogo = useRef<HTMLDialogElement>(null);
  const [valor, setValor] = useState("");

  const abrir = () => dialogo.current?.showModal();
  const fechar = () => dialogo.current?.close();

  /* Route changed (link, back button): the drawer closes. */
  useEffect(() => {
    dialogo.current?.close();
  }, [caminho]);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const alvo = valor.trim();
    if (!alvo) return;
    fechar();
    setValor("");
    abrirComparacao(alvo);
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir o menu"
        aria-haspopup="dialog"
        className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[#0f1729] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] xl:hidden dark:text-white"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogo}
        aria-label="Menu do site"
        onClick={(e) => e.target === e.currentTarget && fechar()}
        className="menu-gaveta m-0 h-dvh max-h-dvh w-[min(320px,86vw)] max-w-none border-r border-black/[0.06] bg-white/90 p-0 backdrop-blur-2xl backdrop-saturate-200 dark:bg-neutral-900/90 text-[#1d1d1f] shadow-2xl backdrop:bg-black/30 dark:border-white/10 dark:text-white"
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <div className="mb-3 flex items-center justify-between pl-2">
            <span className="text-base font-extrabold tracking-tight text-[#21134A] dark:text-white">
              Melhor Escolha
            </span>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar o menu"
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:hover:bg-white/10"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <form role="search" onSubmit={buscar} className="mb-3 flex h-11 items-center gap-2 rounded-full border border-[#e4e4e7] bg-white pl-3.5 pr-1 dark:border-white/15 dark:bg-white/5">
            <Search className="size-4 shrink-0 text-[#6b6b70]" aria-hidden="true" />
            <label htmlFor="busca-gaveta" className="sr-only">
              Link ou nome do produto
            </label>
            <input
              id="busca-gaveta"
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Cole o link ou digite o produto"
              className="min-w-0 flex-1 bg-transparent text-base text-[#0f1729] outline-none placeholder:text-[#6b6b70] dark:text-white"
            />
            <button
              type="submit"
              className="h-9 shrink-0 rounded-full bg-[#0071e3] px-3.5 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
            >
              Buscar
            </button>
          </form>
          <nav aria-label="Páginas do site">
            <Itens caminho={caminho} aoEscolher={fechar} gaveta />
          </nav>
          <a
            href={LINK_CANAL}
            target="_blank"
            rel="noopener noreferrer"
            data-origem="gaveta"
            className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 pt-2 text-sm font-semibold text-[#21134A] hover:bg-[#7547E8]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white"
          >
            <Send className="size-5 shrink-0 text-[#7547E8]" strokeWidth={1.8} aria-hidden="true" />
            Ofertas no Telegram
          </a>
        </div>
      </dialog>
    </>
  );
}
