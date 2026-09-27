/* Vídeo "Como funciona" (28 s), junto da caixa do link (Weslei, 27/09).

   - Primeiro acesso: toca sozinho, sem som (os navegadores só deixam o vídeo
     começar sozinho se estiver mudo), com "Ativar som" e "Fechar".
   - Depois: fica um botão compacto; o vídeo só toca se o cliente pedir.
   - Some quando a comparação começa (quem controla é BuscaPorLink).
   - Um exemplo só no vídeo (kit com 2 óleos capilares, 25/09: R$ 428,90 →
     R$ 291,95), para não misturar preços de produtos diferentes; link
     ilustrativo e sem marca do produto (direitos de marca).
   - Quem pede menos movimento no sistema não recebe o vídeo tocando sozinho.
   - Celular: vídeo vertical. Tela larga: horizontal. */

import { useEffect, useRef, useState } from "react";
import { Play, Volume2, X } from "lucide-react";

const CHAVE_VISTO = "me_video_como_funciona_v2";
const VIDEO = {
  vertical: {
    webm: "/video/como-funciona-v2-vertical.webm",
    mp4: "/video/como-funciona-v2-vertical.mp4",
    poster: "/video/como-funciona-v2-vertical.jpg",
  },
  horizontal: {
    webm: "/video/como-funciona-v2-horizontal.webm",
    mp4: "/video/como-funciona-v2-horizontal.mp4",
    poster: "/video/como-funciona-v2-horizontal.jpg",
  },
};

type Modo = "compacto" | "automatico" | "aberto";

function jaViu(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_VISTO) === "1";
  } catch {
    return true; /* sem armazenamento: não insiste em tocar sozinho */
  }
}

function marcarVisto() {
  try {
    window.localStorage.setItem(CHAVE_VISTO, "1");
  } catch {
    /* ignora */
  }
}

export function ComoFunciona() {
  const [modo, setModo] = useState<Modo>("compacto");
  const [vertical, setVertical] = useState(false);
  const [comSom, setComSom] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVertical(window.matchMedia("(max-width: 640px)").matches);
    const poucoMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!jaViu() && !poucoMovimento) {
      setModo("automatico");
      /* Conta como visto já no primeiro play: a próxima visita não toca de novo. */
      marcarVisto();
    }
  }, []);

  /* React não repassa "muted" como atributo: sem isso o navegador pode
     recusar o início automático. */
  useEffect(() => {
    const v = ref.current;
    if (!v || modo !== "automatico" || comSom) return;
    v.muted = true;
    void v.play().catch(() => setModo("compacto"));
  }, [modo, comSom, vertical]);

  const fonte = vertical ? VIDEO.vertical : VIDEO.horizontal;

  if (modo === "compacto") {
    return (
      <button
        type="button"
        onClick={() => {
          setComSom(true);
          setModo("aberto");
        }}
        className="mt-3 flex w-full items-center gap-3 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-ml-blue"
      >
        <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
          <img
            src={VIDEO.horizontal.poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <Play className="size-5 fill-white text-white" aria-hidden="true" />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">Como funciona</span>
          <span className="block text-xs text-secondary-ink">Vídeo de 28 segundos</span>
        </span>
      </button>
    );
  }

  const automatico = modo === "automatico";
  return (
    <figure className="relative mt-3">
      <video
        ref={ref}
        key={`${fonte.mp4}-${modo}`}
        poster={fonte.poster}
        autoPlay
        muted={automatico && !comSom}
        playsInline
        controls={!automatico || comSom}
        preload={automatico ? "auto" : "metadata"}
        onEnded={() => setModo("compacto")}
        aria-label="Como funciona o comparador, em 28 segundos"
        className={
          "mx-auto block rounded-xl bg-black shadow-sm " +
          (vertical ? "max-h-[72vh] w-auto max-w-full" : "aspect-video w-full")
        }
      >
        {/* WebM (VP9) primeiro, MP4 (H.264) para quem não toca WebM (iPhone antigo). */}
        <source src={fonte.webm} type="video/webm" />
        <source src={fonte.mp4} type="video/mp4" />
      </video>
      <div className="absolute right-2 top-2 flex gap-2">
        {automatico && !comSom && (
          <button
            type="button"
            onClick={() => {
              setComSom(true);
              const v = ref.current;
              if (v) {
                v.muted = false;
                void v.play().catch(() => undefined);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-black/85"
          >
            <Volume2 className="size-4" aria-hidden="true" />
            Ativar som
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            ref.current?.pause();
            setModo("compacto");
          }}
          aria-label="Fechar o vídeo"
          className="grid size-8 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/85"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <figcaption className="mt-1.5 text-center text-[11px] text-secondary-ink">
        Exemplo real de 25/09/2026, com link ilustrativo. Preços mudam.
      </figcaption>
    </figure>
  );
}

/* Versão para páginas de conteúdo (Sobre): só toca se a pessoa pedir. */
export function VideoComoFuncionaEstatico() {
  return (
    <figure className="not-prose my-4">
      <video
        poster={VIDEO.horizontal.poster}
        controls
        playsInline
        preload="none"
        aria-label="Como funciona o comparador, em 28 segundos"
        className="aspect-video w-full rounded-xl bg-black"
      >
        <source src={VIDEO.horizontal.webm} type="video/webm" />
        <source src={VIDEO.horizontal.mp4} type="video/mp4" />
      </video>
      <figcaption className="mt-1.5 text-center text-xs text-secondary-ink">
        Como funciona, em 28 segundos. Exemplo real de 25/09/2026, com link ilustrativo; preços mudam.
      </figcaption>
    </figure>
  );
}
