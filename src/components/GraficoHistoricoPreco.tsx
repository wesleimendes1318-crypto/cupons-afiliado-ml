/* HISTÓRICO DE PREÇO INTERATIVO (Weslei, 04/11): arrastar o dedo ou o
   mouse sobre a curva mostra data, hora e o preço daquela conferência.
   Curva azul com degradê, ponto de agora com anel, meta tracejada verde e
   filtro de período. Linhas no SVG esticado; ponto e balão em HTML para
   não deformar. Setas do teclado também andam pelos pontos. */
import { useId, useMemo, useState } from "react";

import type { PontoPreco } from "@/lib/veredito-preco";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PERIODOS = [
  { id: "7", rotulo: "7 dias", dias: 7 },
  { id: "30", rotulo: "30 dias", dias: 30 },
  { id: "90", rotulo: "90 dias", dias: 90 },
  { id: "tudo", rotulo: "Tudo", dias: null },
] as const;
const L = 300;
const A = 100;
const M = 8;

export function GraficoHistoricoPreco({
  pontos,
  alvo = null,
}: {
  pontos: PontoPreco[];
  alvo?: number | null;
}) {
  const id = useId();
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["id"]>("tudo");
  const [sel, setSel] = useState<number | null>(null);

  const todos = useMemo(
    () =>
      pontos
        .filter((x) => x.p > 0 && !Number.isNaN(new Date(x.em).getTime()))
        .sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime()),
    [pontos],
  );
  const dias = PERIODOS.find((p) => p.id === periodo)!.dias;
  const lista = useMemo(() => {
    if (dias == null) return todos;
    const corte = Date.now() - dias * 86400000;
    return todos.filter((x) => new Date(x.em).getTime() >= corte);
  }, [todos, dias]);

  if (todos.length < 2)
    return (
      <p className="mt-2 text-[11px] text-secondary-ink">
        O histórico aparece a partir da 2ª conferência.
      </p>
    );

  const pills = (
    <div role="group" aria-label="Período do histórico" className="flex flex-wrap gap-1">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={periodo === p.id}
          onClick={() => {
            setPeriodo(p.id);
            setSel(null);
          }}
          className={
            "min-h-7 rounded-full px-2 text-[11px] sm:px-2.5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0071e3] " +
            (periodo === p.id
              ? "bg-[#0071e3] text-white"
              : "bg-[#f5f5f7] text-secondary-ink hover:text-foreground dark:bg-white/10")
          }
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  );

  if (lista.length < 2)
    return (
      <div className="mt-3">
        {pills}
        <p className="mt-2 text-[11px] text-secondary-ink">
          Menos de 2 conferências neste período. Escolha um período maior.
        </p>
      </div>
    );

  const t0 = new Date(lista[0]!.em).getTime();
  const t1 = new Date(lista[lista.length - 1]!.em).getTime();
  const valores = lista.map((x) => x.p);
  const meta = alvo != null && alvo > 0 ? alvo : null;
  const pMin = Math.min(...valores, ...(meta != null ? [meta] : []));
  const pMax = Math.max(...valores, ...(meta != null ? [meta] : []));
  const x = (em: string) =>
    M + ((new Date(em).getTime() - t0) / Math.max(1, t1 - t0)) * (L - 2 * M);
  const y = (p: number) => M + (1 - (p - pMin) / Math.max(0.01, pMax - pMin)) * (A - 2 * M);
  const linha = lista.map((q) => `${x(q.em).toFixed(1)},${y(q.p).toFixed(1)}`).join(" ");
  const area = `M${x(lista[0]!.em).toFixed(1)},${A} L${linha.replace(/ /g, " L")} L${x(lista[lista.length - 1]!.em).toFixed(1)},${A} Z`;
  const iAtivo = sel != null && sel < lista.length ? sel : lista.length - 1;
  const ativo = lista[iAtivo]!;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);

  function aoMover(clientX: number, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const alvoX = ((clientX - r.left) / Math.max(1, r.width)) * L;
    let melhor = 0;
    for (let i = 1; i < lista.length; i++)
      if (Math.abs(x(lista[i]!.em) - alvoX) < Math.abs(x(lista[melhor]!.em) - alvoX)) melhor = i;
    setSel(melhor);
  }

  const quando = new Date(ativo.em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const xa = x(ativo.em);

  return (
    <figure className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {pills}
        <p className="text-[11px] tabular-nums text-secondary-ink" aria-live="polite">
          <strong className="text-foreground">{brl(ativo.p)}</strong> · {quando}
        </p>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Histórico de preço: use as setas para ver cada conferência"
        aria-valuemin={0}
        aria-valuemax={lista.length - 1}
        aria-valuenow={iAtivo}
        aria-valuetext={`${brl(ativo.p)} em ${quando}`}
        className="relative mt-2 h-28 touch-pan-y select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
        onPointerDown={(e) => aoMover(e.clientX, e.currentTarget)}
        onPointerMove={(e) => aoMover(e.clientX, e.currentTarget)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setSel(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSel(Math.max(0, iAtivo - 1));
          else if (e.key === "ArrowRight") setSel(Math.min(lista.length - 1, iAtivo + 1));
          else if (e.key === "Home") setSel(0);
          else if (e.key === "End") setSel(lista.length - 1);
          else return;
          e.preventDefault();
        }}
      >
        <svg
          viewBox={`0 0 ${L} ${A}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0071e3" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0071e3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id}-g)`} />
          {meta != null && (
            <line
              x1={M}
              x2={L - M}
              y1={y(meta)}
              y2={y(meta)}
              stroke="#34c759"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <polyline
            points={linha}
            fill="none"
            stroke="#0071e3"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {sel != null && (
            <line
              x1={xa}
              x2={xa}
              y1={0}
              y2={A}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {meta != null && (
          <span
            className="pointer-events-none absolute right-1 -translate-y-full rounded bg-white/90 px-1 text-[10px] font-semibold text-[#248a3d] dark:bg-black/60"
            style={{ top: pct(y(meta), A) }}
          >
            Seu preço {brl(meta)}
          </span>
        )}
        <span
          aria-hidden="true"
          className={
            "pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#0071e3] shadow-[0_0_0_4px_rgba(0,113,227,0.25)] dark:border-card " +
            (sel == null ? "motion-safe:animate-pulse" : "")
          }
          style={{ left: pct(xa, L), top: pct(y(ativo.p), A) }}
        />
      </div>
      <figcaption className="mt-1 grid grid-cols-[auto_1fr_auto] gap-x-2 text-[10px] text-secondary-ink">
        <span>
          {new Date(lista[0]!.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </span>
        <span className="text-center">
          menor: {brl(menor)} · maior: {brl(maior)}
        </span>
        <span>agora</span>
      </figcaption>
    </figure>
  );
}
