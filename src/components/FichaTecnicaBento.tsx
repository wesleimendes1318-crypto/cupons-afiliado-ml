/* Details drawer sheet (Weslei, 08/11): "O que você precisa saber" with the
   listing highlights, a 2-column bento grid of characteristics and the
   description on demand. Only what was read from the listing or catalog. */
import { useState } from "react";
import { Check, ListChecks } from "lucide-react";

import type { Caracteristica } from "@/lib/ficha-detalhes";

const VISIVEIS = 8;

export function FichaTecnicaBento({
  destaques,
  caracteristicas,
  descricao,
}: {
  destaques: string[];
  caracteristicas: Caracteristica[];
  descricao: string;
}) {
  const [todosDestaques, setTodosDestaques] = useState(false);
  const [todaFicha, setTodaFicha] = useState(false);
  const [verDescricao, setVerDescricao] = useState(false);
  const [descricaoToda, setDescricaoToda] = useState(false);
  const longa = descricao.length > 420;
  const ficha = caracteristicas.slice(0, todaFicha ? 40 : VISIVEIS);

  return (
    <div className="space-y-4">
      {destaques.length > 0 && (
        <section className="rounded-3xl border border-border/60 bg-[#f5f5f7] p-4 dark:bg-white/5">
          <h4 className="flex items-center gap-2 text-[13px] font-bold">
            <ListChecks className="size-4 text-[#0071e3]" aria-hidden="true" />O que você precisa
            saber
          </h4>
          <ul className="mt-3 space-y-2">
            {destaques.slice(0, todosDestaques ? 12 : 5).map((d, k) => (
              <li
                key={k}
                className="animate-cartao flex items-start gap-2.5 leading-relaxed [overflow-wrap:anywhere]"
                style={{ animationDelay: `${k * 60}ms` }}
              >
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                  <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
          {destaques.length > 5 && (
            <button
              type="button"
              onClick={() => setTodosDestaques((x) => !x)}
              className="mt-2 font-semibold text-[#0058b0] hover:underline"
            >
              {todosDestaques ? "Mostrar menos" : `Ver todos os ${Math.min(12, destaques.length)}`}
            </button>
          )}
        </section>
      )}

      {caracteristicas.length > 0 && (
        <section aria-label="Características do produto" className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
            Características do produto
          </h4>
          <ul className="grid grid-cols-2 gap-2">
            {ficha.map((c, k) => (
              <li
                key={k}
                className="min-w-0 rounded-2xl border border-border/60 bg-white px-3 py-2 dark:bg-white/5"
              >
                <p className="text-[11px] font-medium text-[#6e6e73]">{c.nome}</p>
                <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{c.valor}</p>
              </li>
            ))}
          </ul>
          {caracteristicas.length > VISIVEIS && (
            <button
              type="button"
              onClick={() => setTodaFicha((x) => !x)}
              aria-expanded={todaFicha}
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#f5f5f7] px-3 text-[12px] font-semibold hover:bg-[#e8e8ed]"
            >
              {todaFicha
                ? "Mostrar menos"
                : `Ver todas as características (${Math.min(40, caracteristicas.length)})`}
            </button>
          )}
        </section>
      )}

      {descricao && (
        <section aria-label="Descrição do anúncio">
          <button
            type="button"
            onClick={() => setVerDescricao((x) => !x)}
            aria-expanded={verDescricao}
            className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#f5f5f7] px-3 text-[12px] font-semibold hover:bg-[#e8e8ed]"
          >
            {verDescricao ? "Fechar descrição" : "Descrição do anúncio"}
            <span aria-hidden="true">{verDescricao ? "▴" : "▾"}</span>
          </button>
          {verDescricao && (
            <div className="mt-2 rounded-3xl border border-border/60 bg-white p-4 dark:bg-white/5">
              <p className="whitespace-pre-line leading-relaxed text-[#424245] [overflow-wrap:anywhere] dark:text-white/80">
                {longa && !descricaoToda ? descricao.slice(0, 420).trimEnd() + "…" : descricao}
              </p>
              {longa && (
                <button
                  type="button"
                  onClick={() => setDescricaoToda((x) => !x)}
                  className="mt-1 font-bold text-[#0058b0] hover:underline"
                >
                  {descricaoToda ? "Mostrar menos" : "Ler descrição completa"}
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
