/* Abas do celular (Weslei, 25/10: "simular um aplicativo nativo"): barra de
   vidro embaixo com Início, Colar link, Categorias, Meus preços e Ofertas.
   Só abaixo de sm (o PC segue com o cabeçalho). Quando a barra de compra do
   resultado aparece (html[data-compra]), as abas descem e a compra fica sozinha
   embaixo: o botão de compra tem prioridade. A folga do conteúdo e da
   navegação rápida vem de --folga-abas (styles.css). */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Gift, Home, LayoutGrid, Link2, Send, Tag } from "lucide-react";

import { irAoCampo } from "@/components/CabecalhoSite";
import { LINK_CANAL } from "@/lib/telegram-publico";

const ABA =
  "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-center text-[10px] font-semibold leading-[1.1] [&>svg]:shrink-0 text-[#6b6b70] transition-transform duration-100 ease-out select-none active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transition-none dark:text-white/60";
const ATIVA = { className: "font-bold !text-[#7547E8]" };

export function NavegacaoInferiorMobile() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const navegar = useNavigate();

  const colarLink = () => {
    if (caminho === "/") irAoCampo();
    else void navegar({ to: "/", hash: "colar-link" }).then(irAoCampo);
  };

  /* Tocar na aba já aberta volta ao topo, como num app nativo (substitui a
     pílula flutuante no celular, 02/11). */
  const topoSeAtiva = (destino: string) => {
    if (caminho !== destino) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduzir ? "auto" : "smooth" });
  };

  return (
    <nav
      data-abas-inferiores
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-black/[0.06] vidro-barra px-1 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden dark:border-white/10 [[data-compra]_&]:pointer-events-none [[data-compra]_&]:translate-y-full"
    >
      <Link
        to="/"
        onClick={() => topoSeAtiva("/")}
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
      <Link
        to="/categorias"
        onClick={() => topoSeAtiva("/categorias")}
        activeProps={ATIVA}
        className={ABA}
      >
        <LayoutGrid className="size-6" strokeWidth={1.8} aria-hidden="true" />
        Categorias
      </Link>
      <Link
        to="/amigo-secreto"
        onClick={() => topoSeAtiva("/amigo-secreto")}
        activeProps={ATIVA}
        className={ABA}
      >
        <Gift className="size-6 text-[#0071e3]" strokeWidth={1.8} aria-hidden="true" />
        Amigo Secreto
      </Link>
      <Link
        to="/meus-precos"
        onClick={() => topoSeAtiva("/meus-precos")}
        activeProps={ATIVA}
        className={ABA}
      >
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
