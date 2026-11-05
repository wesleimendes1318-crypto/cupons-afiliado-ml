/* Fixed top bar of /amigo-secreto: budget (quick chips + custom), import
   the group list. The delivery CEP lives in the site header (CepTopo). */
import { ClipboardPaste } from "lucide-react";
import { useState } from "react";

const FAIXAS = [
  { rotulo: "Até R$ 50", min: null, max: 50 },
  { rotulo: "R$ 80 a R$ 100", min: 80, max: 100 },
  { rotulo: "R$ 100 a R$ 200", min: 100, max: 200 },
] as const;

export const rotuloFaixa = (min: number | null, max: number) =>
  min ? `entre R$ ${min} e R$ ${max}` : `até R$ ${max}`;

export function CabecalhoAmigoSecreto({
  min,
  max,
  aoMudarFaixa,
  aoImportar,
}: {
  min: number | null;
  max: number;
  aoMudarFaixa: (min: number | null, max: number) => void;
  aoImportar: () => void;
}) {
  const fixa = FAIXAS.find((f) => f.min === min && f.max === max);
  const [personalizar, setPersonalizar] = useState(false);
  const [de, setDe] = useState(String(min ?? ""));
  const [ate, setAte] = useState(String(max));
  const aplicar = () => {
    const a = Number(de.replace(",", ".")) || null;
    const b = Number(ate.replace(",", "."));
    if (!(b > 0) || (a != null && a >= b)) return;
    aoMudarFaixa(a, Math.round(b));
  };
  const chip = (ativo: boolean) =>
    "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
    (ativo ? "bg-[#0071e3] text-white shadow-sm" : "vidro-botao text-[#1d1d1f] dark:text-white");
  return (
    <div className="vidro-barra sticky top-14 z-30 border-b sm:top-[60px] border-black/5 dark:border-white/10">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-xs font-semibold text-secondary-ink">Valor do presente</span>
          {FAIXAS.map((f) => (
            <button
              key={f.rotulo}
              type="button"
              aria-pressed={fixa === f && !personalizar}
              onClick={() => {
                setPersonalizar(false);
                aoMudarFaixa(f.min, f.max);
              }}
              className={chip(fixa === f && !personalizar)}
            >
              {f.rotulo}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={personalizar || !fixa}
            onClick={() => setPersonalizar((p) => !p)}
            className={chip(personalizar || !fixa)}
          >
            {!fixa && !personalizar ? `R$ ${min ?? 0} a R$ ${max}` : "Personalizado"}
          </button>
          </div>
          <button
            type="button"
            onClick={aoImportar}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#1d1d1f] px-4 text-[13px] font-semibold text-white active:scale-[0.97] dark:bg-white dark:text-[#1d1d1f]"
          >
            <ClipboardPaste className="size-4" aria-hidden="true" />
            Colar lista<span className="hidden sm:inline"> do grupo</span>
          </button>
        </div>
        {personalizar && (
          <form
            className="animate-conteudo flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              aplicar();
            }}
          >
            <label className="flex flex-col text-[11px] font-semibold text-secondary-ink">
              De (R$)
              <input
                inputMode="decimal"
                value={de}
                onChange={(e) => setDe(e.target.value)}
                className="mt-0.5 h-11 w-24 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                placeholder="0"
              />
            </label>
            <label className="flex flex-col text-[11px] font-semibold text-secondary-ink">
              Até (R$)
              <input
                inputMode="decimal"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                className="mt-0.5 h-11 w-24 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>
            <button type="submit" className="h-11 rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white">
              Aplicar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
