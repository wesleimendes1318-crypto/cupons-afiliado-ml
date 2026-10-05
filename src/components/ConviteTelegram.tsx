/* Convite para o canal de ofertas e para o bot do Telegram (Weslei, 05/10).
   Estático (sem efeito nem busca): não pesa no carregamento. O canal é a ação
   principal; o bot é a secundária. Ícone genérico de envio, sem logo nem cor
   do Telegram. Os nomes vêm de src/lib/telegram-publico.ts. */

import { Send } from "lucide-react";

import { LINK_CANAL, linkDoBot, type OrigemTelegram } from "@/lib/telegram-publico";

const EXTERNO = { target: "_blank", rel: "noopener noreferrer" } as const;
const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ml-blue focus-visible:ring-offset-2";

export function ConviteTelegram({
  formato,
  origem,
  className,
}: {
  formato: "pilula" | "cartao" | "linha";
  origem: OrigemTelegram;
  className?: string;
}) {
  if (formato === "pilula")
    /* Fica na faixa azul do topo, ao lado de "Meus preços | Guias | Sobre". */
    return (
      <a
        href={LINK_CANAL}
        {...EXTERNO}
        aria-label="Ofertas no Telegram: abrir o canal de ofertas comparadas (abre em nova aba)"
        className={
          "inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white " +
          (className ?? "")
        }
      >
        <Send className="size-4" aria-hidden="true" />
        Ofertas no Telegram
      </a>
    );

  if (formato === "linha")
    return (
      <p className={className ?? "text-xs text-secondary-ink"}>
        Ofertas comparadas no Telegram:{" "}
        <a
          href={LINK_CANAL}
          {...EXTERNO}
          aria-label="Canal de ofertas no Telegram (abre em nova aba)"
          className={"rounded font-semibold text-ml-blue hover:underline " + FOCO}
        >
          canal
        </a>
        {" · "}
        <a
          href={linkDoBot(origem)}
          {...EXTERNO}
          aria-label="Comparar pelo bot do Telegram (abre em nova aba)"
          className={"rounded font-semibold text-ml-blue hover:underline " + FOCO}
        >
          bot
        </a>
      </p>
    );

  return (
    <section
      aria-label="Ofertas no Telegram"
      className={
        "rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6 " +
        (className ?? "")
      }
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ml-blue/10 text-ml-blue"
        >
          <Send className="size-5" />
        </span>
        <div className="min-w-0">
          {/* mt-0!: dentro do LayoutConteudo todo h2 ganha margem de seção. */}
          <h2 className="mt-0! text-base font-bold tracking-tight text-foreground sm:text-lg">
            Receba os achados no Telegram
          </h2>
          <p className="mt-0.5 text-sm text-secondary-ink">
            Separo as comparações com economia de verdade e publico no canal. Sem spam.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={LINK_CANAL}
          {...EXTERNO}
          aria-label="Entrar no canal de ofertas no Telegram (abre em nova aba)"
          className={
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ml-blue px-5 text-sm font-bold text-ml-blue-foreground transition hover:brightness-95 " +
            FOCO
          }
        >
          <Send className="size-4" aria-hidden="true" />
          Entrar no canal
        </a>
        <a
          href={linkDoBot(origem)}
          {...EXTERNO}
          aria-label="Comparar pelo Telegram: abrir a conversa com o bot (abre em nova aba)"
          className={
            "inline-flex min-h-11 items-center justify-center rounded-full border border-ml-blue px-5 text-sm font-bold text-ml-blue transition-colors hover:bg-ml-blue/5 " +
            FOCO
          }
        >
          Comparar pelo Telegram
        </a>
      </div>
      <p className="mt-2 text-xs text-secondary-ink">
        No bot, mande o link do produto e a comparação volta na conversa.
      </p>
      <p className="mt-1 text-[11px] text-secondary-ink">
        Canal independente, sem vínculo com o Mercado Livre.
      </p>
    </section>
  );
}
