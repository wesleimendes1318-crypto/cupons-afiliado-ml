/* ARTES DAS CAMPANHAS (Weslei, 05/10: "artes encantadoras, símbolos bem
   desenhados... volume suave, profundidade e acabamento refinado").
   Ilustrações próprias em SVG (sem marca de terceiros, sem imagem externa),
   nas cores do tema de cada campanha. Só decoração (aria-hidden): textos,
   preços e botões ficam na interface.
   - ArteSazonal: ilustração principal (presentes de Natal; sacolas e
     etiqueta da Black Friday; balões e blocos do Dia das Crianças).
   - DecoracaoSazonal: detalhes espalhados pelo fundo (neve, confete ou
     pontos de luz), com cintilar breve.
   Movimento: flutuar e cintilar poucas vezes (classes campanha-*, só
   transform/opacity, desligam com prefers-reduced-motion). */
import { useId } from "react";

import type { Temporada } from "@/lib/sazonal";

type P = { id: string; t: Temporada };

/* ---------- Natal: presentes com laço, estrela, enfeites e ramos ---------- */
function Natal({ id, t }: P) {
  const g = (n: string) => `${id}-${n}`;
  const ouro = t.tema.destaque;
  const verm = t.tema.realce;
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" fill="none">
      <defs>
        <radialGradient id={g("halo")} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor={ouro} stopOpacity="0.38" />
          <stop offset="100%" stopColor={ouro} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g("caixaV")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2564f" />
          <stop offset="100%" stopColor="#9f2622" />
        </linearGradient>
        <linearGradient id={g("caixaVd")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2f7a58" />
          <stop offset="100%" stopColor="#174d36" />
        </linearGradient>
        <linearGradient id={g("caixaC")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbf4e4" />
          <stop offset="100%" stopColor="#e3d6b9" />
        </linearGradient>
        <linearGradient id={g("ouro")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbe7a8" />
          <stop offset="55%" stopColor={ouro} />
          <stop offset="100%" stopColor="#a8822f" />
        </linearGradient>
        <radialGradient id={g("bola")} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff8f87" />
          <stop offset="100%" stopColor="#a52520" />
        </radialGradient>
        <radialGradient id={g("bolaO")} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff1c4" />
          <stop offset="100%" stopColor="#b88e35" />
        </radialGradient>
      </defs>

      <ellipse cx="170" cy="130" rx="150" ry="110" fill={`url(#${g("halo")})`} />
      {/* sombra no chão */}
      <ellipse cx="170" cy="214" rx="120" ry="10" fill="#000" opacity="0.22" />

      {/* enfeites pendurados */}
      <g className="campanha-balanca" style={{ transformOrigin: "84px 0px" }}>
        <path d="M84 0 V58" stroke={ouro} strokeOpacity="0.7" strokeWidth="1.2" />
        <rect x="79" y="56" width="10" height="7" rx="2" fill={`url(#${g("ouro")})`} />
        <circle cx="84" cy="75" r="13" fill={`url(#${g("bola")})`} />
        <path d="M76 72 Q84 68 92 72" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" />
        <circle cx="79" cy="70" r="3" fill="#fff" opacity="0.6" />
      </g>
      <g className="campanha-balanca campanha-atraso-1" style={{ transformOrigin: "262px 0px" }}>
        <path d="M262 0 V38" stroke={ouro} strokeOpacity="0.7" strokeWidth="1.2" />
        <rect x="257.5" y="36" width="9" height="6" rx="2" fill={`url(#${g("ouro")})`} />
        <circle cx="262" cy="52" r="11" fill={`url(#${g("bolaO")})`} />
        <circle cx="258" cy="48" r="2.6" fill="#fff" opacity="0.7" />
      </g>

      {/* estrela */}
      <g className="campanha-cintila">
        <path
          d="M196 22 l7.6 15.4 17 2.5 -12.3 12 2.9 16.9 -15.2 -8 -15.2 8 2.9 -16.9 -12.3 -12 17 -2.5z"
          fill={`url(#${g("ouro")})`}
        />
        <path
          d="M196 30 l3 6"
          stroke="#fff"
          strokeOpacity="0.8"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* ramo de pinheiro */}
      <g opacity="0.95">
        <path d="M18 214 Q60 196 104 206" stroke="#1d5a3f" strokeWidth="3" strokeLinecap="round" />
        {[26, 40, 54, 68, 82, 96].map((x, i) => (
          <g key={x}>
            <path
              d={`M${x} ${210 - i * 1.4} l-8 -12`}
              stroke="#2f7a58"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d={`M${x} ${210 - i * 1.4} l9 -10`}
              stroke="#3c8f68"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        ))}
        <circle cx="62" cy="200" r="5" fill={`url(#${g("bola")})`} />
        <circle cx="78" cy="204" r="4" fill={`url(#${g("bolaO")})`} />
      </g>

      {/* presente grande (vermelho, fita dourada) */}
      <g className="campanha-flutua">
        <rect x="128" y="112" width="96" height="98" rx="6" fill={`url(#${g("caixaV")})`} />
        <rect x="120" y="98" width="112" height="24" rx="5" fill="#e8625b" />
        <rect x="120" y="116" width="112" height="6" fill="#000" opacity="0.12" />
        <rect x="168" y="98" width="16" height="112" fill={`url(#${g("ouro")})`} />
        {/* laço */}
        <path d="M176 98 C150 70 132 88 150 98 Z" fill={`url(#${g("ouro")})`} />
        <path d="M176 98 C202 70 220 88 202 98 Z" fill={`url(#${g("ouro")})`} />
        <path
          d="M176 98 C166 112 160 120 156 128"
          stroke={ouro}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M176 98 C186 112 192 120 196 128"
          stroke={ouro}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="176" cy="98" r="7" fill="#f7dc8f" />
        <path
          d="M134 128 V200"
          stroke="#fff"
          strokeOpacity="0.14"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>

      {/* presente verde (fita creme) */}
      <g>
        <rect x="226" y="150" width="70" height="60" rx="5" fill={`url(#${g("caixaVd")})`} />
        <rect x="221" y="140" width="80" height="17" rx="4" fill="#3a8a64" />
        <rect x="255" y="140" width="12" height="70" fill="#f7f0e1" />
        <path d="M261 140 C246 124 236 134 246 140 Z" fill="#f7f0e1" />
        <path d="M261 140 C276 124 286 134 276 140 Z" fill="#f7f0e1" />
        <circle cx="261" cy="140" r="4.5" fill="#efe3c6" />
      </g>

      {/* presente creme (fita vermelha) */}
      <g>
        <rect x="70" y="160" width="58" height="50" rx="5" fill={`url(#${g("caixaC")})`} />
        <rect x="66" y="152" width="66" height="14" rx="4" fill="#fffaf0" />
        <rect x="94" y="152" width="10" height="58" fill={verm} />
        <rect x="66" y="176" width="66" height="8" fill={verm} opacity="0.92" />
        <path d="M99 152 C88 140 80 147 87 152 Z" fill={verm} />
        <path d="M99 152 C110 140 118 147 111 152 Z" fill={verm} />
      </g>
    </svg>
  );
}

/* ---------- Black Friday: sacolas, etiqueta e economia ---------- */
function BlackFriday({ id, t }: P) {
  const g = (n: string) => `${id}-${n}`;
  const vio = t.tema.destaque;
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" fill="none">
      <defs>
        <radialGradient id={g("halo")} cx="55%" cy="45%" r="55%">
          <stop offset="0%" stopColor={vio} stopOpacity="0.55" />
          <stop offset="100%" stopColor={vio} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g("sacola1")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9a82ff" />
          <stop offset="100%" stopColor="#4b2fd1" />
        </linearGradient>
        <linearGradient id={g("sacola2")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3a47" />
          <stop offset="100%" stopColor="#1c1c24" />
        </linearGradient>
        <linearGradient id={g("tag")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4f2ff" />
          <stop offset="100%" stopColor="#c9bfff" />
        </linearGradient>
      </defs>
      <ellipse cx="170" cy="120" rx="150" ry="110" fill={`url(#${g("halo")})`} />
      <ellipse cx="168" cy="216" rx="118" ry="9" fill="#000" opacity="0.4" />

      {/* sacola escura (atrás) */}
      <g>
        <path
          d="M188 76 C188 52 236 52 236 76"
          stroke="#55556a"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M172 80 H252 L262 212 H162 Z" fill={`url(#${g("sacola2")})`} />
        <path d="M172 80 H252 L254 96 H170 Z" fill="#fff" opacity="0.06" />
        <text
          x="212"
          y="160"
          textAnchor="middle"
          fontSize="30"
          fontWeight="800"
          fill={t.tema.realce}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity="0.9"
        >
          BF
        </text>
      </g>

      {/* sacola violeta (frente) */}
      <g className="campanha-flutua">
        <path
          d="M104 92 C104 62 162 62 162 92"
          stroke="#cbbcff"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M86 96 H180 L192 214 H74 Z" fill={`url(#${g("sacola1")})`} />
        <path d="M86 96 H120 L106 214 H74 Z" fill="#fff" opacity="0.1" />
        <path d="M86 96 H180 L181.5 108 H84.5 Z" fill="#000" opacity="0.15" />
        {/* símbolo de economia: seta para baixo */}
        <circle cx="133" cy="156" r="24" fill="#fff" opacity="0.16" />
        <path
          d="M133 140 V170 M121 160 L133 172 L145 160"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* etiqueta de preço */}
      <g className="campanha-balanca" style={{ transformOrigin: "232px 30px" }}>
        <path
          d="M232 30 C246 40 252 52 252 62"
          stroke={t.tema.realce}
          strokeWidth="1.6"
          strokeOpacity="0.8"
        />
        <g transform="rotate(18 262 90)">
          <path d="M232 60 H292 L310 90 L292 120 H232 Z" fill={`url(#${g("tag")})`} />
          <circle cx="294" cy="90" r="5" fill="#1a1a23" />
          <text
            x="262"
            y="101"
            textAnchor="middle"
            fontSize="30"
            fontWeight="900"
            fill="#3f24c7"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            %
          </text>
        </g>
      </g>

      {/* faíscas */}
      {[
        [58, 54, 1],
        [286, 170, 0.8],
        [40, 150, 0.7],
        [150, 36, 0.9],
      ].map(([x, y, s], i) => (
        <path
          key={i}
          className={`campanha-cintila campanha-atraso-${i % 3}`}
          transform={`translate(${x} ${y}) scale(${s})`}
          d="M0 -10 C1.4 -2 2 -1.4 10 0 C2 1.4 1.4 2 0 10 C-1.4 2 -2 1.4 -10 0 C-2 -1.4 -1.4 -2 0 -10Z"
          fill={t.tema.brilho}
        />
      ))}
    </svg>
  );
}

/* ---------- Dia das Crianças: balões, blocos, carrinho e estrelas ---------- */
function Criancas({ id, t }: P) {
  const g = (n: string) => `${id}-${n}`;
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" fill="none">
      <defs>
        <radialGradient id={g("b1")} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffb39c" />
          <stop offset="100%" stopColor="#f2603c" />
        </radialGradient>
        <radialGradient id={g("b2")} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#9ed8ff" />
          <stop offset="100%" stopColor="#2d8fe6" />
        </radialGradient>
        <radialGradient id={g("b3")} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffe48a" />
          <stop offset="100%" stopColor="#f2b705" />
        </radialGradient>
        <linearGradient id={g("blocoV")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6b5e" />
          <stop offset="100%" stopColor="#d93a2f" />
        </linearGradient>
        <linearGradient id={g("blocoA")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d9bff" />
          <stop offset="100%" stopColor="#0a66c9" />
        </linearGradient>
        <linearGradient id={g("blocoAm")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd84d" />
          <stop offset="100%" stopColor="#f0b400" />
        </linearGradient>
        <linearGradient id={g("carro")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4fd17a" />
          <stop offset="100%" stopColor="#23a356" />
        </linearGradient>
      </defs>
      <ellipse cx="190" cy="218" rx="118" ry="8" fill="#1d1d1f" opacity="0.1" />

      {/* balões */}
      <g className="campanha-flutua">
        <path d="M70 92 C64 130 80 160 74 200" stroke="#8e8e93" strokeWidth="1.2" />
        <ellipse cx="70" cy="62" rx="27" ry="32" fill={`url(#${g("b1")})`} />
        <path d="M65 93 l5 -6 5 6z" fill="#f2603c" />
        <ellipse cx="61" cy="50" rx="6" ry="9" fill="#fff" opacity="0.45" />
      </g>
      <g className="campanha-flutua campanha-atraso-1">
        <path d="M112 80 C118 120 104 150 112 196" stroke="#8e8e93" strokeWidth="1.2" />
        <ellipse cx="112" cy="50" rx="24" ry="29" fill={`url(#${g("b2")})`} />
        <path d="M107 79 l5 -6 5 6z" fill="#2d8fe6" />
        <ellipse cx="104" cy="39" rx="5" ry="8" fill="#fff" opacity="0.45" />
      </g>
      <g className="campanha-flutua campanha-atraso-2">
        <path d="M44 100 C40 140 52 170 46 204" stroke="#8e8e93" strokeWidth="1.2" />
        <ellipse cx="42" cy="78" rx="19" ry="23" fill={`url(#${g("b3")})`} />
        <path d="M38 101 l4 -5 4 5z" fill="#f2b705" />
      </g>

      {/* blocos de montar */}
      {[
        { x: 168, y: 168, w: 60, f: "blocoV" },
        { x: 228, y: 168, w: 60, f: "blocoA" },
        { x: 196, y: 128, w: 60, f: "blocoAm" },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height="40" rx="6" fill={`url(#${g(b.f)})`} />
          <rect x={b.x} y={b.y + 30} width={b.w} height="10" rx="6" fill="#000" opacity="0.1" />
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <rect
                x={b.x + 8 + k * 17}
                y={b.y - 7}
                width="12"
                height="9"
                rx="3"
                fill={`url(#${g(b.f)})`}
              />
              <rect
                x={b.x + 9 + k * 17}
                y={b.y - 6}
                width="5"
                height="3"
                rx="1.5"
                fill="#fff"
                opacity="0.45"
              />
            </g>
          ))}
        </g>
      ))}

      {/* carrinho */}
      <g>
        <path d="M112 196 H160 L152 178 H122 Z" fill="#8fe3ac" />
        <rect x="100" y="194" width="72" height="18" rx="8" fill={`url(#${g("carro")})`} />
        <rect x="128" y="182" width="9" height="11" rx="2" fill="#dff7e8" />
        <rect x="140" y="182" width="9" height="11" rx="2" fill="#dff7e8" />
        <circle cx="118" cy="214" r="8" fill="#2b2b30" />
        <circle cx="118" cy="214" r="3" fill="#c7c7cc" />
        <circle cx="156" cy="214" r="8" fill="#2b2b30" />
        <circle cx="156" cy="214" r="3" fill="#c7c7cc" />
      </g>

      {/* estrelas */}
      {[
        [254, 40, 1.2, t.tema.brilho],
        [296, 96, 0.8, t.tema.realce],
        [168, 70, 0.9, "#2d8fe6"],
      ].map(([x, y, s, c], i) => (
        <path
          key={i}
          className={`campanha-cintila campanha-atraso-${i % 3}`}
          transform={`translate(${x} ${y}) scale(${s})`}
          d="M0 -12 l3.5 7.2 7.9 1.2 -5.7 5.5 1.3 7.9 -7 -3.7 -7 3.7 1.3 -7.9 -5.7 -5.5 7.9 -1.2z"
          fill={c as string}
        />
      ))}
    </svg>
  );
}

export function ArteSazonal({ t, className }: { t: Temporada; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  return (
    <div className={className} aria-hidden="true">
      {t.id === "natal" ? (
        <Natal id={id} t={t} />
      ) : t.id === "criancas" ? (
        <Criancas id={id} t={t} />
      ) : (
        <BlackFriday id={id} t={t} />
      )}
    </div>
  );
}

/* Detalhes espalhados pelo fundo da seção (posições fixas: nada aleatório,
   sem diferença entre servidor e navegador). */
const PONTOS: Array<[number, number, number]> = [
  /* Só nas bordas e no lado da arte: nunca sobre títulos e textos. */
  [58, 6, 0.7],
  [66, 16, 0.5],
  [74, 4, 0.9],
  [83, 22, 0.6],
  [92, 8, 1],
  [97, 38, 0.6],
  [88, 52, 0.5],
  [70, 40, 0.6],
  [2, 97, 0.6],
  [30, 98, 0.5],
  [62, 97, 0.7],
  [95, 96, 0.6],
];
const CONFETE = ["#ff7a59", "#2d8fe6", "#ffc93c", "#34c759"];

export function DecoracaoSazonal({ t }: { t: Temporada }) {
  const tipo = t.tema.decoracao;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PONTOS.map(([x, y, s], i) => (
        <span
          key={i}
          className={`campanha-cintila campanha-atraso-${i % 3} absolute ${y < 90 ? "hidden sm:block" : "block"}`}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: tipo === "confete" ? 8 * s + 4 : 6 * s + 3,
            height: tipo === "confete" ? 4 * s + 2 : 6 * s + 3,
            borderRadius: tipo === "confete" ? 2 : 999,
            transform: tipo === "confete" ? `rotate(${(i * 37) % 180}deg)` : undefined,
            background:
              tipo === "confete"
                ? CONFETE[i % CONFETE.length]
                : tipo === "neve"
                  ? "rgba(255,255,255,0.85)"
                  : t.tema.brilho,
            opacity: tipo === "confete" ? 0.55 : tipo === "neve" ? 0.5 : 0.55,
            boxShadow: tipo === "luzes" ? `0 0 ${10 * s}px ${t.tema.brilho}` : undefined,
          }}
        />
      ))}
    </div>
  );
}
