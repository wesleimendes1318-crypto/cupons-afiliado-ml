/* Vitrine: produtos que alguém já comparou aqui.

   Só aparece o que foi pesquisado de verdade no site (nada de varrer
   catálogo). O preço vem SEMPRE com a data em que foi visto, e cada item tem
   "Comparar de novo" para atualizar antes de comprar: preço velho mostrado
   como atual seria enganar o cliente. Categorias proibidas para anúncio do
   Google ficam de fora no próprio banco (função vitrine). */

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingDown } from "lucide-react";

import { CATEGORIAS } from "@/content/categorias";
import { supabase } from "@/integrations/supabase/client";

const NOME_CATEGORIA: Record<string, string> = Object.fromEntries(
  [...CATEGORIAS.map((c) => [c.slug, c.nome] as const), ["outros", "Mais achados"] as const],
);

type ItemVitrine = {
  chave: string;
  titulo: string;
  imagem: string | null;
  categoria: string | null;
  categoria_site: string | null;
  loja: string | null;
  preco: number | null;
  url_produto: string | null;
  link: string | null;
  melhor_loja: string | null;
  melhor_preco: number | null;
  melhor_link: string | null;
  economia: number | null;
  lojas_comparadas: number | null;
  vezes: number | null;
  visto_em: string;
  cupom_codigo: string | null;
  cupom_desconto: string | null;
};

/* Código de cupom já gerado da loja, pronto para copiar. */
function CupomDaLoja({ codigo, desconto }: { codigo: string; desconto: string | null }) {
  const [copiou, setCopiou] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        try {
          void navigator.clipboard.writeText(codigo);
          setCopiou(true);
          setTimeout(() => setCopiou(false), 2500);
        } catch {
          /* sem área de transferência: o código continua visível */
        }
      }}
      className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-success bg-success/10 px-2 py-1.5 text-left"
      title="Copiar código do cupom"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-success">
          Cupom da loja{desconto ? ` · ${desconto}` : ""}
        </span>
        <span className="block truncate font-mono text-xs font-bold">{codigo}</span>
      </span>
      <span className="shrink-0 text-[11px] font-bold text-success">{copiou ? "copiado ✓" : "copiar"}</span>
    </button>
  );
}

const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const quando = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "";
  }
};

type Aba = "recentes" | "economias" | "procurados";

export function Vitrine() {
  const [itens, setItens] = useState<ItemVitrine[]>([]);
  const [aba, setAba] = useState<Aba>("recentes");
  const [categoria, setCategoria] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("vitrine" as never, { p_limite: 120 } as never);
        if (vivo && Array.isArray(data)) setItens(data as ItemVitrine[]);
      } catch {
        /* sem vitrine: a página segue normal */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /* Categorias do próprio site, na ordem do site; "Mais achados" por último. */
  const categorias = useMemo(() => {
    const presentes = new Set(itens.map((i) => i.categoria_site ?? "outros"));
    return [...CATEGORIAS.map((c) => c.slug), "outros"].filter((s) => presentes.has(s));
  }, [itens]);

  const lista = useMemo(() => {
    let l = categoria ? itens.filter((i) => (i.categoria_site ?? "outros") === categoria) : itens;
    if (aba === "economias") l = l.filter((i) => (i.economia ?? 0) > 0).sort((a, b) => (b.economia ?? 0) - (a.economia ?? 0));
    else if (aba === "procurados") l = [...l].sort((a, b) => (b.vezes ?? 0) - (a.vezes ?? 0));
    return l.slice(0, categoria == null ? 120 : 48);
  }, [itens, aba, categoria]);

  if (!itens.length) return null;

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "recentes", rotulo: "Pesquisados agora" },
    { id: "economias", rotulo: "Maiores economias" },
    { id: "procurados", rotulo: "Mais procurados" },
  ];

  return (
    <section className="mt-8" aria-label="Produtos já comparados">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">Produtos que já comparei</h2>
          <p className="mt-1 text-sm text-secondary-ink">
            Preço de quando foi comparado. Toque em "Comparar de novo" para ver o preço de agora.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={
              "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors " +
              (aba === a.id ? "bg-ml-blue text-white" : "border border-border bg-card hover:border-ml-blue")
            }
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {categorias.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoria(null)}
            className={
              "shrink-0 rounded-full px-3 py-1 text-xs font-semibold " +
              (categoria == null ? "bg-foreground text-background" : "border border-border bg-card")
            }
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold " +
                (categoria === c ? "bg-foreground text-background" : "border border-border bg-card")
              }
            >
              {NOME_CATEGORIA[c] ?? c}
            </button>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <p className="mt-4 rounded-md border border-border bg-card p-4 text-sm text-secondary-ink">
          Ainda não há produtos nesta lista.
        </p>
      ) : categoria == null ? (
        /* "Todas": uma seção por categoria, cada uma com seus produtos. */
        <div className="mt-4 space-y-7">
          {categorias.map((c) => {
            const daCategoria = lista.filter((i) => (i.categoria_site ?? "outros") === c);
            if (!daCategoria.length) return null;
            return (
              <div key={c}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold">
                    {NOME_CATEGORIA[c] ?? c}{" "}
                    <span className="text-sm font-normal text-secondary-ink">({daCategoria.length})</span>
                  </h3>
                  {daCategoria.length > 4 && (
                    <button type="button" onClick={() => setCategoria(c)} className="text-sm font-semibold text-ml-blue hover:underline">
                      Ver todos
                    </button>
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {daCategoria.slice(0, 4).map((i) => <Cartao key={i.chave} i={i} />)}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((i) => <Cartao key={i.chave} i={i} />)}
        </ul>
      )}
    </section>
  );
}

function Cartao({ i }: { i: ItemVitrine }) {
            const temEconomia = (i.economia ?? 0) > 0 && i.melhor_preco != null;
            const destino = (temEconomia ? i.melhor_link : null) ?? i.link;
            return (
              <li key={i.chave} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                <div className="relative aspect-square bg-white">
                  {i.imagem ? (
                    <img
                      src={i.imagem}
                      alt={i.titulo}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-secondary-ink">
                      {NOME_CATEGORIA[i.categoria_site ?? "outros"] ?? "Produto comparado"}
                    </div>
                  )}
                  {temEconomia && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-success px-1.5 py-0.5 text-[11px] font-bold text-white">
                      <TrendingDown className="size-3" aria-hidden="true" />
                      {brl(i.economia)} a menos
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-2.5">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{i.titulo}</p>
                  <p className="mt-1.5 text-lg font-extrabold tabular-nums">
                    {brl(temEconomia ? i.melhor_preco : i.preco)}
                  </p>
                  <p className="text-xs text-secondary-ink">
                    {temEconomia ? (
                      <>
                        na {i.melhor_loja} <span className="line-through">{brl(i.preco)}</span>
                      </>
                    ) : (
                      <>na {i.loja ?? "loja"}</>
                    )}
                  </p>
                  {i.cupom_codigo && <CupomDaLoja codigo={i.cupom_codigo} desconto={i.cupom_desconto} />}
                  <p className="mt-0.5 text-[11px] text-secondary-ink/80">
                    visto em {quando(i.visto_em)}
                    {(i.lojas_comparadas ?? 0) > 0 ? ` · ${i.lojas_comparadas} lojas comparadas` : ""}
                  </p>
                  <div className="mt-auto flex flex-col gap-1.5 pt-2.5">
                    {destino && (
                      <a
                        href={destino}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="rounded-md bg-success py-2 text-center text-sm font-bold text-white hover:brightness-95"
                      >
                        Ver oferta
                      </a>
                    )}
                    {i.url_produto && (
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(new CustomEvent("comparar-link", { detail: i.url_produto }))
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-border py-1.5 text-xs font-semibold hover:border-ml-blue"
                      >
                        <RefreshCw className="size-3.5" aria-hidden="true" />
                        Comparar de novo
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
}
