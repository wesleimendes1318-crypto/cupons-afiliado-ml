/* TRILHOS DE RECOMENDAÇÃO NA HOME (Weslei, 27/10), abaixo da vitrine.
   Pessoais (só com histórico ou buscas): Seu histórico, Semelhantes ao que
   te interessa, Combina com o que você procura, Mais vendidos no seu nicho,
   Mais vendidos para você na temporada. Para todos: Itens que as pessoas
   costumam comprar de novo. E o 2º bloco, Mais desejados e em alta.
   Fontes: mais vendidos oficiais já lidos (em_alta_catalogo), notas lidas nos
   anúncios e o perfil local do aparelho; a seleção fica em
   src/lib/recomendacoes.ts. Trilho com poucos produtos não aparece. Todo
   botão de compra é o VerNaLoja (link de afiliado gerado no clique). */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Flame, Gift, History, Repeat, Shuffle, Sparkles, Target } from "lucide-react";

import { CartaoEmAlta } from "@/components/EmAltaCatalogo";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { TrilhoRecomendacao } from "@/components/recomendacoes/TrilhoRecomendacao";
import { NOS, subarvore } from "@/content/taxonomia";
import { supabase } from "@/integrations/supabase/client";
import { itemDoEndereco, useAvaliacoesPorItens } from "@/lib/avaliacoes-detalhe";
import { classificar } from "@/lib/classificar";
import { propsFotoCartao } from "@/lib/foto";
import {
  atributoProduto,
  limparPerfil,
  limparProdutosVistos,
  temInteracoes,
  usePerfilVisitante,
  type PerfilVisitante,
} from "@/lib/perfil-visitante";
import {
  NOS_RECOMPRA,
  chipDoSemelhante,
  montarHistorico,
  nichoDoVisitante,
  nosComplementares,
  referenciaDoVisitante,
  selecionarComplementos,
  selecionarMaisDesejados,
  selecionarPensados,
  selecionarRecompra,
  selecionarSazonal,
  selecionarSemelhantes,
  type ItemHistorico,
  type ItemRec,
} from "@/lib/recomendacoes";
import { temporadasComOfertas, type Temporada } from "@/lib/sazonal";

const MINIMO = 3;

/* Leituras de uma visita, por conjunto de nós (cada trilho pede o seu). */
const leituras = new Map<string, Promise<ItemRec[]>>();
function lerPorNos(nos: string[], limite: number): Promise<ItemRec[]> {
  const chave = `${nos.join(",")}|${limite}`;
  let p = leituras.get(chave);
  if (!p) {
    p = Promise.resolve(
      supabase.rpc("em_alta_por_no" as never, { p_nos: nos, p_limite: limite } as never),
    )
      .then(({ data }) => (Array.isArray(data) ? (data as ItemRec[]) : []))
      .catch(() => {
        leituras.delete(chave);
        return [];
      });
    leituras.set(chave, p);
  }
  return p;
}
function lerTodasCategorias(): Promise<ItemRec[]> {
  const chave = "v3|40";
  let p = leituras.get(chave);
  if (!p) {
    p = Promise.resolve(
      supabase
        .rpc(
          "em_alta_por_categoria_v3" as never,
          { p_categoria: null, p_por_categoria: 40 } as never,
        )
        .range(0, 999),
    )
      .then(({ data }) => (Array.isArray(data) ? (data as ItemRec[]) : []))
      .catch(() => {
        leituras.delete(chave);
        return [];
      });
    leituras.set(chave, p);
  }
  return p;
}

function useItens(chave: string | null, ler: () => Promise<ItemRec[]>): ItemRec[] {
  const [itens, setItens] = useState<ItemRec[]>([]);
  useEffect(() => {
    if (!chave) {
      setItens([]);
      return;
    }
    let vivo = true;
    void ler().then((l) => {
      if (vivo) setItens(l);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume a leitura
  }, [chave]);
  return itens;
}

/* Notas lidas dos candidatos (uma leitura por conjunto). */
function useNotas(itens: ItemRec[]) {
  const mapa = useAvaliacoesPorItens(itens.map((i) => itemDoEndereco(i.url)));
  return (i: ItemRec) => mapa.get(itemDoEndereco(i.url) ?? "");
}

function comparar(url: string) {
  window.dispatchEvent(new CustomEvent("comparar-link", { detail: url }));
}

function Fileira({
  itens,
  notaDe,
  selo,
}: {
  itens: ItemRec[];
  notaDe: ReturnType<typeof useNotas>;
  selo?: (i: ItemRec) => ReactNode;
}) {
  return (
    <>
      {itens.map((i) => (
        <CartaoEmAlta
          key={i.produto}
          i={i}
          resumo={notaDe(i)}
          grade={false}
          trilho
          onComparar={comparar}
          selo={selo?.(i)}
        />
      ))}
    </>
  );
}

const ICONE = "size-5";

/* 2º BLOCO DA HOME (27/10): "Mais desejados e em alta", uma fileira só,
   com procura comprovada e nota alta lida (selecionarMaisDesejados). */
export function MaisDesejadosHome() {
  const itens = useItens("todas", lerTodasCategorias);
  const notaDe = useNotas(itens);
  const lista = selecionarMaisDesejados(itens, notaDe);
  if (lista.length < MINIMO) return null;
  return (
    <TrilhoRecomendacao
      id="mais-desejados"
      icone={<Flame className={ICONE + " text-[#ff6b00]"} />}
      titulo="Mais desejados e em alta"
      subtitulo="Entre os mais vendidos e mais buscados do Mercado Livre, com nota alta de quem comprou."
      acao={
        <a
          href="#em-alta-titulo"
          className="min-h-9 whitespace-nowrap text-sm font-semibold text-[#0071e3] hover:underline"
        >
          Ver mais<span className="hidden sm:inline"> produtos em alta</span>
        </a>
      }
    >
      <Fileira itens={lista} notaDe={notaDe} />
    </TrilhoRecomendacao>
  );
}

/* 4º BLOCO (27/10): com histórico ou buscas, os trilhos pessoais vêm
   primeiro, num fundo de foco sutil; visitante novo vê só a recompra (a
   tendência já está no 2º bloco) e trilho vazio não aparece. */
export function RecomendacoesHome() {
  const perfil = usePerfilVisitante();
  const pessoal = temInteracoes(perfil);
  /* Temporada pelo relógio do aparelho, depois de montar (o servidor não sabe o dia daqui). */
  const [temporada, setTemporada] = useState<Temporada | null>(null);
  useEffect(() => setTemporada(temporadasComOfertas()[0] ?? null), []);
  return (
    <div data-origem="recomendacoes">
      <TrilhosDeProdutos
        perfil={perfil}
        temporada={pessoal ? temporada : null}
        historico={pessoal ? <TrilhoHistorico perfil={perfil} /> : null}
      />
    </div>
  );
}

function lerHistoricoDoAparelho(): Parameters<typeof montarHistorico>[0] {
  try {
    const l = JSON.parse(window.localStorage.getItem("me_historico_v1") ?? "[]");
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function TrilhoHistorico({ perfil }: { perfil: PerfilVisitante | null }) {
  const [comparados, setComparados] = useState<Parameters<typeof montarHistorico>[0]>([]);
  /* Relê a cada mudança do perfil (toda comparação e todo clique a disparam). */
  useEffect(() => setComparados(lerHistoricoDoAparelho()), [perfil]);
  const itens = useMemo(() => montarHistorico(comparados, perfil), [comparados, perfil]);
  if (!itens.length) return null;
  return (
    <TrilhoRecomendacao
      id="historico"
      icone={<History className={ICONE + " text-[#0071e3]"} />}
      titulo="Seu histórico"
      subtitulo="O que você comparou e abriu neste aparelho. Atualize o preço antes de comprar."
      acao={
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.removeItem("me_historico_v1");
            } catch {
              /* armazenamento bloqueado: some só nesta tela */
            }
            limparProdutosVistos();
            setComparados([]);
          }}
          className="min-h-9 whitespace-nowrap text-xs font-semibold text-secondary-ink underline-offset-2 hover:underline"
        >
          Limpar histórico
        </button>
      }
    >
      {itens.map((h) => (
        <CartaoHistorico key={h.url} h={h} />
      ))}
    </TrilhoRecomendacao>
  );
}

const ehDoMercadoLivre = (u: string) =>
  /mercadolivre\.com\.br|mercadolibre\.com|meli\.la|MLB-?\d/i.test(u);

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (ms: number) =>
  ms > 0
    ? new Date(ms).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : null;

function CartaoHistorico({ h }: { h: ItemHistorico }) {
  return (
    <li
      {...atributoProduto({ titulo: h.titulo, preco: h.preco, foto: h.imagem, url: h.url })}
      className="group flex w-[58%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] min-[480px]:w-[40%] sm:w-[30%] lg:w-[23%] xl:w-[18.5%]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        {h.imagem ? (
          <img
            {...propsFotoCartao(h.imagem)}
            alt=""
            width={300}
            height={300}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-contain p-3"
          />
        ) : (
          <History className="absolute inset-0 m-auto size-6 text-[#86868b]" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col border-t border-border/60 p-3">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{h.titulo}</p>
        <p className="mt-2 text-[11px] text-secondary-ink">
          {h.preco != null && h.preco > 0 ? (
            <>
              Visto{dia(h.em) ? ` em ${dia(h.em)}` : ""} por
              <span className="block text-base font-extrabold tabular-nums text-foreground">
                {brl(h.preco)}
              </span>
            </>
          ) : (
            "Atualize para ver o preço de agora"
          )}
        </p>
        <div className="mt-auto space-y-1.5 pt-3">
          {ehDoMercadoLivre(h.url) && <VerNaLoja url={h.url} grande />}
          <button
            type="button"
            onClick={() => comparar(h.url)}
            className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#0071e3]/40 px-2 py-1.5 text-xs font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            Atualizar preço
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}

/* Trilhos de produtos: calculados juntos para o mesmo produto não se repetir
   de um trilho para o outro (vale o primeiro, na ordem da página). */
function TrilhosDeProdutos({
  perfil,
  temporada,
  historico,
}: {
  perfil: PerfilVisitante | null;
  temporada: Temporada | null;
  historico: ReactNode;
}) {
  const nosComp = useMemo(() => nosComplementares(perfil), [perfil]);
  const comp = useItens(nosComp.length ? nosComp.join(",") : null, () => lerPorNos(nosComp, 300));
  const saz = useItens(temporada?.id ?? null, async () => {
    const [todas, doNo] = await Promise.all([
      lerTodasCategorias(),
      temporada && NOS[temporada.id] ? lerPorNos(subarvore(temporada.id), 100) : [],
    ]);
    return [...doNo, ...todas];
  });
  const rec = useItens("recompra", () => lerPorNos(NOS_RECOMPRA, 400));
  const nicho = useMemo(() => nichoDoVisitante(perfil), [perfil]);
  const pens = useItens(nicho, () => lerPorNos(nicho ? subarvore(nicho) : [], 300));
  const ref = useMemo(() => referenciaDoVisitante(perfil), [perfil]);
  const area = useMemo(() => {
    if (!ref) return null;
    const c = NOS[classificar({ nome: ref.titulo }).no]?.caminho;
    return c ? (c[1] ?? c[0]!) : null;
  }, [ref]);
  const sem = useItens(area, () => lerPorNos(area ? subarvore(area) : [], 400));

  const notaComp = useNotas(comp);
  const notaSaz = useNotas(saz);
  const notaRec = useNotas(rec);
  const notaPens = useNotas(pens);
  const notaSem = useNotas(sem);

  const usados = new Set<string>();
  const unicos = (l: ItemRec[]) => {
    const r = l.filter((i) => !usados.has(i.produto));
    if (r.length >= MINIMO) r.forEach((i) => usados.add(i.produto));
    return r.length >= MINIMO ? r : [];
  };
  const lComp = unicos(selecionarComplementos(comp, notaComp, perfil));
  const lSaz = unicos(selecionarSazonal(saz, notaSaz, perfil, temporada));
  const lRec = unicos(selecionarRecompra(rec, notaRec, perfil));
  /* Semelhantes reserva antes de "Pensados": é o mais ligado ao que ele viu. */
  const lSem = unicos(selecionarSemelhantes(sem, notaSem, perfil, ref));
  const lPens = nicho ? unicos(selecionarPensados(pens, notaPens, perfil)) : [];

  const semelhantes = ref && lSem.length > 0 && (
    <TrilhoRecomendacao
      id="semelhantes"
      icone={<Target className={ICONE + " text-[#0071e3]"} />}
      titulo="Semelhantes ao que te interessa"
      subtitulo={`Parecidos com "${ref.titulo.slice(0, 60)}${ref.titulo.length > 60 ? "…" : ""}", pelo mesmo preço ou menos.`}
    >
      <Fileira
        itens={lSem}
        notaDe={notaSem}
        selo={(i) => (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold leading-tight text-success">
            {chipDoSemelhante(ref, i, notaSem(i))}
          </span>
        )}
      />
    </TrilhoRecomendacao>
  );

  return (
    <>
      {historico != null && (
        /* Some sozinho quando nenhum trilho pessoal tem produto. */
        <div className="mt-8 hidden rounded-[28px] bg-[#0071e3]/[0.04] px-4 pb-6 ring-1 ring-[#0071e3]/15 has-[section]:block sm:px-6">
          <div className="flex items-center justify-between gap-3 pt-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0058b0]">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Para você
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem("me_historico_v1");
                } catch {
                  /* armazenamento bloqueado */
                }
                limparPerfil();
              }}
              className="min-h-9 whitespace-nowrap text-xs font-semibold text-secondary-ink underline-offset-2 hover:underline"
            >
              Limpar preferências
            </button>
          </div>
          <div className="-mt-6">
            {historico}
            {semelhantes}
            {lComp.length > 0 && (
              <TrilhoRecomendacao
                id="complementos"
                icone={<Shuffle className={ICONE + " text-[#0071e3]"} />}
                titulo="Combina com o que você procura"
                subtitulo="Complementos do que você pesquisou, com frete grátis primeiro."
              >
                <Fileira itens={lComp} notaDe={notaComp} />
              </TrilhoRecomendacao>
            )}
            {nicho && lPens.length > 0 && (
              <TrilhoRecomendacao
                id="pensados"
                icone={<Sparkles className={ICONE + " text-[#0071e3]"} />}
                titulo={`Mais vendidos no seu nicho: ${NOS[nicho]!.nome}`}
                subtitulo="Nota 4,5 ou mais de quem comprou e frete grátis confirmado."
              >
                <Fileira itens={lPens} notaDe={notaPens} />
              </TrilhoRecomendacao>
            )}
            {temporada && lSaz.length > 0 && (
              <TrilhoRecomendacao
                id="sazonal"
                icone={<Gift className={ICONE + " text-[#c4122f]"} />}
                titulo={`Mais vendidos para você em ${temporada.nome}`}
                subtitulo={`${temporada.emoji} Ideias de ${temporada.nome} com frete grátis, na faixa de preço que você costuma ver.`}
              >
                <Fileira itens={lSaz} notaDe={notaSaz} />
              </TrilhoRecomendacao>
            )}
          </div>
        </div>
      )}
      {lRec.length > 0 && (
        <TrilhoRecomendacao
          id="recompra"
          icone={<Repeat className={ICONE + " text-success"} />}
          titulo="Itens que as pessoas costumam comprar de novo"
          subtitulo="Produtos de reposição entre os mais vendidos ou muito bem avaliados por quem comprou."
        >
          <Fileira itens={lRec} notaDe={notaRec} />
        </TrilhoRecomendacao>
      )}
    </>
  );
}
