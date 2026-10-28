/* TRILHO DE RECOMENDAÇÃO (Weslei, 27/10): título, explicação e uma fileira
   com rolagem lateral (snap no celular, setas no PC). Os cartões vêm de quem
   chama (CartaoEmAlta ou o cartão do histórico).
   SEM LIMITE (Weslei, 28/10: "Sempre deve dar a opção de ver mais. Jamais
   limitar"): monta 12 cartões de cada vez; ao chegar perto do fim da
   fileira vem o próximo lote sozinho, e o cartão "Ver mais" faz o mesmo no
   toque. Acabando a lista, "Ver todos" leva à página da categoria (verTodos). */
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const LOTE = 12;
const LARGURA_CARTAO =
  "w-[58%] shrink-0 snap-start min-[480px]:w-[40%] sm:w-[30%] lg:w-[23%] xl:w-[18.5%]";

export function TrilhoRecomendacao({
  id,
  icone,
  titulo,
  subtitulo,
  acao = null,
  verTodos,
  children,
}: {
  id: string;
  icone: ReactNode;
  titulo: string;
  subtitulo: string;
  acao?: ReactNode;
  /* Página com todos os produtos do assunto, oferecida no fim da fileira. */
  verTodos?: { href: string; rotulo: string } | null;
  children: ReactNode;
}) {
  const fileira = useRef<HTMLUListElement>(null);
  const fim = useRef<HTMLLIElement>(null);
  const cartoes = Children.toArray(children);
  const [mostrar, setMostrar] = useState(LOTE);
  const restam = cartoes.length - mostrar;
  const maisUm = () => setMostrar((m) => m + LOTE);
  useEffect(() => {
    const el = fim.current;
    if (!el || restam <= 0 || typeof IntersectionObserver === "undefined") return;
    /* Carrega antes de o cartão final aparecer (uma tela de folga à direita). */
    const obs = new IntersectionObserver(([e]) => e?.isIntersecting && maisUm(), {
      root: fileira.current,
      rootMargin: "0px 100% 0px 0px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [restam]);
  const cartaoFinal =
    "inline-flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-[#0071e3]/40 bg-card p-4 text-center text-sm font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]";
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
        {cartoes.slice(0, mostrar)}
        {restam > 0 ? (
          <li ref={fim} className={LARGURA_CARTAO + " flex"}>
            <button type="button" onClick={maisUm} className={cartaoFinal + " w-full"}>
              Ver mais {Math.min(LOTE, restam)}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </li>
        ) : (
          verTodos && (
            <li className={LARGURA_CARTAO + " flex"}>
              <a href={verTodos.href} className={cartaoFinal + " w-full"}>
                {verTodos.rotulo}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </li>
          )
        )}
      </ul>
    </section>
  );
}
