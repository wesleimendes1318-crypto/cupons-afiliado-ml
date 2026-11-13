/* PRODUCT PAGE (Weslei, 13/11/2026): a card click anywhere opens this full
   page instead of the drawer, and the multi-store comparison only runs when
   the visitor taps "Comparar preço em outras lojas". Card data (router
   state) paints at once; the official API read comes after. Nothing is
   invented: sales counts, rankings, seller medals and installments are not
   in the data, so they are not shown. Every buy button ends in Weslei's
   affiliate link (ComprarComSeguranca with the stored link, else VerNaLoja,
   which generates it on click). */
import { createFileRoute, Link, notFound, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Check, LoaderCircle, PackageCheck, Truck, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { LinhaAvaliacoes } from "@/components/Avaliacoes";
import { abrirComparacao, ComprarComSeguranca, SinoAcompanhar } from "@/components/BotoesCartao";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { useRegiaoGuardada } from "@/components/CepDestino";
import { CoracaoDesejo } from "@/components/CoracaoDesejo";
import {
  BotaoWhatsApp,
  fotoGrande,
  GaleriaProduto,
  useDetalhesProduto,
  type PreviaProduto,
} from "@/components/DetalhesVitrine";
import { CartaoEmAlta } from "@/components/EmAltaCatalogo";
import { FichaTecnicaBento } from "@/components/FichaTecnicaBento";
import { LinhaEntrega } from "@/components/LinhaEntrega";
import { OpinioesCompradores } from "@/components/OpinioesCompradores";
import { acoesDoProduto } from "@/lib/afiliado";
import { itemDoEndereco, useAvaliacoesPorItens } from "@/lib/avaliacoes-detalhe";
import { caracteristicasValidas, pilulasDaFicha } from "@/lib/ficha-detalhes";
import { SITE } from "@/lib/lista-publica";
import { lerProdutoPagina, type ItemMesmoTipo, type ProdutoPagina } from "@/lib/produto-pagina";
import { bemAvaliadosPrimeiro, reprovadaPelaAvaliacao } from "@/lib/qualidade-avaliacao";
import { funcionaEm, rotuloVoltagem, voltagemDaRegiao, voltagemDoTexto } from "@/lib/voltagem";

export const Route = createFileRoute("/produto/$id")({
  loader: async ({ params, location }) => {
    const id = params.id.toUpperCase();
    if (!/^MLB\d{5,12}$/.test(id)) throw notFound();
    const previa = (location.state as { previa?: PreviaProduto } | undefined)?.previa ?? null;
    /* Coming from a card: paint now, read the API on the page. */
    if (previa && typeof window !== "undefined") return { id, dados: null, previa };
    const dados = await lerProdutoPagina({ data: id }).catch(() => null);
    return { id, dados, previa };
  },
  head: ({ loaderData }) => {
    const d = loaderData?.dados;
    const pv = loaderData?.previa;
    const nome = d?.nome ?? pv?.titulo ?? "Produto";
    const preco = d?.preco ?? pv?.preco ?? null;
    const foto = d?.fotos[0] ?? pv?.imagem ?? null;
    const url = `${SITE}/produto/${loaderData?.id ?? ""}`;
    const titulo = `${nome} | Melhor Escolha`;
    const descricao = [
      preco != null ? `${brl(preco)} no Mercado Livre` : null,
      d?.avaliacao ? `nota ${d.avaliacao.nota.toFixed(1).replace(".", ",")}` : null,
      d?.freteGratis ? "frete grátis" : null,
      "Compare o preço em outras lojas antes de comprar.",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(foto
          ? [
              { property: "og:image", content: foto },
              { name: "twitter:image", content: foto },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: titulo },
        { name: "twitter:description", content: descricao },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: d
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: d.nome,
                image: d.fotos.slice(0, 6),
                url,
                ...(d.preco != null
                  ? {
                      offers: {
                        "@type": "Offer",
                        price: d.preco.toFixed(2),
                        priceCurrency: "BRL",
                        availability: "https://schema.org/InStock",
                        url,
                      },
                    }
                  : {}),
                ...(d.avaliacao
                  ? {
                      aggregateRating: {
                        "@type": "AggregateRating",
                        ratingValue: d.avaliacao.nota,
                        reviewCount: d.avaliacao.total,
                      },
                    }
                  : {}),
              }),
            },
          ]
        : [],
    };
  },
  component: PaginaProduto,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

function PaginaProduto() {
  const { id } = Route.useLoaderData();
  /* A new product resets everything (card -> card inside the page). */
  return <Produto key={id} />;
}

function Produto() {
  const { id, dados: doServidor, previa: daCarga } = Route.useLoaderData();
  /* Router state survives a reload of the same entry; the loader value wins. */
  const doEstado = useRouterState({
    select: (s) => (s.location.state as { previa?: PreviaProduto }).previa ?? null,
  });
  const pv = daCarga ?? doEstado;
  const [d, setD] = useState<ProdutoPagina | null | undefined>(doServidor ?? undefined);
  useEffect(() => {
    if (doServidor) return;
    let vivo = true;
    lerProdutoPagina({ data: id })
      .then((r) => vivo && setD(r))
      .catch(() => vivo && setD(null));
    return () => {
      vivo = false;
    };
  }, [id, doServidor]);

  const pronto = useMemo(() => (d ? { fotos: d.fotos, ficha: d.ficha } : null), [d]);
  const { dados, doCatalogo, ficha } = useDetalhesProduto(id, id, id, undefined, pronto);

  const titulo = d?.nome ?? pv?.titulo ?? dados?.titulo ?? "";
  /* shortcut: without card data or API, catalog ids have <= 9 digits;
     a wrong guess only makes the generated link open the other page type. */
  const url =
    pv?.url ??
    d?.url ??
    (id.length <= 12
      ? `https://www.mercadolivre.com.br/p/${id}`
      : `https://produto.mercadolivre.com.br/${id.replace(/^MLB/, "MLB-")}`);
  const acoes = acoesDoProduto(pv?.link ?? null, url);
  const linkPronto = acoes.comprar && "href" in acoes.comprar ? acoes.comprar.href : null;
  const gerar = acoes.comprar && "gerar" in acoes.comprar ? acoes.comprar.gerar : null;

  /* The price shown is the one the buy button opens: the API price only when
     the link opens that same offer (catalog page = buy box, or same listing). */
  const doLink = itemDoEndereco(url);
  const apiServe =
    d?.preco != null &&
    !d.precoDeReferencia &&
    (!pv?.preco || doLink?.startsWith("MLBP") || doLink === d.item);
  const preco = apiServe ? d!.preco : (pv?.preco ?? d?.preco ?? null);
  const original = apiServe ? d!.precoOriginal : null;
  const desconto = original && preco ? Math.round((1 - preco / original) * 100) : 0;
  const itemEntrega =
    (apiServe ? d?.item : null) ?? (doLink?.startsWith("MLBP") ? d?.item : doLink);
  const itemAval = doLink ?? d?.item ?? null;
  const notas = useAvaliacoesPorItens([itemAval]);

  const lidas = caracteristicasValidas(dados?.detalhes?.caracteristicas);
  const carac = lidas.length ? lidas : caracteristicasValidas(ficha?.length ? ficha : d?.ficha);
  const pilulas = pilulasDaFicha(carac);
  const destaques = (dados?.detalhes?.destaques ?? []).filter(Boolean);
  const descricao = (dados?.detalhes?.descricao ?? d?.descricao ?? "").trim();

  const galeria = [
    ...new Set(
      [pv?.imagem, ...(pv?.fotos ?? []), ...(doCatalogo ?? []), ...(d?.fotos ?? [])]
        .filter((u): u is string => !!u)
        .map(fotoGrande),
    ),
  ];
  const foto = galeria[0] ?? null;
  const desejo = { chave: id, titulo, preco, foto, link: linkPronto, url };
  const atalhos: [ReactNode, ReactNode] = [
    <CoracaoDesejo key="c" compacto produto={desejo} />,
    <BotaoWhatsApp key="w" produto={desejo} />,
  ];

  /* Voltage against the visitor's region (CEP in the header). */
  const regiao = useRegiaoGuardada();
  const volt = voltagemDoTexto(
    d?.voltagem ?? carac.find((c) => /voltagem|tens[aã]o/i.test(c.nome))?.valor,
  );
  const rede = volt ? voltagemDaRegiao(regiao?.cidade, regiao?.uf) : null;
  const naoServe = volt != null && rede != null && !funcionaEm(volt, rede.volts);

  const botaoCompra = linkPronto ? (
    <ComprarComSeguranca link={linkPronto} origem="pagina_produto" destaque />
  ) : gerar ? (
    <VerNaLoja url={gerar} grande />
  ) : null;

  const caixaCompra = useRef<HTMLDivElement>(null);
  const carregando = d === undefined && !pv;

  if (d === null && !pv && !dados?.titulo)
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Não consegui abrir este produto</h1>
        <p className="mt-2 text-sm text-secondary-ink">
          Pode ter saído do ar. Compare pelo link ou volte para as ofertas.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
          {botaoCompra}
          <Link
            to="/"
            className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Ver as ofertas
          </Link>
        </div>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 md:pb-12">
      <nav aria-label="Você está em" className="mb-3 text-[12px] text-secondary-ink">
        <Link to="/" className="hover:underline">
          Início
        </Link>
        <span aria-hidden="true"> › </span>
        <span>Produto</span>
      </nav>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start lg:gap-8">
        <div className="min-w-0 rounded-3xl bg-card p-3 shadow-[var(--shadow-card)] sm:p-4">
          {galeria.length ? (
            <GaleriaProduto
              galeria={galeria}
              titulo={titulo}
              atalhos={atalhos}
              carregando={doCatalogo === null}
              alto="h-72 sm:h-96 lg:h-[28rem]"
            />
          ) : (
            <div className="grid h-72 place-items-center rounded-2xl bg-[#f5f5f7] sm:h-96">
              {carregando ? (
                <LoaderCircle className="size-6 animate-spin text-[#86868b]" aria-hidden="true" />
              ) : (
                <div className="flex gap-2">{atalhos}</div>
              )}
            </div>
          )}
        </div>

        <div
          ref={caixaCompra}
          className="min-w-0 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] sm:p-5 md:sticky md:top-24"
        >
          <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-secondary-ink">
            {d?.condicao && <span>{d.condicao === "novo" ? "Novo" : "Usado"}</span>}
            {d?.lojaOficial && (
              <span className="rounded-full bg-[#0071e3]/10 px-2 py-0.5 text-[11px] font-bold text-[#0058b0]">
                Loja oficial
              </span>
            )}
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
            {titulo || <span className="block h-7 w-3/4 animate-pulse rounded-lg bg-[#f5f5f7]" />}
          </h1>
          <LinhaAvaliacoes
            resumo={itemAval ? notas.get(itemAval) : null}
            titulo={titulo}
            link={linkPronto}
            className="mt-1.5"
          />

          <div className="mt-3">
            {original && desconto >= 1 && (
              <p className="text-[13px] text-secondary-ink">
                <s className="tabular-nums">{brl(original)}</s>
              </p>
            )}
            {preco != null ? (
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums sm:text-[34px]">
                  {brl(preco)}
                </span>
                {desconto >= 1 && (
                  <span className="text-[15px] font-bold text-[#248a3d]">{desconto}% OFF</span>
                )}
              </p>
            ) : d === undefined ? (
              <span className="block h-9 w-40 animate-pulse rounded-lg bg-[#f5f5f7]" />
            ) : (
              <p className="text-[13px] text-secondary-ink">
                Vendido por várias lojas: veja o preço na loja ou compare.
              </p>
            )}
            {preco != null && !apiServe && (
              <p className="text-[11px] text-secondary-ink">
                Preço de referência
                {d?.precoDeReferencia ? ` de ${dia(d.precoDeReferencia)}` : ""}. Confira na loja.
              </p>
            )}
          </div>

          <div className="mt-4 space-y-1.5 rounded-2xl bg-[#f5f5f7] p-3 dark:bg-white/5">
            <LinhaEntrega item={itemEntrega} freteGratis={d?.freteGratis ?? null} />
            {!itemEntrega && d?.freteGratis === true && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-success">
                <Check className="size-3.5" aria-hidden="true" />
                Frete grátis
              </p>
            )}
            {!itemEntrega && d?.freteGratis !== true && (
              <p className="flex items-center gap-1 text-[11px] text-secondary-ink">
                <Truck className="size-3.5" aria-hidden="true" />
                Frete e prazo na loja
              </p>
            )}
            {apiServe && d?.full && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-[#248a3d]">
                <PackageCheck className="size-3.5" aria-hidden="true" />
                Enviado pelo Full
              </p>
            )}
            {volt && (
              <p
                className={
                  "flex items-center gap-1 text-[11px] " +
                  (naoServe ? "font-semibold text-[#b25000]" : "text-secondary-ink")
                }
              >
                <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                {rotuloVoltagem(volt)}
                {naoServe && rede
                  ? ` · sua região (${rede.cidade}) é ${rede.volts} V: confira a voltagem antes de comprar`
                  : ""}
              </p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {botaoCompra}
            <SinoAcompanhar url={url} titulo={titulo} onComparar={abrirComparacao}>
              <button
                type="button"
                onClick={() => abrirComparacao(url)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-[#0071e3]/50 px-3 py-2.5 text-[14px] font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:text-[#4da3ff]"
              >
                <span className="truncate">
                  Comparar preço<span className="hidden min-[360px]:inline"> em outras lojas</span>
                </span>
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            </SinoAcompanhar>
            <p className="text-center text-[11px] text-muted-foreground">
              ✓ Você compra direto na loja oficial · Sem taxa extra
            </p>
          </div>
        </div>
      </div>

      {(pilulas.length > 0 || carac.length > 0 || destaques.length > 0 || descricao) && (
        <section aria-labelledby="ficha-titulo" className="mt-8 space-y-3">
          <h2 id="ficha-titulo" className="text-xl font-extrabold tracking-tight">
            Características do produto
          </h2>
          {pilulas.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Principais características">
              {pilulas.map((c, k) => (
                <li
                  key={k}
                  className="animate-cartao max-w-full truncate rounded-full border border-border/60 bg-white/80 px-3 py-1 text-[12px] shadow-sm backdrop-blur-xl dark:bg-white/5"
                  style={{ animationDelay: `${k * 80}ms` }}
                >
                  <span className="text-[#6e6e73]">{c.nome}: </span>
                  <span className="font-semibold">{c.valor}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[13px]">
            <FichaTecnicaBento
              destaques={destaques}
              caracteristicas={carac}
              descricao={descricao}
            />
          </div>
          <p className="text-[11px] text-secondary-ink">
            Informações do anúncio e da ficha oficial. Confira na loja antes de comprar.
          </p>
        </section>
      )}

      {itemAval && (
        <section className="mt-8 text-[13px]">
          <OpinioesCompradores item={itemAval} titulo={titulo} link={linkPronto} />
        </section>
      )}

      {d === undefined && pv && (
        <p className="mt-8 flex items-center gap-2 text-[13px] text-secondary-ink">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Carregando mais detalhes…
        </p>
      )}

      <MesmoTipo itens={d?.mesmoTipo ?? []} preco={preco} url={url} />

      <BarraCompraCelular
        alvo={caixaCompra}
        foto={foto}
        titulo={titulo}
        preco={preco}
        linkPronto={linkPronto}
        gerar={gerar}
      />
    </main>
  );
}

/* Best sellers of the same product type, and the cheaper ones among them.
   Same TYPE, never "same product": prices are the showcase references. */
function MesmoTipo({
  itens,
  preco,
  url,
}: {
  itens: ItemMesmoTipo[];
  preco: number | null;
  url: string;
}) {
  const mapa = useAvaliacoesPorItens(itens.map((i) => itemDoEndereco(i.url)));
  const resumoDe = (i: ItemMesmoTipo) => mapa.get(itemDoEndereco(i.url) ?? "");
  /* shortcut: ML domains mix accessories in (Buds under CELLPHONES), so a
     price band keeps the same kind of product; upgrade to a title check if
     odd neighbours still show. */
  const naFaixa = (i: ItemMesmoTipo) =>
    preco == null || (i.preco >= preco * 0.4 && i.preco <= preco * 2.5);
  const bons = bemAvaliadosPrimeiro(
    itens.filter((i) => naFaixa(i) && !reprovadaPelaAvaliacao(resumoDe(i))),
    resumoDe,
  ).map((i) => ({ ...i, categoria_site: i.categoria_site ?? "" }));
  if (!bons.length) return null;
  const baratos =
    preco != null ? bons.filter((i) => i.preco > 0 && preco - i.preco >= 5).slice(0, 10) : [];
  const maxEconomia = baratos.reduce((m, i) => Math.max(m, preco! - i.preco), 0);
  const comparar = () => abrirComparacao(url);
  return (
    <>
      {baratos.length > 0 && (
        <Trilho
          id="mais-em-conta"
          titulo="Mais em conta do mesmo tipo"
          resumo={`Economize até ${brl(maxEconomia)} em outros modelos. Veja o que muda antes de trocar.`}
        >
          {baratos.map((i) => (
            <CartaoEmAlta
              key={i.produto}
              i={i}
              resumo={resumoDe(i)}
              grade={false}
              trilho
              onComparar={comparar}
              selo={
                <span className="whitespace-nowrap rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-[#248a3d]">
                  {brl(preco! - i.preco)} a menos
                </span>
              }
            />
          ))}
        </Trilho>
      )}
      <Trilho
        id="mais-vendidos-tipo"
        titulo="Mais vendidos do mesmo tipo"
        resumo="Lista oficial de mais vendidos do Mercado Livre, os mais bem avaliados primeiro."
      >
        {bons.slice(0, 12).map((i) => (
          <CartaoEmAlta
            key={i.produto}
            i={i}
            resumo={resumoDe(i)}
            grade={false}
            trilho
            onComparar={comparar}
          />
        ))}
      </Trilho>
    </>
  );
}

function Trilho({
  id,
  titulo,
  resumo,
  children,
}: {
  id: string;
  titulo: string;
  resumo: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-extrabold tracking-tight">
        {titulo}
      </h2>
      <p className="mt-1 text-sm text-secondary-ink">{resumo}</p>
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {children}
      </ul>
    </section>
  );
}

/* Mobile buy bar once the buy box scrolls away (same pattern as the result
   page: the bottom tabs step aside through html[data-compra]). */
function BarraCompraCelular({
  alvo,
  foto,
  titulo,
  preco,
  linkPronto,
  gerar,
}: {
  alvo: React.RefObject<HTMLDivElement | null>;
  foto: string | null;
  titulo: string;
  preco: number | null;
  linkPronto: string | null;
  gerar: string | null;
}) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const r = alvo.current?.getBoundingClientRect();
      setVisivel(Boolean(r && r.bottom < 0));
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    medir();
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [alvo]);
  useEffect(() => {
    const doc = document.documentElement;
    const celular = window.matchMedia?.("(max-width: 767px)").matches;
    doc.style.setProperty("--folga-compra", visivel && celular ? "76px" : "0px");
    doc.toggleAttribute("data-compra", Boolean(visivel && celular));
    return () => {
      doc.style.setProperty("--folga-compra", "0px");
      doc.removeAttribute("data-compra");
    };
  }, [visivel]);
  if (!linkPronto && !gerar) return null;
  return (
    <div
      className={
        "fixed inset-x-0 bottom-0 z-40 border-t border-black/5 vidro-barra px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none dark:border-white/10 md:hidden " +
        (visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0")
      }
      aria-hidden={!visivel}
      inert={!visivel}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
          {foto && (
            <img
              src={foto}
              alt=""
              width={44}
              height={44}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-contain p-0.5"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] text-secondary-ink">{titulo}</p>
          {preco != null && (
            <p className="text-[16px] font-bold tabular-nums text-foreground">{brl(preco)}</p>
          )}
        </div>
        <div className="shrink-0">
          {linkPronto ? (
            <a
              href={linkPronto}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-origem="pagina_produto_barra"
              className="botao-seguro inline-flex items-center rounded-full bg-success px-5 py-2.5 text-[14px] font-bold text-white shadow-sm active:scale-95"
            >
              Comprar com segurança ↗
            </a>
          ) : (
            <VerNaLoja url={gerar!} pilula />
          )}
        </div>
      </div>
    </div>
  );
}
