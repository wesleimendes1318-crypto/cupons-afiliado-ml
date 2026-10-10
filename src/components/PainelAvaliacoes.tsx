/* PAINEL "VER AVALIAÇÕES" (Weslei, 10/10: "precisa de um espaço que abra o
   detalhamento das avaliações reais"). Nota, total, distribuição por
   estrelas e as opiniões que a página do anúncio mostra, com a data da
   leitura. Botão para ver todas no anúncio só com o link de afiliado. Sem
   distribuição ou opiniões lidas, diz isso (nunca inventa). */
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Star, ThumbsUp, X } from "lucide-react";

import { ehLinkDeCompra } from "@/lib/afiliado";
import { notaEscrita, rotuloDasAvaliacoes, totalEscrito, type Avaliacoes } from "@/lib/avaliacoes";
import { lerDetalheAvaliacoes, percentual, type DetalheAvaliacoes } from "@/lib/avaliacoes-detalhe";

/** Cinco estrelas com o preenchimento da nota (nunca arredonda para cima). */
export function Estrelas({ nota, tamanho = "size-4" }: { nota: number; tamanho?: string }) {
  const pct = Math.max(0, Math.min(100, (Math.floor(nota * 10) / 10 / 5) * 100));
  const linha = (cor: string) => (
    <span className={`flex gap-0.5 ${cor}`}>
      {[0, 1, 2, 3, 4].map((k) => (
        <Star key={k} className={`${tamanho} fill-current`} strokeWidth={0} />
      ))}
    </span>
  );
  return (
    <span className="relative inline-flex" aria-hidden="true">
      {linha("text-[#d2d2d7] dark:text-white/20")}
      <span className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        {linha("text-amber-400")}
      </span>
    </span>
  );
}

function dataDaLeitura(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function PainelAvaliacoes({
  item,
  titulo,
  resumo,
  link,
  fechar,
}: {
  item: string;
  titulo?: string | null | undefined;
  /* O que o cartão já mostrava (enquanto o detalhe carrega ou se faltar). */
  resumo?: Avaliacoes | null | undefined;
  link?: string | null | undefined;
  fechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [det, setDet] = useState<DetalheAvaliacoes | null | undefined>(undefined);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    let vivo = true;
    void lerDetalheAvaliacoes(item).then((r) => {
      if (vivo) setDet(r);
    });
    return () => {
      vivo = false;
    };
  }, [item]);

  const av = det?.avaliacoes ?? resumo ?? null;
  const niveis = det?.distribuicao ?? null;
  const opinioes = det?.opinioes ?? [];
  const lido = dataDaLeitura(det?.lidoEm ?? null);
  const compra = ehLinkDeCompra(link, "mercadolivre") ? link : null;
  const idTitulo = `aval-${item}`;

  return (
    <dialog
      ref={ref}
      onClose={fechar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby={idTitulo}
      className="m-auto max-h-[88vh] w-[min(560px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-border bg-white p-0 text-[#1d1d1f] shadow-2xl backdrop:bg-black/40 dark:bg-neutral-900 dark:text-white"
    >
      <div className="flex max-h-[88vh] flex-col">
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <h3 id={idTitulo} className="text-[17px] font-bold leading-snug">
              Avaliações de quem comprou
            </h3>
            {titulo && (
              <p className="mt-0.5 line-clamp-2 text-[13px] text-[#6e6e73] dark:text-white/60">
                {titulo}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] focus-visible:outline-2 focus-visible:outline-[#0071e3] dark:bg-white/10"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-[13px]">
          {av ? (
            <section
              aria-label="Resumo das avaliações"
              className="grid gap-4 rounded-2xl bg-[#f5f5f7] p-4 dark:bg-white/5 sm:grid-cols-[auto_1fr] sm:items-center"
            >
              <div className="text-center sm:pr-2">
                <p className="text-5xl font-extrabold leading-none tabular-nums">
                  {notaEscrita(av)}
                </p>
                <div className="mt-2 flex justify-center">
                  <Estrelas nota={av.nota} />
                </div>
                <p className="mt-1.5 text-xs text-[#6e6e73] dark:text-white/60">
                  {totalEscrito(av)}
                </p>
                <span className="sr-only">{rotuloDasAvaliacoes(av)}</span>
              </div>
              {niveis ? (
                <ul className="space-y-1.5" aria-label="Avaliações por número de estrelas">
                  {niveis.map((n) => {
                    const p = percentual(n, niveis);
                    return (
                      <li key={n.estrelas} className="flex items-center gap-2 text-xs">
                        <span className="w-8 shrink-0 tabular-nums text-[#3a3a3c] dark:text-white/80">
                          {n.estrelas}
                          <Star
                            className="ml-0.5 inline size-3 fill-amber-400 align-[-1px] text-amber-400"
                            strokeWidth={0}
                            aria-hidden="true"
                          />
                        </span>
                        <span
                          className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e5ea] dark:bg-white/10"
                          aria-hidden="true"
                        >
                          <span
                            className="block h-full rounded-full bg-amber-400"
                            style={{ width: `${p}%` }}
                          />
                        </span>
                        <span className="w-14 shrink-0 text-right tabular-nums text-[#6e6e73] dark:text-white/60">
                          {n.total.toLocaleString("pt-BR")}
                        </span>
                        <span className="sr-only">
                          {`${n.estrelas} ${n.estrelas === 1 ? "estrela" : "estrelas"}: ${n.total.toLocaleString("pt-BR")} avaliações (${p}%)`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : det !== undefined ? (
                <p className="text-xs text-[#6e6e73] dark:text-white/60">
                  A divisão por estrelas deste anúncio ainda não foi lida.
                </p>
              ) : (
                <div className="space-y-2" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((k) => (
                    <div key={k} className="h-2 animate-pulse rounded-full bg-[#e5e5ea]" />
                  ))}
                </div>
              )}
            </section>
          ) : det === undefined ? (
            <div className="h-28 animate-pulse rounded-2xl bg-[#f5f5f7]" aria-label="Carregando" />
          ) : det?.sem ? (
            <p className="rounded-2xl bg-[#f5f5f7] p-4 text-[14px] dark:bg-white/5">
              Este anúncio ainda não tem avaliações de compradores.
            </p>
          ) : (
            <p className="rounded-2xl bg-[#f5f5f7] p-4 text-[14px] dark:bg-white/5">
              As avaliações deste anúncio ainda não foram lidas. Elas aparecem aqui assim que a
              leitura terminar.
            </p>
          )}

          {det?.aviso && <p className="text-xs text-[#6e6e73] dark:text-white/60">{det.aviso}</p>}

          {opinioes.length > 0 && (
            <section aria-label="Opiniões de compradores">
              <h4 className="text-[15px] font-bold">O que dizem os compradores</h4>
              <ul className="mt-2 space-y-2.5">
                {opinioes.map((o, k) => (
                  <li
                    key={k}
                    className="rounded-2xl border border-border bg-white p-3 dark:bg-white/5"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Estrelas nota={o.nota} tamanho="size-3.5" />
                      <span className="sr-only">{`Nota ${o.nota} de 5`}</span>
                      {o.data && (
                        <span className="text-[11px] text-[#6e6e73] dark:text-white/60">
                          {o.data}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed [overflow-wrap:anywhere]">
                      {o.texto}
                    </p>
                    {o.uteis != null && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#6e6e73] dark:text-white/60">
                        <ThumbsUp className="size-3" aria-hidden="true" />
                        {o.uteis === 1
                          ? "1 pessoa achou útil"
                          : `${o.uteis.toLocaleString("pt-BR")} pessoas acharam útil`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {det?.totalComentarios != null && det.totalComentarios > opinioes.length && (
                <p className="mt-2 text-xs text-[#6e6e73] dark:text-white/60">
                  {`Mostrando ${opinioes.length} de ${det.totalComentarios.toLocaleString("pt-BR")} comentários.`}
                </p>
              )}
            </section>
          )}
          {av && det !== undefined && !opinioes.length && (
            <p className="text-xs text-[#6e6e73] dark:text-white/60">
              Os comentários deste anúncio ainda não foram lidos.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-border p-4">
          {compra && (
            <a
              href={compra}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-origem="avaliacoes"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] px-4 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transition-none"
            >
              Ver todas as avaliações no anúncio
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          )}
          <p className="text-center text-[11px] text-[#6e6e73] dark:text-white/60">
            {lido
              ? `Avaliações reais de compradores, lidas na página do anúncio em ${lido}.`
              : "Avaliações reais de compradores, lidas na página do anúncio."}
          </p>
        </div>
      </div>
    </dialog>
  );
}
