/* CEP NO CABEÇALHO (Weslei, 02/11: "está faltando ... as facilidades do
   cep"): a mesma região do resultado, visível em todas as páginas. Tocar
   abre a troca do CEP (digitado ou pela localização do aparelho). */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { SeloCep, useCepDestino } from "@/components/CepDestino";

export function CepTopo() {
  const { regiao, trocar } = useCepDestino(true);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  /* Atalho "Informe o CEP" dos cartões (05/11): o cabeçalho é fixo. */
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener("abrir-cep", abrir);
    return () => window.removeEventListener("abrir-cep", abrir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  /* Fecha sozinho depois que o CEP muda. */
  const ultimo = useRef(regiao?.cep);
  useEffect(() => {
    if (regiao?.cep !== ultimo.current) {
      ultimo.current = regiao?.cep;
      setAberto(false);
    }
  }, [regiao?.cep]);

  const rotulo = !regiao || regiao.padrao ? "Informar CEP" : (regiao.cidade ?? regiao.cep);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        aria-expanded={aberto}
        aria-label={
          regiao && !regiao.padrao
            ? `Entregar em ${regiao.cidade ?? ""} ${regiao.cep}. Alterar CEP`
            : "Informar o CEP de entrega"
        }
        className="inline-flex min-h-10 min-w-10 max-w-[150px] items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold text-[#1d1d1f] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-white dark:hover:bg-white/10 sm:px-3"
      >
        <MapPin className="size-4 shrink-0 text-[#0071e3]" aria-hidden />
        <span className="hidden min-w-0 flex-col items-start leading-tight min-[480px]:flex">
          <span className="text-[10px] font-normal text-secondary-ink">Entregar em</span>
          <span className="max-w-[100px] truncate">{rotulo}</span>
        </span>
      </button>
      {aberto && (
        <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-border bg-card p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[340px]">
          <p className="text-sm font-semibold text-foreground">Onde você vai receber?</p>
          <p className="mt-0.5 text-xs text-secondary-ink">
            Frete e prazo de entrega de cada loja são calculados para este CEP.
          </p>
          <SeloCep regiao={regiao} trocar={trocar} className="mt-3" />
        </div>
      )}
    </div>
  );
}
