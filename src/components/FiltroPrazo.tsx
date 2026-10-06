/* FILTRO "RECEBER ATÉ" (Weslei, 06/10). Chips de prazo, data escolhida e o
   aviso oficial; a filtragem usa a estimativa do Mercado Livre para o CEP da
   tela (/api/public/prazo-entrega). O que não chega até a data (ou não tem
   data confirmada) sai da tabela, da Melhor opção e dos Parecidos e fica num
   bloco recolhido; nada sem data confirmada passa como rápido. */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Gift, Truck, X } from "lucide-react";

import {
  AVISO_PRAZO,
  formatarDataAmigavel,
  formatarDataCompleta,
  obterAmanhaBrasilia,
  obterFimDeSemanaBrasilia,
  obterHojeBrasilia,
  type PrazoDoItem,
  type ResultadoPrazo,
} from "@/lib/prazo-entrega";


const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FiltroPrazo({
  limite,
  mudar,
  cep,
  carregando,
}: {
  limite: string | null;
  mudar: (d: string | null) => void;
  cep: string | null;
  carregando: boolean;
}) {
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(obterHojeBrasilia()), []);
  const [aberto, setAberto] = useState(false);
  if (!hoje) return null;
  const chips = [
    { rotulo: "Receba hoje", data: hoje },
    { rotulo: "Receba amanhã", data: obterAmanhaBrasilia() },
    { rotulo: "Este fim de semana", data: obterFimDeSemanaBrasilia() },
  ];
  return (
    <div className="mt-3 rounded-2xl border border-border/70 bg-[#f5f5f7] p-3 dark:bg-white/5">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Gift className="size-4 text-[#0071e3]" aria-hidden />É presente ou tem data para chegar?
      </p>
      {!cep ? (
        <p className="mt-1 text-xs text-secondary-ink">
          Informe o seu CEP acima para ver o prazo de entrega de cada loja.
        </p>
      ) : limite ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-3 py-1 text-xs font-semibold text-white">
            <Truck className="size-3.5" aria-hidden />
            Entregas até: {formatarDataCompleta(limite)}
            <button
              type="button"
              onClick={() => mudar(null)}
              className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 hover:bg-white/30"
              aria-label="Remover data limite"
            >
              <X className="size-3" aria-hidden /> Remover
            </button>
          </span>
          {carregando && (
            <span className="text-xs text-secondary-ink">Consultando o prazo de cada loja…</span>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.rotulo}
              type="button"
              onClick={() => mudar(c.data)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:border-[#0071e3] hover:text-[#0071e3]"
            >
              {c.rotulo}
            </button>
          ))}
          {aberto ? (
            <label className="inline-flex items-center gap-1.5 rounded-full border border-[#0071e3] bg-card px-3 py-1 text-xs font-semibold">
              <CalendarDays className="size-3.5 text-[#0071e3]" aria-hidden />
              <input
                type="date"
                min={hoje}
                aria-label="Data limite para receber"
                className="bg-transparent text-xs outline-none"
                onChange={(e) => e.target.value && mudar(e.target.value)}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:border-[#0071e3] hover:text-[#0071e3]"
            >
              <CalendarDays className="size-3.5" aria-hidden /> Escolher data limite
            </button>
          )}
        </div>
      )}
      {cep && <p className="mt-2 text-[11px] leading-snug text-secondary-ink">{AVISO_PRAZO}</p>}
    </div>
  );
}

/** Estimativas da comparação para o CEP (só busca com o filtro ligado). */
export function usePrazos(pedidoId: number | null, cep: string | null, ativo: boolean) {
  const [dados, setDados] = useState<{ chave: string; prazos: Record<string, PrazoDoItem> } | null>(
    null,
  );
  const [carregando, setCarregando] = useState(false);
  const chave = pedidoId != null && cep ? `${pedidoId}|${cep}` : null;
  useEffect(() => {
    if (!ativo || !chave || dados?.chave === chave) return;
    let vivo = true;
    setCarregando(true);
    fetch("/api/public/prazo-entrega", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido: pedidoId, cep }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { prazos?: Record<string, PrazoDoItem> } | null) => {
        if (vivo) setDados({ chave, prazos: j?.prazos ?? {} });
      })
      .catch(() => vivo && setDados({ chave, prazos: {} }))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, chave]);
  return { prazos: dados?.chave === chave ? dados.prazos : null, carregando };
}

/** Avisos do filtro: colado fora do prazo, economia x urgência, nenhuma
    loja a tempo e o bloco recolhido do que ficou de fora. */
export function AvisosDoPrazo({
  limite,
  r,
  melhorNoPrazo,
  paraReceber = null,
}: {
  limite: string;
  r: ResultadoPrazo<unknown>;
  /* Anúncio colado fora do prazo: a loja que chega a tempo. */
  paraReceber?: {
    nome: string;
    preco: number;
    freteGratis: boolean | null;
    custoFrete: number | null;
    total: number | null;
    link: string;
  } | null;
  /* Total da melhor opção que chega a tempo (o que a tela recomenda). */
  melhorNoPrazo: { nome: string; total: number | null } | null;
}) {
  const data = formatarDataCompleta(limite);
  const maisBaratasFora = useMemo(
    () =>
      melhorNoPrazo?.total != null
        ? r.fora.filter(
            (f) =>
              f.tipo === "mesmo" && f.total != null && f.total < (melhorNoPrazo.total as number),
          )
        : [],
    [r.fora, melhorNoPrazo],
  );
  if (!r.algumAtende)
    return (
      <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        Nenhuma loja confirmou entrega até esta data para seu CEP. Tente uma data um pouco mais
        longe; abaixo estão todas as opções, sem o filtro.
      </p>
    );
  const economia =
    maisBaratasFora.length && melhorNoPrazo?.total != null
      ? Math.min(...maisBaratasFora.map((f) => f.total as number))
      : null;
  return (
    <div className="mt-3 space-y-2">
      {!r.coladoAtende && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          O anúncio que você colou{" "}
          {r.coladoChega
            ? `tem previsão de chegar a partir de ${formatarDataAmigavel(r.coladoChega)}`
            : "não tem prazo confirmado para o seu CEP"}
          : não garante entrega até {data}.
        </p>
      )}
      {paraReceber && (
        <div className="rounded-3xl border border-success/50 bg-success/10 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-success">
            📦 Para receber até {data}
          </p>
          <p className="mt-1 text-sm font-semibold">{paraReceber.nome}</p>
          <p className="text-sm">
            <strong className="text-lg tabular-nums">{brl(paraReceber.preco)}</strong>
          </p>
          <p className="text-xs text-secondary-ink">
            {paraReceber.freteGratis
              ? "Frete grátis"
              : paraReceber.custoFrete
                ? `Frete ${brl(paraReceber.custoFrete)}`
                : "Frete não confirmado"}
          </p>
          {paraReceber.total != null && paraReceber.total !== paraReceber.preco && (
            <p className="text-xs text-secondary-ink">Total {brl(paraReceber.total)}</p>
          )}
          <a
            href={paraReceber.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            data-origem="prazo"
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-success px-4 py-2.5 text-sm font-bold text-white hover:brightness-95"
          >
            🛡️ Comprar com segurança
          </a>
        </div>
      )}
      {economia != null && melhorNoPrazo?.total != null && (
        <p className="rounded-2xl border border-[#0071e3]/30 bg-[#0071e3]/5 p-3 text-xs leading-relaxed">
          <strong>💡 Economia vs Urgência:</strong> há opção mais barata (custo final{" "}
          {brl(economia)}), mas ela não chega até {data}. Para receber a tempo, a melhor é{" "}
          {melhorNoPrazo.nome}: {brl(melhorNoPrazo.total - economia)} a mais no custo final, já com
          o frete.
        </p>
      )}
      {r.fora.length > 0 && (
        <details className="rounded-2xl border border-border/70 bg-card p-3 text-xs">
          <summary className="cursor-pointer font-semibold">
            {maisBaratasFora.length > 0
              ? `${maisBaratasFora.length} ${maisBaratasFora.length > 1 ? "lojas mais baratas entregam" : "loja mais barata entrega"} após ${data}`
              : `${r.fora.length} ${r.fora.length > 1 ? "opções ficaram" : "opção ficou"} de fora (entrega após ${data} ou sem prazo confirmado)`}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {r.fora.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {f.nome}
                  {f.preco != null && <strong className="ml-1">{brl(f.preco)}</strong>}
                </span>
                <span className="shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[11px] text-secondary-ink dark:bg-white/10">
                  {f.chega
                    ? `chega a partir de ${formatarDataAmigavel(f.chega)}`
                    : "prazo não confirmado"}
                </span>
                {f.link && (
                  <a
                    href={f.link}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    data-origem="prazo-fora"
                    className="shrink-0 font-semibold text-[#0071e3] underline"
                  >
                    Comprar com segurança
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
