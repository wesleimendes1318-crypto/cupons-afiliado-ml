/* One checklist item: status (falta / já tenho / comprei / ganhei), the
   product chosen from real offers (bought through VerNaLoja, which ends in
   Weslei's link: rule no. 1) and "Pedir de presente" for the public list. */
import { Check, ChevronDown, Gift, Search } from "lucide-react";
import { useState } from "react";

import { VerNaLoja } from "@/components/BuscaPorLink";
import { OfertasDoItem } from "@/components/planejadores/OfertasDoItem";
import type { Resultado } from "@/lib/busca-guiada-cliente";
import type { Presente } from "@/lib/lista-publica";
import {
  FASES,
  type EstadoItem,
  type Estilo,
  type ItemPlano,
  type Status,
} from "@/lib/planejadores";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const STATUS: { id: Status; rotulo: string }[] = [
  { id: "falta", rotulo: "Falta" },
  { id: "tenho", rotulo: "Já tenho" },
  { id: "comprei", rotulo: "Comprei" },
  { id: "ganhei", rotulo: "Ganhei" },
];

export function CartaoItemPlanejador({
  item,
  estado,
  estilo,
  volts,
  presenteDeAlguem,
  atraso,
  aoMudar,
  aoEscolher,
}: {
  item: ItemPlano;
  estado: EstadoItem;
  estilo: Estilo;
  volts: "127" | "220" | null;
  /** A guest marked it as bought on the public list. */
  presenteDeAlguem: Presente | undefined;
  atraso: number;
  aoMudar: (f: (x: EstadoItem) => EstadoItem) => void;
  aoEscolher: (r: Resultado, presente: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [querPresente, setQuerPresente] = useState(false);
  const e = estado.escolhido;
  const resolvido = estado.status !== "falta";

  return (
    <li
      className={
        "animate-cartao min-w-0 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] transition sm:p-5 " +
        (resolvido ? "opacity-75" : "")
      }
      style={{ animationDelay: `${Math.min(atraso, 8) * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " +
            (resolvido ? "bg-[#34c759] text-white" : "ring-2 ring-border")
          }
          aria-hidden="true"
        >
          {resolvido && <Check className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className={
              "text-base font-bold leading-snug " + (resolvido ? "line-through decoration-1" : "")
            }
          >
            {item.nome}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-secondary-ink">
            <span className="inline-flex items-center gap-1">
              <span
                className="size-2 rounded-full"
                style={{ background: FASES[item.fase].cor }}
                aria-hidden="true"
              />
              {FASES[item.fase].rotulo}
            </span>
            {item.eletrico && volts && <span>· {volts} V ou bivolt</span>}
          </p>
          {item.dica && !resolvido && (
            <p className="mt-1 text-xs text-secondary-ink">{item.dica}</p>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-label={`Situação de ${item.nome}`}
        className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-[#f5f5f7] p-1 dark:bg-white/5"
      >
        {STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={estado.status === s.id}
            onClick={() => aoMudar((x) => ({ ...x, status: s.id }))}
            className={
              "min-h-11 min-w-0 rounded-full px-1 text-[12px] font-semibold transition sm:text-[13px] " +
              (estado.status === s.id ? "bg-card text-foreground shadow-sm" : "text-secondary-ink")
            }
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {e && (
        <div className="mt-3 flex min-w-0 items-center gap-3 rounded-2xl bg-[#f5f5f7] p-2.5 dark:bg-white/5">
          {e.foto ? (
            <img
              src={e.foto}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-16 shrink-0 rounded-xl bg-white object-contain p-1"
            />
          ) : (
            <span className="size-16 shrink-0 rounded-xl bg-white" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{e.titulo}</p>
            {e.preco != null && (
              <p className="text-sm font-extrabold tabular-nums">
                {brl(e.preco)}{" "}
                <span className="text-[10px] font-normal text-secondary-ink">
                  em {dia(e.adicionadoEm)}, confira na loja
                </span>
              </p>
            )}
          </div>
        </div>
      )}
      {presenteDeAlguem && estado.status === "falta" && (
        <p className="mt-2 rounded-2xl bg-[#34c759]/10 px-3 py-2 text-xs font-semibold text-[#248a3d]">
          {presenteDeAlguem.nome
            ? `${presenteDeAlguem.nome} marcou que vai dar de presente.`
            : "Alguém marcou que vai dar de presente."}{" "}
          <button
            type="button"
            onClick={() => aoMudar((x) => ({ ...x, status: "ganhei" }))}
            className="min-h-11 underline underline-offset-2"
          >
            Marcar como ganhei
          </button>
        </p>
      )}

      {!resolvido && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {e?.url && (
            <div className="sm:w-56">
              <VerNaLoja url={e.url} grande />
            </div>
          )}
          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => setAberto((v) => !v)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-[#0071e3] ring-1 ring-border transition active:scale-[0.97]"
          >
            {e ? (
              <ChevronDown
                className={"size-4 transition " + (aberto ? "rotate-180" : "")}
                aria-hidden="true"
              />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            {e
              ? aberto
                ? "Fechar opções"
                : "Trocar produto"
              : aberto
                ? "Fechar ofertas"
                : "Ver ofertas"}
          </button>
          <button
            type="button"
            aria-pressed={estado.presente}
            onClick={() => {
              if (e) return aoMudar((x) => ({ ...x, presente: !x.presente }));
              setQuerPresente(true);
              setAberto(true);
            }}
            className={
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] " +
              (estado.presente
                ? "bg-[#ff2d55]/10 text-[#d70040]"
                : "text-secondary-ink ring-1 ring-border")
            }
          >
            <Gift className="size-4" aria-hidden="true" />
            {estado.presente ? "Na lista de presentes" : "Pedir de presente"}
          </button>
        </div>
      )}
      {querPresente && !e && aberto && (
        <p className="mt-2 text-xs font-semibold text-[#0058b0] dark:text-[#64a8ff]">
          Escolha um produto abaixo para entrar na lista de presentes.
        </p>
      )}
      {aberto && !resolvido && (
        <div className="mt-3">
          <OfertasDoItem
            item={item}
            estilo={estilo}
            volts={volts}
            escolhidoId={e?.id ?? null}
            aoEscolher={(r) => {
              aoEscolher(r, querPresente || estado.presente);
              setQuerPresente(false);
              setAberto(false);
            }}
          />
        </div>
      )}
    </li>
  );
}
