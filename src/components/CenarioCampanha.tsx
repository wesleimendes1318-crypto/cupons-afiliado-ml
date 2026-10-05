/* CENÁRIO DE ESTÚDIO DAS CAMPANHAS (Weslei, 05/10: "as artes devem ter como
   base esses exemplos! é um cenário que simula um estúdio, com o fundo
   ripado"; depois: "deixar as artes mais elaboradas. integre melhor na
   vitrine. ajuste para as demais vitrines").

   - A arte não fica num quadro: ocupa a lateral do destaque e se funde no
     fundo da seção (máscara em degradê), como um banner.
   - Tema com arte de estúdio (Crianças, Natal, Black Friday): a foto 3D do
     Weslei, com câmera lenta e reflexo. As fotos reais dos produtos entram
     num cartão de comparação flutuante, fora da máscara (sem corte, sem
     filtro).
   - Demais temas (tecnologia, casa, beleza, marca): o mesmo estúdio
     montado em CSS (parede ripada, arco, piso, pedestais e cartão de
     comparação com ✓), nas cores do tema, com as fotos reais dos produtos
     nos pedestais; sem foto, ícones do tema.
   - Só decoração (aria-hidden). Movimento desliga com
     prefers-reduced-motion. */
import { useId, type CSSProperties, type ComponentType } from "react";
import {
  Armchair,
  Blocks,
  Check,
  Flower2,
  Gem,
  Gift,
  Headphones,
  Lamp,
  ShoppingBag,
  Sparkles,
  Tag,
  TreePine,
  Watch,
} from "lucide-react";

import { useArteSalva } from "@/lib/artes-salvas";
import { TEMAS_VISUAIS, type TemaVisualId } from "@/lib/campanha-visual";

type Estudio = {
  parede: string;
  paredeEscura: string;
  ripa: string;
  ripaClara: string;
  ripaSombra: string;
  arco: string;
  arcoClaro: string;
  piso: string;
  pisoEscuro: string;
  pedestal: string;
  pedestalTopo: string;
  pedestalSombra: string;
};

const ESTUDIO: Record<TemaVisualId, Estudio> = {
  criancas: {
    parede: "#e9e2ff",
    paredeEscura: "#d9cdfb",
    ripa: "#cfc0f7",
    ripaClara: "#e4dafd",
    ripaSombra: "#b8a5ef",
    arco: "#c9b8f6",
    arcoClaro: "#ece5ff",
    piso: "#cdbff3",
    pisoEscuro: "#b9a8ec",
    pedestal: "#d3c5f8",
    pedestalTopo: "#eee8ff",
    pedestalSombra: "#b19ce9",
  },
  natal: {
    parede: "#164a37",
    paredeEscura: "#0f3a2b",
    ripa: "#14402f",
    ripaClara: "#1d5640",
    ripaSombra: "#0b2d21",
    arco: "#1b5340",
    arcoClaro: "#246650",
    piso: "#103827",
    pisoEscuro: "#0b2b1e",
    pedestal: "#1a4d3a",
    pedestalTopo: "#2a6a52",
    pedestalSombra: "#0e3326",
  },
  black_friday: {
    parede: "#2b2266",
    paredeEscura: "#1f1850",
    ripa: "#3a2d8a",
    ripaClara: "#5442b8",
    ripaSombra: "#221a5a",
    arco: "#4a39a6",
    arcoClaro: "#6b55d6",
    piso: "#2a2170",
    pisoEscuro: "#1c1650",
    pedestal: "#4535a0",
    pedestalTopo: "#6a56d4",
    pedestalSombra: "#2a2070",
  },
  tecnologia: {
    parede: "#e8eefb",
    paredeEscura: "#d9e3f7",
    ripa: "#dfe7f6",
    ripaClara: "#f4f7fd",
    ripaSombra: "#c6d2ea",
    arco: "#d9e4fa",
    arcoClaro: "#ffffff",
    piso: "#d3ddf2",
    pisoEscuro: "#c1cde8",
    pedestal: "#e6ecf8",
    pedestalTopo: "#ffffff",
    pedestalSombra: "#c7d2e8",
  },
  casa: {
    parede: "#f5ebe0",
    paredeEscura: "#ecdccb",
    ripa: "#e6cfb8",
    ripaClara: "#f3e4d4",
    ripaSombra: "#d2b598",
    arco: "#e9cdb3",
    arcoClaro: "#fbf3ea",
    piso: "#e3cdb6",
    pisoEscuro: "#d4b99d",
    pedestal: "#ead6c1",
    pedestalTopo: "#f9efe5",
    pedestalSombra: "#cfb293",
  },
  beleza: {
    parede: "#fbe9ee",
    paredeEscura: "#f5d7e0",
    ripa: "#f1c9d5",
    ripaClara: "#fae3ea",
    ripaSombra: "#e1aebf",
    arco: "#f2cdd8",
    arcoClaro: "#fff4f7",
    piso: "#efcfd9",
    pisoEscuro: "#e2b9c8",
    pedestal: "#f4d9e2",
    pedestalTopo: "#fff6f8",
    pedestalSombra: "#ddb0c0",
  },
  neutro: {
    parede: "#eef1f6",
    paredeEscura: "#e2e7ef",
    ripa: "#e3e8f0",
    ripaClara: "#f7f9fc",
    ripaSombra: "#cdd5e1",
    arco: "#e1e9f6",
    arcoClaro: "#ffffff",
    piso: "#dfe5ee",
    pisoEscuro: "#cfd7e3",
    pedestal: "#eaeef5",
    pedestalTopo: "#ffffff",
    pedestalSombra: "#cbd3df",
  },
};

type Icone = ComponentType<{ className?: string; strokeWidth?: number }>;
const ICONES: Record<TemaVisualId, [Icone, Icone]> = {
  criancas: [Blocks, Gift],
  natal: [Gift, TreePine],
  black_friday: [ShoppingBag, Tag],
  tecnologia: [Headphones, Watch],
  casa: [Lamp, Armchair],
  beleza: [Sparkles, Flower2],
  neutro: [ShoppingBag, Gem],
};

export type Fusao = "esquerda" | "baixo" | "ambos" | "vertical" | "nenhuma";

const MASCARAS: Record<Fusao, string | null> = {
  esquerda: "linear-gradient(to right, transparent 0%, #000 30%)",
  baixo: "linear-gradient(to bottom, #000 62%, transparent 100%)",
  ambos:
    "linear-gradient(to right, transparent 0%, #000 30%), linear-gradient(to bottom, #000 72%, transparent 100%)",
  vertical: "linear-gradient(to bottom, transparent 0%, #000 16%, #000 80%, transparent 100%)",
  nenhuma: null,
};

function estiloMascara(f: Fusao): CSSProperties {
  const m = MASCARAS[f];
  if (!m) return {};
  const duas = f === "ambos";
  return {
    maskImage: m,
    WebkitMaskImage: m,
    ...(duas ? { maskComposite: "intersect", WebkitMaskComposite: "source-in" } : {}),
  };
}

const fotoGrande = (u: string) =>
  u.replace(/^http:/, "https:").replace(/-[A-Z](\.(?:webp|jpg|jpeg|png))$/i, "-O$1");

/* Foto real num ladrilho branco (sem corte: object-contain). */
function Ladrilho({
  src,
  Icone,
  cor,
  className = "",
}: {
  src?: string | undefined;
  Icone: Icone;
  cor: string;
  className?: string;
}) {
  return (
    <span
      className={`absolute aspect-square overflow-hidden rounded-[18%] bg-white shadow-[0_14px_24px_-12px_rgba(0,0,0,0.4)] ring-1 ring-black/5 ${className}`}
    >
      {src ? (
        <img
          src={fotoGrande(src)}
          width={200}
          height={200}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-contain p-[9%]"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center" style={{ color: cor }}>
          <Icone className="h-1/2 w-1/2" strokeWidth={1.6} />
        </span>
      )}
    </span>
  );
}

/* Pedestal cilíndrico (topo em elipse, corpo com luz lateral). */
function Pedestal({ e, className = "" }: { e: Estudio; className?: string }) {
  const id = `ped-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return (
    <svg viewBox="0 0 100 34" className={`absolute ${className}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor={e.pedestalSombra} />
          <stop offset="0.35" stopColor={e.pedestal} />
          <stop offset="1" stopColor={e.pedestalSombra} />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="31" rx="50" ry="3" fill="#000" opacity="0.12" />
      <path d="M0 8 v20 a50 6 0 0 0 100 0 v-20 z" fill={`url(#${id})`} />
      <ellipse cx="50" cy="8" rx="50" ry="7.5" fill={e.pedestalTopo} />
    </svg>
  );
}

/* Cartão de comparação do estúdio: duas colunas com ladrilho e ✓. */
function CartaoComparacao({
  fotos,
  icones,
  cor,
  className = "",
}: {
  fotos: string[];
  icones: [Icone, Icone];
  cor: string;
  className?: string;
}) {
  return (
    <span
      className={`absolute grid grid-cols-2 gap-[6%] rounded-[10%] bg-white/85 p-[5%] shadow-[0_18px_30px_-16px_rgba(0,0,0,0.35)] ring-1 ring-white/70 backdrop-blur-sm ${className}`}
    >
      {[0, 1].map((k) => {
        const Icone = icones[k]!;
        return (
          <span key={k} className="flex flex-col gap-[8%]">
            <span className="relative aspect-square overflow-hidden rounded-[14%] bg-[#f3f4f8]">
              {fotos[k] ? (
                <img
                  src={fotoGrande(fotos[k]!)}
                  width={120}
                  height={120}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full object-contain p-[10%] mix-blend-multiply"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center" style={{ color: cor }}>
                  <Icone className="h-1/2 w-1/2" strokeWidth={1.6} />
                </span>
              )}
            </span>
            {[0, 1, 2].map((l) => (
              <span key={l} className="flex items-center gap-[8%]">
                <span className="grid aspect-square w-[22%] shrink-0 place-items-center rounded-full bg-[#34c759]">
                  <Check className="h-[70%] w-[70%] text-white" strokeWidth={3.5} />
                </span>
                <span
                  className="h-[5px] rounded-full bg-[#d7dbe4]"
                  style={{ width: `${[78, 60, 70][l]}%` }}
                />
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

/* Estúdio montado em CSS para os temas sem arte própria. */
function EstudioCss({ tema, fotos, cor }: { tema: TemaVisualId; fotos: string[]; cor: string }) {
  const e = ESTUDIO[tema];
  const icones = ICONES[tema];
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${e.parede} 0%, ${e.paredeEscura} 74%, ${e.piso} 74%, ${e.pisoEscuro} 100%)`,
      }}
    >
      {/* parede ripada */}
      <span
        className="absolute left-[22%] top-0 h-[74%] w-[34%]"
        style={{
          background: `repeating-linear-gradient(90deg, ${e.ripaClara} 0 14px, ${e.ripa} 14px 22px, ${e.ripaSombra} 22px 25px)`,
          boxShadow: `inset 0 -30px 40px -20px ${e.paredeEscura}`,
        }}
      />
      {/* arco */}
      <span
        className="absolute right-[3%] top-[8%] h-[66%] w-[42%] rounded-t-[999px]"
        style={{
          background: `linear-gradient(160deg, ${e.arcoClaro} 0%, ${e.arco} 70%)`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.35)`,
        }}
      />
      {/* luz no piso */}
      <span
        className="absolute bottom-0 left-[20%] h-[26%] w-[80%]"
        style={{
          background:
            "radial-gradient(60% 70% at 55% 40%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      <CartaoComparacao
        fotos={fotos}
        icones={icones}
        cor={cor}
        className="right-[9%] top-[12%] w-[34%]"
      />
      {/* pedestais com os produtos */}
      <Pedestal e={e} className="bottom-[7%] left-[33%] h-[19%] w-[30%]" />
      <Ladrilho
        src={fotos[0]}
        Icone={icones[0]}
        cor={cor}
        className="bottom-[22%] left-[37%] w-[22%]"
      />
      <Pedestal e={e} className="bottom-[4%] right-[5%] h-[13%] w-[24%]" />
      <Ladrilho
        src={fotos[1]}
        Icone={icones[1]}
        cor={cor}
        className="bottom-[13.5%] right-[9%] w-[16%] rotate-2"
      />
    </div>
  );
}

export function CenarioCampanha({
  tema,
  fotos = [],
  fundir = "esquerda",
  className = "",
}: {
  tema: TemaVisualId;
  fotos?: Array<string | null | undefined>;
  fundir?: Fusao;
  /* Sem efeito desde 05/10 (cartão flutuante removido); aceito para não
     quebrar quem ainda passa. */
  cartao?: boolean;
  className?: string;
}) {
  const t = TEMAS_VISUAIS[tema];
  const salva = useArteSalva(tema);
  const arte = t.imagem?.estudio ? t.imagem.src : (salva ?? null);
  const reais = fotos.filter((f): f is string => !!f && /^https?:\/\//.test(f)).slice(0, 2);
  const cor = t.paleta.destaque;
  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
      <div className="absolute inset-0 overflow-hidden" style={estiloMascara(fundir)}>
        {arte ? (
          <img
            src={arte}
            width={t.imagem?.largura ?? 1536}
            height={t.imagem?.altura ?? 1024}
            alt=""
            className="campanha-camera absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "50% 40%" }}
          />
        ) : (
          <EstudioCss tema={tema} fotos={reais} cor={cor} />
        )}
        <span className="campanha-reflexo" />
      </div>
      {/* Sem cartão flutuante sobre a arte (Weslei, 05/10: "remova esses
          cards, estão estragando a vitrine"); as fotos reais ficam nos
          cartões de oferta logo abaixo. */}
    </div>
  );
}
