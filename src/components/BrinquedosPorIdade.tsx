import { useEffect, useMemo, useState } from "react";
import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";
import { RefreshCw, ShieldCheck, Truck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { FAIXAS, faixaPorId, pareceBrinquedo } from "@/lib/brinquedos";
import { SELO_MAIS_VENDIDO, seloDoCatalogo } from "@/lib/selos";

/* BRINQUEDOS POR IDADE (Weslei, 05/10). Produtos que o agente mapeou na
   API oficial (mais vendidos e buscas por idade) e que JÁ passaram pela
   comparação com link de afiliado (curadoria_brinquedos). Cada cartão diz
   só o que foi medido:
   - "R$ X a menos": outra loja do mesmo produto mais barata, com frete
     grátis confirmado;
   - "Menor preço encontrado": a oferta mais barata entre as N ofertas
     novas do catálogo e nenhuma loja mais barata na comparação;
   - senão "Preço conferido". Frete sempre em linha própria.
   Comprar só com meli.la e comparação de menos de 24 h; senão "Ver o
   preço de agora" (compara de novo). */

export type ItemBrinquedo = Item;
type Item = {
  produto: string;
  faixa: string | null;
  em_alta: boolean;
  posicao: number | null;
  nome: string;
  imagem: string | null;
  idade_texto: string | null;
  ofertas: number | null;
  url: string;
  preco: number | null;
  loja: string | null;
  link: string | null;
  frete_gratis: boolean | null;
  atendido_em: string;
  economia: number | null;
  melhor_preco: number | null;
  melhor_loja: string | null;
  melhor_link: string | null;
  melhor_frete_gratis: boolean | null;
};

type Cartao = {
  item: Item;
  preco: number;
  loja: string | null;
  link: string | null;
  freteGratis: boolean | null;
  selo: string;
  detalhe: string | null;
  tipo: "desconto" | "menor" | "conferido";
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const recente = (iso: string) => Date.now() - Date.parse(iso) < 24 * 3600_000;

function cartaoDo(i: Item): Cartao | null {
  if (i.preco == null) return null;
  if (
    (i.economia ?? 0) > 0 &&
    i.melhor_preco != null &&
    i.melhor_frete_gratis === true &&
    ehLinkDeAfiliado(i.melhor_link)
  )
    return {
      item: i,
      preco: i.melhor_preco,
      loja: i.melhor_loja,
      link: i.melhor_link,
      freteGratis: true,
      selo: `${brl(i.economia as number)} a menos`,
      detalhe: `${brl(i.preco)} em outra loja`,
      tipo: "desconto",
    };
  /* "Melhor preço" só com 2+ ofertas novas no catálogo e nenhuma loja mais
     barata na comparação (src/lib/selos.ts). */
  const selo = (i.economia ?? 0) <= 0 ? seloDoCatalogo(i.ofertas) : null;
  return {
    item: i,
    preco: i.preco,
    loja: i.loja,
    link: ehLinkDeAfiliado(i.link) ? i.link : null,
    freteGratis: i.frete_gratis,
    selo: selo?.texto ?? "Preço conferido",
    detalhe: selo?.nota ?? null,
    tipo: selo ? "menor" : "conferido",
  };
}

function CartaoBrinquedo({ c, naHome }: { c: Cartao; naHome: boolean }) {
  const i = c.item;
  const faixa = faixaPorId(i.faixa);
  /* Botão direto sempre que houver link de afiliado (Weslei, 05/10). */
  const podeComprar = !!c.link;
  const antigo = !recente(i.atendido_em);
  return (
    <li className="flex w-[60vw] max-w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-white sm:w-auto sm:max-w-none">
      <div className="relative h-28 overflow-hidden bg-white sm:h-32">
        {i.imagem ? (
          <img
            src={i.imagem}
            alt={i.nome}
            width={200}
            height={200}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-contain p-2.5"
          />
        ) : null}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            c.tipo === "desconto"
              ? "bg-[#1d7a3e] text-white"
              : c.tipo === "menor"
                ? "bg-[#0071e3] text-white"
                : "bg-[#f5f5f7] text-[#1d1d1f]"
          }`}
        >
          {c.selo}
        </span>
        {i.em_alta && (
          <span
            className="absolute bottom-2 left-2 rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-bold text-[#a33c00]"
            title={SELO_MAIS_VENDIDO.nota}
          >
            {SELO_MAIS_VENDIDO.texto}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col border-t border-border p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0058b0]">
          {i.idade_texto ? `Idade: ${i.idade_texto}` : (faixa?.curto ?? "Em alta")}
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug">{i.nome}</p>
        <p className="mt-2 text-[17px] font-extrabold leading-none tabular-nums">{brl(c.preco)}</p>
        {c.detalhe && <p className="mt-1 text-[11px] text-secondary-ink">{c.detalhe}</p>}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-secondary-ink">
          <Truck className="size-3.5 shrink-0" aria-hidden="true" />
          {c.freteGratis === true
            ? "Frete grátis"
            : c.freteGratis === false
              ? "Frete à parte"
              : "Frete: confira no anúncio"}
        </p>
        {c.loja && (
          <p className="mt-0.5 truncate text-[11px] text-secondary-ink">Vendido por {c.loja}</p>
        )}
        <div className="mt-auto pt-3">
          <VerDetalhesVitrine
            chave={/item_id(?:%3A|:)(MLB\d+)/i.exec(i.url)?.[1]?.toUpperCase() ?? ""}
            titulo={i.nome}
            imagem={i.imagem}
            preco={c.preco}
            link={c.link}
            vistoEm={i.atendido_em}
            urlProduto={i.url}
            className="mb-1.5 w-full"
          />
          {podeComprar ? (
            <a
              href={c.link as string}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-origem="brinquedos"
              className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#1d7a3e] px-2 py-2 text-[11px] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d7a3e]"
            >
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              Comprar com segurança
            </a>
          ) : null}
          {(!podeComprar || antigo) &&
            (() => {
              const classe = podeComprar
                ? "mt-1.5 flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-semibold text-[#0058b0] hover:bg-[#f5f5f7]"
                : "flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#0071e3] px-2 py-2 text-[11px] font-bold text-white hover:brightness-110";
              const texto = podeComprar ? "Atualizar preço" : "Ver o preço de agora";
              return naHome ? (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("comparar-link", { detail: i.url }))
                  }
                  className={classe}
                >
                  <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
                  {texto}
                </button>
              ) : (
                <a href={`/?link=${encodeURIComponent(i.url)}`} className={classe}>
                  <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
                  {texto}
                </a>
              );
            })()}
        </div>
      </div>
    </li>
  );
}

const ABAS = [
  {
    id: "em_alta",
    nome: "Em alta",
    dica: "Os mais vendidos de brinquedos agora, já comparados com as outras lojas.",
  },
  ...FAIXAS.map((f) => ({
    id: f.id,
    nome: f.id === "doacao" ? "Doação (até R$ 30)" : f.curto,
    dica: f.dica,
  })),
];

export function BrinquedosPorIdade({
  naHome = false,
  className = "",
  inicial,
  titulo = "h2",
}: {
  naHome?: boolean;
  className?: string;
  /* Lista lida no servidor (página /brinquedos): sai no HTML para busca. */
  inicial?: Item[];
  /* "oculto": a página já tem o banner com o título (09/10). */
  titulo?: "h1" | "h2" | "oculto";
}) {
  const [itens, setItens] = useState<Item[]>(inicial ?? []);
  const [carregou, setCarregou] = useState(!!inicial);
  const [aba, setAba] = useState("em_alta");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("curadoria_brinquedos" as never);
        if (vivo && Array.isArray(data))
          setItens((data as Item[]).filter((i) => pareceBrinquedo(i.nome ?? "")));
      } catch {
        /* sem dados: estado vazio */
      } finally {
        if (vivo) setCarregou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const porAba = useMemo(() => {
    const m = new Map<string, Cartao[]>();
    for (const a of ABAS) m.set(a.id, []);
    for (const i of itens) {
      const c = cartaoDo(i);
      if (!c) continue;
      if (i.em_alta) m.get("em_alta")!.push(c);
      if (i.faixa && m.has(i.faixa)) m.get(i.faixa)!.push(c);
      /* Barato de qualquer faixa também serve para doação. */
      if (i.faixa !== "doacao" && c.preco <= 30) m.get("doacao")!.push(c);
    }
    const peso = (c: Cartao) => (c.tipo === "desconto" ? 0 : c.tipo === "menor" ? 1 : 2);
    for (const [id, l] of m)
      l.sort((a, b) =>
        id === "doacao"
          ? a.preco - b.preco
          : id === "em_alta"
            ? (a.item.posicao ?? 99) - (b.item.posicao ?? 99)
            : peso(a) - peso(b) || a.preco - b.preco,
      );
    return m;
  }, [itens]);

  /* Abre na primeira aba com produtos. */
  useEffect(() => {
    if (!carregou) return;
    if ((porAba.get(aba)?.length ?? 0) === 0) {
      const primeira = ABAS.find((a) => (porAba.get(a.id)?.length ?? 0) > 0);
      if (primeira) setAba(primeira.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregou]);

  const atual = ABAS.find((a) => a.id === aba)!;
  const lista = porAba.get(aba) ?? [];
  const total = itens.length;
  if (carregou && total === 0) return null;

  return (
    <section
      aria-labelledby="brinquedos-titulo"
      className={`rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7 ${className}`}
    >
      {titulo === "h1" ? (
        <h1 id="brinquedos-titulo" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Brinquedos por idade com o menor preço conferido
        </h1>
      ) : (
        <h2
          id="brinquedos-titulo"
          className={titulo === "oculto" ? "sr-only" : "text-2xl font-extrabold tracking-tight"}
        >
          Brinquedos por idade
        </h2>
      )}
      {titulo !== "oculto" && (
        <p className="mt-1 text-sm text-secondary-ink">
          Os mais vendidos e as melhores escolhas por idade, já comparados com as outras lojas.
          Inclui opções baratas para doação.
        </p>
      )}
      <div
        role="tablist"
        aria-label="Faixa de idade"
        className={
          "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 " + (titulo === "oculto" ? "" : "mt-4")
        }
      >
        {ABAS.map((a) => {
          const n = porAba.get(a.id)?.length ?? 0;
          const ativa = a.id === aba;
          return (
            <button
              key={a.id}
              role="tab"
              type="button"
              aria-selected={ativa}
              onClick={() => setAba(a.id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${
                ativa
                  ? "border-[#0071e3] bg-[#0071e3] text-white"
                  : "border-border bg-[#f5f5f7] text-foreground hover:bg-[#e8e8ed]"
              }`}
            >
              {a.nome}
              {carregou && (
                <span className={ativa ? "text-white/80" : "text-secondary-ink"}> · {n}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-secondary-ink">{atual.dica}</p>
      {!carregou ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((k) => (
            <li key={k} className="h-64 animate-pulse rounded-2xl bg-[#f5f5f7]" />
          ))}
        </ul>
      ) : lista.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm">
          Estou conferindo os primeiros desta faixa. Volte mais tarde ou cole o link do brinquedo
          que você quer.
        </p>
      ) : (
        <ul
          role="tabpanel"
          className="-mx-5 mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5"
        >
          {lista.slice(0, 15).map((c) => (
            <CartaoBrinquedo key={c.item.produto} c={c} naHome={naHome} />
          ))}
        </ul>
      )}
    </section>
  );
}
