/* BARRA DAS LOJAS (Weslei, 07/11): floating glass pills with each store's
   price; a tap scrolls to that store. Used by the comparison of a pasted ML
   link (ComparacaoMarketplaces) and of a link from another store
   (LinkDeOutraLoja). Store named in text only (no logo, no brand colors). */
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Exact price without ",00" when there are no cents (fits 3 pills at 320 px). */
const precoCurto = (n: number) =>
  Number.isInteger(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : brl(n);

export type PilulaDeLoja = {
  chave: string;
  nome: string;
  /* Shorter name below 640 px ("ML"). */
  curto: string;
  /* Price shown, or the text when there is none ("Comparar", "—"). */
  valor: number | string;
  vence: boolean;
};

export function BarraDeLojas({
  itens,
  ir,
  className = "top-16 sm:top-[72px]",
}: {
  itens: PilulaDeLoja[];
  ir: (chave: string) => void;
  /* Sticky offset: below the site header (and the section bar, when there is one). */
  className?: string;
}) {
  return (
    <nav
      aria-label="Ir para a loja"
      className={
        "vidro-barra sticky z-30 mt-3 flex items-center gap-1 rounded-full border border-border/60 p-1.5 shadow-lg " +
        className
      }
    >
      {itens.map((i) => (
        <button
          key={i.chave}
          type="button"
          onClick={() => ir(i.chave)}
          className={
            "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-full px-1 leading-tight transition-colors duration-200 " +
            (i.vence
              ? "bg-success text-white"
              : "text-foreground hover:bg-black/[0.05] dark:hover:bg-white/10")
          }
        >
          <span className="max-w-full truncate text-[11px] font-semibold">
            <span className="sm:hidden">{i.curto}</span>
            <span className="hidden sm:inline">{i.nome}</span>
          </span>
          <span className="max-w-full truncate text-[11px] font-bold tabular-nums sm:text-[12px]">
            {typeof i.valor === "number" ? precoCurto(i.valor) : i.valor}
          </span>
        </button>
      ))}
    </nav>
  );
}
