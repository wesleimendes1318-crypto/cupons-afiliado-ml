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
