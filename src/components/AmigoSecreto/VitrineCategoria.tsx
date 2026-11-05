/* One showcase of one person: title, count inside the budget, a horizontal
   rail of the SAME card as the site search (CartaoBusca: real photo,
   reference price, shipping line, "Comprar com segurança" through the
   affiliate link generated on click, "Comparar preço"), and "+20 opções". */
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { usePrazosDosItens } from "@/lib/prazo-cliente";

import { BotaoCarregarMaisVitrine } from "@/components/AmigoSecreto/BotaoCarregarMaisVitrine";
import { abrirComparacao } from "@/components/BotoesCartao";
import { CartaoBusca, doCatalogo } from "@/components/BuscaGuiada";
import { BotaoCoracao } from "@/components/CoracaoDesejo";
import type { Resultado } from "@/lib/busca-guiada-cliente";
import type { VitrineCategoriaAmigo } from "@/lib/amigo-secreto-tipos";

export function VitrineCategoria({
  vitrine,
  faixa,
  aoCarregarMais,
  favoritos,
  aoFavoritar,
  contadorFixo,
  ampliar,
  dataFesta,
}: {
  /** "YYYY-MM-DD": only what arrives by then (needs the CEP). */
  dataFesta?: string | null;
  /** Thin showcase: offer shipping-to-calculate or a slightly higher budget. */
  ampliar?: { freteACalcular: boolean; proximoMax: number | null; aoAceitarFrete: () => void; aoSubirValor: () => void };
  vitrine: VitrineCategoriaAmigo;
  /** "entre R$ 80 e R$ 100" */
  faixa: string;
  aoCarregarMais: () => void;
  /** Catalog ids already hearted for this person. */
  favoritos?: Set<string>;
  aoFavoritar?: (r: Resultado) => void;
  /** Replaces the count line (favorites list). */
  contadorFixo?: string;
}) {
  /* Store-like controls per showcase (Weslei, 05/11): sort, free shipping
     and "arrives before the party" by the CEP in the header. */
  const [ordem, setOrdem] = useState<"relevancia" | "menor" | "maior" | "vendidos" | "economia">("relevancia");
  const [soGratis, setSoGratis] = useState(false);
  const { cep, prazos } = usePrazosDosItens(dataFesta ? vitrine.produtos.map((r) => r.item) : []);
  const filtrados = vitrine.produtos.filter((r) => {
    if (soGratis && r.freteGratis !== true) return false;
    if (dataFesta && cep) {
      const p = prazos.get(r.item);
      if (p === null) return false;
      if (p && p.chega_ate > dataFesta) return false;
    }
    return true;
  });
  const precoOu = (r: Resultado, v: number) => r.preco ?? v;
  const produtos =
    ordem === "relevancia"
      ? filtrados
      : [...filtrados].sort((a, b) =>
          ordem === "menor"
            ? precoOu(a, 1e9) - precoOu(b, 1e9)
            : ordem === "maior"
              ? precoOu(b, 0) - precoOu(a, 0)
              : ordem === "vendidos"
                ? (a.maisVendido ?? 999) - (b.maisVendido ?? 999)
                : (b.economia ?? 0) - (a.economia ?? 0),
        );
  const controles = !contadorFixo && vitrine.produtos.length > 3;
  const n = vitrine.produtos.length;
  const contador =
    contadorFixo ??
    (vitrine.carregando
      ? n
        ? `${n} opções ${faixa} até agora…`
        : "Procurando opções no valor…"
      : n
        ? `${n} ${n === 1 ? "opção encontrada" : "opções encontradas"} ${faixa}`
        : vitrine.erro
          ? vitrine.erro
          : `Nenhuma opção ${ampliar?.freteACalcular ? "" : "com frete grátis "}${faixa} agora.`);
  return (
    <section aria-label={vitrine.titulo} className="animate-cartao min-w-0">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-start gap-2 text-lg font-extrabold tracking-tight sm:text-xl">
            <span aria-hidden="true">{vitrine.icone}</span>
            <span className="line-clamp-2 min-w-0">{vitrine.titulo}</span>
          </h3>
          <p
            className="mt-0.5 flex items-center gap-1.5 text-xs text-secondary-ink"
            aria-live="polite"
          >
            {vitrine.carregando && (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            )}
            {contador}
          </p>
        </div>
      </header>
      {controles && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-secondary-ink">
            Ordenar
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as typeof ordem)}
              className="h-11 rounded-full border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="relevancia">Mais relevantes</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
              <option value="vendidos">Mais vendidos</option>
              <option value="economia">Maior economia</option>
            </select>
          </label>
          <button
            type="button"
            aria-pressed={soGratis}
            onClick={() => setSoGratis((v) => !v)}
            className={"min-h-11 rounded-full px-4 font-semibold " + (soGratis ? "bg-[#0071e3] text-white" : "bg-card ring-1 ring-border")}
          >
            Frete grátis
          </button>
          {dataFesta && !cep && <span className="text-secondary-ink">Informe o CEP no topo para ver o que chega antes da festa.</span>}
          {dataFesta && cep && filtrados.length < n && (
            <span className="text-secondary-ink">{n - filtrados.length} não chegam a tempo e ficaram de fora.</span>
          )}
        </div>
      )}
      {n > 0 ? (
        <>
          <ul className="-mx-4 mt-3 grid snap-x scroll-px-4 auto-cols-[11.5rem] grid-flow-col gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:-mx-6 sm:auto-cols-[13.5rem] sm:px-6">
            {produtos.map((r, k) => (
              <CartaoBusca
                key={r.item || r.produto}
                c={doCatalogo(r, (r as { favoritadoEm?: string }).favoritadoEm)}
                indice={k}
                resumo={undefined}
                comparar={abrirComparacao}
                canto={
                  aoFavoritar && (
                    <BotaoCoracao
                      ativo={favoritos?.has(r.produto) === true}
                      aoTocar={() => aoFavoritar(r)}
                    />
                  )
                }
              />
            ))}
          </ul>
          {vitrine.temMais && (
            <BotaoCarregarMaisVitrine
              carregando={vitrine.carregando}
              aoCarregar={aoCarregarMais}
              className="mt-1"
            />
          )}
        </>
      ) : vitrine.carregando ? (
        <ul
          className="-mx-4 mt-3 grid auto-cols-[11.5rem] grid-flow-col gap-3 overflow-hidden px-4 sm:-mx-6 sm:px-6"
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((k) => (
            <li key={k} className="h-80 animate-pulse rounded-2xl bg-[#f5f5f7] dark:bg-white/5" />
          ))}
        </ul>
      ) : vitrine.temMais ? (
        <BotaoCarregarMaisVitrine carregando={false} aoCarregar={aoCarregarMais} className="mt-3" />
      ) : null}
      {ampliar && !vitrine.carregando && n < 12 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-[#f5f5f7] p-3 text-xs dark:bg-white/5">
          <span className="text-secondary-ink">Poucas opções {ampliar.freteACalcular ? "nessa faixa" : "com frete grátis"}. Quer ver mais?</span>
          {!ampliar.freteACalcular && (
            <button type="button" onClick={ampliar.aoAceitarFrete} className="min-h-11 rounded-full bg-card px-3 font-semibold ring-1 ring-border">
              Incluir frete a calcular
            </button>
          )}
          {ampliar.proximoMax != null && <button type="button" onClick={ampliar.aoSubirValor} className="min-h-11 rounded-full bg-card px-3 font-semibold ring-1 ring-border">
            Ver até R$ {ampliar.proximoMax}
          </button>}
        </div>
      )}
    </section>
  );
}
