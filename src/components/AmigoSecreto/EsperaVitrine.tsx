/* ESPERA DA VITRINE (Weslei, 05/11: estilo Apple / vidro). Shimmer cards with
   the exact shape of a product card (photo square, title, price, button) so
   nothing jumps when products arrive, and a floating white pill with a
   drawn line (blue) that ends in a check (green) plus the waiting message.
   Only transform/opacity/stroke; prefers-reduced-motion shows it still. */
export function CartoesDeEspera({ quantos = 4 }: { quantos?: number }) {
  return (
    <>
      {Array.from({ length: quantos }, (_, k) => (
        <li
          key={k}
          aria-hidden="true"
          className="flex flex-col overflow-hidden rounded-3xl bg-[#f5f5f7] dark:bg-white/5"
        >
          <div className="esqueleto aspect-square w-full" />
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="esqueleto h-4 w-20 rounded-full" />
            <div className="esqueleto h-4 w-full rounded-full" />
            <div className="esqueleto h-4 w-3/4 rounded-full" />
            <div className="esqueleto mt-2 h-6 w-24 rounded-full" />
            <div className="esqueleto mt-auto h-11 w-full rounded-2xl" />
          </div>
        </li>
      ))}
    </>
  );
}

export function PilulaDeEspera({ frase }: { frase: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 flex justify-center px-4">
      <p
        aria-live="polite"
        className="flex max-w-full items-center gap-2.5 rounded-full bg-white/95 px-4 py-2.5 text-xs font-semibold text-foreground shadow-[var(--shadow-card)] backdrop-blur dark:bg-[#1c1c1e]/95 sm:text-sm"
      >
        <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden="true">
          <circle cx="16" cy="16" r="13" fill="none" stroke="#e3e3e8" strokeWidth="2.5" />
          <path
            className="garimpo-traco"
            pathLength={1}
            d="M16 3 a13 13 0 1 1 -9.2 3.8"
            fill="none"
            stroke="#0071e3"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            className="garimpo-check"
            pathLength={1}
            d="M10.5 16.5 l3.8 3.8 l7.2 -7.8"
            fill="none"
            stroke="#34c759"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span key={frase} className="frase-espera min-w-0">
          {frase}
        </span>
      </p>
    </div>
  );
}

/* BARRA DE CARGA (Weslei, 06/11: "uma barra sendo carregada com X produtos
   de 50", same look as the price-tracking animation): blue line that grows
   with the real count, green dot at its tip, soft shine while loading. */
export function BarraDeCarga({ n, meta }: { n: number; meta: number }) {
  const pct = Math.min(100, Math.round((n / Math.max(1, meta)) * 100));
  return (
    <div className="mb-2 rounded-2xl bg-[#f5f5f7] p-3 dark:bg-white/5">
      <p className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="flex min-w-0 items-center gap-2">
          <span className="carga-ponto size-2 shrink-0 rounded-full bg-[#34c759]" aria-hidden="true" />
          Carregando mais anúncios…
        </span>
        <span className="shrink-0 tabular-nums text-secondary-ink">
          {n} de {meta} produtos
        </span>
      </p>
      <div
        role="progressbar"
        aria-label="Anúncios carregados"
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={n}
        className="relative mt-2 h-2 overflow-hidden rounded-full bg-[#e3e3e8] dark:bg-white/10"
      >
        <div
          className="carga-barra relative h-full rounded-full bg-[#0071e3] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}
