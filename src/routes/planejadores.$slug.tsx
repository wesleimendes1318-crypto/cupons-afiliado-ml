/* LIFE-EVENT PLANNER (Weslei, 06/11/2026): see src/lib/planejadores.ts. */
import { ClientOnly, createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useRegiaoGuardada } from "@/components/CepDestino";
import { CompartilharListaPublica } from "@/components/CompartilharListaPublica";
import { CartaoItemPlanejador } from "@/components/planejadores/CartaoItemPlanejador";
import { OnboardingPlanejador } from "@/components/planejadores/OnboardingPlanejador";
import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { supabase } from "@/integrations/supabase/client";
import { itemDoProduto } from "@/lib/lista-desejos";
import { lerListaPublica, salvarListaPublica, SITE, type Presente } from "@/lib/lista-publica";
import {
  chaveDoPlano,
  dataDo,
  diasAte,
  estadoInicial,
  FASES,
  itemDe,
  itensDoPresente,
  lerEstado,
  alternarEscolhido,
  mudarItem,
  planejadorDo,
  resumir,
  textoDaFase,
  type EstadoPlano,
  type Fase,
  type Planejador,
} from "@/lib/planejadores";
import { voltagemDaRegiao } from "@/lib/voltagem";

export const Route = createFileRoute("/planejadores/$slug")({
  loader: ({ params }) => {
    const p = planejadorDo(params.slug);
    if (!p) throw notFound();
    return { slug: p.slug };
  },
  head: ({ params }) => {
    const p = planejadorDo(params.slug);
    const titulo = p
      ? `Lista de compras para ${p.titulo.toLowerCase()} por prioridade`
      : "Planejador | Melhor Escolha";
    const descricao = p
      ? `${p.resumo} Escolha os produtos, veja quanto falta e compartilhe a lista de presentes no WhatsApp.`
      : "";
    const url = `${SITE}/planejadores/${params.slug}`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PaginaPlanejador,
});

const reais = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
type Aba = Fase | "esquecidos";

function PaginaPlanejador() {
  const { slug } = Route.useLoaderData();
  const p = planejadorDo(slug)!;
  return (
    <div className="fundo-conteudo min-h-screen overflow-x-clip">
      <main className="mx-auto flex max-w-[960px] flex-col gap-5 px-4 pb-16 pt-6 sm:px-6">
        <header className="animate-conteudo">
          <Link
            to="/planejadores"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0071e3]"
          >
            ‹ Planejadores
          </Link>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-[40px]">
            {p.emoji} {p.titulo}
            <span className="block text-[#0071e3]">o que comprar primeiro.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-secondary-ink">
            {p.resumo} Cada item abre ofertas reais para você escolher, e o que pedir de presente
            vira uma lista para mandar no WhatsApp.
          </p>
        </header>
        <ClientOnly fallback={<div className="esqueleto h-64 rounded-3xl" aria-hidden="true" />}>
          <Conteudo p={p} />
        </ClientOnly>
      </main>
      <RodapeInstitucional />
    </div>
  );
}

function Conteudo({ p }: { p: Planejador }) {
  const chave = chaveDoPlano(p.slug);
  const [estado, setEstado] = useState<EstadoPlano>(() => {
    try {
      return lerEstado(JSON.parse(localStorage.getItem(chave) ?? "null"), p);
    } catch {
      return estadoInicial();
    }
  });
  const [aba, setAba] = useState<Aba>(1);
  const [presentes, setPresentes] = useState<Record<string, Presente>>({});
  const guardada = useRegiaoGuardada();
  const regiao = guardada ? voltagemDaRegiao(guardada.cidade, guardada.uf) : null;
  const slot = `planejador-${p.slug}`;

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(estado));
    } catch {
      /* private mode: the planner still works for this visit */
    }
  }, [chave, estado]);

  /* Gifts guests marked on the public list. */
  useEffect(() => {
    if (!estado.listaId) return;
    void supabase
      .rpc("lista_publica" as never, { p_id: estado.listaId } as never)
      .then(({ data }) => {
        const l = lerListaPublica(data);
        if (l) setPresentes(l.presentes);
      });
  }, [estado.listaId]);

  /* Once shared, the same link follows the gift picks (1.5 s after the last change). */
  const presentesJson = JSON.stringify(itensDoPresente(p, estado).map((i) => i.id));
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const itens = itensDoPresente(p, estado);
    if (!estado.listaId || !itens.length) return;
    const t = setTimeout(
      () => void salvarListaPublica({ titulo: "", ocasiao: p.ocasiao, itens }, slot),
      1_500,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentesJson]);

  if (!estado.configurado)
    return (
      <OnboardingPlanejador
        pergunta={dataDo(p).pergunta}
        inicial={estado}
        regiao={regiao}
        aoConcluir={(x) => setEstado((e) => ({ ...e, ...x, configurado: true }))}
      />
    );

  const fase = aba === "esquecidos" ? undefined : aba;
  const r = resumir(p, estado, fase);
  const geral = resumir(p, estado);
  const dias = diasAte(estado.data);
  const itens = p.itens.filter((it) => (aba === "esquecidos" ? it.esquecido : it.fase === aba));
  const doPresente = itensDoPresente(p, estado);
  const pct = r.total ? Math.round((r.resolvidos / r.total) * 100) : 0;

  return (
    <>
      <div className="vidro-barra sticky top-16 z-20 rounded-3xl p-3 sm:p-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[15px] font-extrabold tracking-tight">
            {geral.essenciaisSemProduto === 0 && geral.faltaEssencial === 0
              ? "Essencial resolvido"
              : geral.faltaEssencial === 0
                ? "Escolha os produtos do essencial"
                : `Faltam ${reais(geral.faltaEssencial)} do essencial`}
          </p>
          <p className="text-xs text-secondary-ink">
            {dias != null &&
              (dias > 0
                ? `${dias} ${dias === 1 ? "dia" : "dias"} para ${dataDo(p).evento} · `
                : dias === 0
                  ? "É hoje · "
                  : "")}
            {r.resolvidos} de {r.total}{" "}
            {aba === "esquecidos" ? "fáceis de esquecer" : `em ${FASES[aba].rotulo.toLowerCase()}`}
          </p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Itens resolvidos"
        >
          <div
            className="relative h-full overflow-hidden rounded-full bg-[#34c759] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          >
            {/* Shines once each time the bar grows (key = value). */}
            <span
              key={pct}
              className="animate-plano-brilho absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
            />
          </div>
        </div>
        <p className="mt-1.5 truncate text-[11px] text-secondary-ink">
          {geral.essenciaisSemProduto > 0 &&
            `${geral.essenciaisSemProduto} essenciais sem produto escolhido · `}
          {estado.orcamento
            ? `Comprado: ${reais(geral.gasto)} de ${reais(estado.orcamento)}`
            : `Comprado: ${reais(geral.gasto)}`}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Fases"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {([1, 2, 3, "esquecidos"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] " +
              (aba === a ? "bg-[#0071e3] text-white" : "bg-card ring-1 ring-border")
            }
          >
            {a === "esquecidos" ? (
              "💡 Fáceis de esquecer"
            ) : (
              <>
                <span
                  className="size-2 rounded-full"
                  style={{ background: FASES[a].cor }}
                  aria-hidden="true"
                />
                {FASES[a].rotulo}
              </>
            )}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-sm text-secondary-ink">
        {aba === "esquecidos"
          ? "Coisas baratas que costumam ficar para depois e fazem falta logo na primeira semana."
          : `${textoDaFase(p, aba)}`}
        <span className="mt-0.5 block text-xs">
          Os valores somam só os produtos que você escolheu, sem o frete quando ele não é grátis.
        </span>
      </p>

      <ul key={String(aba)} className="grid items-start gap-3 sm:grid-cols-2">
        {itens.map((it, k) => (
          <CartaoItemPlanejador
            key={it.id}
            item={it}
            emoji={p.emoji}
            estado={itemDe(estado, it.id)}
            estilo={estado.estilo}
            volts={estado.volts}
            presenteDeAlguem={(() => {
              const ids = itemDe(estado, it.id).escolhidos.map((y) => y.id);
              return ids.map((id) => presentes[id]).find(Boolean);
            })()}
            atraso={k}
            aoMudar={(f) => setEstado((e) => mudarItem(e, it.id, f))}
            aoEscolher={(res, presente) => {
              const escolhido = itemDoProduto({
                chave: res.item || res.produto,
                titulo: res.nome,
                preco: res.preco,
                foto: res.imagem,
                url: res.url,
              });
              if (escolhido)
                setEstado((e) =>
                  mudarItem(e, it.id, (x) => alternarEscolhido(x, escolhido, presente)),
                );
            }}
          />
        ))}
      </ul>

      <section
        aria-label="Lista de presentes"
        className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6"
      >
        <h2 className="text-lg font-extrabold tracking-tight">🎁 Lista de presentes</h2>
        <p className="mt-1 text-sm text-secondary-ink">
          {doPresente.length
            ? `${doPresente.length} ${doPresente.length === 1 ? "item pedido" : "itens pedidos"} de presente. Quem abrir o link compra e marca o que já comprou, para ninguém repetir.`
            : "Toque em “Pedir de presente” nos itens que você quer ganhar. Eles entram numa lista para mandar no WhatsApp."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <CompartilharListaPublica
            itens={doPresente}
            ocasiaoFixa={p.ocasiao}
            slot={`planejador-${p.slug}`}
            rotulo={estado.listaId ? "Ver link da lista" : "Criar lista de presentes"}
            aoGerar={(id) => setEstado((e) => ({ ...e, listaId: id }))}
          />
          {estado.listaId && (
            <Link
              to="/lista/$id"
              params={{ id: estado.listaId }}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-[#0071e3]"
            >
              Abrir como convidado
            </Link>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setEstado((e) => ({ ...e, configurado: false }))}
        className="mx-auto min-h-11 text-sm font-semibold text-secondary-ink"
      >
        Mudar preferências (estilo, data, voltagem)
      </button>
    </>
  );
}
