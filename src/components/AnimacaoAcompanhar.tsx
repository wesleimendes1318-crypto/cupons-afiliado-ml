/* ACOMPANHAR PREÇO, ANIMADO (Weslei, 09/10: "animação sobre acompanhar os
   preços"). Ilustração sem números (nada de preço inventado): a linha do
   preço desce até o preço desejado, o ponto acende e o sino toca com o
   aviso. Só transform/opacity e o traço da linha; 3 repetições e para no
   quadro final; prefers-reduced-motion mostra o quadro final parado. */
import { Link } from "@tanstack/react-router";
import { Bell, LineChart } from "lucide-react";

export function AnimacaoAcompanhar({
  compacto = false,
  className = "",
}: {
  /* /meus-precos: sem o botão (a pessoa já está na página). */
  compacto?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="acompanhar-titulo"
      className={
        "grid items-center gap-5 overflow-hidden rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:p-6 " +
        className
      }
    >
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-bold text-[#0058b0]">
          <LineChart className="size-3.5" aria-hidden="true" />
          Acompanhar preço
        </p>
        <h2
          id="acompanhar-titulo"
          className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl"
        >
          Quer pagar menos? Eu aviso quando cair.
        </h2>
        <p className="mt-1.5 text-sm text-secondary-ink">
          Compare um produto e toque em "Acompanhar preço". Eu confiro o preço de tempos em tempos e
          aviso aqui no site ou no Telegram quando ele cair ou chegar no valor que você quer.
        </p>
        {!compacto && (
          <Link
            to="/meus-precos"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            <Bell className="size-4" aria-hidden="true" />
            Ver meus preços
          </Link>
        )}
      </div>

      <figure
        className="relative mx-auto w-full max-w-md"
        aria-label="Ilustração: o preço cai até o valor desejado e chega o aviso"
      >
        <svg viewBox="0 0 320 170" className="h-auto w-full" role="img" aria-hidden="true">
          <rect x="0" y="0" width="320" height="170" rx="22" fill="#f5f5f7" />
          {/* Grade suave. */}
          {[40, 75, 110, 145].map((y) => (
            <line key={y} x1="20" x2="300" y1={y} y2={y} stroke="#e3e3e8" strokeWidth="1" />
          ))}
          {/* Preço desejado. */}
          <line
            x1="20"
            x2="300"
            y1="122"
            y2="122"
            stroke="#34c759"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          <text x="24" y="138" fontSize="11" fill="#1f7a3a" fontWeight="600">
            seu preço desejado
          </text>
          {/* Linha do preço. */}
          <path
            className="acomp-linha"
            pathLength={1}
            d="M20 52 C 55 46, 70 70, 100 62 S 150 40, 175 74 S 225 96, 250 104 S 285 120, 292 122"
            fill="none"
            stroke="#0071e3"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle
            className="acomp-ponto"
            cx="292"
            cy="122"
            r="7"
            fill="#34c759"
            stroke="#fff"
            strokeWidth="3"
          />
        </svg>
        {/* Aviso que chega. */}
        <figcaption className="acomp-aviso absolute right-2 top-2 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]">
          <span className="acomp-sino grid size-6 place-items-center rounded-full bg-[#34c759] text-white">
            <Bell className="size-3.5" aria-hidden="true" />
          </span>
          O preço caiu!
        </figcaption>
      </figure>
    </section>
  );
}
