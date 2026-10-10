import { useContext, useState } from "react";
import { ChevronRight, Star } from "lucide-react";

import { PainelAvaliacoes } from "@/components/PainelAvaliacoes";
import {
  avaliacoesValidas,
  notaEscrita,
  rotuloDasAvaliacoes,
  totalEscrito,
  type Avaliacoes as DadosAvaliacoes,
} from "@/lib/avaliacoes";
import {
  ContextoAvaliacoesPorItem,
  itemDaOferta,
  type ResumoAvaliacoes,
} from "@/lib/avaliacoes-detalhe";

function Nota({ v, compacto }: { v: DadosAvaliacoes; compacto: boolean }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-0.5">
      <Star className="size-3 fill-amber-400 text-amber-400" />
      <strong className="font-bold tabular-nums text-foreground">{notaEscrita(v)}</strong>
      <span className="tabular-nums">
        ({compacto ? v.total.toLocaleString("pt-BR") : totalEscrito(v)})
      </span>
    </span>
  );
}

/* Estrela + nota + total, como a página do anúncio mostra. Com o anúncio
   conhecido, vira botão que abre o detalhamento (distribuição e opiniões,
   Weslei 10/10). Sem dado conferido, não aparece. */
export function Avaliacoes({
  a,
  de = null,
  titulo = null,
  link = null,
  compacto = false,
  className = "",
}: {
  a: unknown;
  /* Oferta (item MLB... ou endereço do anúncio): abre o painel. */
  de?: { item?: string | null | undefined; url?: string | null | undefined } | null | undefined;
  titulo?: string | null | undefined;
  link?: string | null | undefined;
  /* Tabela e cartões estreitos: "4,9 (5.056)". */
  compacto?: boolean;
  className?: string;
}) {
  const porItem = useContext(ContextoAvaliacoesPorItem);
  const [aberto, setAberto] = useState(false);
  const item = itemDaOferta(de);
  const lida = item ? porItem.get(item) : undefined;
  const v = lida?.avaliacoes ?? avaliacoesValidas(a);
  if (!v) return null;
  const rotulo = rotuloDasAvaliacoes(v);
  if (!item) {
    return (
      <span
        className={`items-center gap-1 whitespace-nowrap text-[11px] leading-tight text-secondary-ink ${className}`}
        title={`${rotulo} no anúncio`}
      >
        <span className="sr-only">{rotulo}</span>
        <Nota v={v} compacto={compacto} />
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        title={`${rotulo}: ver as avaliações de quem comprou`}
        className={`items-center gap-1 whitespace-nowrap rounded-full text-[11px] leading-tight text-secondary-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${className}`}
      >
        <span className="sr-only">{`${rotulo}. Ver avaliações`}</span>
        <Nota v={v} compacto={compacto} />
        {!compacto && (
          <span aria-hidden="true" className="font-semibold text-[#0071e3]">
            Ver avaliações
          </span>
        )}
      </button>
      {aberto && (
        <PainelAvaliacoes
          item={item}
          titulo={titulo}
          resumo={v}
          link={link}
          fechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

/* Linha de avaliação dos cartões (vitrine, campanhas, brinquedos, mais
   vendidos): sempre ocupa a mesma altura, para os cartões ficarem
   alinhados. Com nota: estrela + "Ver avaliações" (abre o painel). Página
   lida sem avaliação: "Sem avaliações ainda". Sem leitura: espaço reservado. */
export function LinhaAvaliacoes({
  resumo,
  titulo = null,
  link = null,
  className = "",
}: {
  resumo: ResumoAvaliacoes | null | undefined;
  titulo?: string | null | undefined;
  link?: string | null | undefined;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const v = resumo?.avaliacoes ?? null;
  const base = `flex min-h-[20px] items-center text-[12px] leading-tight ${className}`;
  if (!v) {
    return resumo?.sem ? (
      <p className={`${base} text-secondary-ink`}>Sem avaliações ainda</p>
    ) : (
      <span aria-hidden="true" className={base} />
    );
  }
  const rotulo = rotuloDasAvaliacoes(v);
  if (!resumo?.item) {
    return (
      <p className={`${base} gap-1 text-secondary-ink`} title={`${rotulo} no anúncio`}>
        <span className="sr-only">{rotulo}</span>
        <Nota v={v} compacto />
      </p>
    );
  }
  return (
    <div className={base}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        title={`${rotulo}: ver as avaliações de quem comprou`}
        className="group inline-flex min-h-[28px] flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg text-left text-secondary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
      >
        <span className="sr-only">{`${rotulo}. Ver avaliações`}</span>
        <span className="whitespace-nowrap">
          <Nota v={v} compacto />
        </span>
        <span
          aria-hidden="true"
          className="inline-flex items-center whitespace-nowrap font-semibold text-[#0071e3] group-hover:underline"
        >
          Ver avaliações
          <ChevronRight className="size-3.5" />
        </span>
      </button>
      {aberto && (
        <PainelAvaliacoes
          item={resumo.item}
          titulo={titulo}
          resumo={v}
          link={link}
          fechar={() => setAberto(false)}
        />
      )}
    </div>
  );
}
