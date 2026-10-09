/* OUTROS MARKETPLACES (Weslei, 09/10): o mesmo produto na Amazon e na
   Shopee, conferido pela foto, abaixo da tabela das lojas do Mercado Livre.
   Selo discreto do marketplace (só o nome, sem logotipo), "Prime" quando a
   busca foi só de itens Prime, frete em linha própria e botão "Comprar com
   segurança" com o link de afiliado do marketplace. A recomendação da tela
   continua a do Mercado Livre: sem frete confirmado, nada passa na frente. */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { ehLinkDeCompra } from "@/lib/afiliado";
import type { LojaExterna } from "@/lib/coletor-multiloja";
import { NOME_DO_MARKETPLACE } from "@/lib/integracoes/tipos";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function frete(l: LojaExterna) {
  if (l.freteGratis === true) return "Frete grátis";
  if (l.custoFrete != null && l.custoFrete > 0) return `Frete ${brl(l.custoFrete)}`;
  return l.notaFrete ?? "Frete: confira no anúncio";
}

export function OutrosMarketplaces({
  pedidoId,
  precoReferencia,
}: {
  pedidoId: number | null;
  /* Melhor preço do mesmo produto no Mercado Livre (no produto). */
  precoReferencia: number | null;
}) {
  const [lojas, setLojas] = useState<LojaExterna[] | null>(null);
  useEffect(() => {
    if (pedidoId == null) return;
    let vivo = true;
    let tentativas = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const pedir = async () => {
      tentativas += 1;
      try {
        const r = await fetch("/api/public/multiloja", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pedido: pedidoId }),
        });
        const j = (await r.json().catch(() => null)) as {
          ativo?: boolean;
          lojas?: LojaExterna[];
          aguardar?: boolean;
        } | null;
        if (!vivo) return;
        if (j?.aguardar && tentativas < 4) {
          espera = setTimeout(() => void pedir(), 6_000);
          return;
        }
        setLojas(
          j?.ativo ? (j.lojas ?? []).filter((l) => ehLinkDeCompra(l.link, l.marketplace)) : [],
        );
      } catch {
        if (vivo) setLojas([]);
      }
    };
    void pedir();
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
  }, [pedidoId]);

  if (!lojas?.length) return null;
  const maisBarato = lojas.find(
    (l) => l.relacao === "mesmo" && precoReferencia != null && l.preco <= precoReferencia - 0.5,
  );
  return (
    <section aria-label="Em outros marketplaces" className="mt-4" data-origem="multiloja">
      <p className="text-sm font-bold">Em outros marketplaces ({lojas.length})</p>
      {maisBarato && precoReferencia != null && (
        <div className="mt-1.5 rounded-2xl border border-[#0071e3]/25 bg-[#0071e3]/5 p-3 text-xs leading-relaxed">
          <p>
            <strong>Mesmo produto conferido pela foto</strong> na{" "}
            {NOME_DO_MARKETPLACE[maisBarato.marketplace]}:{" "}
            <strong>
              {brl(precoReferencia - maisBarato.preco)} a menos no produto que o melhor preço no
              Mercado Livre
            </strong>
            .
          </p>
          <p className="text-secondary-ink">{frete(maisBarato)}. Confira antes de comprar.</p>
        </div>
      )}
      <ul className="mt-1.5 overflow-hidden rounded-2xl border border-border">
        {lojas.map((l, i) => (
          <li
            key={`${l.marketplace}:${l.id}`}
            className={
              "grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:grid-cols-[56px_minmax(0,1fr)_auto] " +
              (i % 2 ? "bg-muted/40" : "bg-card")
            }
          >
            <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-white">
              {l.imagem && (
                <img
                  src={l.imagem}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-border bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-ink dark:bg-white/10">
                  {NOME_DO_MARKETPLACE[l.marketplace]}
                </span>
                {l.selos.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[#e8f1fd] px-2 py-0.5 text-[10px] font-bold text-[#0058b0]"
                  >
                    {s}
                  </span>
                ))}
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                    (l.relacao === "mesmo"
                      ? "bg-success/15 text-success"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200")
                  }
                >
                  {l.relacao === "mesmo" ? "Mesmo produto" : "Parecido"}
                </span>
              </span>
              <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-snug">
                {l.titulo}
              </span>
              {l.loja && (
                <span className="block text-[11px] text-secondary-ink">Vendido por {l.loja}</span>
              )}
              {l.relacao === "parecido" && l.muda && (
                <span className="block text-[11px] text-amber-900 dark:text-amber-200">
                  Não é idêntico. Muda: {l.muda}
                </span>
              )}
            </span>
            {/* Celular: preço e botão numa linha própria, abaixo do texto. */}
            <span className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:gap-1 sm:text-right">
              <span className="flex flex-col sm:items-end">
                <strong className="text-sm tabular-nums">{brl(l.preco)}</strong>
                <span className="text-[11px] text-secondary-ink">{frete(l)}</span>
              </span>
              <a
                href={l.link}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-success px-3 py-1.5 text-[11px] font-bold text-white hover:brightness-95"
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Comprar com segurança
              </a>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-secondary-ink">
        Preço de quando comparei. Links de afiliado dos programas da Amazon e da Shopee.
      </p>
    </section>
  );
}
