import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Loader2, ShieldCheck } from "lucide-react";

import { ehLinkDeCompra, urlBuscaAmazon } from "@/lib/afiliado";
import {
  pedirGarimpo,
  verGarimpo,
  type OfertaGarimpo,
  type PedidoGarimpo,
  type ResultadoGarimpo,
} from "@/lib/garimpo-cliente";
import {
  brl,
  chipsDoMuda,
  diferencaNoProduto,
  parecidoIndicavel,
  type EstadoPlayer,
} from "@/lib/placar-garimpo";
import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";

/* GARIMPO NO PLAYER (Weslei, 11/10): o mesmo produto procurado na Amazon
   ou na Shopee pela extensão (busca com a sessão + conferência pela foto).
   REDESIGN PREMIUM (11/10, estilo Apple): o produto do link e o veredito
   ficam no topo da tela (LinkDeOutraLoja); aqui ficam as ofertas, em
   cartões: selo (Mesmo produto / Parecido) e qualidade no topo; foto,
   título e preço no centro; a diferença no produto; o que muda em chips
   (sem setas e sem texto corrido); desvantagens em bloco vermelho; e o
   botão largo "Comprar com segurança". Todo botão leva o link de afiliado
   do Weslei (regra nº 1); sem link, sem botão. Valor em reais nunca junto
   de "frete": o frete vai em linha própria. */

const NOME: Record<PedidoGarimpo["player"], string> = { amazon: "Amazon", shopee: "Shopee" };

type Fase = "parado" | "pedindo" | "aguardando" | "pronto" | "erro";

export type MudancaGarimpo = { status: EstadoPlayer["status"]; resultado: ResultadoGarimpo | null };

const STATUS_DA_FASE: Record<Fase, EstadoPlayer["status"]> = {
  parado: "nao_consultado",
  pedindo: "carregando",
  aguardando: "carregando",
  pronto: "pronto",
  erro: "erro",
};

export function GarimpoNoPlayer({
  pedido,
  auto,
  referencia = null,
  destaqueId = null,
  aoMudar,
}: {
  pedido: PedidoGarimpo;
  /** Começa sozinho (player do link, campeão ou toque no placar). */
  auto: boolean;
  /** Preço do link colado (para a diferença no produto). */
  referencia?: number | null;
  /** Oferta do veredito (moldura verde): só ela, nunca outra. */
  destaqueId?: string | null;
  /** O placar acompanha a fase e o resultado. */
  aoMudar?: ((m: MudancaGarimpo) => void) | undefined;
}) {
  const [fase, setFase] = useState<Fase>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoGarimpo | null>(null);
  const vez = useRef(0);
  const avisar = useRef(aoMudar);
  avisar.current = aoMudar;
  const nome = NOME[pedido.player];
  const chavePedido = `${pedido.player}|${pedido.url}|${pedido.termo}`;

  async function comecar() {
    const minha = ++vez.current;
    setFase("pedindo");
    setErro(null);
    setResultado(null);
    const r = await pedirGarimpo(pedido);
    if (minha !== vez.current) return;
    if ("erro" in r) {
      setErro(r.erro);
      setFase("erro");
      return;
    }
    setFase("aguardando");
    const inicio = Date.now();
    while (minha === vez.current && Date.now() - inicio < 6 * 60_000) {
      await new Promise((ok) => setTimeout(ok, Date.now() - inicio < 60_000 ? 3000 : 5000));
      if (minha !== vez.current) return;
      const e = await verGarimpo(r.id, r.chave, pedido.player);
      if (!e) continue;
      if (e.status === "pronto") {
        setResultado(e.resultado);
        setFase("pronto");
        return;
      }
      if (e.status === "falhou" || e.parado) break;
    }
    if (minha !== vez.current) return;
    setErro(`A conferência na ${nome} não respondeu agora.`);
    setFase("erro");
  }

  useEffect(() => {
    if (auto) void comecar();
    return () => {
      vez.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, chavePedido]);

  useEffect(() => {
    avisar.current?.({ status: STATUS_DA_FASE[fase], resultado });
  }, [fase, resultado]);

  const buscaAmazon = pedido.player === "amazon" ? urlBuscaAmazon(pedido.termo) : null;
  /* Mesmo produto primeiro; depois os parecidos que podem ser indicados
     (qualidade equivalente/superior, sem vir menos); cada grupo do mais
     barato para o mais caro. */
  const grupo = (o: OfertaGarimpo) => (o.relacao === "mesmo" ? 0 : parecidoIndicavel(o) ? 1 : 2);
  const conferidos = (resultado?.ofertas.filter((o) => o.relacao !== "busca") ?? []).sort(
    (a, b) => grupo(a) - grupo(b) || a.preco - b.preco,
  );
  const daBusca = resultado?.ofertas.filter((o) => o.relacao === "busca") ?? [];
  const mesmoMaisBarato =
    referencia != null &&
    conferidos.some((o) => o.relacao === "mesmo" && o.preco < referencia - 0.009);

  return (
    <section
      id={`secao-garimpo-${pedido.player}`}
      className="scroll-mt-36 rounded-3xl border border-black/5 bg-card p-4 shadow-sm dark:border-white/10 sm:p-5"
      aria-live="polite"
      data-origem={`garimpo_${pedido.player}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[17px] font-bold tracking-tight text-foreground">Na {nome}</h3>
        {resultado && (
          <p className="text-[11px] text-secondary-ink">
            li {resultado.lidas} {resultado.lidas === 1 ? "resultado" : "resultados"}
            {resultado.conferencia === "ok"
              ? ` e conferi ${resultado.conferidas} pela foto`
              : resultado.conferencia === "sem_foto"
                ? " (sem foto do seu produto para conferir)"
                : ""}
          </p>
        )}
      </div>

      {fase === "parado" && (
        <button
          type="button"
          onClick={() => void comecar()}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
        >
          Ver preço
        </button>
      )}

      {(fase === "pedindo" || fase === "aguardando") && (
        <div className="mt-3">
          <p className="inline-flex items-center gap-2 text-sm text-secondary-ink">
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Procurando o mesmo produto na {nome}… de 30 segundos a 2 minutos.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-hidden="true">
            {[0, 1].map((k) => (
              <div
                key={k}
                className="flex gap-3 rounded-2xl border border-black/5 p-3 dark:border-white/10"
              >
                <div className="size-20 shrink-0 animate-pulse rounded-xl bg-[#f5f5f7] dark:bg-white/10" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-[#f5f5f7] dark:bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-[#f5f5f7] dark:bg-white/10" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-[#f5f5f7] dark:bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fase === "erro" && (
        <div className="mt-2 text-sm text-secondary-ink">
          <p>{erro}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void comecar()}
              className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-[13px] font-semibold text-foreground hover:bg-[#f5f5f7] dark:hover:bg-white/10"
            >
              Tentar de novo
            </button>
            {buscaAmazon && ehLinkDeCompra(buscaAmazon, "amazon") && (
              <a
                href={buscaAmazon}
                target="_blank"
                rel="noopener noreferrer sponsored"
                data-origem="garimpo_amazon_busca"
                className="inline-flex min-h-10 items-center gap-1 rounded-full border border-border px-4 text-[13px] font-semibold text-foreground hover:bg-[#f5f5f7] dark:hover:bg-white/10"
              >
                Conferir na loja <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}

      {fase === "pronto" && resultado && (
        <div className="mt-3 space-y-4">
          {pedido.origem === pedido.player &&
            resultado.conferencia === "ok" &&
            !mesmoMaisBarato &&
            !conferidos.some((o) => o.relacao === "mesmo") && (
              <p className="text-sm text-secondary-ink">
                Não achei o mesmo produto mais barato na {nome} agora.
              </p>
            )}

          {conferidos.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 sm:items-start">
              {conferidos.map((o) => (
                <li key={`${o.relacao}-${o.id}`} className="flex">
                  <CartaoOferta
                    oferta={o}
                    referencia={referencia}
                    destaque={destaqueId != null && destaqueId === o.id}
                  />
                </li>
              ))}
            </ul>
          )}

          {daBusca.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-secondary-ink">
                Encontrados pela busca (não conferi pela foto: confira se é o mesmo produto)
              </p>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 sm:items-start">
                {daBusca.map((o) => (
                  <li key={`busca-${o.id}`} className="flex">
                    <CartaoOferta oferta={o} referencia={referencia} destaque={false} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!resultado.ofertas.length && (
            <p className="text-sm text-secondary-ink">
              {resultado.conferencia === "falhou"
                ? "A conferência pela foto não respondeu agora. Tente de novo em alguns minutos."
                : pedido.origem === pedido.player
                  ? `Não achei outra oferta do mesmo produto na ${nome} agora.`
                  : `Sem modelo compatível na ${nome} nesta análise.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const SELO: Record<OfertaGarimpo["relacao"], { texto: string; cor: string }> = {
  mesmo: {
    texto: "Mesmo produto",
    cor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  parecido: {
    texto: "Parecido",
    cor: "bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  },
  busca: {
    texto: "Encontrado pela busca",
    cor: "bg-[#f5f5f7] text-secondary-ink dark:bg-white/10",
  },
};

function seloQualidade(q: string | null | undefined) {
  if (q === "superior" || q === "equivalente")
    return {
      texto: q === "superior" ? "✓ Qualidade superior" : "✓ Qualidade equivalente",
      cor: "text-emerald-700 dark:text-emerald-300",
    };
  if (q === "inferior")
    return { texto: "⚠ Qualidade inferior", cor: "text-amber-800 dark:text-amber-300" };
  if (q) return { texto: "? Qualidade não confirmada", cor: "text-secondary-ink" };
  return null;
}

function CartaoOferta({
  oferta: o,
  referencia,
  destaque,
}: {
  oferta: OfertaGarimpo;
  referencia: number | null;
  destaque: boolean;
}) {
  const selo = SELO[o.relacao];
  const qualidade = o.relacao === "parecido" ? seloQualidade(o.qualidade) : null;
  const chips = o.relacao === "parecido" ? chipsDoMuda(o.muda) : [];
  const desvantagens = o.relacao === "parecido" ? (o.desvantagens ?? []).slice(0, 3) : [];
  const diferenca = diferencaNoProduto(o.preco, referencia);
  const frete = o.selos.includes("Prime")
    ? "Frete grátis para assinantes Prime"
    : (o.notaFrete ?? "Frete: confira no anúncio");
  const temDetalhe = o.relacao === "parecido" && (!!o.muda || !!o.qualidadeMotivo);
  return (
    <article
      className={
        "flex w-full flex-col rounded-2xl border p-3.5 transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-safe:hover:-translate-y-0.5 hover:shadow-md sm:p-4 " +
        (destaque
          ? "border-emerald-500/50 bg-emerald-50/40 ring-1 ring-emerald-500/30 dark:bg-emerald-400/5"
          : "border-black/5 bg-card dark:border-white/10")
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${selo.cor}`}
        >
          {o.relacao === "mesmo" && <Check className="size-3" aria-hidden="true" />}
          {selo.texto}
        </span>
        {qualidade && (
          <span className={`text-[11px] font-semibold ${qualidade.cor}`}>{qualidade.texto}</span>
        )}
        {destaque && (
          <span className="ml-auto text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <span className="animate-fogo inline-block" aria-hidden="true">
              🔥
            </span>{" "}
            Menor valor
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-black/5 sm:size-24">
          {o.imagem ? (
            <VerDetalhesVitrine
              chave={`${o.marketplace}:${o.id}`}
              titulo={o.titulo}
              imagem={o.imagem}
              preco={o.preco}
              link={o.link}
              className="absolute inset-0"
              gatilho={
                <img
                  src={o.imagem}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  className="absolute inset-0 h-full w-full object-contain p-1.5"
                />
              }
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
            {o.titulo}
          </p>
          <p className="mt-1 text-lg font-extrabold tabular-nums tracking-tight text-foreground">
            {brl(o.preco)}
          </p>
          {diferenca && (
            <p
              className={
                "text-[12px] font-semibold " +
                (diferenca.menos && (o.relacao === "mesmo" || parecidoIndicavel(o))
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-secondary-ink")
              }
            >
              {diferenca.texto}
            </p>
          )}
          <p className="text-[11px] text-secondary-ink">{frete}</p>
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="O que muda em relação ao seu">
          {chips.map((c) => (
            <li
              key={`${c.campo ?? ""}-${c.valor}`}
              title={c.original ? `O seu: ${c.original}` : undefined}
              className="max-w-full rounded-md bg-[#f5f5f7] px-2.5 py-1 text-xs text-foreground [overflow-wrap:anywhere] dark:bg-white/10"
            >
              <span aria-hidden="true">{c.icone} </span>
              {c.campo ? `${c.campo}: ` : ""}
              <strong className="font-semibold">{c.valor}</strong>
            </li>
          ))}
        </ul>
      )}

      {desvantagens.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <p className="font-semibold">Desvantagens em relação ao seu</p>
          <ul className="mt-0.5 list-disc pl-4">
            {desvantagens.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {temDetalhe && (
        <details className="abertura-nativa group mt-2 text-[12px] text-secondary-ink">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 font-semibold text-[#0071e3] [&::-webkit-details-marker]:hidden">
            Ver análise técnica detalhada
            <ChevronDown
              className="size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <ul className="mt-1 space-y-0.5">
            {chipsDoMuda(o.muda, 12).map((c) => (
              <li key={`d-${c.campo ?? ""}-${c.valor}`}>
                {c.campo ? `${c.campo}: ` : ""}
                {c.original ? `o seu ${c.original} → este ${c.valor}` : c.valor}
              </li>
            ))}
            {o.qualidadeMotivo && <li>Qualidade: {o.qualidadeMotivo}</li>}
          </ul>
        </details>
      )}

      <div className="mt-auto pt-3">
        <a
          href={o.link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          data-origem="garimpo"
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-success px-4 text-[13px] font-bold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Comprar com segurança
          <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export type { OfertaGarimpo };
