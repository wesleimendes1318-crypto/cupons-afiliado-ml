/* Navegação rápida (Weslei, 06/10: "precisa de um botão de tela inicial,
   também de subir a tela para o início"). Pílula discreta no canto inferior
   esquerdo (o botão "Colar link" fica à direita), só depois de rolar a tela:
   "Início" abre a tela inicial limpa e a seta volta ao topo. Some com um
   diálogo aberto; o movimento respeita prefers-reduced-motion. */
import { useEffect, useState } from "react";
import { ArrowUp, House } from "lucide-react";

export function BotoesNavegacao() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const ver = () => setVisivel(window.scrollY > 700);
    ver();
    window.addEventListener("scroll", ver, { passive: true });
    return () => window.removeEventListener("scroll", ver);
  }, []);

  const subir = () => {
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduzir ? "auto" : "smooth" });
  };

  return (
    <nav
      data-navegacao-rapida
      aria-label="Navegação rápida"
      aria-hidden={!visivel}
      className={
        "fixed bottom-6 left-4 z-40 flex items-center gap-1 rounded-full border border-black/5 bg-white/85 p-1 shadow-lg backdrop-blur-md transition duration-200 motion-reduce:transition-none " +
        (visivel ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0")
      }
    >
      <a
        href="/"
        tabIndex={visivel ? 0 : -1}
        className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[#1d1d1f] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#0071e3]"
      >
        <House className="size-4" aria-hidden />
        Início
      </a>
      <button
        type="button"
        onClick={subir}
        tabIndex={visivel ? 0 : -1}
        aria-label="Voltar ao topo"
        title="Voltar ao topo"
        className="flex size-10 items-center justify-center rounded-full bg-[#0071e3] text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
