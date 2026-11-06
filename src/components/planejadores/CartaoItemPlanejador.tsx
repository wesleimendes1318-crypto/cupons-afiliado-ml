/* One checklist item: status (falta / já tenho / comprei / ganhei), the
   products chosen from real offers (several allowed, Weslei 06/11) (bought through VerNaLoja, which ends in
   Weslei's link: rule no. 1) and "Pedir de presente" for the public list. */
import { Check, ChevronDown, Gift, Plus, Search, X } from "lucide-react";
import { useState } from "react";

import { VerNaLoja } from "@/components/BuscaPorLink";
import { OfertasDoItem } from "@/components/planejadores/OfertasDoItem";
import { useFotosDoTermo } from "@/lib/fotos-do-plano";
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
  emoji,
  estado,
  estilo,
  volts,
  presenteDeAlguem,
  atraso,
  aoMudar,
  aoEscolher,
}: {
  item: ItemPlano;
  /** Planner emoji: art fallback when the search has no photo. */
  emoji: string;
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
  const escolhidos = estado.escolhidos;
  const e = escolhidos.length > 0;
  const resolvido = estado.status !== "falta";

  return (
    <li
      className={
        "animate-cartao group min-w-0 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none sm:p-5 " +
        (resolvido ? "opacity-75" : "")
      }
      style={{ animationDelay: `${Math.min(atraso, 8) * 40}ms` }}
    >
      <ArteDoItem
        termo={item.termos[0]!}
        escolhidas={escolhidos.flatMap((y) => (y.foto ? [y.foto] : [])).slice(0, 3)}
        emoji={emoji}
      />
      <div className="mt-3 flex items-start gap-3">
        <span
          className={
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " +
            (resolvido ? "bg-[#34c759] text-white" : "ring-2 ring-border")
          }
          aria-hidden="true"
        >
          {resolvido && <Check className="animate-plano-check size-4" />}
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
        <ul className="mt-3 flex flex-col gap-2">
          {escolhidos.map((y) => (
            <li
              key={y.id}
              className="animate-plano-foto min-w-0 rounded-2xl bg-[#f5f5f7] p-2.5 dark:bg-white/5"
            >
              <div className="flex min-w-0 items-center gap-3">
                {y.foto ? (
                  <img
                    src={y.foto}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-16 shrink-0 rounded-xl bg-white object-contain p-1"
                  />
                ) : (
                  <span className="size-16 shrink-0 rounded-xl bg-white" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{y.titulo}</p>
                  {y.preco != null && (
                    <p className="text-sm font-extrabold tabular-nums">
                      {brl(y.preco)}{" "}
                      <span className="text-[10px] font-normal text-secondary-ink">
                        em {dia(y.adicionadoEm)}, confira na loja
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Tirar ${y.titulo} deste item`}
                  onClick={() =>
                    aoMudar((x) => {
                      const resto = x.escolhidos.filter((z) => z.id !== y.id);
                      return { ...x, escolhidos: resto, presente: x.presente && resto.length > 0 };
                    })
                  }
                  className="grid size-11 shrink-0 place-items-center rounded-full text-secondary-ink transition hover:bg-black/5 active:scale-90 dark:hover:bg-white/10"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              {!resolvido && y.url && (
                <div className="mt-2 sm:w-56">
                  <VerNaLoja url={y.url} grande />
                </div>
              )}
            </li>
          ))}
        </ul>
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
          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => setAberto((v) => !v)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-[#0071e3] ring-1 ring-border transition active:scale-[0.97]"
          >
            {aberto ? (
              <ChevronDown className="size-4 rotate-180 transition" aria-hidden="true" />
            ) : e ? (
              <Plus className="size-4" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            {aberto ? "Fechar ofertas" : e ? "Escolher mais" : "Ver ofertas"}
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
            <Gift
              className={"size-4" + (estado.presente ? " animate-plano-check" : "")}
              aria-hidden="true"
            />
            {estado.presente ? "Na lista de presentes" : "Pedir de presente"}
          </button>
        </div>
      )}
      {querPresente && !e && aberto && (
        <p className="mt-2 text-xs font-semibold text-[#0058b0] dark:text-[#64a8ff]">
          Escolha um ou mais produtos abaixo para entrar na lista de presentes.
        </p>
      )}
      {aberto && !resolvido && (
        <div className="animate-plano-foto mt-3">
          <OfertasDoItem
            item={item}
            estilo={estilo}
            volts={volts}
            escolhidosIds={escolhidos.map((y) => y.id)}
            aoEscolher={(r) => aoEscolher(r, querPresente || estado.presente)}
          />
        </div>
      )}
    </li>
  );
}

/* Card art: the chosen products' photos, else up to 3 real photos of the item's
   offers on white (nothing over the photo); never an empty box. */
function ArteDoItem({
  termo,
  escolhidas,
  emoji,
}: {
  termo: string;
  escolhidas: string[];
  emoji: string;
}) {
  const { ref, fotos } = useFotosDoTermo(termo);
  const lista = escolhidas.length ? escolhidas : (fotos ?? []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="flex h-28 gap-1.5 overflow-hidden rounded-2xl bg-[#f5f5f7] p-1.5 sm:h-32 dark:bg-white/5"
    >
      {lista.length ? (
        lista.map((src, k) => (
          <span
            key={src}
            className="animate-plano-foto flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-white"
            style={{ animationDelay: `${k * 90}ms` }}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(ev) => (ev.currentTarget.style.visibility = "hidden")}
              className="h-full w-full object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
            />
          </span>
        ))
      ) : fotos === null && !escolhidas.length ? (
        <span className="esqueleto flex-1 rounded-xl" />
      ) : (
        <span className="flex flex-1 items-center justify-center rounded-xl bg-white text-5xl">
          {emoji}
        </span>
      )}
    </div>
  );
}
