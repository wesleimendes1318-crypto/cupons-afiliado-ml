/* Motion shared by the /painel tabs (Weslei, 06/11: "animações como tem ao
   fazer login, em gráficos"). Same easing as the login and the cards
   (cubic-bezier(0.22, 1, 0.36, 1)); with prefers-reduced-motion everything
   shows its final value at once. */
import type React from "react";
import { useEffect, useState } from "react";

const reduzido = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 to `valor` in ~0.9 s (ease-out). */
export function useContagem(valor: number, ms = 900): number {
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (reduzido() || valor === 0) {
      setAtual(valor);
      return;
    }
    let raf = 0;
    const inicio = performance.now();
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / ms);
      setAtual(valor * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor, ms]);
  return atual;
}

/** Bar that grows from 0 to `pct` after mount (CSS transition, no JS loop). */
export function BarraProgresso({
  pct,
  cor = "#0071e3",
  rotulo,
}: {
  pct: number;
  cor?: string;
  rotulo: string;
}) {
  const [largura, setLargura] = useState(0);
  const alvo = Math.max(0, Math.min(100, pct));
  useEffect(() => {
    const t = requestAnimationFrame(() => setLargura(alvo));
    return () => cancelAnimationFrame(t);
  }, [alvo]);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[#f5f5f7] dark:bg-white/10"
      role="progressbar"
      aria-label={rotulo}
      aria-valuenow={Math.round(alvo)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ width: `${largura}%`, backgroundColor: cor }}
      />
    </div>
  );
}

/** Price line that draws itself left to right (clip reveal keeps the stroke
    crisp on a stretched SVG), end dot pops in.
    Green when the last price is below the first, red when above. */
export function MiniGrafico({
  pontos,
  atraso = 0,
  className = "h-10 w-full",
}: {
  pontos: number[];
  atraso?: number;
  className?: string;
}) {
  if (pontos.length < 2) return null;
  const min = Math.min(...pontos);
  const max = Math.max(...pontos);
  const faixa = max - min || 1;
  const xy = pontos.map((p, k) => [(k / (pontos.length - 1)) * 100, 4 + (1 - (p - min) / faixa) * 28] as const);
  const caiu = pontos[pontos.length - 1]! < pontos[0]!;
  const cor = caiu ? "#34c759" : pontos[pontos.length - 1]! > pontos[0]! ? "#ff3b30" : "#0071e3";
  const [fx, fy] = xy[xy.length - 1]!;
  const linha = xy.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <span className={`relative block ${className}`} aria-hidden="true">
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="painel-traco size-full" style={{ animationDelay: `${atraso}ms` }}>
      <polygon points={`0,36 ${linha} 100,36`} fill={cor} opacity="0.08" />
      <polyline
        points={linha}
        fill="none"
        stroke={cor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
      {/* HTML dot: the stretched SVG would turn a circle into an oval. */}
      <span
        className="painel-ponto absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
        style={{ left: `${fx}%`, top: `${(fy / 36) * 100}%`, backgroundColor: cor, animationDelay: `${atraso + 900}ms` }}
      />
    </span>
  );
}

/** Ring that fills to `pct` (stroke draw, same motion as the bars). */
export function Anel({ pct, cor = "#0071e3", children }: { pct: number; cor?: string; children?: React.ReactNode }) {
  const [v, setV] = useState(0);
  const alvo = Math.max(0, Math.min(100, pct));
  useEffect(() => {
    const t = requestAnimationFrame(() => setV(alvo));
    return () => cancelAnimationFrame(t);
  }, [alvo]);
  return (
    <span className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={cor}
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v} 100`}
          className="transition-[stroke-dasharray] duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        />
      </svg>
      {children}
    </span>
  );
}
