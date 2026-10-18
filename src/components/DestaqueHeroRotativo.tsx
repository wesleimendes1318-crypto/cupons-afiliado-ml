/* DESTAQUE ROTATIVO DO TOPO (Weslei, 09/10, "animações e vitrine rotativa
   no hero"): no PC, à direita da caixa do link.
   - Itens: o institucional (fones + "Compare com clareza"), as artes das
     categorias fortes (src/lib/artes.ts) e, quando houver, UMA oferta real
     de campanha ativa (foto, nome, economia e link de afiliado validado;
     sem link de afiliado, a oferta não entra).
   - Troca a cada 4 s com fade de 500 ms; pausa no mouse/toque/foco, com a
     aba oculta e pelo botão; pontos acessíveis por teclado.
   - O cartão de vidro e os textos ficam FIXOS; só a imagem flutua 4 px num
     ciclo de 6 s. prefers-reduced-motion: sem troca automática e sem
     flutuação.
   - ENQUADRAMENTO (Weslei, 18/10: "melhor ajustado e não competindo com a
     foto"): a imagem fica inteira num quadro de cantos arredondados, sem
     nada por cima; rótulo, pontos e "Compare com clareza" vão ABAIXO dela.
   - Timers só depois de montar (nada muda no HTML do servidor). */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Package, Pause, Play, Search, ShieldCheck } from "lucide-react";

import { ehLinkDeCompra } from "@/lib/afiliado";
import { ARTES, srcArte, srcSetArte, type Arte } from "@/lib/artes";
import { ofertaDaCampanha, useCampanhasAtivas } from "@/lib/campanhas-publicas";
import { propsFotoGrande } from "@/lib/foto";

type Slide =
  | { id: string; tipo: "institucional"; rotulo: string }
  | { id: string; tipo: "categoria"; rotulo: string; arte: Arte; slug: string }
  | {
      id: string;
      tipo: "oferta";
      rotulo: string;
      titulo: string;
      imagem: string;
      economia: number;
      link: string;
    };

const CATEGORIAS_DESTAQUE: Array<{ slug: string; rotulo: string; arte: Arte }> = [
  { slug: "informatica", rotulo: "Tecnologia", arte: ARTES["home-office"] },
  { slug: "casa", rotulo: "Casa e cozinha", arte: ARTES.cozinha },
  { slug: "beleza", rotulo: "Beleza", arte: ARTES["beleza-penteadeira"] },
  { slug: "brinquedos", rotulo: "Brinquedos", arte: ARTES["brinquedos-aprender"] },
];

/* Weslei, 09/10: "está demorando muito para passar os cards" (era 7 s). */
const TROCA_MS = 4000;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A melhor oferta conferida das campanhas ativas (só meli.la, < 24 h). */
function useOfertaEmDestaque(): Slide | null {
  const { campanhas } = useCampanhasAtivas();
  return useMemo(() => {
    for (const c of campanhas ?? []) {
      const ofertas = (c.produtos ?? [])
        .map((p) => ofertaDaCampanha(p))
        .filter(
          (o): o is NonNullable<typeof o> =>
            !!o && !!o.imagem && o.recente && o.economia > 0 && !!o.link,
        )
        .filter((o) => ehLinkDeCompra(o.link, "mercadolivre"))
        .sort((a, b) => b.economia - a.economia);
      const o = ofertas[0];
      if (o?.link && o.imagem)
        return {
          id: `oferta-${o.chave}`,
          tipo: "oferta" as const,
          rotulo: "Oferta conferida",
          titulo: o.titulo,
          imagem: o.imagem,
          economia: o.economia,
          link: o.link,
        };
    }
    return null;
  }, [campanhas]);
}

export function DestaqueHeroRotativo() {
  const oferta = useOfertaEmDestaque();
  const slides = useMemo<Slide[]>(() => {
    const base: Slide[] = [
      { id: "institucional", tipo: "institucional", rotulo: "Compare com clareza" },
      ...CATEGORIAS_DESTAQUE.map((c) => ({
        id: `cat-${c.slug}`,
        tipo: "categoria" as const,
        rotulo: c.rotulo,
        arte: c.arte,
        slug: c.slug,
      })),
    ];
    if (oferta) base.splice(1, 0, oferta);
    return base;
  }, [oferta]);

  const [ativo, setAtivo] = useState(0);
  const [pausadoPeloBotao, setPausadoPeloBotao] = useState(false);
  const [emUso, setEmUso] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [reduzido, setReduzido] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ler = () => setReduzido(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    const vis = () => setOculto(document.hidden);
    vis();
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", ler);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  /* A oferta entra depois de montar: mantém o item que estava na tela. */
  const total = slides.length;
  const indice = Math.min(ativo, total - 1);
  const rodando = !pausadoPeloBotao && !emUso && !oculto && !reduzido && total > 1;
  useEffect(() => {
    if (!rodando) return;
    const t = window.setTimeout(() => setAtivo((i) => (i + 1) % total), TROCA_MS);
    return () => window.clearTimeout(t);
  }, [rodando, indice, total]);

  return (
    <div
      ref={raiz}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative"
      onMouseEnter={() => setEmUso(true)}
      onMouseLeave={() => setEmUso(false)}
      onTouchStart={() => setEmUso(true)}
      onTouchEnd={() => window.setTimeout(() => setEmUso(false), 5000)}
      onFocus={() => setEmUso(true)}
      onBlur={(e) => {
        if (!raiz.current?.contains(e.relatedTarget as Node | null)) setEmUso(false);
      }}
    >
      {/* Imagens (só elas mudam; o quadro flutua junto). */}
      <div className="hero-flutua relative mx-auto aspect-[774/706] w-full max-w-[30rem] overflow-hidden rounded-[2rem] bg-white/10 shadow-[0_30px_60px_-30px_rgba(20,10,60,0.65)] ring-1 ring-white/30">
        {slides.map((s, i) => {
          const visivel = i === indice;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="destaque"
              aria-label={`${i + 1} de ${total}: ${s.rotulo}`}
              aria-hidden={!visivel}
              inert={!visivel}
              className={
                "absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none " +
                (visivel ? "opacity-100" : "pointer-events-none opacity-0")
              }
            >
              <div className="absolute inset-0">
                {s.tipo === "institucional" ? (
                  <img
                    src="/home/hero-fones.webp"
                    alt=""
                    width={774}
                    height={706}
                    className="absolute inset-0 h-full w-full object-cover"
                    fetchPriority="high"
                  />
                ) : s.tipo === "categoria" ? (
                  /* A arte cobre o quadro pela altura (aparece ~780 px de
                     largura): o navegador escolhe 1280 ou 1672 px. */
                  <img
                    src={srcArte(s.arte.id, true)}
                    srcSet={srcSetArte(s.arte.id)}
                    sizes="780px"
                    alt=""
                    width={1280}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: s.arte.focoCelular }}
                  />
                ) : (
                  /* Foto da oferta inteira, no branco que ocupa o quadro. */
                  <span className="absolute inset-0 bg-white">
                    <img
                      {...propsFotoGrande(s.imagem)}
                      alt=""
                      width={320}
                      height={320}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="absolute inset-[10%] h-[80%] w-[80%] object-contain"
                    />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Abaixo do quadro: o rótulo do item à esquerda e os pontos à direita. */}
      <div className="mx-auto mt-3 flex w-full max-w-[30rem] items-center justify-between gap-3">
        <div className="min-w-0">
          {slides.map((s, i) =>
            i !== indice ? null : s.tipo === "categoria" ? (
              <Link
                key={s.id}
                to="/categorias/$slug"
                params={{ slug: s.slug }}
                className="campanha-entra inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-md hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Em destaque: {s.rotulo}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : s.tipo === "oferta" ? (
              <a
                key={s.id}
                href={s.link}
                target="_blank"
                rel="noopener noreferrer sponsored"
                data-origem="hero_oferta"
                className="campanha-entra flex max-w-full flex-col rounded-2xl border border-white/30 bg-white/15 px-3 py-1.5 text-xs backdrop-blur-md hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="truncate">
                  <span className="font-semibold">Oferta conferida:</span> {s.titulo}
                </span>
                <span className="font-bold">{brl(s.economia)} a menos no produto</span>
              </a>
            ) : (
              <span key={s.id} className="text-xs font-semibold text-white/85">
                O mesmo produto, em diferentes lojas
              </span>
            ),
          )}
        </div>
        {total > 1 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2 py-1 backdrop-blur-md">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Mostrar destaque ${i + 1} de ${total}: ${s.rotulo}`}
                aria-current={i === indice ? "true" : undefined}
                onClick={() => setAtivo(i)}
                className={
                  "h-2 rounded-full transition-all duration-300 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white " +
                  (i === indice ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80")
                }
              />
            ))}
            <button
              type="button"
              onClick={() => setPausadoPeloBotao((p) => !p)}
              aria-label={pausadoPeloBotao ? "Reproduzir destaques" : "Pausar destaques"}
              className="ml-0.5 grid size-6 place-items-center rounded-full hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {pausadoPeloBotao ? (
                <Play className="size-3.5" aria-hidden="true" />
              ) : (
                <Pause className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* "Compare com clareza": fixo, abaixo da imagem (nunca sobre ela). */}
      <div className="mx-auto mt-3 w-full max-w-[30rem] rounded-3xl border border-white/25 bg-[#1d1240]/25 px-4 py-3 backdrop-blur-md">
        <p className="text-sm font-bold">Compare com clareza</p>
        <ul className="mt-2 grid grid-cols-3 gap-3 text-xs leading-snug text-white/90">
          <li className="flex flex-col gap-1">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            Mesmo produto em diferentes lojas
          </li>
          <li className="flex flex-col gap-1">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Loja oficial, quando houver
          </li>
          <li className="flex flex-col gap-1">
            <Package className="size-4 shrink-0" aria-hidden="true" />
            Parecidos em seção separada
          </li>
        </ul>
      </div>
    </div>
  );
}
