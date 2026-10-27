import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { ArrowRight, Check, Flame, Loader2, Search, Sparkles, Star } from "lucide-react";
import { propsFotoCartao } from "@/lib/foto";
import {
  buscarProdutos,
  quandoFoiLido,
  type ContextoBusca,
  type Resposta,
  type Resultado,
} from "@/lib/busca-guiada-cliente";
import { ComprarComSeguranca } from "@/components/BotoesCartao";
import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";
import { FaixaArte } from "@/components/FaixaArte";
import { LinhaAvaliacoes, SeloBemAvaliado } from "@/components/Avaliacoes";
import { SeloMarketplace } from "@/components/SeloMarketplace";
import { carregarProdutos } from "@/components/SugestoesBusca";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { arteDaBusca } from "@/lib/artes";
import {
  itemDoEndereco,
  useAvaliacoesPorItens,
  type ResumoAvaliacoes,
} from "@/lib/avaliacoes-detalhe";
import { faixaDaNota, idsDoEndereco, mesclarSemRepetir } from "@/lib/busca-resultados";
import { obterSugestoes, produtosDaBusca, type ProdutoConhecido } from "@/lib/busca-sugestoes";

export type { ContextoBusca } from "@/lib/busca-guiada-cliente";

/* BUSCA GUIADA (05/10): para quem não tem o link. A pessoa escreve do jeito
   dela ("presente para menino de 8 anos até R$ 200"), o servidor entende o
   pedido, busca no catálogo oficial e devolve produtos com anúncio ativo.
   O botão abre a COMPARAÇÃO (nunca compra direto): o link de afiliado sai
   dela, com as regras de sempre. Visual do site (Weslei, 05/10: "mantenha
   clean... devolva a identidade do site"): cartão branco, cinza #f5f5f7 e
   azul #0071e3. Os textos não citam IA. */

const SUGESTOES: Record<ContextoBusca, string[]> = {
  home: [
    "Air fryer boa e econômica",
    "Fone bluetooth com cancelamento de ruído",
    "Presente até R$ 200 para menino de 8 anos",
    "Perfume masculino amadeirado",
    "Aspirador vertical para apartamento",
  ],
  natal: [
    "Presente de Natal para mãe até R$ 150",
    "Amigo secreto até R$ 50",
    "Caixa de som para presente",
    "Kit de perfume feminino",
    "Smartwatch para presente",
  ],
  criancas: [
    "Brinquedo educativo para 3 anos",
    "LEGO até R$ 200",
    "Boneca para 5 anos",
    "Carrinho de controle remoto",
    "Bicicleta infantil aro 16",
  ],
};

const TITULOS: Record<ContextoBusca, { linha1: string; linha2: string; apoio: string }> = {
  home: {
    linha1: "Não tem o link?",
    linha2: "Me diga o que procura.",
    apoio: "Escreva do seu jeito. Eu acho o produto e comparo o preço em outras lojas.",
  },
  natal: {
    linha1: "Procurando presente?",
    linha2: "Me diga para quem.",
    apoio: "Diga a pessoa, o estilo e quanto quer gastar. Eu acho e comparo o preço.",
  },
  criancas: {
    linha1: "Qual brinquedo?",
    linha2: "Me diga a idade.",
    apoio: "Diga a idade, o que a criança gosta e quanto quer gastar. Eu acho e comparo.",
  },
};

/* Exemplo no campo, do contexto da página e curto (até 25 caracteres:
   cabe inteiro no celular de 390 px; 16/10, em /brinquedos aparecia "fone
   bluetooth até R$" cortado). */
const EXEMPLO: Record<ContextoBusca, string> = {
  home: "Ex.: air fryer até R$ 400",
  natal: "Ex.: presente para mãe",
  criancas: "Ex.: LEGO para 6 anos",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BuscaGuiada({
  contexto = "home",
  naHome = false,
  className = "",
}: {
  contexto?: ContextoBusca;
  naHome?: boolean;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [buscada, setBuscada] = useState("");
  const idCampo = useId();
  const textos = TITULOS[contexto];

  async function buscar(texto: string) {
    const pergunta = texto.trim();
    if (pergunta.length < 2 || carregando) return;
    setQ(pergunta);
    setBuscada(pergunta);
    setCarregando(true);
    setErro(null);
    setResposta(null);
    const r = await buscarProdutos(pergunta, contexto);
    setErro(r.erro);
    setResposta(r.resposta);
    setCarregando(false);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void buscar(q);
  }

  function comparar(url: string) {
    if (naHome) {
      window.dispatchEvent(new CustomEvent("comparar-link", { detail: url }));
    } else {
      window.location.href = `/?link=${encodeURIComponent(url)}`;
    }
  }

  return (
    <section
      aria-labelledby={`${idCampo}-titulo`}
      data-origem={`busca_${contexto}`}
      className={`rounded-3xl border border-border bg-card shadow-sm ${className}`}
    >
      <div className="p-5 sm:p-7">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0058b0]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Busca guiada
          </p>
          <h2
            id={`${idCampo}-titulo`}
            className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"
          >
            {textos.linha1} <span className="text-[#0071e3]">{textos.linha2}</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-secondary-ink">{textos.apoio}</p>

          <form onSubmit={enviar} className="mt-4 flex max-w-xl gap-2" role="search">
            <label htmlFor={idCampo} className="sr-only">
              O que você procura?
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#86868b]"
                aria-hidden="true"
              />
              <input
                id={idCampo}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={160}
                placeholder={EXEMPLO[contexto]}
                className="h-12 w-full rounded-full border border-transparent bg-[#f5f5f7] pl-10 pr-4 text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus-visible:border-[#0071e3] focus-visible:ring-4 focus-visible:ring-[#0071e3]/20"
              />
            </div>
            <button
              type="submit"
              disabled={carregando || q.trim().length < 2}
              className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-[#0071e3] px-5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
            >
              {carregando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="size-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Buscar</span>
              <span className="sr-only sm:hidden">Buscar</span>
            </button>
          </form>

          <ul className="mt-3 flex max-w-2xl flex-wrap gap-2" aria-label="Sugestões de busca">
            {SUGESTOES[contexto].map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => void buscar(s)}
                  disabled={carregando}
                  className="rounded-full border border-border bg-[#f5f5f7] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-[#e8e8ed] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ResultadosDaBusca
        carregando={carregando}
        erro={erro}
        resposta={resposta}
        comparar={comparar}
        consulta={buscada ? { q: buscada, contexto, modo: "guiada" } : null}
        buscarTermo={(t) => void buscar(t)}
      />
    </section>
  );
}

/* RESULTADOS DA BUSCA (27/10, Weslei: "padronização visual igual às
   vitrines" e "hierarquia do Mercado Livre"):
   1. resposta imediata com o que o site já conhece (vitrine e em alta) e,
      em paralelo, o catálogo oficial; o mesmo anúncio (mesmo MLB no
      endereço) aparece uma vez só;
   2. arte do tema da busca no topo, faixa de buscas relacionadas e modelos
      em alta, e a grade (2 colunas no celular, 4 no PC) com o cartão da
      vitrine: foto 4:3 limpa que abre fotos e detalhes, selo da loja, nota
      real, preço de referência com a hora, frete em linha própria, "Comprar
      com segurança" (afiliado) e "Comparar preço";
   3. 16 de cara e "Carregar mais resultados (+16 opções)" enquanto o
      catálogo tiver mais, com uma faixa de curadoria a cada 12;
   4. nota acima de 4,5 (quando lida) na frente; nota mais baixa no fim. */

export type ConsultaBusca = {
  q: string;
  contexto: ContextoBusca;
  modo: "guiada" | "produto";
};

const LOTE = 16;
const CURADORIA_A_CADA = 12;

type CartaoDaBusca = {
  chave: string;
  /* Anúncio (MLB...) do botão de compra; vazio sem oferta destacada. */
  item: string;
  /* Chave das notas (anúncio ou MLBP do catálogo). */
  avaliacao: string | null;
  nome: string;
  imagem: string | null;
  preco: number | null;
  url: string;
  link: string | null;
  outroLink: string | null;
  freteGratis: boolean | null;
  lojaOficial: boolean;
  /* Remoto: hora da leitura ("agora", "às 14:05"); local: data. */
  quando: string | null;
};

const dataCurta = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : null;
};

function doCatalogo(r: Resultado, lidoEm: string | undefined): CartaoDaBusca {
  return {
    chave: r.item || r.produto,
    item: r.item,
    avaliacao: itemDoEndereco(r.url),
    nome: r.nome,
    imagem: r.imagem,
    preco: r.preco,
    url: r.url,
    link: null,
    outroLink: null,
    freteGratis: r.freteGratis ?? null,
    lojaOficial: r.lojaOficial === true,
    quando: quandoFoiLido(lidoEm),
  };
}

function doSite(p: ProdutoConhecido): CartaoDaBusca {
  const ids = idsDoEndereco(p.url);
  const avaliacao = itemDoEndereco(p.url);
  return {
    chave: ids[ids.length - 1] ?? p.url,
    item: avaliacao && /^MLB\d/.test(avaliacao) ? avaliacao : "",
    avaliacao,
    nome: p.titulo,
    imagem: p.imagem,
    preco: p.preco,
    url: p.url,
    link: ehLinkDeAfiliado(p.link) ? p.link : null,
    outroLink: p.outroLink ?? null,
    freteGratis: p.freteGratis ?? null,
    lojaOficial: false,
    quando: dataCurta(p.vistoEm) ? `de ${dataCurta(p.vistoEm)}` : null,
  };
}

export function ResultadosDaBusca({
  carregando,
  erro,
  resposta,
  comparar,
  compacto = false,
  consulta = null,
  buscarTermo,
  semResultado = "Não achei um produto com anúncio ativo para essa busca. Tente com outras palavras ou cole o link do produto acima.",
}: {
  carregando: boolean;
  erro: string | null;
  resposta: Resposta | null;
  comparar: (url: string) => void;
  semResultado?: string;
  /* Dentro de outro cartão: sem o recuo lateral da seção. */
  compacto?: boolean;
  /* O que foi buscado: liga a resposta imediata, a arte e "Carregar mais". */
  consulta?: ConsultaBusca | null;
  /* Toque numa busca relacionada. */
  buscarTermo?: (t: string) => void;
}) {
  const recuo = compacto ? "pt-3" : "px-5 pb-6 sm:px-7";
  const q = consulta?.q ?? "";
  const guiada = consulta?.modo === "guiada";

  /* 1. O que o site já conhece (uma leitura por visita). */
  const [conhecidos, setConhecidos] = useState<ProdutoConhecido[]>([]);
  useEffect(() => {
    if (!guiada) return;
    let vivo = true;
    void carregarProdutos().then((p) => vivo && setConhecidos(p));
    return () => {
      vivo = false;
    };
  }, [guiada]);
  const locais = useMemo(
    () => (guiada && q ? produtosDaBusca(q, conhecidos, LOTE) : []),
    [guiada, q, conhecidos],
  );
  const relacionadas = useMemo(
    () =>
      guiada && q
        ? obterSugestoes(q, { produtos: conhecidos }).filter(
            (s) => s.tipo === "termo" || s.tipo === "categoria",
          )
        : [],
    [guiada, q, conhecidos],
  );

  /* 2. Páginas seguintes do catálogo ("Carregar mais"). */
  const [extras, setExtras] = useState<Resultado[]>([]);
  const [pagina, setPagina] = useState(1);
  const [fim, setFim] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [visiveis, setVisiveis] = useState(LOTE);
  const focar = useRef<number | null>(null);
  const lista = useRef<HTMLUListElement>(null);
  const geracao = useRef(0);

  const remotos = useMemo(
    () => mesclarSemRepetir([resposta?.resultados ?? [], extras], (r) => r.url),
    [resposta, extras],
  );
  const cartoesBase = useMemo(
    () =>
      mesclarSemRepetir(
        [locais.map(doSite), remotos.map((r) => doCatalogo(r, resposta?.lidoEm))],
        (c) => c.url,
      ),
    [locais, remotos, resposta?.lidoEm],
  );
  const notas = useAvaliacoesPorItens(cartoesBase.map((c) => c.avaliacao));
  /* A nota reordena só dentro de cada lote de 16: o que já está na tela
     não pula de lugar quando chega o lote seguinte. */
  const cartoes = useMemo(
    () =>
      cartoesBase
        .map((c, k) => ({
          c,
          k,
          lote: Math.floor(k / LOTE),
          f: faixaDaNota(c.avaliacao ? notas.get(c.avaliacao) : undefined),
        }))
        .sort((a, b) => a.lote - b.lote || a.f - b.f || a.k - b.k)
        .map((x) => x.c),
    [cartoesBase, notas],
  );

  async function lerPaginas(desde: number, alvo: number, base: number) {
    if (!consulta) return;
    const minha = geracao.current;
    setCarregandoMais(true);
    let p = desde;
    let total = base;
    const novos: Resultado[] = [];
    /* No máximo 2 páginas por toque (cada uma traz até 8 do catálogo). */
    for (let n = 0; n < 2 && total < alvo; n++) {
      const r = await buscarProdutos(consulta.q, consulta.contexto, consulta.modo, p);
      if (minha !== geracao.current) return;
      const achados = r.resposta?.resultados ?? [];
      p += 1;
      if (r.erro || !achados.length) {
        setFim(true);
        break;
      }
      novos.push(...achados);
      total += achados.length;
    }
    setExtras((e) => [...e, ...novos]);
    setPagina(p);
    setCarregandoMais(false);
  }

  /* Nova resposta: recomeça e completa o 1º lote de 16 sozinho. */
  useEffect(() => {
    geracao.current += 1;
    setExtras([]);
    setPagina(1);
    /* Sem a 1ª página do catálogo (erro ou nada achado), não há "mais". */
    setFim(!consulta || !resposta?.resultados.length);
    setCarregandoMais(false);
    setVisiveis(LOTE);
    if (consulta && resposta?.resultados.length)
      void lerPaginas(1, LOTE, locais.length + resposta.resultados.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resposta]);

  function carregarMais() {
    focar.current = Math.min(visiveis, cartoes.length);
    const alvo = visiveis + LOTE;
    setVisiveis(alvo);
    if (!fim && cartoes.length < alvo) void lerPaginas(pagina, alvo, cartoes.length);
  }

  /* Foco no 1º cartão novo, com rolagem suave (teclado e leitor de tela). */
  useEffect(() => {
    const k = focar.current;
    if (k == null) return;
    const el = lista.current?.querySelector<HTMLElement>(`[data-indice="${k}"]`);
    if (!el) return;
    focar.current = null;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [cartoes.length, visiveis]);

  const mostrados = cartoes.slice(0, visiveis);
  const temMais = cartoes.length > visiveis || (!fim && !!consulta);
  const emAlta = locais.filter((l) => !l.link).slice(0, 8);
  const arte = q ? arteDaBusca(q) : null;
  const procurando = carregando && cartoes.length === 0;

  return (
    <div aria-busy={carregando || carregandoMais}>
      {arte && (carregando || resposta || cartoes.length > 0) && (
        <div className={compacto ? "" : "px-5 sm:px-7"}>
          <FaixaArte arte={arte} className="mb-1" />
        </div>
      )}

      {procurando && (
        <div className={recuo}>
          <p className="mt-3 text-sm text-secondary-ink">
            Procurando os produtos certos para você…
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <li key={k} className="h-72 animate-pulse rounded-2xl bg-[#f5f5f7]" />
            ))}
          </ul>
        </div>
      )}

      {erro && !carregando && (
        <p
          className={`rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm ${compacto ? "mt-3" : "mx-5 mb-3 mt-3 sm:mx-7"}`}
        >
          {erro}
        </p>
      )}

      {!procurando && (resposta || cartoes.length > 0) && (
        <div className={recuo}>
          {(relacionadas.length > 0 || emAlta.length > 0) && (
            <Relacionadas
              termos={relacionadas}
              emAlta={emAlta}
              buscarTermo={buscarTermo}
              comparar={comparar}
            />
          )}
          {resposta?.resumo && <p className="mt-3 text-sm text-secondary-ink">{resposta.resumo}</p>}
          {carregando && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-secondary-ink">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Já mostrei o que conheço; buscando mais opções no catálogo…
            </p>
          )}
          {cartoes.length === 0 ? (
            !carregando && (
              <p className="mt-3 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm">{semResultado}</p>
            )
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {`${mostrados.length} produtos na tela.`}
              </p>
              <ul ref={lista} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {mostrados.map((c, k) => (
                  <FragmentoComCuradoria
                    key={c.chave}
                    indice={k}
                    cartao={c}
                    mostrados={mostrados}
                    notas={notas}
                    arte={arte}
                    resumo={c.avaliacao ? notas.get(c.avaliacao) : undefined}
                    comparar={comparar}
                  />
                ))}
              </ul>
              {temMais && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={carregarMais}
                    disabled={carregandoMais}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0071e3]/40 bg-white px-5 text-sm font-semibold text-[#0058b0] transition hover:bg-[#f5f5f7] disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                  >
                    {carregandoMais ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {carregandoMais
                      ? "Carregando mais opções…"
                      : "Carregar mais resultados (+16 opções)"}
                  </button>
                </div>
              )}
              {!temMais && cartoes.length > LOTE && (
                <p className="mt-4 text-center text-xs text-secondary-ink">
                  Esses são todos os produtos com anúncio ativo que achei para esta busca.
                </p>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-secondary-ink">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                Preço de referência do anúncio na hora indicada: pode mudar. "Comparar preço"
                confere o mesmo produto em outras lojas antes de você comprar
                {(resposta?.enfileirados ?? 0) > 0
                  ? "; os primeiros também passam pela comparação completa e, se valerem a pena, entram na vitrine."
                  : "."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Buscas relacionadas (pílulas) e modelos em alta que casam com a busca
   (miniaturas), numa linha que desliza no celular. Só o que o site já leu
   das listas oficiais: nada inventado. */
function Relacionadas({
  termos,
  emAlta,
  buscarTermo,
  comparar,
}: {
  termos: ReturnType<typeof obterSugestoes>;
  emAlta: ProdutoConhecido[];
  buscarTermo: ((t: string) => void) | undefined;
  comparar: (url: string) => void;
}) {
  const pilula =
    "inline-flex min-h-8 shrink-0 snap-start items-center whitespace-nowrap rounded-full border border-border bg-[#f5f5f7] px-3 text-xs font-semibold text-foreground transition hover:bg-[#e8e8ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]";
  const pilulas = termos.filter((t) => t.tipo === "categoria" || buscarTermo);
  return (
    <div className="mt-3">
      {pilulas.length > 0 && (
        <>
          <p className="text-[11px] font-bold uppercase tracking-wide text-secondary-ink">
            Mais buscados relacionados
          </p>
          <ul className="-mx-1 mt-1.5 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pilulas.map((t) => (
              <li key={`${t.tipo}-${t.texto}`} className="shrink-0">
                {t.tipo === "categoria" ? (
                  <Link to="/categorias/$slug" params={{ slug: t.slug }} className={pilula}>
                    {t.texto}
                  </Link>
                ) : (
                  <button type="button" onClick={() => buscarTermo?.(t.texto)} className={pilula}>
                    <Search className="mr-1 size-3 text-[#86868b]" aria-hidden="true" />
                    {t.texto}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {emAlta.length > 0 && (
        <>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-secondary-ink">
            <Flame className="size-3.5 text-[#ff6b00]" aria-hidden="true" />
            Em alta no Mercado Livre
          </p>
          <ul className="-mx-1 mt-1.5 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {emAlta.map((p) => (
              <li key={p.url} className="w-28 shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => comparar(p.url)}
                  title={`Comparar preço: ${p.titulo}`}
                  className="block w-full rounded-xl border border-border/70 bg-white p-1.5 text-left text-[#1d1d1f] transition hover:border-[#0071e3]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-lg bg-white">
                    {p.imagem && (
                      <img
                        {...propsFotoCartao(p.imagem, "112px")}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-snug">
                    {p.titulo}
                  </span>
                  {p.preco != null && (
                    <span className="block text-xs font-extrabold tabular-nums">
                      {brl(p.preco)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* O cartão e, a cada 12, a faixa de curadoria antes dele (como o Mercado
   Livre faz no meio da página). */
function FragmentoComCuradoria({
  indice,
  cartao,
  mostrados,
  notas,
  arte,
  resumo,
  comparar,
}: {
  indice: number;
  cartao: CartaoDaBusca;
  mostrados: CartaoDaBusca[];
  notas: Map<string, ResumoAvaliacoes>;
  arte: ReturnType<typeof arteDaBusca> | null;
  resumo: ResumoAvaliacoes | undefined;
  comparar: (url: string) => void;
}) {
  const curadoria = indice > 0 && indice % CURADORIA_A_CADA === 0;
  return (
    <>
      {curadoria && (
        <Curadoria
          vez={indice / CURADORIA_A_CADA}
          mostrados={mostrados}
          notas={notas}
          arte={arte}
        />
      )}
      <CartaoBusca c={cartao} indice={indice} resumo={resumo} comparar={comparar} />
    </>
  );
}

/** Destaques da curadoria: os mais bem avaliados (nota 4,5+ lida) ou os de
    frete grátis confirmado, do mais barato; até 6. */
function destaquesDaCuradoria(
  tema: "avaliados" | "frete",
  cartoes: CartaoDaBusca[],
  notas: Map<string, ResumoAvaliacoes>,
): CartaoDaBusca[] {
  if (tema === "avaliados")
    return cartoes
      .map((c) => ({ c, v: c.avaliacao ? notas.get(c.avaliacao)?.avaliacoes : null }))
      .filter((x) => x.v && x.v.nota >= 4.5)
      .sort((a, b) => b.v!.nota - a.v!.nota || (b.v!.total ?? 0) - (a.v!.total ?? 0))
      .slice(0, 6)
      .map((x) => x.c);
  return cartoes
    .filter((c) => c.freteGratis === true && c.preco != null)
    .sort((a, b) => a.preco! - b.preco!)
    .slice(0, 6);
}

function Curadoria({
  vez,
  mostrados,
  notas,
  arte,
}: {
  vez: number;
  mostrados: CartaoDaBusca[];
  notas: Map<string, ResumoAvaliacoes>;
  arte: ReturnType<typeof arteDaBusca> | null;
}) {
  const ordem: Array<"avaliados" | "frete"> =
    vez % 2 ? ["avaliados", "frete"] : ["frete", "avaliados"];
  const tema = ordem.find((t) => destaquesDaCuradoria(t, mostrados, notas).length >= 2);
  const itens = tema ? destaquesDaCuradoria(tema, mostrados, notas) : [];
  const irPara = (chave: string) => {
    const el = document.getElementById(`busca-${chave}`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <li className="col-span-full overflow-hidden rounded-2xl border border-border/70 bg-card">
      {arte && (
        <FaixaArte arte={arte} className="!mt-0 !h-20 !rounded-none !shadow-none sm:!h-24" />
      )}
      {tema && (
        <div className="p-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold">
            {tema === "frete" ? (
              <Flame className="size-4 text-[#ff6b00]" aria-hidden="true" />
            ) : (
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
            )}
            {tema === "frete"
              ? "Destaque com frete grátis e melhor preço"
              : "Mais bem avaliados nesta busca"}
          </p>
          <ul className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {itens.map((c) => {
              const v = c.avaliacao ? notas.get(c.avaliacao)?.avaliacoes : null;
              return (
                <li key={c.chave} className="w-36 shrink-0 snap-start">
                  <button
                    type="button"
                    onClick={() => irPara(c.chave)}
                    className="flex w-full items-center gap-2 rounded-xl bg-[#f5f5f7] p-1.5 text-left text-[#1d1d1f] hover:bg-[#e8e8ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                  >
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white">
                      {c.imagem && (
                        <img
                          {...propsFotoCartao(c.imagem, "44px")}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-1 block text-[11px]">{c.nome}</span>
                      {c.preco != null && (
                        <span className="block text-xs font-extrabold tabular-nums">
                          {brl(c.preco)}
                        </span>
                      )}
                      <span className="block text-[10px] text-secondary-ink">
                        {tema === "frete"
                          ? "Frete grátis"
                          : v
                            ? `★ ${v.nota.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${v.total ? ` (${v.total})` : ""}`
                            : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

/* Cartão da busca: o mesmo desenho do cartão da vitrine (Vitrine.tsx). */
function CartaoBusca({
  c,
  indice,
  resumo,
  comparar,
}: {
  c: CartaoDaBusca;
  indice: number;
  resumo: ResumoAvaliacoes | undefined;
  comparar: (url: string) => void;
}) {
  const detalhe = c.item || idsDoEndereco(c.url)[0] || "";
  const foto = (
    <span className="relative block aspect-[4/3] overflow-hidden bg-white sm:aspect-auto sm:h-40">
      {c.imagem ? (
        <img
          {...propsFotoCartao(c.imagem)}
          alt={c.nome}
          width={200}
          height={200}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-contain p-2.5 transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <Search className="size-6 text-[#86868b]" aria-hidden="true" />
        </span>
      )}
    </span>
  );
  return (
    <li
      id={`busca-${c.chave}`}
      data-indice={indice}
      tabIndex={-1}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
    >
      <VerDetalhesVitrine
        chave={detalhe}
        titulo={c.nome}
        imagem={c.imagem}
        preco={c.preco}
        link={c.link}
        urlProduto={c.url}
        gatilho={foto}
        className="w-full"
      />
      <div className="flex flex-1 flex-col border-t border-border/60 p-2.5">
        <p className="flex min-h-5 flex-wrap items-center gap-1">
          <SeloMarketplace links={[c.link ?? c.url, c.outroLink]} />
          {c.lojaOficial && (
            <span className="whitespace-nowrap rounded-full bg-[#0071e3]/10 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-[#0058b0]">
              Loja oficial
            </span>
          )}
        </p>
        <p className="mt-1 line-clamp-2 min-h-[2lh] text-xs font-medium leading-snug">{c.nome}</p>
        {c.preco != null ? (
          <>
            <p className="mt-1 text-base font-extrabold tabular-nums">{brl(c.preco)}</p>
            <p className="text-[10px] text-secondary-ink/80">
              Preço de referência{c.quando ? ` ${c.quando}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-1 text-[11px] text-secondary-ink">
            Vendido por várias lojas: compare para ver os preços.
          </p>
        )}
        <p
          className={
            "mt-0.5 flex items-center gap-1 text-[11px] " +
            (c.freteGratis === true ? "font-semibold text-success" : "text-secondary-ink")
          }
        >
          {c.freteGratis === true ? (
            <>
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              Frete grátis
            </>
          ) : (
            "Frete a calcular para seu CEP"
          )}
        </p>
        <LinhaAvaliacoes resumo={resumo} titulo={c.nome} link={c.link} className="mt-0.5" />
        <SeloBemAvaliado resumo={resumo} className="mt-1 self-start" />
        <div className="mt-auto flex flex-col gap-1.5 pt-2.5">
          {/* REGRA Nº 1: link de afiliado guardado ou gerado no clique. */}
          {c.link ? (
            <ComprarComSeguranca link={c.link} origem="busca" />
          ) : c.item ? (
            <VerNaLoja url={c.url} grande />
          ) : null}
          <button
            type="button"
            onClick={() => comparar(c.url)}
            className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#0071e3]/40 px-2 py-1.5 text-xs font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            Comparar preço
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
          {detalhe && (
            <div className="flex justify-center">
              <VerDetalhesVitrine
                chave={detalhe}
                titulo={c.nome}
                imagem={c.imagem}
                preco={c.preco}
                link={c.link}
                urlProduto={c.url}
                rotulo="Detalhes"
                className="min-h-7"
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
