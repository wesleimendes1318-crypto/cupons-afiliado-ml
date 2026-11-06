/* Fixed top bar of /amigo-secreto: budget and import the group list.
   Weslei, 06/11: no preset ranges; the value is asked first (form open until
   chosen) and stays editable from the chip. The delivery CEP lives in the site header (CepTopo). */
import { ClipboardPaste } from "lucide-react";
import { useEffect, useState } from "react";

export const rotuloFaixa = (min: number | null, max: number | null) =>
  !max ? (min ? `a partir de R$ ${min}` : "em qualquer valor") : min ? `entre R$ ${min} e R$ ${max}` : `até R$ ${max}`;

export function CabecalhoAmigoSecreto({
  min,
  max,
  escolhida,
  aoMudarFaixa,
  aoImportar,
}: {
  min: number | null;
  max: number | null;
  escolhida: boolean;
  aoMudarFaixa: (min: number | null, max: number | null) => void;
  aoImportar: () => void;
}) {
  const [personalizar, setPersonalizar] = useState(!escolhida);
  const [de, setDe] = useState(String(min ?? ""));
  const [ate, setAte] = useState(max ? String(max) : "");
  /* Saved state arrives after mount: open the form when no value was chosen yet. */
  useEffect(() => {
    if (!escolhida) setPersonalizar(true);
  }, [escolhida]);
  useEffect(() => {
    setDe(min ? String(min) : "");
    setAte(max ? String(max) : "");
  }, [min, max]);
  const aplicar = () => {
    const a = Number(de.replace(",", ".")) || null;
    const b = Number(ate.replace(",", ".")) || null;
    if (b != null && a != null && a >= b) return;
    setPersonalizar(false);
    aoMudarFaixa(a, b != null ? Math.round(b) : null);
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
          <button
            type="button"
            aria-expanded={personalizar}
            onClick={() => setPersonalizar((p) => !p)}
            className={chip(escolhida)}
          >
            {escolhida ? rotuloFaixa(min, max).replace(/^./, (c) => c.toUpperCase()) : "Escolher valor"}
            <span className="ml-1.5 opacity-80">· Editar</span>
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
          <>
          {!escolhida && (
            <p className="text-sm font-semibold">Quanto você quer gastar em cada presente? Preencha só o que quiser.</p>
          )}
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
            <button
              type="button"
              onClick={() => {
                setPersonalizar(false);
                aoMudarFaixa(null, null);
              }}
              className="vidro-botao h-11 rounded-full px-4 text-sm font-semibold"
            >
              Qualquer valor
            </button>
          </form>
          </>
        )}
      </div>
    </div>
  );
}
