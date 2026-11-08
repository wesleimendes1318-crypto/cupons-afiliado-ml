/* Buyer reviews inside the details drawer (Weslei, 08/11). Real data only:
   the rating, total, star split and opinions the extension read on the
   listing page (detalhe_avaliacoes). No rating read: the block is hidden. */
import { useEffect, useState } from "react";
import { ChevronRight, Star } from "lucide-react";

import { Estrelas, PainelAvaliacoes } from "@/components/PainelAvaliacoes";
import { notaEscrita, totalEscrito } from "@/lib/avaliacoes";
import { lerDetalheAvaliacoes, percentual, type DetalheAvaliacoes } from "@/lib/avaliacoes-detalhe";

export function OpinioesCompradores({
  item,
  titulo,
  link,
}: {
  item: string;
  titulo: string;
  link: string | null;
}) {
  const [det, setDet] = useState<DetalheAvaliacoes | null>(null);
  const [painel, setPainel] = useState(false);
  useEffect(() => {
    let vivo = true;
    void lerDetalheAvaliacoes(item).then((r) => {
      if (vivo) setDet(r);
    });
    return () => {
      vivo = false;
    };
  }, [item]);

  const av = det?.avaliacoes;
  if (!av) return null;
  const niveis = det.distribuicao;
  const opinioes = det.opinioes.slice(0, 2);

  return (
    <section
      aria-label="Avaliações de quem comprou"
      className="space-y-3 rounded-3xl border border-border/60 bg-white p-4 dark:bg-white/5"
    >
      <h4 className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
        Avaliações de quem comprou
      </h4>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="shrink-0">
          <p className="text-4xl font-extrabold leading-none tabular-nums">{notaEscrita(av)}</p>
          <div className="mt-1.5">
            <Estrelas nota={av.nota} tamanho="size-3.5" />
          </div>
          <p className="mt-1 text-[11px] text-[#6e6e73]">{totalEscrito(av)}</p>
        </div>
        {niveis && (
          <ul className="min-w-[150px] flex-1 space-y-1" aria-label="Avaliações por estrelas">
            {niveis.map((n) => {
              const p = percentual(n, niveis);
              return (
                <li key={n.estrelas} className="flex items-center gap-2 text-[11px]">
                  <span className="w-6 shrink-0 tabular-nums">
                    {n.estrelas}
                    <Star
                      className="ml-0.5 inline size-2.5 fill-amber-400 align-[-1px] text-amber-400"
                      strokeWidth={0}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e5e5ea] dark:bg-white/10"
                    aria-hidden="true"
                  >
                    <span
                      className="animate-barra block h-full rounded-full bg-amber-400"
                      style={{ width: `${p}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums text-[#6e6e73]">{p}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {opinioes.length > 0 && (
        <ul className="space-y-2">
          {opinioes.map((o, k) => (
            <li key={k} className="rounded-2xl bg-[#f5f5f7] p-3 dark:bg-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <Estrelas nota={o.nota} tamanho="size-3" />
                <span className="sr-only">{`Nota ${o.nota} de 5`}</span>
                {o.data && <span className="text-[11px] text-[#6e6e73]">{o.data}</span>}
              </div>
              <p className="mt-1 line-clamp-4 leading-relaxed [overflow-wrap:anywhere]">
                {o.texto}
              </p>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setPainel(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-0.5 font-semibold text-[#0058b0] hover:underline"
      >
        Ver todas as avaliações
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </button>
      {painel && (
        <PainelAvaliacoes
          item={item}
          titulo={titulo}
          resumo={av}
          link={link}
          fechar={() => setPainel(false)}
        />
      )}
    </section>
  );
}
