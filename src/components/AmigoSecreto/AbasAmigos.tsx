/* Horizontal pills, one per person: gift chosen (struck through), number
   of showcases, and a quick "add person". */
import { Check, Plus } from "lucide-react";

import type { Amigo } from "@/lib/amigo-secreto-tipos";

export function AbasAmigos({
  amigos,
  ativoId,
  aoEscolher,
  aoAdicionar,
}: {
  amigos: Amigo[];
  ativoId: string | null;
  aoEscolher: (id: string) => void;
  aoAdicionar: () => void;
}) {
  const feitos = amigos.filter((a) => a.comprado).length;
  return (
    <nav aria-label="Pessoas do amigo secreto" className="min-w-0">
      {amigos.length > 0 && (
        <p className="mb-2 text-xs font-semibold text-secondary-ink">
          {feitos === amigos.length
            ? "Todos já têm presente escolhido 🎉"
            : `${feitos} de ${amigos.length} com presente escolhido`}
        </p>
      )}
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {amigos.map((a) => {
          const ativo = a.id === ativoId;
          return (
            <li key={a.id} className="snap-start">
              <button
                type="button"
                aria-current={ativo ? "true" : undefined}
                onClick={() => aoEscolher(a.id)}
                className={
                  "inline-flex min-h-11 max-w-[14rem] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all duration-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
                  (ativo
                    ? "bg-[#1d1d1f] text-white shadow-md dark:bg-white dark:text-[#1d1d1f]"
                    : "bg-card text-foreground ring-1 ring-border hover:ring-[#0071e3]/40")
                }
              >
                {a.comprado && (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#34c759] text-white animate-cartao">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                )}
                <span className={"truncate " + (a.comprado ? "line-through decoration-2 opacity-70" : "")}>
                  {a.nome}
                </span>
                {a.vitrines.length > 0 && (
                  <span
                    className={
                      "shrink-0 rounded-full px-1.5 text-[11px] tabular-nums " +
                      (ativo ? "bg-white/20" : "bg-[#f5f5f7] text-secondary-ink dark:bg-white/10")
                    }
                    title={`${a.vitrines.length} vitrines`}
                  >
                    {a.vitrines.length}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        <li className="snap-start">
          <button
            type="button"
            onClick={aoAdicionar}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[#0071e3]/50 px-4 text-sm font-semibold text-[#0058b0] hover:bg-[#0071e3]/5 dark:text-[#64a8ff]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar pessoa
          </button>
        </li>
      </ul>
    </nav>
  );
}
