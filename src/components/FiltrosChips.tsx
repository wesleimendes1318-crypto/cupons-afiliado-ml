/* Chips de filtro (página de categoria e resultado da busca). */
const CHIP =
  "inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]";
export const chip = (ativo: boolean) =>
  CHIP +
  (ativo
    ? " border-[#0071e3] bg-[#0071e3] text-white"
    : " border-border bg-card text-foreground hover:border-[#0071e3]");

export function Grupo({
  nome,
  opcoes,
  atual,
  onEscolher,
}: {
  nome: string;
  opcoes: Array<{ id: string; rotulo: string }>;
  atual: string | null;
  onEscolher: (id: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-bold text-secondary-ink">{nome}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={atual === o.id}
            onClick={() => onEscolher(atual === o.id ? null : o.id)}
            className={chip(atual === o.id)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
