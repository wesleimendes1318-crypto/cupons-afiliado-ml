import { LoaderCircle, Plus } from "lucide-react";

export function BotaoCarregarMaisVitrine({
  carregando,
  aoCarregar,
  className = "",
}: {
  carregando: boolean;
  aoCarregar: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoCarregar}
      disabled={carregando}
      className={
        "vidro-botao inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold text-[#0058b0] transition active:scale-[0.97] disabled:opacity-70 dark:text-[#64a8ff] " +
        className
      }
    >
      {carregando ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="size-4" aria-hidden="true" />
      )}
      {carregando ? "Buscando mais opções…" : "+20 opções"}
    </button>
  );
}
