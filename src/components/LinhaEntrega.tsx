/* DATA DE ENTREGA NO CARTÃO (05/11). Com CEP: a data oficial do Mercado
   Livre para a opção que chega antes (verde até amanhã, azul depois). Sem
   CEP: atalho para informar. Sem data confirmada: "Frete e prazo no
   anúncio", nunca uma data inventada. Uma linha só, para não empurrar o
   título nem desalinhar as fotos. */
import { Check, MapPin, Truck, Zap } from "lucide-react";

import { abrirCepTopo, usePrazosDosItens } from "@/lib/prazo-cliente";
import { textoDaEntrega } from "@/lib/prazo-entrega";

export function LinhaEntrega({
  item,
  freteGratis,
  className = "",
}: {
  /* Anúncio que o botão de compra abre; sem ele, só a linha de frete. */
  item: string | null | undefined;
  freteGratis: boolean | null | undefined;
  className?: string;
}) {
  const { cep, prazos } = usePrazosDosItens([item]);
  const base = `flex min-w-0 items-center gap-1 text-[11px] leading-tight ${className}`;
  const valido = !!item && /^MLB\d{6,}$/.test(item);

  if (valido && !cep)
    return (
      <>
        {freteGratis === true && (
          <p className={`${base} font-semibold text-success`}>
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
            Frete grátis
          </p>
        )}
        <button
          type="button"
          onClick={abrirCepTopo}
          className={`${base} items-start self-start text-left font-semibold text-[#0058b0] underline-offset-2 hover:underline dark:text-[#4da3ff]`}
        >
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Informe o CEP para ver a data de entrega</span>
        </button>
      </>
    );

  const r = valido ? prazos.get(item) : null;
  if (valido && r === undefined)
    return (
      <p className={`${base} text-secondary-ink`} aria-busy="true">
        <Truck className="size-3.5 shrink-0 motion-safe:animate-pulse" aria-hidden="true" />
        <span className="truncate">Consultando a entrega…</span>
      </p>
    );

  if (r) {
    const { texto, rapida } = textoDaEntrega(r);
    return (
      <p
        className={`${base} self-start rounded-full px-2 py-0.5 font-semibold ${
          rapida
            ? "bg-[#34c759]/12 text-[#248a3d] dark:text-[#34c759]"
            : "bg-[#0071e3]/10 text-[#0058b0] dark:text-[#4da3ff]"
        }`}
      >
        {rapida ? (
          <Zap className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Truck className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{texto}</span>
      </p>
    );
  }

  /* Sem prazo (ou sem anúncio): o frete que o cartão já sabia. */
  return (
    <p
      className={`${base} ${freteGratis === true ? "font-semibold text-success" : "text-secondary-ink"}`}
    >
      {freteGratis === true ? (
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Truck className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">
        {freteGratis === true
          ? valido && cep
            ? "Frete grátis · prazo no anúncio"
            : "Frete grátis"
          : "Frete e prazo no anúncio"}
      </span>
    </p>
  );
}
