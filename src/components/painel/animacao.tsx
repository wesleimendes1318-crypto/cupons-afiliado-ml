/* Motion shared by the /painel tabs (Weslei, 06/11: "animações como tem ao
   fazer login, em gráficos"). Same easing as the login and the cards
   (cubic-bezier(0.22, 1, 0.36, 1)); with prefers-reduced-motion everything
   shows its final value at once. */
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
