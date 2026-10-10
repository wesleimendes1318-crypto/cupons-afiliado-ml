/* COMPARE COM CLAREZA: OS 3 MARKETPLACES (Weslei, 09/10: "deve fazer a mesma
   analise em cada player e por fim comparar os 3 players"; 10/10: nova tela
   e "exemplo de tabela final"). No fim do resultado, em largura inteira:
   1. "Mesmo produto | N ofertas confirmadas nesta análise": tabela com uma
      coluna por marketplace (Mercado Livre = a recomendação da tela) e as
      linhas Correspondência, Produto, Frete, Total, Vendedor e Ação. Só
      disputa a "Melhor escolha" quem tem o custo total confirmado (src/lib/
      comparacao-marketplaces.ts); Prime é só para assinantes. Espaço
      estreito (celular): um cartão por marketplace (container query).
   2. "Alternativas parecidas": os parecidos da Amazon e da Shopee em cartões
      horizontais (foto, marca, o que difere, qualidade, desvantagens, preço,
      frete e botão).
   Botão sempre "Comprar com segurança" com o link de afiliado do próprio
   marketplace; sem link pronto no Mercado Livre, gera no clique (VerNaLoja);
   sem preço capturado na Amazon, "Conferir na loja" (busca com a tag). Nunca
   "Ver no Mercado Livre/na Amazon/na Shopee". Marketplace identificado só
   pelo NOME e pelo endereço da loja, em texto: sem logotipo e sem as cores
   das marcas (Weslei, 10/10: "use a medida que me resguarde dos termos de
   uso de cada afiliado, mas que seja possível identificar o player"). Quem
   busca na Amazon e na Shopee é a extensão pela sessão logada; aqui o site
   só lê o resultado. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Info,
  MapPin,
  Minus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  TriangleAlert,
} from "lucide-react";

import { ehLinkDeCompra, urlBuscaAmazon } from "@/lib/afiliado";
import type { LojaExterna } from "@/lib/coletor-multiloja";
import {
  celulaDoFrete,
  comparacaoDoParecido,
  decidirEntreMarketplaces,
  detalhesDoParecido,
  diferencaContraColado,
  ENDERECO_DO_JOGADOR,
  linhaDoFrete,
  marcaDoParecido,
  melhorDoMarketplace,
  NOME_DO_JOGADOR,
  ofertaExterna,
  ORDEM_DAS_COLUNAS,
  qualidadeDoCartao,
  rotuloDaRelacao,
  totalConfirmado,
  type Jogador,
  type OfertaDoJogador,
} from "@/lib/comparacao-marketplaces";
import { limparResultado, type RespostaMultiloja } from "@/lib/multiloja-resultado";
import { precoMuitoAbaixo } from "@/lib/preco-suspeito";
import { termoDeBuscaExterna } from "@/lib/termo-busca-externa";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Estado = "aguardando" | "pronto" | "inativo";

export type ColadoParaComparar = {
  titulo: string | null;
  preco: number | null;
  /* Produto + frete quando o frete do colado é conhecido; senão null. */
  totalConfirmado: number | null;
};

/* Pergunta à rota enquanto a extensão compara (busca, conferência pela foto
   e links levam de 30 s a alguns minutos). */
function useMultiloja(pedidoId: number | null) {
  const [r, setR] = useState<{ estado: Estado; dados: RespostaMultiloja | null }>({
    estado: "aguardando",
    dados: null,
  });
  useEffect(() => {
    if (pedidoId == null) {
      setR({ estado: "inativo", dados: null });
      return;
    }
    setR({ estado: "aguardando", dados: null });
    let vivo = true;
    let tentativas = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const pedir = async () => {
      tentativas += 1;
      try {
        const resp = await fetch("/api/public/multiloja", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pedido: pedidoId }),
        });
        const j = (await resp.json().catch(() => null)) as
          (RespostaMultiloja & { aguardar?: boolean }) | null;
        if (!vivo) return;
        /* 1º minuto a cada 5 s; depois a cada 15 s, até a rota parar de
           pedir espera (ela desiste 4 min depois do pedido). */
        if (j?.aguardar && tentativas < 30) {
          espera = setTimeout(() => void pedir(), tentativas < 12 ? 5_000 : 15_000);
          return;
        }
        if (!j?.ativo) {
          setR({ estado: "inativo", dados: null });
          return;
        }
        setR({ estado: "pronto", dados: limparResultado(j) });
      } catch {
        if (vivo) setR({ estado: "inativo", dados: null });
      }
    };
    void pedir();
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
  }, [pedidoId]);
  return r;
}

const semMovimento = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Situacao =
  "mesmo" | "conferindo" | "nao_localizado" | "nao_consultado" | "indisponivel" | "sem_preco";

type Coluna = {
  jogador: Jogador;
  oferta: OfertaDoJogador | null;
  /* Outras ofertas do mesmo produto no mesmo marketplace. */
  extras: number;
  situacao: Situacao;
  /* Há parecido deste marketplace em "Alternativas parecidas". */
  temAlternativa: boolean;
  suspeito: boolean;
};

const TEXTO_DA_SITUACAO: Record<Exclude<Situacao, "mesmo">, [string, string]> = {
  conferindo: ["Conferindo", "aguarde alguns segundos"],
  nao_localizado: ["Não localizado", "nesta análise"],
  nao_consultado: ["Não consultado", "nesta análise"],
  indisponivel: ["Conferência", "indisponível agora"],
  sem_preco: ["Sem preço lido", ""],
};

/* Fundo da linha Total (como no exemplo: a linha que decide). */
const FUNDO_TOTAL = "bg-[#f3f6fb] dark:bg-white/[0.06]";

function Correspondencia({ c }: { c: Coluna }) {
  if (c.situacao === "mesmo")
    return (
      <span className="inline-flex items-center gap-2 font-semibold">
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
        <span className="whitespace-nowrap">Mesmo produto</span>
      </span>
    );
  const [l1, l2] = TEXTO_DA_SITUACAO[c.situacao];
  return (
    <span className="inline-flex items-center gap-2 text-left">
      <span
        className={
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-white dark:bg-white/25" +
          (c.situacao === "conferindo" ? " motion-safe:animate-pulse" : "")
        }
      >
        <Minus className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-semibold">{l1}</span>
        {l2 && <span className="text-[11px] text-secondary-ink">{l2}</span>}
      </span>
    </span>
  );
}

function BotaoComprar({
  link,
  origem,
  compacto = false,
}: {
  link: string;
  origem: string;
  /* Coluna estreita (preço do cartão): mesmo texto, ícones e espaços menores. */
  compacto?: boolean;
}) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-origem={origem}
      className={
        "flex w-full items-center justify-center rounded-xl bg-success py-2.5 font-bold text-white transition-all duration-200 ease-out hover:brightness-95 motion-safe:hover:-translate-y-px " +
        (compacto ? "gap-1 px-2 text-[12px]" : "gap-1.5 px-2.5 text-[13px]")
      }
    >
      <ShieldCheck
        className={(compacto ? "size-3.5" : "size-4") + " shrink-0"}
        aria-hidden="true"
      />
      <span className="whitespace-nowrap">Comprar com segurança</span>
      <ArrowUpRight
        className={(compacto ? "size-3.5" : "size-4") + " shrink-0"}
        aria-hidden="true"
      />
    </a>
  );
}

const BOTAO_SECUNDARIO =
  "flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] font-semibold text-foreground transition-colors duration-200 ease-out hover:bg-muted";

/* "Conferir na loja": busca da Amazon com a tag, quando não há preço
   capturado (nunca é compra direta e nunca leva o nome da loja). */
function ConferirNaLoja({ titulo }: { titulo: string | null }) {
  const link = titulo ? urlBuscaAmazon(termoDeBuscaExterna(titulo)) : null;
  if (!link) return <span className="text-secondary-ink">—</span>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-origem="comparacao_amazon_busca"
      className={BOTAO_SECUNDARIO}
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      Conferir na loja
    </a>
  );
}

function Acao({
  c,
  colado,
  gerarLink,
  verAlternativa,
}: {
  c: Coluna;
  colado: ColadoParaComparar;
  gerarLink?: ((url: string) => ReactNode) | undefined;
  verAlternativa: (j: Jogador) => void;
}) {
  const o = c.oferta;
  if (o?.link) return <BotaoComprar link={o.link} origem={`comparacao_${c.jogador}`} />;
  if (o && o.urlLoja && gerarLink) return <div className="w-full">{gerarLink(o.urlLoja)}</div>;
  if (!o && c.temAlternativa)
    return (
      <button type="button" onClick={() => verAlternativa(c.jogador)} className={BOTAO_SECUNDARIO}>
        Ver alternativa
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </button>
    );
  if (!o && c.jogador === "amazon" && c.situacao !== "conferindo")
    return <ConferirNaLoja titulo={colado.titulo} />;
  return <span className="text-secondary-ink">—</span>;
}

function Vendedor({ c, direita = false }: { c: Coluna; direita?: boolean }) {
  const o = c.oferta;
  if (!o) return <span className="text-secondary-ink">—</span>;
  return (
    <span
      className={"flex flex-col gap-0.5 " + (direita ? "items-end text-right" : "items-center")}
    >
      <span className="break-words">{o.loja ?? "Não informado"}</span>
      {o.ehColado && (
        <span className="text-[11px] text-secondary-ink">o anúncio que você colou</span>
      )}
      {o.oficial && (
        <span className="rounded-full bg-[#e8f1fd] px-2 py-0.5 text-[10px] font-bold text-[#0058b0]">
          Loja oficial
        </span>
      )}
      {c.extras > 0 && (
        <span className="text-[11px] text-secondary-ink">
          +{c.extras} {c.extras === 1 ? "oferta" : "ofertas"} do mesmo produto
        </span>
      )}
      {c.suspeito && (
        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          Preço muito abaixo das outras lojas: confira o vendedor antes de comprar.
        </span>
      )}
    </span>
  );
}

function Total({
  c,
  colado,
  direita = false,
}: {
  c: Coluna;
  colado: ColadoParaComparar;
  direita?: boolean;
}) {
  const o = c.oferta;
  if (!o) return <span className="text-secondary-ink">—</span>;
  const t = totalConfirmado(o);
  const dif = diferencaContraColado(o, colado);
  return (
    <span
      className={"flex flex-col gap-0.5 " + (direita ? "items-end text-right" : "items-center")}
    >
      {t != null ? (
        <strong className="text-xl font-bold tracking-tight tabular-nums">{brl(t)}</strong>
      ) : (
        <span className="font-semibold text-secondary-ink">A confirmar</span>
      )}
      {dif && <span className="text-[11px] font-normal text-secondary-ink">{dif}</span>}
    </span>
  );
}

function SeloMelhor() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
      <span className="animate-fogo inline-block" aria-hidden="true">
        🔥
      </span>
      Melhor escolha
    </span>
  );
}

function SeloMenorNoProduto() {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-center text-[10px] font-bold leading-tight text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      Menor preço no produto (frete a confirmar)
    </span>
  );
}

function SeloPrime() {
  return (
    <span className="rounded-full bg-[#e8f1fd] px-2 py-0.5 text-[10px] font-bold text-[#0058b0]">
      Prime
    </span>
  );
}

/* Nome do marketplace em texto + endereço da loja: identifica sem logotipo. */
function NomeDoMarketplace({ j, grande = false }: { j: Jogador; grande?: boolean }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className={(grande ? "text-[15px]" : "text-sm") + " font-bold"}>
        {NOME_DO_JOGADOR[j]}
      </span>
      <span className="text-[10px] font-normal text-secondary-ink">{ENDERECO_DO_JOGADOR[j]}</span>
    </span>
  );
}

function CartaoAlternativa({
  l,
  colado,
  ancora,
  destacado,
}: {
  l: LojaExterna;
  colado: ColadoParaComparar;
  ancora: string | undefined;
  destacado: boolean;
}) {
  const o = ofertaExterna(l);
  const marca = marcaDoParecido(l.muda);
  const detalhes = detalhesDoParecido(l.muda);
  const porExtenso = comparacaoDoParecido(l.muda);
  const qualidade = qualidadeDoCartao(l.qualidade);
  const dif = diferencaContraColado(o, colado);
  const desv = l.desvantagens ?? [];
  return (
    <li
      id={ancora}
      className={
        "@container/cartao group scroll-mt-24 rounded-2xl border bg-card p-3 shadow-sm transition-all duration-200 ease-out hover:shadow-md motion-safe:hover:-translate-y-0.5 sm:p-4 " +
        (destacado ? "border-[#0071e3] ring-2 ring-[#0071e3]/40" : "border-border")
      }
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <NomeDoMarketplace j={l.marketplace} grande />
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {rotuloDaRelacao(l)}
        </span>
        {l.mesmaFoto && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-secondary-ink">
            Mesma foto do anúncio colado
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 [grid-template-areas:'foto_info'_'preco_preco'] @md/cartao:grid-cols-[5.5rem_minmax(0,1fr)_minmax(11rem,auto)] @md/cartao:[grid-template-areas:'foto_info_preco']">
        <div className="relative h-24 overflow-hidden rounded-xl bg-white [grid-area:foto]">
          {l.imagem ? (
            <img
              src={l.imagem}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-contain p-1.5 transition-transform duration-200 ease-out motion-safe:group-hover:scale-[1.02]"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] text-secondary-ink">
              Sem foto
            </span>
          )}
        </div>
        <div className="min-w-0 [grid-area:info]">
          <p className="line-clamp-2 text-[14px] font-bold leading-snug">{l.titulo}</p>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-snug text-secondary-ink">
            <li className="flex gap-1.5">
              <Tag className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{marca ? `Marca: ${marca}` : "Marca não informada"}</span>
            </li>
            <li className="flex gap-1.5" title={porExtenso.join("; ") || undefined}>
              <SlidersHorizontal className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {detalhes.length ? detalhes.join(" · ") : "Confira as características no anúncio"}
              </span>
            </li>
            <li
              className={
                "flex gap-1.5 " +
                (qualidade.nivel === "inferior"
                  ? "text-red-700 dark:text-red-300"
                  : qualidade.nivel === "incerta"
                    ? ""
                    : "text-success")
              }
              title={l.qualidadeMotivo ?? undefined}
            >
              {qualidade.nivel === "incerta" ? (
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              ) : qualidade.nivel === "inferior" ? (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{qualidade.texto}</span>
            </li>
            {desv.length > 0 && (
              <li className="flex gap-1.5 text-red-700 dark:text-red-300">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  Desvantagens em relação ao seu: {desv.join("; ")}
                </span>
              </li>
            )}
          </ul>
        </div>
        <div className="flex flex-col justify-center [grid-area:preco] @md/cartao:border-l @md/cartao:border-border @md/cartao:pl-4">
          <p className="text-2xl font-bold tracking-tight tabular-nums">{brl(l.preco)}</p>
          <p className="text-[12px] text-secondary-ink">{linhaDoFrete(o)}</p>
          {dif && <p className="text-[11px] text-secondary-ink">{dif}</p>}
          {o.link && (
            <div className="mt-2">
              <BotaoComprar link={o.link} origem={`alternativa_${l.marketplace}`} compacto />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

const ROTULOS = ["Correspondência", "Produto", "Frete", "Total", "Vendedor", "Ação"] as const;

export function ComparacaoMarketplaces({
  pedidoId,
  colado,
  melhorMl,
  precosMl,
  cep,
  gerarLink,
}: {
  pedidoId: number | null;
  colado: ColadoParaComparar;
  /* A recomendação do Mercado Livre na tela (mesmo produto). */
  melhorMl: OfertaDoJogador | null;
  /* Preços do mesmo produto no Mercado Livre (anúncio colado + lojas da
     tabela): contagem de ofertas e aviso de preço muito abaixo. */
  precosMl: number[];
  /* CEP do frete simulado, quando houver. */
  cep?: string | null;
  /* Botão que gera o link de afiliado no clique (Mercado Livre sem link). */
  gerarLink?: (url: string) => ReactNode;
}) {
  const { estado, dados } = useMultiloja(pedidoId);
  const [destaque, setDestaque] = useState<Jogador | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const verAlternativa = useCallback((j: Jogador) => {
    const el = document.getElementById(`alternativa-${j}`);
    if (!el) return;
    el.scrollIntoView({ behavior: semMovimento() ? "auto" : "smooth", block: "center" });
    setDestaque(j);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDestaque(null), 1800);
  }, []);

  if (pedidoId == null) return null;
  const lojas = dados?.lojas ?? [];
  const ml =
    melhorMl && melhorMl.link && !ehLinkDeCompra(melhorMl.link, "mercadolivre")
      ? { ...melhorMl, link: null }
      : melhorMl;
  const amazon = melhorDoMarketplace(lojas, "amazon");
  const shopee = melhorDoMarketplace(lojas, "shopee");
  const decisao = decidirEntreMarketplaces([ml, amazon, shopee]);
  const v = decisao.vencedor;
  const m = decisao.menorNoProduto;
  const mesmosExternos = lojas.filter(
    (l) => l.relacao === "mesmo" && ehLinkDeCompra(l.link, l.marketplace),
  );
  const precosDoMesmo = [...precosMl, ...mesmosExternos.map((l) => l.preco)];
  const parecidos = lojas
    .filter((l) => l.relacao === "parecido" && ehLinkDeCompra(l.link, l.marketplace))
    .sort(
      (a, b) =>
        (b.mesmaFoto ? 1 : 0) - (a.mesmaFoto ? 1 : 0) ||
        (b.semelhanca ?? 0) - (a.semelhanca ?? 0) ||
        a.preco - b.preco,
    );
  const consultado = (mk: "amazon" | "shopee") =>
    Boolean(dados?.resumo?.[mk]) || lojas.some((l) => l.marketplace === mk);

  const colunas: Coluna[] = ORDEM_DAS_COLUNAS.map((j) => {
    const oferta = j === "mercadolivre" ? ml : j === "amazon" ? amazon : shopee;
    const situacao: Situacao = oferta
      ? "mesmo"
      : j === "mercadolivre"
        ? "sem_preco"
        : estado === "aguardando"
          ? "conferindo"
          : dados?.incompleto
            ? "indisponivel"
            : consultado(j)
              ? "nao_localizado"
              : "nao_consultado";
    return {
      jogador: j,
      oferta,
      extras:
        j === "mercadolivre"
          ? 0
          : Math.max(0, mesmosExternos.filter((l) => l.marketplace === j).length - 1),
      situacao,
      temAlternativa: j !== "mercadolivre" && parecidos.some((l) => l.marketplace === j),
      suspeito:
        j !== "mercadolivre" && oferta != null && precoMuitoAbaixo(oferta.preco, precosDoMesmo),
    };
  });
  const totalOfertas = precosMl.length + mesmosExternos.length;
  const resumo = dados?.resumo;
  const leitura = (["amazon", "shopee"] as const)
    .map((mk) => {
      const r = resumo?.[mk];
      if (!r) return null;
      return r.lidas
        ? `${NOME_DO_JOGADOR[mk]}: li ${r.lidas} ${r.lidas === 1 ? "resultado" : "resultados"}` +
            (r.conferidas ? ` e conferi ${r.conferidas} pela foto` : "")
        : `${NOME_DO_JOGADOR[mk]}: nenhum resultado lido`;
    })
    .filter(Boolean)
    .join(" · ");
  const ehVencedor = (c: Coluna) => v != null && v.jogador === c.jogador;
  const ehMenor = (c: Coluna) => m != null && m.jogador === c.jogador;
  /* Âncora do "Ver alternativa": o 1º parecido de cada marketplace. */
  const ancoras = new Map<string, string>();
  for (const l of parecidos)
    if (![...ancoras.values()].includes(`alternativa-${l.marketplace}`))
      ancoras.set(`${l.marketplace}:${l.id}`, `alternativa-${l.marketplace}`);
  const busca = colado.titulo ? termoDeBuscaExterna(colado.titulo) : "";

  /* Conteúdo de cada linha da tabela, por coluna. */
  const celula = (c: Coluna, rotulo: (typeof ROTULOS)[number]): ReactNode => {
    const o = c.oferta;
    switch (rotulo) {
      case "Correspondência":
        return <Correspondencia c={c} />;
      case "Produto":
        return o ? (
          <span className="tabular-nums">{brl(o.preco)}</span>
        ) : (
          <span className="text-secondary-ink">—</span>
        );
      case "Frete":
        return o ? <span>{celulaDoFrete(o)}</span> : <span className="text-secondary-ink">—</span>;
      case "Total":
        return <Total c={c} colado={colado} />;
      case "Vendedor":
        return <Vendedor c={c} />;
      case "Ação":
        return <Acao c={c} colado={colado} gerarLink={gerarLink} verAlternativa={verAlternativa} />;
    }
  };

  return (
    <section
      aria-label="Compare com clareza: Mercado Livre, Amazon e Shopee"
      className="@container mt-6"
      data-origem="comparacao_marketplaces"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold tracking-tight">Compare com clareza.</h3>
          <p className="text-[15px] text-secondary-ink">
            Veja preço, frete e diferenças em cada loja.
          </p>
          {busca && (
            <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[13px]">
              <Search className="size-4 shrink-0 text-secondary-ink" aria-hidden="true" />
              <span className="shrink-0 text-secondary-ink">Sua busca:</span>
              <strong className="truncate">{busca}</strong>
            </p>
          )}
        </div>
        {cep && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12px] shadow-sm">
            <MapPin className="size-4 text-[#0071e3]" aria-hidden="true" />
            Entrega: CEP {cep}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-secondary-ink">
        {estado === "aguardando"
          ? "Conferindo o mesmo produto na Amazon e na Shopee…"
          : leitura || "A mesma análise em cada marketplace."}
      </p>

      {/* MESMO PRODUTO */}
      <div className="mt-3 rounded-3xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-5">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <strong className="text-xl tracking-tight">Mesmo produto</strong>
          <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
          <span className="text-[13px] text-secondary-ink">
            {totalOfertas} {totalOfertas === 1 ? "oferta confirmada" : "ofertas confirmadas"} nesta
            análise
          </span>
        </p>
        {(v || m) && (
          <div className="mt-2 space-y-1 text-xs leading-relaxed">
            {v && (
              <p>
                <strong>🔥 Melhor escolha: {NOME_DO_JOGADOR[v.jogador]}</strong>
                {(() => {
                  const t = totalConfirmado(v);
                  return t != null ? ` · total de ${brl(t)} confirmado` : "";
                })()}
                .
              </p>
            )}
            {m && (
              <p className="text-amber-900 dark:text-amber-200">
                <strong>
                  Menor preço no produto (frete a confirmar): {NOME_DO_JOGADOR[m.jogador]}
                </strong>
                {v ? `, ${brl(v.preco - m.preco)} a menos no produto` : ""}.{" "}
                {m.prime
                  ? "Frete grátis só para assinantes Prime: confira antes de comprar."
                  : "Confira o frete no anúncio antes de comprar."}
              </p>
            )}
          </div>
        )}
        {!v && !m && decisao.ofertas.length > 0 && estado !== "aguardando" && (
          <p className="mt-2 text-xs text-secondary-ink">
            Nenhum marketplace confirmou o custo total com o frete: compare o preço do produto e
            confira o frete no anúncio.
          </p>
        )}

        {/* Espaço largo: tabela; as linhas se alinham entre as colunas (subgrid). */}
        <div
          className="mt-4 hidden grid-flow-col grid-cols-[minmax(7.5rem,0.7fr)_repeat(3,minmax(0,1fr))] grid-rows-[repeat(7,auto)] text-[13px] @2xl:grid"
          role="group"
          aria-label="Mesmo produto nos 3 marketplaces"
        >
          <div className="row-span-7 grid grid-rows-subgrid">
            <span aria-hidden="true" />
            {ROTULOS.map((r, i) => (
              <span
                key={r}
                className={
                  "flex items-center border-l border-t border-border px-4 py-3 " +
                  (r === "Total"
                    ? FUNDO_TOTAL + " font-bold text-foreground"
                    : "bg-muted/60 font-medium text-secondary-ink") +
                  (i === 0 ? " rounded-tl-xl" : "") +
                  (i === ROTULOS.length - 1 ? " rounded-bl-xl border-b" : "")
                }
              >
                {r}
              </span>
            ))}
          </div>
          {colunas.map((c, idx) => (
            <div
              key={c.jogador}
              role="group"
              aria-label={NOME_DO_JOGADOR[c.jogador]}
              className={
                "relative row-span-7 grid grid-rows-subgrid " +
                (ehVencedor(c)
                  ? "z-10 rounded-xl shadow-lg shadow-success/15 ring-2 ring-success/60"
                  : "")
              }
            >
              <span
                className={
                  "mx-px flex flex-col items-center justify-end gap-1 rounded-t-xl px-3 pb-2.5 pt-2 text-center " +
                  (ehVencedor(c) ? "bg-success/10" : "bg-muted")
                }
              >
                {ehVencedor(c) && <SeloMelhor />}
                <NomeDoMarketplace j={c.jogador} grande />
                {(c.oferta?.prime || ehMenor(c)) && (
                  <span className="flex flex-wrap justify-center gap-1">
                    {c.oferta?.prime && <SeloPrime />}
                    {ehMenor(c) && <SeloMenorNoProduto />}
                  </span>
                )}
              </span>
              {ROTULOS.map((r, i) => (
                <span
                  key={r}
                  className={
                    "flex items-center justify-center border-r border-t border-border px-3 py-3 text-center " +
                    (r === "Total" ? FUNDO_TOTAL : "bg-card") +
                    (i === ROTULOS.length - 1 ? " border-b" : "") +
                    (i === ROTULOS.length - 1 && idx === colunas.length - 1 ? " rounded-br-xl" : "")
                  }
                >
                  {celula(c, r)}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Espaço estreito (celular): um cartão por marketplace. */}
        <ul className="mt-4 space-y-3 @2xl:hidden">
          {colunas.map((c) => (
            <li
              key={c.jogador}
              className={
                "rounded-2xl border bg-card p-3 " +
                (ehVencedor(c)
                  ? "border-success/60 shadow-lg shadow-success/15 ring-2 ring-success/40"
                  : "border-border")
              }
            >
              {(ehVencedor(c) || ehMenor(c) || c.oferta?.prime) && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {ehVencedor(c) && <SeloMelhor />}
                  {ehMenor(c) && <SeloMenorNoProduto />}
                  {c.oferta?.prime && <SeloPrime />}
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <NomeDoMarketplace j={c.jogador} grande />
                </span>
                <span className="shrink-0 text-[13px]">
                  <Correspondencia c={c} />
                </span>
              </div>
              {c.oferta && (
                <dl className="mt-3 overflow-hidden rounded-xl border border-border text-[13px]">
                  {(["Produto", "Frete", "Total", "Vendedor"] as const).map((r) => (
                    <div
                      key={r}
                      className={
                        "flex items-start justify-between gap-3 border-t border-border px-3 py-2 first:border-t-0 " +
                        (r === "Total" ? FUNDO_TOTAL : "")
                      }
                    >
                      <dt
                        className={r === "Total" ? "font-bold" : "font-medium text-secondary-ink"}
                      >
                        {r}
                      </dt>
                      <dd className="min-w-0 text-right">
                        {r === "Total" ? (
                          <Total c={c} colado={colado} direita />
                        ) : r === "Vendedor" ? (
                          <Vendedor c={c} direita />
                        ) : (
                          celula(c, r)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-3">
                <Acao c={c} colado={colado} gerarLink={gerarLink} verAlternativa={verAlternativa} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ALTERNATIVAS PARECIDAS */}
      {parecidos.length > 0 && (
        <div className="mt-6">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <strong className="text-xl tracking-tight">Alternativas parecidas</strong>
            <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
            <span className="text-[13px] text-secondary-ink">
              São produtos diferentes. Confira as características.
            </span>
          </p>
          <ul className="mt-3 grid gap-3 @3xl:grid-cols-2">
            {parecidos.map((l) => (
              <CartaoAlternativa
                key={`${l.marketplace}:${l.id}`}
                l={l}
                colado={colado}
                ancora={ancoras.get(`${l.marketplace}:${l.id}`)}
                destacado={destaque === l.marketplace && ancoras.has(`${l.marketplace}:${l.id}`)}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-secondary-ink">
        Links de afiliado. Frete e condições dependem do CEP (na Amazon e na Shopee, confira no
        anúncio). Valores de referência conferidos no momento da análise. Site independente, sem
        vínculo com Mercado Livre, Amazon ou Shopee; as marcas pertencem aos seus titulares.
      </p>
    </section>
  );
}
