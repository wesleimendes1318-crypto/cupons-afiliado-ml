/* ESPERA ATIVA (Weslei, 02/11): barra fina em degradê que anda rápido no
   começo e desacelera (src/lib/espera.ts), etapa do que a busca faz com
   troca suave, "Pesquisando há Xs" e cartões-esqueleto na forma do
   resultado. Quando a resposta chega, a barra fecha em 100% (150 ms) e some.
   Com "reduzir movimento", nada anda sozinho além do texto. */
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ETAPAS_DA_ESPERA, etapaDaEspera, progressoDaEspera } from "@/lib/espera";

export function EsperaAtiva({
  ativo,
  esqueletos = true,
  className = "",
}: {
  ativo: boolean;
  /* Grade de 4 cartões-esqueleto (sem cartões na tela ainda). */
  esqueletos?: boolean;
  className?: string;
}) {
  const inicio = useRef<number | null>(null);
  const [ms, setMs] = useState(0);
  const [fechando, setFechando] = useState(false);
  useEffect(() => {
    if (!ativo) {
      if (inicio.current == null) return;
      inicio.current = null;
      setFechando(true);
      const t = window.setTimeout(() => setFechando(false), 200);
      return () => window.clearTimeout(t);
    }
    inicio.current = Date.now();
    setMs(0);
    setFechando(false);
    const t = window.setInterval(() => setMs(Date.now() - (inicio.current ?? Date.now())), 150);
    return () => window.clearInterval(t);
  }, [ativo]);

  if (!ativo && !fechando) return null;
  const etapa = etapaDaEspera(ms);
  const segundos = Math.floor(ms / 1000);
  return (
    <div className={className} role="status" aria-live="polite">
      <div className="relative h-1 overflow-hidden rounded-full bg-[#0071e3]/10">
        <div
          className={
            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#0071e3] to-[#7547E8] motion-reduce:transition-none " +
            (fechando
              ? "transition-[width] duration-150 ease-out"
              : "transition-[width] duration-300 ease-out")
          }
          style={{ width: `${(fechando ? 1 : progressoDaEspera(ms)) * 100}%` }}
        />
      </div>
      {!fechando && (
        <>
          <div className="mt-3 flex items-start gap-2.5">
            <span
              className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-[#0071e3] etapa-andando"
              aria-hidden="true"
            >
              <Check className="size-3" />
            </span>
            <div className="min-w-0">
              <p key={etapa} className="animate-sugestao text-sm font-medium text-foreground">
                {ETAPAS_DA_ESPERA[etapa]?.texto}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-secondary-ink">
                {segundos < 3 ? "Geralmente leva alguns segundos" : `Pesquisando há ${segundos}s`}
              </p>
            </div>
          </div>
          {esqueletos && (
            <ul
              aria-hidden="true"
              className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
            >
              {[0, 1, 2, 3].map((k) => (
                <li
                  key={k}
                  className={
                    "rounded-2xl border border-border/60 bg-card p-2.5 " +
                    (k === 3 ? "sm:hidden lg:block" : "")
                  }
                >
                  <div className="esqueleto aspect-[4/3] w-full rounded-xl" />
                  <div className="esqueleto mt-3 h-3 w-11/12 rounded-full" />
                  <div className="esqueleto mt-2 h-3 w-2/3 rounded-full" />
                  <div className="esqueleto mt-4 h-5 w-1/2 rounded-full" />
                  <div className="esqueleto mt-3 h-9 w-full rounded-full" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/* "Quer comparar outro produto?" só com a busca pronta (Weslei, 02/11): quem
   está esperando avisa a página. Cada espera soma 1 enquanto dura. */
export const EVENTO_OCUPADO = "busca-ocupada";
export function useAvisarOcupado(ocupado: boolean) {
  useEffect(() => {
    if (!ocupado) return;
    window.dispatchEvent(new CustomEvent(EVENTO_OCUPADO, { detail: 1 }));
    return () => {
      window.dispatchEvent(new CustomEvent(EVENTO_OCUPADO, { detail: -1 }));
    };
  }, [ocupado]);
}

/** Quantas esperas estão em andamento na página (0 = nada carregando). */
export function useEsperasAtivas() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const ouvir = (e: Event) =>
      setN((v) => Math.max(0, v + Number((e as CustomEvent).detail ?? 0)));
    window.addEventListener(EVENTO_OCUPADO, ouvir);
    return () => window.removeEventListener(EVENTO_OCUPADO, ouvir);
  }, []);
  return n;
}
