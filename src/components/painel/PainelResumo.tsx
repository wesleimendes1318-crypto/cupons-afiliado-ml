/* Summary tab of /painel (Weslei, 06/11): real numbers only, all from what
   the visitor already saved. "Queda somada" is the listing price drop since
   each item started being tracked (preco_ao_seguir - preco_atual, never
   below 0); it is not money saved on a purchase, so it is not called that. */
import { Bell, Gift, Heart, ListChecks, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

import { BarraProgresso, useContagem } from "@/components/painel/animacao";
import type { Item } from "@/components/painel/PainelAlertasPreco";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const queda = (i: Item) =>
  i.preco_ao_seguir != null && i.preco_atual != null ? Math.max(0, i.preco_ao_seguir - i.preco_atual) : 0;

/** Fell today: the last reading of today is below the reading before it. */
export function caiuHoje(i: Item, hoje = new Date()): boolean {
  const h = [...(i.historico ?? [])].sort((a, b) => a.em.localeCompare(b.em));
  const dia = hoje.toDateString();
  for (let k = h.length - 1; k > 0; k--) {
    const [antes, agora] = [h[k - 1]!, h[k]!];
    if (new Date(agora.em).toDateString() !== dia) return false;
    if (agora.p < antes.p) return true;
  }
  return false;
}

export type ResumoPainel = {
  precos: Item[] | null;
  desejos: number;
  planos: number;
  amigos: number;
  irPara: (aba: string) => void;
};

export function PainelResumo({ precos, desejos, planos, amigos, irPara }: ResumoPainel) {
  const lista = precos ?? [];
  const hoje = lista.filter((i) => caiuHoje(i)).length;
  const somada = lista.reduce((s, i) => s + queda(i), 0);
  const maiores = lista
    .filter((i) => queda(i) > 0)
    .sort((a, b) => queda(b) - queda(a))
    .slice(0, 3);
  const maior = maiores[0] ? queda(maiores[0]) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi i={0} icone={<Bell className="size-4" />} valor={lista.length} rotulo="Preços acompanhados" onClick={() => irPara("precos")} />
        <Kpi i={1} icone={<TrendingDown className="size-4" />} valor={hoje} rotulo="Caíram hoje" cor="#248a3d" onClick={() => irPara("precos")} />
        <Kpi i={2} icone={<Heart className="size-4" />} valor={desejos} rotulo="Na lista de desejos" onClick={() => irPara("desejos")} />
        <Kpi i={3} icone={<ListChecks className="size-4" />} valor={planos + amigos} rotulo="Listas em andamento" onClick={() => irPara(planos ? "planejadores" : "amigo")} />
      </div>

      <div className="animate-cartao rounded-3xl bg-[#f5f5f7] p-4 dark:bg-white/5" style={{ animationDelay: "240ms" }}>
        <p className="text-xs">Queda somada desde que você começou a acompanhar</p>
        <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-[#248a3d] tabular-nums">
          <Dinheiro valor={somada} />
        </p>
        <p className="mt-1 text-[11px]">Diferença no preço do anúncio. Frete e taxas aparecem na hora da compra.</p>
      </div>

      {precos == null ? null : maiores.length ? (
        <section>
          <h2 className="!mt-0 flex items-center gap-2">
            <TrendingDown className="size-4 text-[#248a3d]" aria-hidden /> Maiores quedas
          </h2>
          <ul className="!ml-0 !list-none !pl-0 mt-3 space-y-3">
            {maiores.map((i, k) => (
              <li key={i.id} className="animate-cartao" style={{ animationDelay: `${300 + k * 70}ms` }}>
                <button
                  type="button"
                  onClick={() => irPara("precos")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:bg-muted active:scale-[0.99]"
                >
                  {i.imagem ? (
                    <img src={i.imagem} alt="" loading="lazy" className="size-12 shrink-0 rounded-xl bg-white object-contain" />
                  ) : (
                    <span className="size-12 shrink-0 rounded-xl bg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-semibold text-foreground">{i.titulo ?? "Produto acompanhado"}</span>
                    <span className="mt-1 block">
                      <BarraProgresso pct={(queda(i) / maior) * 100} cor="#34c759" rotulo={`Queda de ${brl(queda(i))}`} />
                    </span>
                    <span className="mt-1 block text-xs tabular-nums">
                      caiu <strong className="text-[#248a3d]">{brl(queda(i))}</strong> · era {brl(i.preco_ao_seguir ?? 0)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="animate-cartao rounded-2xl border border-dashed border-border p-4 text-center" style={{ animationDelay: "300ms" }}>
          {lista.length
            ? "Nenhum dos seus preços caiu ainda. Eu confiro de tempos em tempos e mostro aqui."
            : "Compare um produto e toque em \"Acompanhar preço\" para ver as quedas aqui."}
        </p>
      )}

      {amigos > 0 && (
        <button
          type="button"
          onClick={() => irPara("amigo")}
          className="animate-cartao flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left text-sm transition hover:bg-muted"
          style={{ animationDelay: "420ms" }}
        >
          <Gift className="size-5 text-[#0071e3]" aria-hidden />
          <span className="flex-1">
            Amigo secreto com <strong>{amigos}</strong> {amigos === 1 ? "pessoa" : "pessoas"}
          </span>
        </button>
      )}
    </div>
  );
}

function Dinheiro({ valor }: { valor: number }) {
  return <>{brl(useContagem(valor))}</>;
}

function Kpi({
  i,
  icone,
  valor,
  rotulo,
  cor = "#0071e3",
  onClick,
}: {
  i: number;
  icone: ReactNode;
  valor: number;
  rotulo: string;
  cor?: string;
  onClick: () => void;
}) {
  const n = Math.round(useContagem(valor));
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-cartao flex min-h-24 flex-col justify-between rounded-3xl border border-border bg-card p-3.5 text-left transition hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none"
      style={{ animationDelay: `${i * 60}ms` }}
    >
      <span className="grid size-8 place-items-center rounded-full" style={{ color: cor, backgroundColor: `${cor}14` }} aria-hidden>
        {icone}
      </span>
      <span>
        <span className="block text-2xl font-extrabold tracking-tight text-foreground tabular-nums">{n}</span>
        <span className="block text-xs leading-tight">{rotulo}</span>
      </span>
    </button>
  );
}
