import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { ArrowUpRight, ChevronDown, Loader2, Search, ShieldCheck, Store } from "lucide-react";

import { ResultadosDaBusca, type ConsultaBusca } from "@/components/BuscaGuiada";
import { GarimpoNoPlayer, type MudancaGarimpo } from "@/components/GarimpoNoPlayer";
import { buscarProdutos, type Resposta } from "@/lib/busca-guiada-cliente";
import { nomeParaTela, type AnaliseLink } from "@/lib/analisar-link";
import { ehLinkDeCompra, gerarUrlAfiliadoAmazon, urlBuscaAmazon } from "@/lib/afiliado";
import {
  determinarCampeaoDoSegmento,
  NOME_PLAYER,
  type Campeao,
  type PlayerAfiliado,
} from "@/lib/campeao-segmento";
import type { PedidoGarimpo } from "@/lib/garimpo-cliente";
import {
  brl,
  diferencaNoProduto,
  estadoDoGarimpo,
  estadoDoMercadoLivre,
  naPlayer,
  rotuloMercadoLivre,
  vencedorDoPlacar,
  vereditoDoGarimpo,
  type EstadoPlayer,
  type OfertaPlacar,
  type Veredito,
} from "@/lib/placar-garimpo";

/* RECONHECIMENTO UNIVERSAL DE LINKS (Weslei, 10/10) + GARIMPO NO PLAYER DE
   ORIGEM E CAMPEÃO DO NICHO (11/10) + REDESIGN PREMIUM ESTILO APPLE (11/10,
   prompt mestre "correção multi-player"). Link que não é do Mercado Livre
   nunca vira "link inválido". A tela, de cima para baixo:
   1. o produto do link (cartão âncora): foto, "Visto na <loja>", nome limpo,
      preço de referência e, na Amazon/Shopee, o link de afiliado dele;
   2. o veredito em uma frase: "Economize R$ X na Shopee!" (mesmo produto
      conferido pela foto, ou "com modelo similar" de qualidade equivalente)
      ou "Você já encontrou o melhor preço!" (só depois de conferir);
   3. o placar dos 3 (Mercado Livre, Amazon, Shopee): correspondência,
      preço, frete em linha própria e ação; o vencedor ganha moldura verde e
      🔥; quem ainda não foi consultado fica translúcido com "Ver preço";
   4. as ofertas de cada player (GarimpoNoPlayer: chips do que muda,
      qualidade, desvantagens) e a busca no Mercado Livre com o cabeçalho
      honesto (src/lib/placar-garimpo.ts: "Menor preço" só se for mais barato
      que o visto E que os outros players);
   5. no celular, a barra de compra embaixo (vidro) com a melhor opção.
   Todo botão de compra leva o link de afiliado do Weslei (regra nº 1). */

export type LinkIdentificadoTela = AnaliseLink & {
  precoOrigem?: number;
  imagemOrigem?: string;
  categoriaOrigem?: string;
  campeao?: Campeao;
};

type Estado = { carregando: boolean; erro: string | null; resposta: Resposta | null };

const VAZIO: Estado = { carregando: false, erro: null, resposta: null };

const ORDEM: PlayerAfiliado[] = ["mercadolivre", "amazon", "shopee"];

type Garimpos = Partial<Record<"amazon" | "shopee", MudancaGarimpo>>;

const rolarAte = (id: string) => {
  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
};

export function LinkDeOutraLoja({
  analise,
  identificando,
  comparar,
}: {
  analise: LinkIdentificadoTela;
  identificando: boolean;
  comparar: (url: string) => void;
}) {
  const idCampo = useId();
  const [termo, setTermo] = useState(analise.termoIdentificado ?? "");
  const [busca, setBusca] = useState<Estado>(VAZIO);
  const [consulta, setConsulta] = useState<ConsultaBusca | null>(null);
  /* Players abertos nesta tela (sozinhos ou pelo toque). */
  const [abertos, setAbertos] = useState<PlayerAfiliado[]>([]);
  /* Fase e resultado de cada garimpo (o placar e o veredito leem daqui). */
  const [garimpos, setGarimpos] = useState<Garimpos>({});
  const automatica = useRef<string | null>(null);

  const origem = analise.origem;
  const nomeTermo = analise.termoIdentificado ?? null;
  /* O produto do link lido no próprio player (foto e preço para conferir
     nos outros). */
  const lidoNaOrigem =
    origem === "amazon" || origem === "shopee"
      ? (garimpos[origem]?.resultado?.original ?? null)
      : null;
  /* O servidor diz o campeão; link com nome no endereço não passa por lá,
     então a mesma regra roda aqui. */
  const campeao =
    analise.campeao ??
    (nomeTermo && origem !== "invalido" && origem !== "mercadolivre"
      ? determinarCampeaoDoSegmento({
          titulo: nomeTermo,
          categoria: analise.categoriaOrigem ?? null,
          preco: analise.precoOrigem ?? null,
        })
      : null);
  const termoGarimpo = nomeTermo ?? (origem === "amazon" ? (analise.identificador ?? null) : null);
  /* Busca no Mercado Livre: o nome do link ou, sem ele, o lido no player. */
  const termoMl = nomeTermo ?? lidoNaOrigem?.titulo ?? null;

  /* Onde a busca começa: o próprio player (Amazon/Shopee) ou o campeão. */
  const inicial: PlayerAfiliado | null =
    origem === "amazon"
      ? "amazon"
      : origem === "shopee"
        ? "shopee"
        : origem === "outro_player"
          ? (campeao?.player ?? "mercadolivre")
          : null;
  /* Amazon/Shopee de um segmento em que o Mercado Livre é o campeão de
     verdade (autopeças, linha branca, beleza e moda): a busca no Mercado
     Livre também começa sozinha. Segmento indeterminado fica sob demanda. */
  const mercadoLivreJunto =
    (origem === "amazon" || origem === "shopee") &&
    campeao?.player === "mercadolivre" &&
    campeao.segmento !== "geral";

  useEffect(() => {
    setTermo(analise.termoIdentificado ?? "");
  }, [analise.termoIdentificado]);

  async function buscar(texto: string, modo: "guiada" | "produto") {
    const q = texto.trim();
    if (q.length < 2 || busca.carregando) return;
    setConsulta({ q, contexto: "home", modo });
    setBusca({ carregando: true, erro: null, resposta: null });
    const r = await buscarProdutos(q, "home", modo);
    setBusca({ carregando: false, erro: r.erro, resposta: r.resposta });
  }

  /* Abre os players do começo, uma vez por link identificado. */
  useEffect(() => {
    if (identificando || !inicial) return;
    const marca = `${analise.urlLimpa}|${termoGarimpo ?? ""}`;
    if (automatica.current === marca) return;
    automatica.current = marca;
    setGarimpos({});
    setBusca(VAZIO);
    const comeco: PlayerAfiliado[] = [];
    if (inicial === "mercadolivre") {
      if (nomeTermo) comeco.push("mercadolivre");
    } else if (termoGarimpo) {
      comeco.push(inicial);
      if (mercadoLivreJunto && nomeTermo) comeco.push("mercadolivre");
    }
    setAbertos(comeco);
    if (comeco.includes("mercadolivre") && nomeTermo) void buscar(nomeTermo, "produto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analise.urlLimpa, termoGarimpo, identificando, inicial]);

  /* Texto digitado (busca universal, 27/10): busca o produto na hora, sem
     aviso de "link" nem pergunta antes. */
  useEffect(() => {
    if (origem !== "invalido" || !nomeTermo) return;
    if (automatica.current === `texto|${nomeTermo}`) return;
    automatica.current = `texto|${nomeTermo}`;
    setBusca(VAZIO);
    void buscar(nomeTermo, "guiada");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem, nomeTermo]);

  function abrir(p: PlayerAfiliado) {
    if (p === "mercadolivre" && !termoMl) return;
    setAbertos((a) => (a.includes(p) ? a : [...a, p]));
    if (p === "mercadolivre" && termoMl) void buscar(termoMl, "produto");
  }

  const atualizarGarimpo = useCallback((p: "amazon" | "shopee", m: MudancaGarimpo) => {
    setGarimpos((g) =>
      g[p]?.status === m.status && g[p]?.resultado === m.resultado ? g : { ...g, [p]: m },
    );
  }, []);

  function pedidoPara(player: "amazon" | "shopee"): PedidoGarimpo | null {
    if (!termoGarimpo || !analise.urlLimpa) return null;
    const doPlayer = origem === player;
    return {
      player,
      origem: doPlayer ? player : origem === "amazon" || origem === "shopee" ? origem : "outro",
      url: analise.urlLimpa,
      termo: termoGarimpo,
      idOrigem: doPlayer ? (analise.identificador ?? null) : null,
      loja: analise.nomeLoja ?? null,
      preco: doPlayer ? null : (lidoNaOrigem?.preco ?? analise.precoOrigem ?? null),
      imagem: doPlayer ? null : (lidoNaOrigem?.imagem ?? analise.imagemOrigem ?? null),
    };
  }

  const linkAmazon =
    origem === "amazon" && analise.identificador
      ? gerarUrlAfiliadoAmazon(analise.identificador)
      : null;
  const nome = nomeTermo ? nomeParaTela(nomeTermo) : null;
  const semNome = !identificando && !nome && !(origem === "amazon" && analise.identificador);

  function enviar(e: FormEvent) {
    e.preventDefault();
    void buscar(termo, origem === "invalido" ? "guiada" : "produto");
  }

  const lojaDoLink =
    origem === "amazon"
      ? "Amazon"
      : origem === "shopee"
        ? "Shopee"
        : origem === "invalido"
          ? null
          : (analise.nomeLoja ?? "").replace(/^www\./, "") || null;

  /* Preço de referência: o lido na loja do link (servidor) ou no próprio
     player (extensão). Sem ele, nada de economia calculada. */
  const referencia =
    origem === "outro_player" ? (analise.precoOrigem ?? null) : (lidoNaOrigem?.preco ?? null);
  const tituloAncora = lidoNaOrigem?.titulo ?? nome;
  const imagemAncora =
    origem === "outro_player" ? (analise.imagemOrigem ?? null) : (lidoNaOrigem?.imagem ?? null);
  const linkAncora =
    linkAmazon && ehLinkDeCompra(linkAmazon, "amazon")
      ? linkAmazon
      : origem === "shopee" && ehLinkDeCompra(lidoNaOrigem?.link, "shopee")
        ? lidoNaOrigem!.link
        : null;
  const lendoNaOrigem =
    (origem === "amazon" || origem === "shopee") &&
    abertos.includes(origem) &&
    (garimpos[origem]?.status ?? "carregando") === "carregando";

  const ordemPlacar: PlayerAfiliado[] = inicial
    ? [inicial, ...ORDEM.filter((p) => p !== inicial)]
    : ORDEM;

  const estados: EstadoPlayer[] = useMemo(
    () =>
      ordemPlacar.map((p) => {
        if (p === "mercadolivre") {
          if (!abertos.includes("mercadolivre")) return estadoDoMercadoLivre("nao_consultado", []);
          const status = busca.carregando
            ? "carregando"
            : busca.erro
              ? "erro"
              : busca.resposta
                ? "pronto"
                : "carregando";
          return estadoDoMercadoLivre(status, busca.resposta?.resultados ?? []);
        }
        if (!abertos.includes(p)) return estadoDoGarimpo(p, "nao_consultado", null, false);
        const g = garimpos[p];
        const status = !g || g.status === "nao_consultado" ? "carregando" : g.status;
        return estadoDoGarimpo(p, status, g?.resultado ?? null, origem === p);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abertos, busca, garimpos, origem, inicial],
  );
  const veredito = vereditoDoGarimpo(referencia, estados);
  const vencedor = vencedorDoPlacar(veredito, estados);
  const ofertaVencedora =
    veredito.tipo === "economia" || veredito.tipo === "melhor_do_mesmo" ? veredito.oferta : null;

  /* Menor preço da busca no Mercado Livre (não conferido pela foto). */
  const menorNoMl = estados.find((e) => e.player === "mercadolivre")?.melhor?.preco ?? null;
  const rotuloMl = rotuloMercadoLivre(
    menorNoMl,
    referencia,
    estados
      .filter(
        (e) =>
          e.player !== "mercadolivre" &&
          (e.melhor?.relacao === "mesmo" || e.melhor?.relacao === "parecido"),
      )
      .map((e) => ({ player: e.player, preco: e.melhor!.preco })),
  );

  /* A melhor compra para a barra do celular: só com link de afiliado. */
  const compra:
    | (Pick<OfertaPlacar, "titulo" | "imagem" | "prime"> & {
        preco: number | null;
        link: string;
      })
    | null = useMemo(() => {
    const o =
      ofertaVencedora ??
      (veredito.tipo === "melhor_preco"
        ? (estados.find((e) => e.melhor?.relacao === "seu")?.melhor ?? null)
        : null);
    if (o && (o.player === "amazon" || o.player === "shopee") && ehLinkDeCompra(o.link, o.player))
      return { titulo: o.titulo, imagem: o.imagem, prime: o.prime, preco: o.preco, link: o.link };
    if (linkAncora)
      return {
        titulo: tituloAncora ?? "O produto do seu link",
        imagem: imagemAncora,
        prime: false,
        preco: referencia,
        link: linkAncora,
      };
    return null;
  }, [ofertaVencedora, veredito.tipo, estados, linkAncora, tituloAncora, imagemAncora, referencia]);

  const raiz = useRef<HTMLDivElement | null>(null);
  const topo = useRef<HTMLDivElement | null>(null);

  const mostrarPlacar =
    origem !== "invalido" && !identificando && (Boolean(termoGarimpo) || Boolean(termoMl));

  return (
    <div ref={raiz} className="mt-4 space-y-4" data-origem={`link_${origem}`} aria-live="polite">
      {origem !== "invalido" && (
        <div ref={topo} className="space-y-3">
          <CartaoAncora
            loja={lojaDoLink}
            identificando={identificando}
            titulo={tituloAncora}
            imagem={imagemAncora}
            preco={referencia}
            lendo={lendoNaOrigem}
            link={linkAncora}
            prime={lidoNaOrigem?.selos.includes("Prime") ?? false}
            frase={origem === "outro_player" && nome && campeao ? campeao.frase : null}
          />
          {mostrarPlacar && <BannerVeredito veredito={veredito} />}
        </div>
      )}

      {mostrarPlacar && (
        <PlacarDosTres
          estados={estados}
          vencedor={vencedor}
          veredito={veredito}
          referencia={referencia}
          podeAbrir={(p) => (p === "mercadolivre" ? Boolean(termoMl) : Boolean(termoGarimpo))}
          abrir={abrir}
          comparar={comparar}
          buscaAmazon={termoGarimpo ? urlBuscaAmazon(termoGarimpo) : null}
        />
      )}

      {/* As ofertas de cada player, na ordem do placar. */}
      {ordemPlacar.map((p) => {
        if (!abertos.includes(p)) return null;
        if (p === "mercadolivre") {
          if (!termoMl || origem === "invalido") return null;
          return (
            <section
              key={p}
              id="secao-garimpo-mercadolivre"
              className="scroll-mt-36 rounded-3xl border border-black/5 bg-card p-4 shadow-sm dark:border-white/10 sm:p-5"
            >
              <p className="text-[12px] font-semibold text-secondary-ink">No Mercado Livre</p>
              {busca.carregando ? (
                <p className="mt-1 inline-flex items-center gap-2 text-sm text-secondary-ink">
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Buscando o melhor preço para você no Mercado Livre…
                </p>
              ) : busca.resposta ? (
                <>
                  <h3
                    className={
                      "mt-0.5 text-[17px] font-bold leading-snug tracking-tight " +
                      (rotuloMl.tipo === "menor"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-foreground")
                    }
                  >
                    {rotuloMl.titulo}
                  </h3>
                  {rotuloMl.detalhe && (
                    <p className="mt-0.5 text-[13px] text-secondary-ink">{rotuloMl.detalhe}</p>
                  )}
                  <p className="mt-1 text-[12px] text-secondary-ink">
                    Só na mesma categoria do seu produto. Toque em “Comparar preço” no que for igual
                    ao seu.
                  </p>
                </>
              ) : null}
              {(busca.carregando || busca.erro || busca.resposta) && (
                <ResultadosDaBusca
                  compacto
                  carregando={busca.carregando}
                  erro={busca.erro}
                  resposta={busca.resposta}
                  comparar={comparar}
                  consulta={consulta}
                  semResultado="Não achei este produto com anúncio ativo nas lojas do Mercado Livre agora, na mesma categoria. Tente escrever o nome de outro jeito."
                />
              )}
            </section>
          );
        }
        const pedido = pedidoPara(p);
        return pedido ? (
          <GarimpoNoPlayer
            key={p}
            pedido={pedido}
            auto
            referencia={referencia}
            destaqueId={ofertaVencedora?.player === p ? ofertaVencedora.id : null}
            aoMudar={(m) => atualizarGarimpo(p, m)}
          />
        ) : null;
      })}

      {/* Sem nome no link: a pessoa escreve. */}
      {semNome && (
        <form onSubmit={enviar} className="flex max-w-xl gap-2" role="search">
          <label htmlFor={idCampo} className="sr-only">
            Qual é o produto?
          </label>
          <input
            id={idCampo}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            maxLength={160}
            placeholder="Qual é o produto? Ex.: Echo Dot 5ª geração"
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm text-foreground placeholder:text-[#86868b] focus:outline-none focus-visible:border-[#0071e3] focus-visible:ring-4 focus-visible:ring-[#0071e3]/20"
          />
          <button
            type="submit"
            disabled={busca.carregando || termo.trim().length < 2}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            <Search className="size-4" aria-hidden="true" />
            Buscar
          </button>
        </form>
      )}

      {/* Texto solto ou nome digitado: a busca guiada de sempre. */}
      {(origem === "invalido" || semNome) && (busca.carregando || busca.erro || busca.resposta) && (
        <ResultadosDaBusca
          compacto
          carregando={busca.carregando}
          erro={busca.erro}
          resposta={busca.resposta}
          comparar={comparar}
          consulta={consulta}
          buscarTermo={(t) => void buscar(t, "guiada")}
          semResultado="Não achei este produto com anúncio ativo nas lojas do Mercado Livre agora, na mesma categoria. Tente escrever o nome de outro jeito."
        />
      )}

      {compra && <BarraDeCompra compra={compra} raiz={raiz} topo={topo} />}
    </div>
  );
}

/* ---------- 1. O produto do link ---------- */

function CartaoAncora({
  loja,
  identificando,
  titulo,
  imagem,
  preco,
  lendo,
  link,
  prime,
  frase,
}: {
  loja: string | null;
  identificando: boolean;
  titulo: string | null;
  imagem: string | null;
  preco: number | null;
  lendo: boolean;
  link: string | null;
  prime: boolean;
  frase: string | null;
}) {
  return (
    <article className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 sm:size-20">
          {imagem ? (
            <img
              src={imagem}
              alt=""
              width={80}
              height={80}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="absolute inset-0 h-full w-full object-contain p-1.5"
            />
          ) : (
            <div
              className={
                "grid h-full w-full place-items-center bg-[#f5f5f7] dark:bg-white/10 " +
                (identificando || lendo ? "animate-pulse" : "")
              }
            >
              <Store className="size-6 text-[#86868b]" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-[11px] font-semibold text-secondary-ink dark:bg-white/10">
            {loja ? `Visto na ${loja}` : "Visto na loja do link"}
          </span>
          {identificando ? (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-secondary-ink">
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Identificando o produto…
            </p>
          ) : titulo ? (
            <h3 className="mt-1.5 line-clamp-2 text-[15px] font-bold leading-snug text-foreground sm:text-base">
              {titulo}
            </h3>
          ) : (
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              Não consegui ler o nome do produto neste link.
            </p>
          )}
          {!identificando && (
            <div className="mt-1.5">
              {preco != null ? (
                <p className="leading-tight">
                  <span className="block text-[11px] text-secondary-ink">Preço de referência</span>
                  <span className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">
                    {brl(preco)}
                  </span>
                </p>
              ) : lendo ? (
                <div
                  className="h-7 w-28 animate-pulse rounded-full bg-[#f5f5f7] dark:bg-white/10"
                  aria-label="Lendo o preço"
                />
              ) : (
                <p className="text-[12px] text-secondary-ink">
                  Não consegui ler o preço deste link.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {frase && <p className="mt-3 text-[12px] text-secondary-ink">{frase}</p>}
      {link && (
        <div className="mt-3 sm:max-w-xs">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            data-origem="link_colado"
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-success px-4 text-[13px] font-bold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Comprar com segurança
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </a>
          <p className="mt-1 text-[11px] text-secondary-ink">
            {prime ? "Frete grátis para assinantes Prime" : "Frete: confira no anúncio"}
          </p>
        </div>
      )}
    </article>
  );
}

/* ---------- 2. O veredito ---------- */

function BannerVeredito({ veredito: v }: { veredito: Veredito }) {
  if (v.tipo === "nenhum") return null;
  if (v.tipo === "conferindo")
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-[#f5f5f7] p-4 dark:bg-white/5">
        <Loader2
          className="size-5 shrink-0 animate-spin text-[#0071e3] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div>
          <p className="text-[15px] font-bold text-foreground">{v.titulo}</p>
          <p className="text-[12px] text-secondary-ink">{v.subtitulo}</p>
        </div>
      </div>
    );
  if (v.tipo === "melhor_preco")
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] p-4 sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[17px] font-bold leading-snug text-foreground">{v.titulo}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-secondary-ink">{v.subtitulo}</p>
        </div>
      </div>
    );
  const o = v.oferta;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-white shadow-sm sm:p-5">
      <p className="flex items-start gap-2 text-lg font-extrabold leading-snug sm:text-xl">
        <span className="animate-fogo inline-block" aria-hidden="true">
          🔥
        </span>
        <span>{v.titulo}</span>
      </p>
      <p className="mt-1 text-[13px] text-white/90">{v.subtitulo}</p>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/10 p-2.5">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white">
          {o.imagem ? (
            <img
              src={o.imagem}
              alt=""
              width={48}
              height={48}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="absolute inset-0 h-full w-full object-contain p-1"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="line-clamp-1 text-[12px] text-white/90">{o.titulo}</p>
          <p className="text-base font-extrabold tabular-nums">
            {brl(o.preco)} {naPlayer(o.player)}
          </p>
          <p className="text-[11px] text-white/85">
            {o.prime ? "Frete grátis para assinantes Prime" : "Frete: confira no anúncio"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {o.link && (
          <a
            href={o.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            data-origem="garimpo_veredito"
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-bold text-emerald-700 transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-none"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Comprar com segurança
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </a>
        )}
        <button
          type="button"
          onClick={() => rolarAte(`secao-garimpo-${o.player}`)}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-4 text-[13px] font-semibold text-white/95 ring-1 ring-white/40 transition hover:bg-white/10"
        >
          Ver detalhes <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 3. O placar dos 3 ---------- */

function PlacarDosTres({
  estados,
  vencedor,
  veredito,
  referencia,
  podeAbrir,
  abrir,
  comparar,
  buscaAmazon,
}: {
  estados: EstadoPlayer[];
  vencedor: PlayerAfiliado | null;
  veredito: Veredito;
  referencia: number | null;
  podeAbrir: (p: PlayerAfiliado) => boolean;
  abrir: (p: PlayerAfiliado) => void;
  comparar: (url: string) => void;
  buscaAmazon: string | null;
}) {
  /* No celular (trilho com rolagem lateral), o vencedor aparece primeiro
     na tela quando muda. */
  const trilho = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    const ul = trilho.current;
    if (!ul || !vencedor || ul.scrollWidth <= ul.clientWidth + 4) return;
    const item = ul.querySelector<HTMLElement>(`[data-player="${vencedor}"]`);
    if (!item) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ul.scrollTo({
      left: item.offsetLeft - ul.offsetLeft - 12,
      behavior: reduzir ? "auto" : "smooth",
    });
  }, [vencedor]);
  const seloVencedor =
    veredito.tipo === "economia" && veredito.similar
      ? "Modelo similar mais barato"
      : veredito.tipo === "melhor_preco"
        ? "Melhor valor"
        : "Menor valor encontrado";
  return (
    <section
      aria-labelledby="titulo-placar"
      className="rounded-3xl bg-[#f5f5f7] p-3 dark:bg-white/5 sm:p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <h3 id="titulo-placar" className="text-[15px] font-bold tracking-tight text-foreground">
          Compare com clareza
        </h3>
        <p className="text-[11px] text-secondary-ink">
          Preço, frete e correspondência em cada loja
        </p>
      </div>
      <ul
        ref={trilho}
        className="-mx-3 mt-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 pt-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {estados.map((e) => (
          <li
            key={e.player}
            data-player={e.player}
            className="flex w-[80%] shrink-0 snap-start sm:w-auto"
          >
            <CartaoPlacar
              estado={e}
              vence={vencedor === e.player}
              seloVencedor={seloVencedor}
              referencia={referencia}
              podeAbrir={podeAbrir(e.player)}
              abrir={() => abrir(e.player)}
              comparar={comparar}
              buscaAmazon={e.player === "amazon" ? buscaAmazon : null}
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 px-1 text-[11px] leading-snug text-secondary-ink">
        Links de afiliado. O frete depende do seu CEP: confira no anúncio. Site independente, sem
        vínculo com as lojas; as marcas pertencem aos seus titulares.
      </p>
    </section>
  );
}

function CartaoPlacar({
  estado: e,
  vence,
  seloVencedor,
  referencia,
  podeAbrir,
  abrir,
  comparar,
  buscaAmazon,
}: {
  estado: EstadoPlayer;
  vence: boolean;
  seloVencedor: string;
  referencia: number | null;
  podeAbrir: boolean;
  abrir: () => void;
  comparar: (url: string) => void;
  buscaAmazon: string | null;
}) {
  const m = e.melhor;
  const ml = e.player === "mercadolivre";
  const naoConsultado = e.status === "nao_consultado";
  const correspondencia = !m
    ? null
    : m.relacao === "seu"
      ? { texto: "O seu link", cor: "bg-[#0071e3]/10 text-[#0071e3]" }
      : m.relacao === "mesmo"
        ? {
            texto: "✓ Mesmo produto",
            cor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
          }
        : m.relacao === "parecido"
          ? {
              texto: "Parecido",
              cor: "bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
            }
          : {
              texto: ml ? "Opções similares" : "Encontrado pela busca",
              cor: "bg-white text-secondary-ink dark:bg-white/10",
            };
  const diferenca = m && m.relacao !== "seu" ? diferencaNoProduto(m.preco, referencia) : null;
  return (
    <article
      className={
        "relative flex w-full flex-col rounded-2xl border bg-card p-4 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none " +
        (vence
          ? "border-emerald-500/60 shadow-md ring-2 ring-emerald-500/40 motion-safe:sm:-translate-y-1"
          : naoConsultado
            ? "border-dashed border-black/10 bg-card/60 dark:border-white/15"
            : "border-black/5 shadow-sm dark:border-white/10")
      }
    >
      {vence && (
        <span className="absolute -top-3 left-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
          <span className="animate-fogo inline-block" aria-hidden="true">
            🔥
          </span>
          {seloVencedor}
        </span>
      )}
      <p className="text-[13px] font-bold text-secondary-ink">{NOME_PLAYER[e.player]}</p>

      {naoConsultado ? (
        <div className="mt-2 flex flex-1 flex-col">
          {/* Valores borrados SEM número por trás (10/10): só a forma. */}
          <div aria-hidden="true" className="space-y-2 opacity-60 blur-[2px]">
            <div className="h-4 w-24 rounded-full bg-[#e8e8ed] dark:bg-white/10" />
            <div className="h-6 w-28 rounded-full bg-[#e8e8ed] dark:bg-white/10" />
            <div className="h-3 w-32 rounded-full bg-[#e8e8ed] dark:bg-white/10" />
          </div>
          <p className="mt-3 text-[12px] text-secondary-ink">Ainda não comparado</p>
          <div className="mt-auto pt-3">
            {podeAbrir ? (
              <button
                type="button"
                onClick={abrir}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-[13px] font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
              >
                <Search className="size-4" aria-hidden="true" />
                Ver preço
              </button>
            ) : (
              <p className="text-[11px] text-secondary-ink">
                Disponível quando o produto for lido.
              </p>
            )}
          </div>
        </div>
      ) : e.status === "carregando" ? (
        <div className="mt-2 flex flex-1 flex-col" aria-label="Conferindo">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded-full bg-[#f5f5f7] dark:bg-white/10" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-[#f5f5f7] dark:bg-white/10" />
            <div className="h-3 w-32 animate-pulse rounded-full bg-[#f5f5f7] dark:bg-white/10" />
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-secondary-ink">
            <Loader2
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Conferindo…
          </p>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-1 flex-col">
          <dl className="space-y-2 text-[13px]">
            <div>
              <dt className="sr-only">Correspondência</dt>
              <dd>
                {correspondencia ? (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${correspondencia.cor}`}
                  >
                    {correspondencia.texto}
                  </span>
                ) : (
                  <span className="text-[12px] font-semibold text-secondary-ink">
                    {e.status === "erro"
                      ? "Não respondeu agora"
                      : "Sem modelo compatível nesta análise"}
                  </span>
                )}
              </dd>
            </div>
            {m && (
              <div>
                <dt className="text-[11px] text-secondary-ink">
                  {ml ? "A partir de" : m.relacao === "seu" ? "Preço do seu link" : "Preço"}
                </dt>
                <dd className="text-xl font-extrabold tabular-nums tracking-tight text-foreground">
                  {brl(m.preco)}
                </dd>
                {diferenca && (
                  <dd
                    className={
                      "text-[12px] font-semibold " +
                      (diferenca.menos && !ml
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-secondary-ink")
                    }
                  >
                    {diferenca.texto}
                  </dd>
                )}
                {ml && <dd className="text-[11px] text-secondary-ink">Não conferido pela foto</dd>}
              </div>
            )}
            {m && (
              <div>
                <dt className="sr-only">Frete</dt>
                <dd className="text-[11px] text-secondary-ink">
                  {m.prime ? "Frete grátis para assinantes Prime" : "Frete: confira no anúncio"}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-auto space-y-1.5 pt-3">
            {m && !ml && m.link ? (
              <a
                href={m.link}
                target="_blank"
                rel="noopener noreferrer sponsored"
                data-origem={`placar_${e.player}`}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-success px-4 text-[13px] font-bold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
              >
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                Comprar com segurança
                <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </a>
            ) : m && ml && m.link ? (
              <button
                type="button"
                onClick={() => comparar(m.link!)}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-[#0071e3] px-4 text-[13px] font-bold text-[#0071e3] transition hover:bg-[#0071e3]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
              >
                Comparar preço
              </button>
            ) : !m && buscaAmazon && ehLinkDeCompra(buscaAmazon, "amazon") ? (
              <a
                href={buscaAmazon}
                target="_blank"
                rel="noopener noreferrer sponsored"
                data-origem="placar_amazon_busca"
                className="flex min-h-11 w-full items-center justify-center gap-1 rounded-full border border-border px-4 text-[13px] font-semibold text-foreground hover:bg-[#f5f5f7] dark:hover:bg-white/10"
              >
                Conferir na loja <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
            {(m || e.status === "erro") && (
              <button
                type="button"
                onClick={() => rolarAte(`secao-garimpo-${e.player}`)}
                className="flex min-h-9 w-full items-center justify-center gap-1 text-[12px] font-semibold text-[#0071e3]"
              >
                {e.status === "erro" ? "Tentar de novo" : "Ver opções"}
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/* ---------- 5. A barra de compra do celular ---------- */

function BarraDeCompra({
  compra,
  raiz,
  topo,
}: {
  compra: {
    titulo: string;
    imagem: string | null;
    prime: boolean;
    preco: number | null;
    link: string;
  };
  raiz: RefObject<HTMLDivElement | null>;
  topo: RefObject<HTMLDivElement | null>;
}) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const t = topo.current?.getBoundingClientRect();
      const r = raiz.current?.getBoundingClientRect();
      setVisivel(Boolean(t && r && t.bottom < 0 && r.bottom > 160));
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
  }, [raiz, topo]);
  /* Início / topo sobem junto (só no celular). */
  useEffect(() => {
    const doc = document.documentElement;
    const celular = window.matchMedia?.("(max-width: 639px)").matches;
    doc.style.setProperty("--folga-compra", visivel && celular ? "84px" : "0px");
    /* As abas do celular descem enquanto a compra está na tela. */
    doc.toggleAttribute("data-compra", Boolean(visivel && celular));
    return () => {
      doc.style.setProperty("--folga-compra", "0px");
      doc.removeAttribute("data-compra");
    };
  }, [visivel]);
  return (
    <div
      className={
        "fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/90 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none dark:border-white/10 dark:bg-neutral-900/90 sm:hidden " +
        (visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0")
      }
      aria-hidden={!visivel}
    >
      <div className="flex items-center gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
          {compra.imagem ? (
            <img
              src={compra.imagem}
              alt=""
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="absolute inset-0 h-full w-full object-contain p-0.5"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          {compra.preco != null ? (
            <p className="text-[17px] font-bold tabular-nums text-foreground">
              {brl(compra.preco)}
            </p>
          ) : (
            <p className="truncate text-[13px] font-semibold text-foreground">{compra.titulo}</p>
          )}
          <p className="text-[11px] text-secondary-ink">
            {compra.prime ? "Frete grátis para assinantes Prime" : "Frete: confira no anúncio"}
          </p>
        </div>
        <a
          href={compra.link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          tabIndex={visivel ? 0 : -1}
          data-origem="garimpo_barra"
          className="inline-flex h-11 max-w-[58%] shrink-0 items-center gap-1.5 rounded-full bg-success px-4 text-[13px] font-bold leading-tight text-white active:scale-[0.98]"
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <span>Comprar com segurança</span>
          <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
