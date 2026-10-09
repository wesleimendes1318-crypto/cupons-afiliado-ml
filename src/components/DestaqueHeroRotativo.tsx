/* DESTAQUE ROTATIVO DO TOPO (Weslei, 09/10, "animações e vitrine rotativa
   no hero"): no PC, à direita da caixa do link.
   - Itens: o institucional (fones + "Compare com clareza"), as artes das
     categorias fortes (src/lib/artes.ts) e, quando houver, UMA oferta real
     de campanha ativa (foto, nome, economia e link de afiliado validado;
     sem link de afiliado, a oferta não entra).
   - Troca a cada 7 s com fade de 500 ms; pausa no mouse/toque/foco, com a
     aba oculta e pelo botão; pontos acessíveis por teclado.
   - O cartão de vidro e os textos ficam FIXOS; só a imagem flutua 4 px num
     ciclo de 6 s. prefers-reduced-motion: sem troca automática e sem
     flutuação.
   - Timers só depois de montar (nada muda no HTML do servidor). */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Package, Pause, Play, Search, ShieldCheck } from "lucide-react";

import { ehLinkDeCompra } from "@/lib/afiliado";
import { ARTES, srcArte, type Arte } from "@/lib/artes";
import { ofertaDaCampanha, useCampanhasAtivas } from "@/lib/campanhas-publicas";

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

const TROCA_MS = 7000;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fotoGrande = (u: string) =>
  u.replace(/^http:/, "https:").replace(/-[A-Z](\.(?:webp|jpg|jpeg|png))$/i, "-O$1");

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
          imagem: fotoGrande(o.imagem),
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
      {/* Imagens (só elas mudam e flutuam). */}
      <div className="relative mx-auto aspect-[774/706] w-full max-w-[30rem] [mask-image:radial-gradient(ellipse_75%_80%_at_55%_45%,#000_55%,transparent_100%)]">
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
              <div className="hero-flutua absolute inset-0">
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
                  <img
                    src={srcArte(s.arte.id, true)}
                    alt=""
                    width={960}
                    height={540}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: s.arte.focoCelular }}
                  />
                ) : (
                  <span className="absolute inset-[14%] grid place-items-center rounded-full bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]">
                    <img
                      src={s.imagem}
                      alt=""
                      width={320}
                      height={320}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-[70%] w-[70%] object-contain"
                    />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rótulo do item (muda junto com a imagem, sem mexer no cartão). */}
      <div className="absolute left-2 top-2 max-w-[70%]">
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
              className="campanha-entra inline-flex flex-col rounded-2xl border border-white/30 bg-white/15 px-3 py-2 text-xs backdrop-blur-md hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="font-semibold">Oferta conferida</span>
              <span className="line-clamp-1">{s.titulo}</span>
              <span className="font-bold">{brl(s.economia)} a menos no produto</span>
            </a>
          ) : null,
        )}
      </div>

      {/* Controles: pontos e pausar/reproduzir. */}
      {total > 1 && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2 py-1 backdrop-blur-md">
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

      {/* Cartão de vidro: fixo em todos os itens. */}
      <div className="absolute inset-x-2 -bottom-4 rounded-3xl border border-white/30 bg-white/15 p-4 backdrop-blur-md">
        <p className="border-b border-white/25 pb-2 text-lg font-bold">Compare com clareza</p>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex items-center gap-2.5">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            Mesmo produto em diferentes lojas
          </li>
          <li className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Loja oficial identificada, quando houver
          </li>
          <li className="flex items-center gap-2.5">
            <Package className="size-4 shrink-0" aria-hidden="true" />
            Produtos semelhantes em seção separada
          </li>
        </ul>
      </div>
    </div>
  );
}
