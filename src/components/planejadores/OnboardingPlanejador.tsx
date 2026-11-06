/* 3 quick questions before the checklist: style + optional budget, moving
   date, voltage (pre-filled from the region already saved in the browser,
   always "confira na tomada"). Every step can be skipped. */
import { useState } from "react";

import type { EstadoPlano, Estilo } from "@/lib/planejadores";
import type { VoltagemDaRegiao } from "@/lib/voltagem";

const ESTILOS: { id: Estilo; rotulo: string; texto: string }[] = [
  { id: "economico", rotulo: "Econômico", texto: "Menor preço primeiro" },
  { id: "equilibrado", rotulo: "Equilibrado", texto: "Lojas oficiais e mais vendidos primeiro" },
  { id: "premium", rotulo: "Caprichado", texto: "Lojas oficiais e modelos mais completos" },
];

const pilula = (ativo: boolean) =>
  "min-h-11 rounded-2xl px-4 py-2 text-left text-sm font-semibold transition active:scale-[0.98] " +
  (ativo ? "bg-[#0071e3] text-white" : "bg-card ring-1 ring-border");

export function OnboardingPlanejador({
  pergunta,
  inicial,
  regiao,
  aoConcluir,
}: {
  pergunta: string;
  inicial: EstadoPlano;
  regiao: VoltagemDaRegiao | null;
  aoConcluir: (e: Pick<EstadoPlano, "estilo" | "orcamento" | "data" | "volts">) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [estilo, setEstilo] = useState<Estilo>(inicial.estilo);
  const [orcamento, setOrcamento] = useState(inicial.orcamento ? String(inicial.orcamento) : "");
  const [data, setData] = useState(inicial.data ?? "");
  const [volts, setVolts] = useState<"127" | "220" | null>(inicial.volts ?? regiao?.volts ?? null);
  const concluir = () => {
    const n = Number(orcamento.replace(/\D/g, ""));
    aoConcluir({ estilo, orcamento: n > 0 ? n : null, data: data || null, volts });
  };

  return (
    <section
      aria-label="Primeiros passos"
      className="animate-cartao rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-7"
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((k) => (
          <span
            key={k}
            className={
              "h-1.5 flex-1 rounded-full transition " + (k <= passo ? "bg-[#0071e3]" : "bg-border")
            }
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-secondary-ink">Passo {passo + 1} de 3</p>

      {passo === 0 && (
        <div className="mt-1">
          <h2 className="text-xl font-extrabold tracking-tight">Como você quer comprar?</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {ESTILOS.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={estilo === e.id}
                onClick={() => setEstilo(e.id)}
                className={pilula(estilo === e.id)}
              >
                {e.rotulo}
                <span
                  className={
                    "block text-xs font-normal " +
                    (estilo === e.id ? "text-white/85" : "text-secondary-ink")
                  }
                >
                  {e.texto}
                </span>
              </button>
            ))}
          </div>
          <label className="mt-4 flex flex-col gap-1 text-sm font-semibold">
            Quanto pretende gastar no total? (opcional)
            <input
              inputMode="numeric"
              value={orcamento}
              placeholder="Ex.: 8000"
              onChange={(e) => setOrcamento(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
              className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-base font-normal"
            />
          </label>
        </div>
      )}

      {passo === 1 && (
        <div className="mt-1">
          <h2 className="text-xl font-extrabold tracking-tight">{pergunta}</h2>
          <p className="mt-1 text-sm text-secondary-ink">
            Mostramos quantos dias faltam para você priorizar o essencial.
          </p>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-label={pergunta}
            className="mt-3 h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-base sm:w-auto"
          />
          <button
            type="button"
            onClick={() => setData("")}
            className="ml-0 mt-2 block min-h-11 text-sm font-semibold text-[#0071e3] sm:ml-3 sm:inline"
          >
            Ainda sem data
          </button>
        </div>
      )}

      {passo === 2 && (
        <div className="mt-1">
          <h2 className="text-xl font-extrabold tracking-tight">Qual a voltagem das tomadas?</h2>
          <p className="mt-1 text-sm text-secondary-ink">
            {regiao
              ? `Em ${regiao.cidade} o comum é ${regiao.volts} V. Confira na tomada: um mesmo imóvel pode ter as duas.`
              : "Escondemos eletrodomésticos que não funcionam na sua voltagem. Bivolt sempre aparece."}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["127", "220", null] as const).map((v) => (
              <button
                key={v ?? "nao-sei"}
                type="button"
                aria-pressed={volts === v}
                onClick={() => setVolts(v)}
                className={pilula(volts === v) + " text-center"}
              >
                {v ? `${v} V` : "Não sei"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        {passo > 0 ? (
          <button
            type="button"
            onClick={() => setPasso((p) => p - 1)}
            className="min-h-11 rounded-full px-4 text-sm font-semibold text-[#0071e3]"
          >
            Voltar
          </button>
        ) : (
          <button
            type="button"
            onClick={concluir}
            className="min-h-11 rounded-full px-4 text-sm font-semibold text-secondary-ink"
          >
            Pular
          </button>
        )}
        <button
          type="button"
          onClick={() => (passo < 2 ? setPasso((p) => p + 1) : concluir())}
          className="min-h-11 rounded-full bg-[#0071e3] px-6 text-sm font-semibold text-white shadow-sm transition active:scale-[0.97]"
        >
          {passo < 2 ? "Continuar" : "Ver minha lista"}
        </button>
      </div>
    </section>
  );
}
