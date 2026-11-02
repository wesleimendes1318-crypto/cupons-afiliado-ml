import { useState, type ReactNode } from "react";

/* Home leve (02/11): as vitrines da home viram abas de UMA seção, em vez de
   cinco blocos empilhados. Só a aba escolhida é montada (menos leitura e
   menos poluição); cada vitrine mantém as próprias regras (afiliado, nota,
   frete). */
export type AbaVitrine = { id: string; rotulo: string; conteudo: () => ReactNode };

export function VitrinesHomeAbas({ abas }: { abas: AbaVitrine[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.id);
  const atual = abas.find((a) => a.id === ativa) ?? abas[0];
  return (
    <section aria-labelledby="vitrines-home" className="mt-10">
      <h2 id="vitrines-home" className="text-2xl font-extrabold tracking-tight">
        Ofertas já comparadas
      </h2>
      <div
        role="tablist"
        aria-label="Escolha a vitrine"
        className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
      >
        {abas.map((a) => {
          const sel = a.id === atual?.id;
          return (
            <button
              key={a.id}
              role="tab"
              type="button"
              aria-selected={sel}
              aria-controls={`aba-${a.id}`}
              onClick={() => setAtiva(a.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                sel
                  ? "bg-foreground text-background"
                  : "bg-card text-secondary-ink shadow-sm hover:text-foreground"
              }`}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>
      <div
        id={`aba-${atual?.id}`}
        role="tabpanel"
        key={atual?.id}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 [&>*:first-child]:mt-2"
      >
        {atual?.conteudo()}
      </div>
    </section>
  );
}
