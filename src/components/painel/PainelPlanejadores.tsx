/* Planners in progress on this device (localStorage, the same state the
   planner page uses). Spent = "comprei" items, remaining = chosen prices still
   to buy (resumir()); a planner nobody opened is not listed. */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { BarraProgresso } from "@/components/painel/animacao";
import {
  chaveDoPlano,
  lerEstado,
  PLANEJADORES,
  resumir,
  type EstadoPlano,
  type Planejador,
} from "@/lib/planejadores";

export type PlanoAtivo = { p: Planejador; e: EstadoPlano };

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function lerPlanosAtivos(): PlanoAtivo[] {
  const lista: PlanoAtivo[] = [];
  for (const p of PLANEJADORES) {
    try {
      const bruto = localStorage.getItem(chaveDoPlano(p.slug));
      if (!bruto) continue;
      const e = lerEstado(JSON.parse(bruto), p);
      if (e.configurado || Object.keys(e.itens).length) lista.push({ p, e });
    } catch {
      /* broken or blocked storage: skip this planner */
    }
  }
  return lista;
}

export function usePlanosAtivos(): PlanoAtivo[] | null {
  const [planos, setPlanos] = useState<PlanoAtivo[] | null>(null);
  useEffect(() => setPlanos(lerPlanosAtivos()), []);
  return planos;
}

export function PainelPlanejadores({ planos }: { planos: PlanoAtivo[] | null }) {
  if (planos == null) return null;
  if (!planos.length)
    return (
      <div className="animate-cartao rounded-3xl bg-[#f5f5f7] p-5 text-center dark:bg-white/5">
        <p className="font-semibold text-foreground">Nenhum planejador começado ainda.</p>
        <p className="mt-1">Casa nova, enxoval, casamento, home office: escolha um momento.</p>
        <Link
          to="/planejadores"
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white"
        >
          Ver planejadores
        </Link>
      </div>
    );
  return (
    <ul className="!ml-0 !list-none !pl-0 grid gap-3 sm:grid-cols-2">
      {planos.map(({ p, e }, k) => {
        const r = resumir(p, e);
        const pct = r.total ? (r.resolvidos / r.total) * 100 : 0;
        const orc = e.orcamento;
        return (
          <li key={p.slug} className="animate-cartao" style={{ animationDelay: `${k * 60}ms` }}>
            <Link
              to="/planejadores/$slug"
              params={{ slug: p.slug }}
              className="group block rounded-3xl border border-border bg-card p-4 transition hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transform-none"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f5f5f7] text-2xl dark:bg-white/5" aria-hidden="true">
                  {p.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-foreground">{p.titulo}</span>
                  <span className="block text-xs">
                    {r.resolvidos} de {r.total} itens resolvidos
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
              </span>
              <span className="mt-3 block">
                <BarraProgresso pct={pct} rotulo={`${p.titulo}: itens resolvidos`} />
              </span>
              <span className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs tabular-nums">
                <span>
                  Gasto: <strong>{brl(r.gasto)}</strong>
                </span>
                <span>
                  Falta comprar: <strong>{brl(r.faltaTotal)}</strong>
                </span>
              </span>
              {orc != null && (
                <span className="mt-2 block">
                  <BarraProgresso
                    pct={(r.gasto / orc) * 100}
                    cor={r.gasto > orc ? "#ff3b30" : "#34c759"}
                    rotulo={`${p.titulo}: orçamento usado`}
                  />
                  <span className="mt-1 block text-xs tabular-nums">
                    {r.gasto > orc
                      ? `${brl(r.gasto - orc)} acima do orçamento de ${brl(orc)}`
                      : `${brl(orc - r.gasto)} livres do orçamento de ${brl(orc)}`}
                  </span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
