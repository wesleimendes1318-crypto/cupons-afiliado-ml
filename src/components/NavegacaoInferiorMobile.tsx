/* Abas do celular (Weslei, 25/10: "simular um aplicativo nativo"): barra de
   vidro embaixo com Início, Colar link, Categorias, Meus preços e Ofertas.
   Só abaixo de sm (o PC segue com o cabeçalho). Quando a barra de compra do
   resultado aparece (html[data-compra]), as abas descem e a compra fica sozinha
   embaixo: o botão de compra tem prioridade. A folga do conteúdo e da
   navegação rápida vem de --folga-abas (styles.css). */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, Link2, Send, Tag } from "lucide-react";

import { irAoCampo } from "@/components/CabecalhoSite";
import { LINK_CANAL } from "@/lib/telegram-publico";

const ABA =
  "flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold text-[#6b6b70] transition-transform duration-100 ease-out select-none active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transition-none dark:text-white/60";
const ATIVA = { className: "font-bold !text-[#7547E8]" };

export function NavegacaoInferiorMobile() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const navegar = useNavigate();

  const colarLink = () => {
    if (caminho === "/") irAoCampo();
    else void navegar({ to: "/", hash: "colar-link" }).then(irAoCampo);
  };

  return (
    <nav
      data-abas-inferiores
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-black/[0.06] bg-white/90 px-1 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden dark:border-white/10 dark:bg-neutral-950/90 [[data-compra]_&]:pointer-events-none [[data-compra]_&]:translate-y-full"
    >
      <Link
        to="/"
        activeOptions={{ exact: true, includeHash: false }}
        activeProps={ATIVA}
        className={ABA}
      >
        <Home className="size-6" strokeWidth={1.8} aria-hidden="true" />
        Início
      </Link>
      <button type="button" onClick={colarLink} className={ABA}>
        <Link2 className="size-6" strokeWidth={1.8} aria-hidden="true" />
        Colar link
      </button>
      <Link to="/categorias" activeProps={ATIVA} className={ABA}>
        <LayoutGrid className="size-6" strokeWidth={1.8} aria-hidden="true" />
        Categorias
      </Link>
      <Link to="/meus-precos" activeProps={ATIVA} className={ABA}>
        <Tag className="size-6" strokeWidth={1.8} aria-hidden="true" />
        Meus preços
      </Link>
      <a
        href={LINK_CANAL}
        target="_blank"
        rel="noopener noreferrer"
        data-origem="abas"
        aria-label="Ofertas no Telegram (abre em nova aba)"
        className={ABA}
      >
        <Send className="size-6" strokeWidth={1.8} aria-hidden="true" />
        Ofertas
      </a>
    </nav>
  );
}
