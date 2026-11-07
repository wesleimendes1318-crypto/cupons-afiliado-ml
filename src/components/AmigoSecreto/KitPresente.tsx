/* "Kit presente" (Weslei, 07/11): a ready kit inside the ceiling and an
   "algo ainda melhor" kit up to 20% above it, built from the person's
   showcases. Each item is the same CartaoBusca card, so every buy button
   ends in Weslei's affiliate link (rule no. 1). Totals are the sum of the
   real cost of each card (free shipping confirmed). */
import { Shuffle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { abrirComparacao } from "@/components/BotoesCartao";
import { CartaoBusca, doCatalogo } from "@/components/BuscaGuiada";
import { carregarAte, idsDoResultado, passosIniciais } from "@/lib/amigo-secreto-busca";
import type { Resultado } from "@/lib/busca-guiada-cliente";
import { FOLGA_MELHOR, PARTE_MAX_ITEM, kitsDoPresente, type Candidato, type EstiloKit, type Kit } from "@/lib/amigo-secreto-kit";
import type { VitrineCategoriaAmigo } from "@/lib/amigo-secreto-tipos";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const chip = (ativo: boolean) =>
  "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] " +
  (ativo ? "bg-[#0071e3] text-white" : "bg-card ring-1 ring-border");

/** Same terms and curation the showcase uses (passed by the page). */
export type PrepararKit = (v: VitrineCategoriaAmigo) => { termos: string[]; aprovar: (r: Resultado) => boolean };

const MAX_VITRINES_KIT = 4;

export function KitPresente({
  nome,
  vitrines,
  teto,
  minimo,
  preparar,
}: {
  nome: string;
  vitrines: VitrineCategoriaAmigo[];
  teto: number;
  minimo: number | null;
  preparar: PrepararKit;
}) {
  const [origem, setOrigem] = useState<string>("todas");
  const [estilo, setEstilo] = useState<EstiloKit>("custo");
  const [seed, setSeed] = useState(1);
  /* Showcases hold only items inside the budget range (e.g. R$ 80-100), too
     pricey to combine. The kit searches the same terms for smaller pieces,
     up to half of the "even better" limit, one showcase at a time. */
  const [pecas, setPecas] = useState<Record<string, Resultado[]>>({});
  const [buscando, setBuscando] = useState<string[]>([]);
  const [feitas, setFeitas] = useState<string[]>([]);
  const comProdutos = vitrines.filter((v) => v.produtos.length > 0);
  const maxPeca = Math.round(teto * (1 + FOLGA_MELHOR) * PARTE_MAX_ITEM);
  const chave = `${vitrines.map((v) => v.id).join("|")}@${minimo ?? 0}-${teto}`;
  /* Starts after the first showcase batch, so the reads do not pile up. */
  const livre = vitrines.length > 0 && !vitrines.some((v) => v.carregando) && vitrines.some((v) => v.produtos.length > 0);
  const iniciada = useRef<string | null>(null);
  const cancelar = useRef<() => void>(() => {});
  useEffect(() => () => cancelar.current(), []);

  useEffect(() => {
    if (!livre || iniciada.current === chave) return;
    iniciada.current = chave;
    cancelar.current();
    let cancelado = false;
    cancelar.current = () => {
      cancelado = true;
    };
    setPecas({});
    setFeitas([]);
    void (async () => {
      for (const v of vitrines.slice(0, MAX_VITRINES_KIT)) {
        if (cancelado) return;
        const { termos, aprovar } = preparar(v);
        const lidos = termos.slice(0, 6);
        if (!lidos.length) continue;
        setBuscando(lidos);
        const vistos = new Set(v.produtos.flatMap(idsDoResultado));
        const r = await carregarAte({
          passos: passosIniciais(lidos),
          faixa: { min: Math.max(5, Math.round(teto * 0.1)), max: maxPeca },
          vistos,
          alvo: 10,
          maxChamadas: 6,
          aprovar,
          cancelado: () => cancelado,
        });
        if (cancelado) return;
        setPecas((p) => ({ ...p, [v.id]: r.novos }));
        setFeitas((f) => [...f, ...lidos]);
      }
      if (!cancelado) setBuscando([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, livre]);

  const fontes = vitrines.filter((v) => v.produtos.length > 0 || (pecas[v.id]?.length ?? 0) > 0);

  const { dentro, melhor } = useMemo(() => {
    const fonte = origem === "todas" ? fontes : fontes.filter((v) => v.id === origem);
    const candidatos: Candidato[] = fonte.flatMap((v) =>
      [...(pecas[v.id] ?? []), ...v.produtos].map((r) => ({ r, grupo: v.id })),
    );
    return kitsDoPresente(candidatos, teto, { estilo, seed, minimo, misturar: origem === "todas" && fonte.length > 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrines, pecas, origem, estilo, seed, teto, minimo]);

  if (!comProdutos.length && !buscando.length && !Object.values(pecas).some((p) => p.length)) return null;

  return (
    <section aria-labelledby="kit-presente" className="animate-conteudo rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-border sm:p-6">
      <h2 id="kit-presente" className="text-lg font-extrabold tracking-tight sm:text-xl">
        🎁 Kit presente para {nome}
      </h2>
      <p className="mt-1 text-sm text-secondary-ink">
        Juntamos peças variadas e mais em conta (cada uma até {brl(maxPeca)}), priorizando os mais vendidos e lojas
        oficiais, todas com frete grátis.
      </p>
      {(buscando.length > 0 || feitas.length > 0) && (
        <p className="mt-2 text-xs text-secondary-ink" aria-live="polite">
          {buscando.length > 0 ? (
            <>
              <span className="font-semibold text-[#0071e3]">Buscando peças para o kit:</span> {buscando.join(", ")}…
            </>
          ) : (
            <>
              <span className="font-semibold">Buscas do kit:</span> {feitas.join(", ")}
            </>
          )}
        </p>
      )}

      <div role="group" aria-label="De onde vem o kit" className="-mx-1 mt-3 flex gap-2 overflow-x-auto p-1 [scrollbar-width:none]">
        <button type="button" aria-pressed={origem === "todas"} onClick={() => setOrigem("todas")} className={chip(origem === "todas")}>
          Misturar categorias
        </button>
        {fontes.map((v) => (
          <button key={v.id} type="button" aria-pressed={origem === v.id} onClick={() => setOrigem(v.id)} className={chip(origem === v.id)}>
            {v.icone} {v.titulo}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Estilo do kit" className="flex gap-2">
          <button type="button" aria-pressed={estilo === "custo"} onClick={() => setEstilo("custo")} className={chip(estilo === "custo")}>
            Mais itens, ótimo preço
          </button>
          <button type="button" aria-pressed={estilo === "luxo"} onClick={() => setEstilo("luxo")} className={chip(estilo === "luxo")}>
            Luxo: menos itens, mais sofisticados
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-[#0071e3] ring-1 ring-border transition active:scale-[0.97]"
        >
          <Shuffle className="size-4" aria-hidden="true" /> Sortear outro kit
        </button>
      </div>

      <BlocoKit titulo={minimo ? `Entre ${brl(minimo)} e ${brl(teto)}` : `Até ${brl(teto)}`} kit={dentro} vazio={
          buscando.length
            ? "Procurando peças mais em conta para montar o kit…"
            : estilo === "custo"
              ? "Ainda não achamos peças baratas o bastante para juntar no kit. Tente o Luxo ou outra categoria."
              : "Ainda não há opções suficientes nas vitrines para montar este kit."
        } />
      {melhor && <BlocoKit titulo={`Algo ainda melhor (até ${brl(teto * 1.2)})`} kit={melhor} destaque />}
    </section>
  );
}

function BlocoKit({ titulo, kit, vazio, destaque }: { titulo: string; kit: Kit | null; vazio?: string; destaque?: boolean }) {
  return (
    <div className={"mt-4 rounded-3xl p-3 sm:p-4 " + (destaque ? "bg-[#fff8e6] dark:bg-white/5" : "bg-[#f5f5f7] dark:bg-white/5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-sm font-bold">{titulo}</h3>
        {kit && (
          <p className="text-sm text-secondary-ink">
            {kit.itens.length} {kit.itens.length === 1 ? "item" : "itens"} · total{" "}
            <strong className="text-base font-extrabold tabular-nums text-foreground">{brl(kit.total)}</strong>
          </p>
        )}
      </div>
      {kit ? (
        <ul className="mt-3 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {kit.itens.map((r, k) => (
            <CartaoBusca key={r.item || r.produto} c={doCatalogo(r, undefined)} indice={k} resumo={undefined} comparar={abrirComparacao} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-secondary-ink">{vazio}</p>
      )}
      {kit && <p className="mt-2 text-[11px] text-secondary-ink/80">Cada item é comprado no seu próprio anúncio. Preços de agora, confira na loja.</p>}
    </div>
  );
}
