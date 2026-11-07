/* "VER DETALHES" NOS CARTÕES DA VITRINE (Weslei, 05/10: "dê a opção de
   expandir o anúncio para analisar detalhes, descrição, características").
   Abre um painel com o que a comparação leu no anúncio: foto, título,
   características, destaques e descrição (RPC pública detalhes_da_vitrine).
   Preço é o de quando foi comparado, com a data. Rodapé fixo com Comprar
   (sempre link de afiliado) e Comparar preço. Nada é inventado: sem detalhes guardados,
   o painel diz isso e oferece comparar de novo. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Images,
  LoaderCircle,
  MessageCircle,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  abrirComparacao,
  CompararPreco,
  ComprarComSeguranca,
  SinoAcompanhar,
} from "@/components/BotoesCartao";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { CoracaoDesejo } from "@/components/CoracaoDesejo";
import { acoesDoProduto } from "@/lib/afiliado";
import { buscarLinkAfiliado, itemDoProduto, linkWhatsApp } from "@/lib/lista-desejos";
import { itemDoEndereco } from "@/lib/avaliacoes-detalhe";
import { propsFotoGrande } from "@/lib/foto";
import { registrarAcaoVisitante } from "@/lib/perfil-visitante";

type Carac = { nome: string; valor: string };
type Detalhes = {
  caracteristicas?: Carac[] | null;
  destaques?: string[] | null;
  descricao?: string | null;
};
type Resposta = {
  titulo: string | null;
  imagem: string | null;
  detalhes: Detalhes | null;
  comparado_em: string | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cache = new Map<string, Resposta | null>();
const fotosCache = new Map<string, string[]>();
const fichaCache = new Map<string, Carac[]>();
/* Endereço padrão do mlstatic (-O): chave da galeria e miniaturas; a foto
   aberta usa a original (propsFotoGrande). */
const fotoGrande = (u: string) =>
  u.replace(/^http:/, "https:").replace(/-[A-Z](\.(?:webp|jpg|jpeg|png))$/i, "-O$1");

const dataCurta = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : null;

export function VerDetalhesVitrine({
  chave,
  titulo,
  imagem,
  preco,
  link,
  vistoEm,
  urlProduto,
  className = "",
  rotulo = "Ver fotos e detalhes",
  gatilho = null,
  detalhes,
  fotos,
  compra,
  coracao = false,
}: {
  chave: string;
  titulo: string;
  imagem?: string | null;
  preco?: number | null;
  link?: string | null;
  vistoEm?: string | null;
  /* Endereço do produto: o id do catálogo (/p/MLB...) traz a galeria. */
  urlProduto?: string | null;
  className?: string;
  rotulo?: string;
  /* A FOTO DO CARTÃO abre os detalhes (Weslei, 18/10: "mostrar as principais
     diferenças, mas que mais detalhes sejam consultados"). Sem detalhes
     possíveis, a foto aparece sem botão. */
  gatilho?: ReactNode;
  /* Detalhes já lidos na comparação (27/10): dispensam a busca no banco. */
  detalhes?: Detalhes | null;
  /* Fotos já conhecidas (segunda foto do catálogo, Amazon, Shopee): entram
     na galeria mesmo sem anúncio do Mercado Livre (Weslei, 27/10: carrossel
     em todo o site). */
  fotos?: (string | null | undefined)[] | null;
  /* Botão de compra do rodapé quando não há link pronto (ex.: VerNaLoja,
     que gera o link de afiliado no clique). */
  compra?: ReactNode;
  /* Wishlist heart over the photo corner (05/11); the card must be `relative`. */
  coracao?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const abrirRef = useRef<() => void>(() => {});
  /* Tapping anywhere on the card opens the details (Weslei, 07/11: "Sempre
     deve abrir detalhes em todos os anúncios e vitrines"). Buttons and links
     inside the card keep their own action. */
  useEffect(() => {
    const cartao = botao.current?.parentElement?.closest<HTMLElement>("article, li, [data-cartao]");
    if (!cartao || cartao.dataset["detalhes"]) return;
    /* Several products in one box (e.g. a list): only the photo opens. */
    const outros = cartao.querySelectorAll<HTMLElement>("[data-detalhes-chave]");
    if ([...outros].some((b) => b.dataset["detalhesChave"] !== chave)) return;
    cartao.dataset["detalhes"] = chave;
    cartao.classList.add("cursor-pointer");
    const aoTocar = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo || e.defaultPrevented) return;
      const ativo = alvo.closest(
        "a, button, input, select, textarea, label, summary, dialog, [role=button], [role=dialog]",
      );
      /* A link wrapping the whole card (it holds the photo) counts as the card. */
      const envolve = ativo?.tagName === "A" && botao.current && ativo.contains(botao.current);
      if (ativo && !envolve && ativo !== cartao && cartao.contains(ativo)) return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      abrirRef.current();
    };
    cartao.addEventListener("click", aoTocar);
    return () => {
      cartao.removeEventListener("click", aoTocar);
      cartao.classList.remove("cursor-pointer");
      delete cartao.dataset["detalhes"];
    };
  }, [chave]);
  /* Abrir fotos e detalhes é interesse aprofundado (+4 no perfil local). */
  const abrir = () => {
    setAberto(true);
    registrarAcaoVisitante({
      tipo: "detalhes",
      produto: {
        chave,
        titulo,
        preco: preco ?? null,
        foto: imagem ?? null,
        url: urlProduto ?? null,
      },
    });
  };
  abrirRef.current = abrir;
  /* Anúncio do Mercado Livre (detalhes e galeria oficial); sem ele, o
     carrossel abre só com as fotos que já temos. */
  const mlb = /^MLB\d{5,}$/.test(chave)
    ? chave
    : (itemDoEndereco(urlProduto)?.replace(/^MLBP/, "MLB") ?? null);
  const extras = (fotos ?? []).filter((u): u is string => !!u);
  const canto =
    coracao && gatilho ? (
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
        <CoracaoDesejo
          compacto
          produto={{ chave, titulo, preco, foto: imagem, url: urlProduto, link }}
        />
        <BotaoWhatsApp produto={{ chave, titulo, preco, foto: imagem, url: urlProduto, link }} />
      </div>
    ) : null;
  if (!mlb && !imagem && !extras.length)
    return gatilho ? (
      <>
        {gatilho}
        {canto}
      </>
    ) : null;
  return (
    <>
      {canto}
      {gatilho ? (
        <button
          ref={botao}
          data-detalhes-chave={chave}
          type="button"
          onClick={(e) => {
            /* A foto nunca leva para fora (link do cartão pai). */
            e.stopPropagation();
            e.preventDefault();
            abrir();
          }}
          aria-label={`Ver fotos e detalhes: ${titulo}`}
          className={`${/(^|\s)(hidden|flex|grid)(\s|$)/.test(className) ? "" : "block "}cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0071e3] ${className}`}
        >
          {gatilho}
        </button>
      ) : (
        <button
          ref={botao}
          data-detalhes-chave={chave}
          type="button"
          onClick={abrir}
          className={`inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-[#0058b0] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${className}`}
        >
          <Images className="size-3.5" aria-hidden="true" />
          {rotulo}
        </button>
      )}
      {aberto && (
        <Painel
          chave={chave}
          titulo={titulo}
          imagem={imagem ?? null}
          preco={preco ?? null}
          link={link ?? null}
          vistoEm={vistoEm ?? null}
          mlb={mlb}
          produto={/\/p\/(MLB\d+)/i.exec(urlProduto ?? "")?.[1]?.toUpperCase() ?? mlb}
          fotos={extras}
          compra={compra}
          urlProduto={urlProduto ?? null}
          inicial={
            detalhes ? { titulo, imagem: imagem ?? null, detalhes, comparado_em: null } : undefined
          }
          fechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

function Painel({
  chave,
  titulo,
  imagem,
  preco,
  link,
  vistoEm,
  mlb,
  produto,
  fotos,
  compra,
  urlProduto,
  inicial,
  fechar,
}: {
  chave: string;
  titulo: string;
  imagem: string | null;
  preco: number | null;
  link: string | null;
  vistoEm: string | null;
  mlb: string | null;
  produto: string | null;
  fotos: string[];
  compra: ReactNode;
  urlProduto: string | null;
  inicial?: Resposta | undefined;
  fechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [dados, setDados] = useState<Resposta | null | undefined>(
    inicial ?? (mlb ? cache.get(chave) : null),
  );
  const [descricaoToda, setDescricaoToda] = useState(false);
  /* Menos informação de cara (Weslei, 18/10): destaques à vista;
     características e descrição abrem quando a pessoa quiser. */
  const [verCarac, setVerCarac] = useState(false);
  const [verDescricao, setVerDescricao] = useState(false);
  const [todosDestaques, setTodosDestaques] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    if (inicial || !mlb || cache.has(chave)) return;
    let vivo = true;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("detalhes_da_vitrine", { p_chave: mlb });
        const r = (Array.isArray(data) ? data[0] : null) as Resposta | null;
        cache.set(chave, r ?? null);
        if (vivo) setDados(r ?? null);
      } catch {
        if (vivo) setDados(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [chave, mlb, inicial]);

  /* Galeria: a foto do anúncio e as do catálogo oficial (ou, sem catálogo,
     as do próprio anúncio: "sempre deve permitir ver mais fotos", 27/10). */
  const [doCatalogo, setDoCatalogo] = useState<string[] | null>(
    produto ? (fotosCache.get(produto) ?? null) : [],
  );
  const [ficha, setFicha] = useState<Carac[] | null>(
    produto ? (fichaCache.get(produto) ?? null) : [],
  );
  const [atual, setAtual] = useState(0);
  const trilho = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!produto || fotosCache.has(produto)) return;
    let vivo = true;
    fetch(`/api/public/fotos?produto=${produto}`)
      .then((r) => r.json())
      .then((j: { fotos?: string[]; ficha?: Carac[] }) => {
        const f = Array.isArray(j.fotos) ? j.fotos : [];
        const fi = Array.isArray(j.ficha) ? j.ficha : [];
        fotosCache.set(produto, f);
        fichaCache.set(produto, fi);
        if (vivo) {
          setDoCatalogo(f);
          setFicha(fi);
        }
      })
      .catch(() => {
        if (vivo) {
          setDoCatalogo([]);
          setFicha([]);
        }
      });
    return () => {
      vivo = false;
    };
  }, [produto]);

  const lidas = (dados?.detalhes?.caracteristicas ?? []).filter((c) => c && c.nome && c.valor);
  /* Sem características lidas na comparação, a ficha técnica oficial. */
  const carac = lidas.length ? lidas : (ficha ?? []);
  const det = dados?.detalhes ?? (carac.length ? { caracteristicas: carac } : null);
  const dest = (det?.destaques ?? []).filter(Boolean);
  const descricao = (det?.descricao ?? "").trim();
  const longa = descricao.length > 420;
  const foto = imagem ?? dados?.imagem ?? null;
  const galeria = [
    ...new Set(
      [foto, ...fotos, ...(doCatalogo ?? [])].filter((u): u is string => !!u).map(fotoGrande),
    ),
  ];
  const n = galeria.length;
  const ir = (k: number) => {
    const alvo = ((k % n) + n) % n;
    setAtual(alvo);
    const el = trilho.current;
    if (el) el.scrollTo({ left: alvo * el.clientWidth, behavior: "smooth" });
  };
  const data = dataCurta(vistoEm ?? dados?.comparado_em ?? null);
  const acoes = acoesDoProduto(link, urlProduto);
  const [zoom, setZoom] = useState(false);
  /* The heart needs an ML address or a ready link; a listing id is enough. */
  const desejo = {
    chave,
    titulo,
    preco,
    foto,
    link: acoes.comprar && "href" in acoes.comprar ? acoes.comprar.href : link,
    url:
      urlProduto ??
      (acoes.comprar && "gerar" in acoes.comprar ? acoes.comprar.gerar : null) ??
      (mlb ? `https://produto.mercadolivre.com.br/${mlb.replace(/^MLB/, "MLB-")}` : null),
  }; /* Heart always in the details (Weslei, 06/11: "precisa ter a opção de
     coração SEMPRE") plus WhatsApp, both with his link; beside the photo
     counter so the header stays clean. */
  const atalhos = (
    <>
      <CoracaoDesejo compacto produto={desejo} />
      <BotaoWhatsApp produto={desejo} />
    </>
  );

  return (
    <dialog
      ref={ref}
      onClose={fechar}
      onKeyDown={(e) => {
        /* Setas do teclado passam as fotos (Esc fecha pelo próprio dialog). */
        if (n < 2) return;
        if (e.key === "ArrowLeft") ir(atual - 1);
        else if (e.key === "ArrowRight") ir(atual + 1);
        else return;
        e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby={`det-${chave}`}
      className="painel m-auto max-h-[88dvh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-border bg-white p-0 text-[#1d1d1f] shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <h3 id={`det-${chave}`} className="text-[15px] font-bold leading-snug">
              {titulo}
            </h3>
            {preco != null && (
              <p className="mt-1 text-lg font-extrabold tabular-nums">
                {brl(preco)}
                {data && (
                  <span className="ml-1.5 text-[11px] font-medium text-[#6e6e73]">
                    preço de {data}
                  </span>
                )}
              </p>
            )}
          </div>
          {n === 0 && <div className="flex shrink-0 items-center gap-1.5">{atalhos}</div>}
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] focus-visible:outline-2 focus-visible:outline-[#0071e3]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-[13px]">
          {n > 0 && (
            <section aria-label="Fotos do produto">
              {/* Carrossel (Weslei, 05/10: "deixe como carrossel"): desliza
                  com o dedo (scroll-snap), setas e miniaturas acompanham.
                  Nada por cima da foto (Weslei, 18/10: "não competindo com a
                  foto"): setas e contador ficam na linha de baixo. */}
              <ul
                ref={trilho}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                  if (k !== atual) setAtual(k);
                }}
                className="flex h-64 snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl bg-white ring-1 ring-black/5 [scrollbar-width:none] sm:h-80 [&::-webkit-scrollbar]:hidden"
                aria-label="Fotos do produto"
              >
                {galeria.map((u, k) => (
                  <li key={u} className="relative h-full w-full shrink-0 snap-center">
                    <button
                      type="button"
                      onClick={() => setZoom(true)}
                      aria-label={`Ampliar foto ${k + 1} de ${n}`}
                      className="absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0071e3]"
                    />
                    <img
                      {...propsFotoGrande(u)}
                      alt={`${titulo}: foto ${k + 1} de ${n}`}
                      loading={k === 0 ? "eager" : "lazy"}
                      referrerPolicy="no-referrer"
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain p-2"
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex justify-start">
                  <CoracaoDesejo compacto produto={desejo} />
                </div>
                {n > 1 ? (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => ir(atual - 1)}
                      aria-label="Foto anterior"
                      className="grid size-8 place-items-center vidro-botao rounded-full border border-border focus-visible:outline-2 focus-visible:outline-[#0071e3]"
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>
                    <span className="min-w-12 text-center text-[12px] font-semibold tabular-nums text-[#6e6e73]">
                      {Math.min(atual, n - 1) + 1} de {n}
                    </span>
                    <button
                      type="button"
                      onClick={() => ir(atual + 1)}
                      aria-label="Próxima foto"
                      className="grid size-8 place-items-center vidro-botao rounded-full border border-border focus-visible:outline-2 focus-visible:outline-[#0071e3]"
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#6e6e73]">Toque na foto para ampliar</span>
                )}
                <div className="flex justify-end">
                  <BotaoWhatsApp produto={desejo} />
                </div>
              </div>
              {n > 1 && (
                <ul className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Escolher foto">
                  {galeria.map((u, k) => (
                    <li key={u} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => ir(k)}
                        aria-label={`Foto ${k + 1}`}
                        aria-current={k === atual}
                        className={`relative block size-14 overflow-hidden rounded-xl bg-[#f5f5f7] ring-2 ${k === atual ? "ring-[#0071e3]" : "ring-transparent"}`}
                      >
                        <img
                          src={u}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 h-full w-full object-contain p-1 mix-blend-multiply"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {n > 1 && (
                <p className="mt-1 text-center text-[11px] text-[#6e6e73]">
                  Toque na foto para ampliar
                </p>
              )}
              {zoom && (
                <FotoAmpliada
                  galeria={galeria}
                  atual={Math.min(atual, n - 1)}
                  ir={ir}
                  titulo={titulo}
                  fechar={() => setZoom(false)}
                />
              )}
              {produto && doCatalogo === null && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#6e6e73]">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  Carregando mais fotos…
                </p>
              )}
            </section>
          )}
          {!mlb && !inicial ? null : dados === undefined || (!lidas.length && ficha === null) ? (
            <p className="flex items-center gap-2 text-[#6e6e73]">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Carregando os detalhes do anúncio…
            </p>
          ) : !det || (!carac.length && !dest.length && !descricao) ? (
            <p className="rounded-2xl bg-[#f5f5f7] p-3 text-[#424245]">
              Ainda não li as características deste anúncio. Confira no anúncio antes de comprar.
            </p>
          ) : (
            <>
              {dest.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
                    Destaques
                  </h4>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                    {dest.slice(0, todosDestaques ? 12 : 5).map((d, k) => (
                      <li key={k}>{d}</li>
                    ))}
                  </ul>
                  {dest.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setTodosDestaques((x) => !x)}
                      className="mt-1 font-semibold text-[#0058b0] hover:underline"
                    >
                      {todosDestaques
                        ? "Mostrar menos"
                        : `Ver todos os ${Math.min(12, dest.length)}`}
                    </button>
                  )}
                </section>
              )}
              {(carac.length > 0 || descricao) && (
                <div className="flex flex-wrap gap-2">
                  {carac.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setVerCarac((x) => !x)}
                      aria-expanded={verCarac}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#f5f5f7] px-3 text-[12px] font-semibold hover:bg-[#e8e8ed]"
                    >
                      {verCarac ? "Fechar características" : `Características (${carac.length})`}
                      <span aria-hidden="true">{verCarac ? "▴" : "▾"}</span>
                    </button>
                  )}
                  {descricao && (
                    <button
                      type="button"
                      onClick={() => setVerDescricao((x) => !x)}
                      aria-expanded={verDescricao}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#f5f5f7] px-3 text-[12px] font-semibold hover:bg-[#e8e8ed]"
                    >
                      {verDescricao ? "Fechar descrição" : "Descrição do anúncio"}
                      <span aria-hidden="true">{verDescricao ? "▴" : "▾"}</span>
                    </button>
                  )}
                </div>
              )}
              {verCarac && carac.length > 0 && (
                <section aria-label="Características">
                  <table className="w-full border-collapse overflow-hidden rounded-xl">
                    <tbody>
                      {carac.slice(0, 40).map((c, k) => (
                        <tr key={k} className={k % 2 ? "bg-white" : "bg-[#f5f5f7]"}>
                          <th className="w-2/5 px-2 py-1 text-left align-top font-semibold text-[#6e6e73]">
                            {c.nome}
                          </th>
                          <td className="px-2 py-1 align-top [overflow-wrap:anywhere]">
                            {c.valor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {verDescricao && descricao && (
                <section aria-label="Descrição do anúncio">
                  <p className="whitespace-pre-line leading-relaxed text-[#424245]">
                    {longa && !descricaoToda ? descricao.slice(0, 420).trimEnd() + "…" : descricao}
                  </p>
                  {longa && (
                    <button
                      type="button"
                      onClick={() => setDescricaoToda((x) => !x)}
                      className="mt-1 font-bold text-[#0058b0] hover:underline"
                    >
                      {descricaoToda ? "Mostrar menos" : "Ler descrição completa"}
                    </button>
                  )}
                </section>
              )}
              <p className="text-[11px] text-[#6e6e73]">
                Informações lidas no anúncio quando ele foi comparado. Confira no anúncio antes de
                comprar.
              </p>
            </>
          )}
        </div>

        {/* Barra de compra fixa (Weslei, 02/11: nunca um beco sem saída):
            Comprar com o link de afiliado (pronto, o `compra` do cartão ou
            gerado no clique) e Comparar preço, sempre ao alcance do polegar. */}
        {(acoes.comprar || compra || acoes.comparar) && (
          <div className="space-y-2 border-t border-border bg-white/95 p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            {acoes.comprar && "href" in acoes.comprar ? (
              <ComprarComSeguranca link={acoes.comprar.href} origem="vitrine_detalhes" />
            ) : compra ? (
              compra
            ) : acoes.comprar ? (
              <VerNaLoja url={acoes.comprar.gerar} grande />
            ) : null}
            {acoes.comparar && (
              /* Na tela inicial a comparação abre por baixo: o painel fecha. */
              <SinoAcompanhar
                url={acoes.comparar}
                titulo={titulo}
                onComparar={(u) => {
                  ref.current?.close();
                  abrirComparacao(u);
                }}
              >
                <div className="flex min-w-0 flex-1" onClickCapture={() => ref.current?.close()}>
                  <CompararPreco url={acoes.comparar} />
                </div>
              </SinoAcompanhar>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              ✓ Você compra direto na loja oficial · Sem taxa extra
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}

/** WhatsApp share of one product, always with Weslei's link (rule no. 1):
    the ready link, or link_de_reserva for an ML listing. */
function BotaoWhatsApp({ produto }: { produto: Parameters<typeof itemDoProduto>[0] }) {
  const [enviando, setEnviando] = useState(false);
  const item = itemDoProduto(produto);
  if (!item) return null;
  const enviar = async () => {
    setEnviando(true);
    /* Opened now (popup blockers), filled after the link comes back. */
    const janela = window.open("", "_blank");
    const l = await buscarLinkAfiliado(item);
    setEnviando(false);
    if (!l) {
      janela?.close();
      return;
    }
    const preco = item.preco != null ? `\n💰 ${brl(item.preco)}` : "";
    const url = linkWhatsApp(
      `Olha este achado: *${item.titulo.replace(/[*_~`]/g, "")}*${preco}\n👉 ${l}`,
    );
    if (janela) janela.location.href = url;
    else window.location.href = url;
  };
  return (
    <button
      type="button"
      onClick={() => void enviar()}
      disabled={enviando}
      aria-label={`Enviar no WhatsApp: ${item.titulo}`}
      title="Enviar no WhatsApp"
      className="vidro-botao grid size-9 place-items-center rounded-full shadow-sm transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
    >
      {enviando ? (
        <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
      ) : (
        <MessageCircle className="size-[18px] text-[#25d366]" aria-hidden="true" />
      )}
    </button>
  );
}

const ZOOM_MAX = 4;

/** Full-screen photo at the original resolution (-F, up to 1200 px): tap or
    double-click zooms where touched, pinch zooms, drag/scroll pans, so the
    text printed on the photo stays readable (Weslei, 06/11). */
function FotoAmpliada({
  galeria,
  atual,
  ir,
  titulo,
  fechar,
}: {
  galeria: string[];
  atual: number;
  ir: (k: number) => void;
  titulo: string;
  fechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const pinca = useRef<{ d: number; e: number } | null>(null);
  const n = galeria.length;
  const u = galeria[atual]!;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => setEscala(1), [atual]);

  /* Fit size of the photo in the box at 1x; zoom multiplies it. */
  const medir = (im: HTMLImageElement) => {
    const c = caixa.current;
    if (!c || !im.naturalWidth) return;
    const f = Math.min(c.clientWidth / im.naturalWidth, c.clientHeight / im.naturalHeight, 1.5);
    setBase({ w: im.naturalWidth * f, h: im.naturalHeight * f });
  };

  /* New zoom keeping the point (x, y) of the box under the finger. */
  const ampliar = (nova: number, x?: number, y?: number) => {
    const c = caixa.current;
    const e = Math.min(ZOOM_MAX, Math.max(1, nova));
    if (!c) return setEscala(e);
    const px = x ?? c.clientWidth / 2;
    const py = y ?? c.clientHeight / 2;
    const r = e / escala;
    const sl = (c.scrollLeft + px) * r - px;
    const st = (c.scrollTop + py) * r - py;
    setEscala(e);
    requestAnimationFrame(() => c.scrollTo({ left: sl, top: st }));
  };
  const ponto = (cx: number, cy: number) => {
    const b = caixa.current!.getBoundingClientRect();
    return [cx - b.left, cy - b.top] as const;
  };

  return (
    <dialog
      ref={ref}
      onClose={fechar}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "=") ampliar(escala + 1);
        else if (e.key === "-") ampliar(escala - 1);
      }}
      aria-label={`Foto ampliada: ${titulo}`}
      className="fixed inset-0 m-0 h-auto max-h-none w-auto max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="text-[13px] font-semibold tabular-nums text-white/80">
            {n > 1 ? `${atual + 1} de ${n}` : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => ampliar(escala - 1)}
              disabled={escala <= 1}
              aria-label="Diminuir zoom"
              className="grid size-10 place-items-center rounded-full bg-white/15 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => ampliar(escala + 1)}
              disabled={escala >= ZOOM_MAX}
              aria-label="Aumentar zoom"
              className="grid size-10 place-items-center rounded-full bg-white/15 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Fechar foto ampliada"
              className="grid size-10 place-items-center rounded-full bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          ref={caixa}
          className="relative min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ touchAction: escala > 1 ? "pan-x pan-y" : "pan-y" }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const [a, b] = [e.touches[0]!, e.touches[1]!];
              pinca.current = {
                d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
                e: escala,
              };
            }
          }}
          onTouchMove={(e) => {
            const p = pinca.current;
            if (!p || e.touches.length !== 2) return;
            const [a, b] = [e.touches[0]!, e.touches[1]!];
            const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const [x, y] = ponto((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
            ampliar((p.e * d) / p.d, x, y);
          }}
          onTouchEnd={(e) => {
            if (e.touches.length < 2) pinca.current = null;
          }}
        >
          <div
            className="flex min-h-full min-w-full items-center justify-center"
            style={base ? { width: base.w * escala, height: base.h * escala } : undefined}
          >
            <img
              key={u}
              {...propsFotoGrande(u)}
              alt={`${titulo}: foto ${atual + 1} de ${n}`}
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={(e) => medir(e.currentTarget)}
              onClick={(e) => {
                const [x, y] = ponto(e.clientX, e.clientY);
                ampliar(escala > 1 ? 1 : 2.5, x, y);
              }}
              className={`max-w-none select-none bg-white ${escala > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
              style={
                base
                  ? { width: base.w * escala, height: base.h * escala }
                  : { maxWidth: "100%", maxHeight: "100%" }
              }
            />
          </div>
        </div>
        {n > 1 && (
          <div className="flex items-center justify-center gap-4 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => ir(atual - 1)}
              aria-label="Foto anterior"
              className="grid size-11 place-items-center rounded-full bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <span className="text-center text-[12px] text-white/70">
              Toque ou pince para ampliar
            </span>
            <button
              type="button"
              onClick={() => ir(atual + 1)}
              aria-label="Próxima foto"
              className="grid size-11 place-items-center rounded-full bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
