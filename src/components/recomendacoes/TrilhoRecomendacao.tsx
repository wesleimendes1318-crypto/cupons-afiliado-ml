/* TRILHO DE RECOMENDAÇÃO (Weslei, 27/10): título, explicação e uma fileira
   com rolagem lateral (snap no celular, setas no PC). Os cartões vêm de quem
   chama (CartaoEmAlta ou o cartão do histórico). */
import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function TrilhoRecomendacao({
  id,
  icone,
  titulo,
  subtitulo,
  acao = null,
  children,
}: {
  id: string;
  icone: ReactNode;
  titulo: string;
  subtitulo: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  const fileira = useRef<HTMLUListElement>(null);
  const rolar = (lado: 1 | -1) =>
    fileira.current?.scrollBy({
      left: lado * fileira.current.clientWidth * 0.9,
      behavior: "smooth",
    });
  const seta =
    "hidden size-9 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] sm:grid";
  return (
    <section aria-labelledby={`trilho-${id}`} data-origem={`trilho_${id}`} className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`trilho-${id}`}
            className="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl"
          >
            <span className="shrink-0" aria-hidden="true">
              {icone}
            </span>
            {titulo}
          </h2>
          <p className="mt-0.5 text-sm text-secondary-ink">{subtitulo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {acao}
          <button type="button" className={seta} onClick={() => rolar(-1)} aria-label="Anteriores">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button type="button" className={seta} onClick={() => rolar(1)} aria-label="Próximos">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul
        ref={fileira}
        className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </section>
  );
}
