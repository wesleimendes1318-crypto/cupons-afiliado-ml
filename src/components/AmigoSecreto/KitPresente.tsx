/* "Kit presente" (Weslei, 07/11): a ready kit inside the ceiling and an
   "algo ainda melhor" kit up to 20% above it, built from the person's
   showcases. Each item is the same CartaoBusca card, so every buy button
   ends in Weslei's affiliate link (rule no. 1). Totals are the sum of the
   real cost of each card (free shipping confirmed). */
import { Shuffle } from "lucide-react";
import { useMemo, useState } from "react";

import { abrirComparacao } from "@/components/BotoesCartao";
import { CartaoBusca, doCatalogo } from "@/components/BuscaGuiada";
import { kitsDoPresente, type Candidato, type EstiloKit, type Kit } from "@/lib/amigo-secreto-kit";
import type { VitrineCategoriaAmigo } from "@/lib/amigo-secreto-tipos";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const chip = (ativo: boolean) =>
  "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] " +
  (ativo ? "bg-[#0071e3] text-white" : "bg-card ring-1 ring-border");

export function KitPresente({ nome, vitrines, teto }: { nome: string; vitrines: VitrineCategoriaAmigo[]; teto: number }) {
  const [origem, setOrigem] = useState<string>("todas");
  const [estilo, setEstilo] = useState<EstiloKit>("custo");
  const [seed, setSeed] = useState(1);
  const comProdutos = vitrines.filter((v) => v.produtos.length > 0);

  const { dentro, melhor } = useMemo(() => {
    const fonte = origem === "todas" ? comProdutos : comProdutos.filter((v) => v.id === origem);
    const candidatos: Candidato[] = fonte.flatMap((v) => v.produtos.map((r) => ({ r, grupo: v.id })));
    return kitsDoPresente(candidatos, teto, { estilo, seed, misturar: origem === "todas" && fonte.length > 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrines, origem, estilo, seed, teto]);

  if (comProdutos.reduce((n, v) => n + v.produtos.length, 0) < 2) return null;

  return (
    <section aria-labelledby="kit-presente" className="animate-conteudo rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-border sm:p-6">
      <h2 id="kit-presente" className="text-lg font-extrabold tracking-tight sm:text-xl">
        🎁 Kit presente para {nome}
      </h2>
      <p className="mt-1 text-sm text-secondary-ink">
        Montamos com os mais vendidos e lojas oficiais das vitrines, todos com frete grátis.
      </p>

      <div role="group" aria-label="De onde vem o kit" className="-mx-1 mt-3 flex gap-2 overflow-x-auto p-1 [scrollbar-width:none]">
        <button type="button" aria-pressed={origem === "todas"} onClick={() => setOrigem("todas")} className={chip(origem === "todas")}>
          Misturar categorias
        </button>
        {comProdutos.map((v) => (
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

      <BlocoKit titulo={`Dentro de ${brl(teto)}`} kit={dentro} vazio="Ainda não há opções suficientes nas vitrines para montar este kit." />
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
