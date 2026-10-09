/* Vitrine: produtos que alguém já comparou aqui.

   Só aparece o que foi pesquisado de verdade no site (nada de varrer
   catálogo). O preço vem SEMPRE com a data em que foi visto, e cada item tem
   "Comparar de novo" para atualizar antes de comprar: preço velho mostrado
   como atual seria enganar o cliente. Categorias proibidas para anúncio do
   Google ficam de fora no próprio banco (função vitrine). */

import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, RefreshCw, ShieldCheck, TrendingDown } from "lucide-react";

import { CATEGORIAS } from "@/content/categorias";
import { lerFretesDaVitrine, semEconomiaSemFrete } from "@/lib/frete-vitrine";
import { recomendavel } from "@/lib/vitrine-recomendavel";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENTO_PERFIL,
  clusterPredominante,
  detectarCluster,
  limparPerfil,
  obterPerfil,
  type ClusterInteresse,
} from "@/lib/perfil-visitante";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { propsFotoCartao } from "@/lib/foto";
import { FaixaArte } from "@/components/FaixaArte";

const NOME_CATEGORIA: Record<string, string> = Object.fromEntries([
  ...CATEGORIAS.map((c) => [c.slug, c.nome] as const),
  ["outros", "Mais achados"] as const,
]);

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
  /* Melhor alternativa: parecido mais barato e muito parecido (não é idêntico). */
  alt_preco: number | null;
  alt_economia: number | null;
  alt_titulo: string | null;
  alt_link: string | null;
  alt_loja: string | null;
  alt_oficial: boolean | null;
  alt_vantagem: string | null;
  alt_frete_gratis: boolean | null;
  alt_muda: string | null;
};

/* Maior economia que a comparação achou: a do mesmo produto ou, quando maior,
   a da melhor alternativa (parecido), que o selo diz "Até R$ X de desconto". */
const maiorEconomia = (i: ItemVitrine) => Math.max(i.economia ?? 0, i.alt_economia ?? 0);

const doInteresse = (i: ItemVitrine, c: ClusterInteresse) =>
  detectarCluster(i.titulo ?? "", i.categoria) === c;

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
      <span className="shrink-0 text-[11px] font-bold text-success">
        {copiou ? "copiado ✓" : "copiar"}
      </span>
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

export function Vitrine({
  categoriaFixa,
  vazio,
}: {
  /* Página de categoria (09/10): só os produtos dela, sem os filtros de
     categoria. */
  categoriaFixa?: string;
  /* Mostrado quando a categoria fixa ainda não tem produto. */
  vazio?: ReactNode;
} = {}) {
  const [itens, setItens] = useState<ItemVitrine[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [aba, setAba] = useState<Aba>("recentes");
  const [categoria, setCategoria] = useState<string | null>(categoriaFixa ?? null);
  /* Interesse principal do visitante (perfil anônimo do navegador, só com
     consentimento de análise). Lido depois de montar: o servidor não conhece. */
  const [interesse, setInteresse] = useState<ClusterInteresse | null>(null);
  useEffect(() => {
    const ler = () => setInteresse(clusterPredominante(obterPerfil()));
    ler();
    window.addEventListener(EVENTO_PERFIL, ler);
    return () => window.removeEventListener(EVENTO_PERFIL, ler);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [{ data }, fretes] = await Promise.all([
          supabase.rpc("vitrine" as never, { p_limite: categoriaFixa ? 300 : 120 } as never),
          lerFretesDaVitrine(),
        ]);
        if (vivo && Array.isArray(data))
          setItens(
            semEconomiaSemFrete(data as ItemVitrine[], fretes).filter((i) =>
              recomendavel(i, fretes),
            ),
          );
      } catch {
        /* sem vitrine: a página segue normal */
      } finally {
        if (vivo) setCarregou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [categoriaFixa]);

  /* Categorias do próprio site, na ordem do site; "Mais achados" por último. */
  const categorias = useMemo(() => {
    const presentes = new Set(itens.map((i) => i.categoria_site ?? "outros"));
    return [...CATEGORIAS.map((c) => c.slug), "outros"].filter((s) => presentes.has(s));
  }, [itens]);

  const lista = useMemo(() => {
    let l = categoria ? itens.filter((i) => (i.categoria_site ?? "outros") === categoria) : itens;
    if (aba === "economias")
      l = l.filter((i) => maiorEconomia(i) > 0).sort((a, b) => maiorEconomia(b) - maiorEconomia(a));
    else if (aba === "procurados") l = [...l].sort((a, b) => (b.vezes ?? 0) - (a.vezes ?? 0));
    /* Em "Pesquisados agora", o que é do interesse do visitante sobe; o resto
       mantém a ordem da aba (o mais recente primeiro). */
    if (interesse && aba === "recentes")
      l = [...l].sort(
        (a, b) => Number(doInteresse(b, interesse)) - Number(doInteresse(a, interesse)),
      );
    return l.slice(0, categoria == null ? 120 : 48);
  }, [itens, aba, categoria, interesse]);

  /* "Do seu interesse": até 5 do tipo que o visitante mais compara, na aba
     aberta, com a maior economia primeiro. */
  const paraVoce = useMemo(() => {
    if (!interesse || categoria != null) return [];
    return lista
      .filter((i) => doInteresse(i, interesse))
      .sort((a, b) => maiorEconomia(b) - maiorEconomia(a))
      .slice(0, 5);
  }, [lista, interesse, categoria]);

  if (categoriaFixa) {
    if (!carregou) return null;
    if (!itens.some((i) => (i.categoria_site ?? "outros") === categoriaFixa))
      return <>{vazio ?? null}</>;
  } else if (!itens.length) return null;

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "recentes", rotulo: "Pesquisados agora" },
    { id: "economias", rotulo: "Maiores economias" },
    { id: "procurados", rotulo: "Mais procurados" },
  ];

  return (
    <section className="mt-8" aria-label="Produtos já comparados" data-origem="vitrine">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">
            {categoriaFixa
              ? `${NOME_CATEGORIA[categoriaFixa] ?? "Produtos"} que já comparei`
              : "Produtos que já comparei"}
          </h2>
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
              (aba === a.id
                ? "bg-ml-blue text-white"
                : "border border-border bg-card hover:border-ml-blue")
            }
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {!categoriaFixa && categorias.length > 1 && (
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
      {/* Arte da categoria escolhida (09/10: toda vitrine com arte). */}
      {!categoriaFixa && categoria && <FaixaArte slug={categoria} />}

      {lista.length === 0 ? (
        <p className="mt-4 rounded-md border border-border bg-card p-4 text-sm text-secondary-ink">
          Ainda não há produtos nesta lista.
        </p>
      ) : categoria == null ? (
        /* "Todas": uma seção por categoria, cada uma com seus produtos. */
        <div className="mt-4 space-y-7">
          {paraVoce.length > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold">Do seu interesse</h3>
                  <p className="text-xs text-secondary-ink">
                    Recomendações baseadas nas suas últimas pesquisas (ficam só neste navegador).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    limparPerfil();
                    setInteresse(null);
                  }}
                  className="text-xs font-semibold text-secondary-ink hover:underline"
                >
                  Limpar histórico de interesses
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
                {paraVoce.map((i) => (
                  <Cartao key={i.chave} i={i} />
                ))}
              </ul>
            </div>
          )}
          {categorias.map((c) => {
            const daCategoria = lista.filter((i) => (i.categoria_site ?? "outros") === c);
            if (!daCategoria.length) return null;
            return (
              <div key={c}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold">
                    {NOME_CATEGORIA[c] ?? c}{" "}
                    <span className="text-sm font-normal text-secondary-ink">
                      ({daCategoria.length})
                    </span>
                  </h3>
                  {daCategoria.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setCategoria(c)}
                      className="text-sm font-semibold text-ml-blue hover:underline"
                    >
                      Ver todos
                    </button>
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
                  {daCategoria.slice(0, 5).map((i) => (
                    <Cartao key={i.chave} i={i} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
          {lista.map((i) => (
            <Cartao key={i.chave} i={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Cartao({ i }: { i: ItemVitrine }) {
  const temEconomia = (i.economia ?? 0) > 0 && i.melhor_preco != null;
  const destino = (temEconomia ? i.melhor_link : null) ?? i.link;
  /* Alternativa parecida que economiza mais que o mesmo produto: o selo vira
     "Até R$ X de desconto" (não é idêntico, por isso o "Até"). */
  const temAlternativa = (i.alt_economia ?? 0) > (temEconomia ? (i.economia ?? 0) : 0);
  return (
    <li
      key={i.chave}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="relative h-28 overflow-hidden bg-white sm:h-32">
        {i.imagem ? (
          <img
            {...propsFotoCartao(i.imagem)}
            alt={i.titulo}
            width={200}
            height={200}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain p-1.5 transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] text-secondary-ink">
            {NOME_CATEGORIA[i.categoria_site ?? "outros"] ?? "Produto comparado"}
          </div>
        )}
        {temAlternativa ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-success px-1 py-0.5 text-[10px] font-bold text-white">
            <TrendingDown className="size-3" aria-hidden="true" />
            Até {brl(i.alt_economia)} de desconto
          </span>
        ) : (
          temEconomia && (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-success px-1 py-0.5 text-[10px] font-bold text-white">
              <TrendingDown className="size-3" aria-hidden="true" />
              {brl(i.economia)} a menos
            </span>
          )
        )}
      </div>
      <div className="flex flex-1 flex-col p-2">
        <p className="line-clamp-2 text-xs font-medium leading-snug">{i.titulo}</p>
        <p className="mt-1 text-base font-extrabold tabular-nums">
          {brl(temEconomia ? i.melhor_preco : i.preco)}
        </p>
        <p className="truncate text-[11px] text-secondary-ink">
          {temEconomia ? (
            <>
              na {i.melhor_loja} <span className="line-through">{brl(i.preco)}</span>
            </>
          ) : (
            <>na {i.loja ?? "loja"}</>
          )}
        </p>
        {temAlternativa && <Alternativa i={i} />}
        {i.cupom_codigo && <CupomDaLoja codigo={i.cupom_codigo} desconto={i.cupom_desconto} />}
        <p className="mt-0.5 text-[11px] text-secondary-ink/80">
          visto em {quando(i.visto_em)}
          {(i.lojas_comparadas ?? 0) > 0
            ? ` · ${i.lojas_comparadas} ${i.lojas_comparadas === 1 ? "loja comparada" : "lojas comparadas"}`
            : ""}
        </p>
        {/* BOTÃO DIRETO (Weslei, 05/10: "não tem o botão de consultar os
            produtos diretamente"): compra pelo link de afiliado (a melhor
            loja com frete grátis confirmado ou o próprio anúncio), com o
            preço de quando foi comparado ("visto em"); "Atualizar preço"
            compara de novo na hora. */}
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <VerDetalhesVitrine
            chave={i.chave}
            titulo={i.titulo}
            imagem={i.imagem}
            preco={temEconomia ? i.melhor_preco : i.preco}
            link={destino}
            vistoEm={i.visto_em}
            urlProduto={i.url_produto}
            className="mb-0.5"
          />
          {ehLinkDeAfiliado(destino) && (
            <a
              href={destino}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-origem="vitrine"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-success py-1.5 text-xs font-bold text-white transition hover:brightness-95 active:scale-[0.98]"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Comprar com segurança
            </a>
          )}
          {(i.url_produto || destino) && (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("comparar-link", { detail: i.url_produto ?? destino }),
                )
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-xs font-semibold text-foreground transition hover:bg-[#f5f5f7]"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Atualizar preço
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/* Melhor alternativa no cartão (Weslei, 28/09): parecido mais barato, com as
   vantagens conferidas na comparação e o aviso de que não é idêntico. */
function Alternativa({ i }: { i: ItemVitrine }) {
  const completo = maisCompleto(i.alt_vantagem, i.alt_muda);
  const vantagens = [
    i.alt_oficial === true ? "Loja oficial da marca" : null,
    completo ? "Mais completo" : null,
    i.alt_frete_gratis === true ? "Frete grátis" : null,
  ].filter((v): v is string => v != null);
  return (
    <div className="mt-1.5 rounded-md border border-success/40 bg-success/5 p-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-success">
        Alternativa parecida
      </p>
      <p className="text-sm font-extrabold tabular-nums text-success">{brl(i.alt_preco)}</p>
      {i.alt_loja && (
        <p className="truncate text-[10px] text-secondary-ink">
          Vendido por <strong className="text-foreground">{i.alt_loja}</strong>
        </p>
      )}
      {vantagens.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {vantagens.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-px text-[10px] font-semibold text-success"
            >
              {v === "Loja oficial da marca" && (
                <BadgeCheck className="size-2.5" aria-hidden="true" />
              )}
              {v}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-secondary-ink">
        Não é idêntico{i.alt_muda ? `. Muda: ${i.alt_muda}` : ""}
      </p>
      {ehLinkDeAfiliado(i.alt_link) && (
        <a
          href={i.alt_link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-1 block text-[11px] font-bold text-success underline underline-offset-2 hover:brightness-90"
        >
          Ver alternativa
        </a>
      )}
    </div>
  );
}

/* "Mais completo": a vantagem que a conferência apontou ou, sem ela, o que
   muda quando é algo A MAIS ("acessório adicional incluso", "brinde"). */
function maisCompleto(vantagem: string | null, muda: string | null): boolean {
  if (vantagem) return true;
  return /\b(adicional|inclus[oa]|acompanha|brinde|a mais)\b/i.test(muda ?? "");
}
