/* RODAPÉ PADRÃO DOS CARTÕES (Weslei, 25/10: "preciso que mantenha esse
   padrão"; alguns cartões não tinham "Comparar preço"): em toda vitrine,
   "Comprar com segurança" largo (link de afiliado) e "Comparar preço" logo
   abaixo, no mesmo desenho dos Mais vendidos. */
import { ArrowRight, ShieldCheck } from "lucide-react";

/* 27/10: escudo e brilho sutil (botao-seguro, styles.css). */
const CLASSE_COMPRAR =
  "botao-seguro inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-success py-2.5 text-center text-sm font-bold text-white hover:brightness-95";

export function ComprarComSeguranca({ link, origem }: { link: string; origem: string }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-origem={origem}
      className={CLASSE_COMPRAR}
    >
      <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
      Comprar com segurança ↗
    </a>
  );
}

/* Na tela inicial abre a comparação ali mesmo; fora dela, pelo endereço. */
export function CompararPreco({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.location.pathname === "/")
          window.dispatchEvent(new CustomEvent("comparar-link", { detail: url }));
        else window.location.href = `/?link=${encodeURIComponent(url)}`;
      }}
      className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#0071e3]/40 px-2 py-1.5 text-xs font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
    >
      Comparar preço
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  );
}
