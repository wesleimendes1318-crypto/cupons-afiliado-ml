import { Star } from "lucide-react";

import {
  avaliacoesValidas,
  notaEscrita,
  rotuloDasAvaliacoes,
  totalEscrito,
} from "@/lib/avaliacoes";

/* Estrela + nota + total, como a página do anúncio mostra. Sem dado
   conferido, não aparece. */
export function Avaliacoes({
  a,
  compacto = false,
  className = "",
}: {
  a: unknown;
  /* Tabela e cartões estreitos: "4,9 (5.056)". */
  compacto?: boolean;
  className?: string;
}) {
  const v = avaliacoesValidas(a);
  if (!v) return null;
  const rotulo = rotuloDasAvaliacoes(v);
  return (
    <span
      className={`items-center gap-1 whitespace-nowrap text-[11px] leading-tight text-secondary-ink ${className}`}
      title={`${rotulo} no anúncio`}
    >
      <span className="sr-only">{rotulo}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        <Star className="size-3 fill-amber-400 text-amber-400" />
        <strong className="font-bold tabular-nums text-foreground">{notaEscrita(v)}</strong>
        <span className="tabular-nums">
          ({compacto ? v.total.toLocaleString("pt-BR") : totalEscrito(v)})
        </span>
      </span>
    </span>
  );
}
