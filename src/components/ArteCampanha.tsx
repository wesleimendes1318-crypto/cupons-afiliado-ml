/* ARTE DAS CAMPANHAS (Weslei, 05/10: "artes próprias e uma direção visual
   para cada tema... ilustração principal, elementos decorativos, ícones e
   detalhes de fundo... profundidade suave, formas orgânicas e paleta
   harmoniosa"; "fotos reais dos produtos podem participar, desde que seus
   detalhes e proporções sejam preservados").

   - Cena vetorial própria por tema (SVG, sem marca de terceiros), com volume
     de "massinha": faces em tons diferentes, luz de cima à esquerda, sombra
     de contato. Poucos elementos, composição à direita.
   - Fotos reais (até 2) em cartões brancos SEPARADOS da cena, sem filtro nem
     corte: object-contain, dimensões reservadas.
   - Imagem salva do tema (TemaVisual.imagem), quando houver, no lugar da
     cena: gerada uma vez e reutilizada.
   - Só decoração (aria-hidden), sem cliques; entrada suave uma vez, sem
     movimento contínuo (desliga com prefers-reduced-motion). */
import { useId, type ReactNode } from "react";

import { TEMAS_VISUAIS, type TemaVisualId } from "@/lib/campanha-visual";

type G = (n: string) => string;

function Defs({ g }: { g: G }) {
  return (
    <defs>
      <filter id={g("sombra")} x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#1d1d1f" floodOpacity="0.16" />
      </filter>
      <filter id={g("desfoque")} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <radialGradient id={g("luz")} cx="0.32" cy="0.28" r="0.75">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/* Sombra de contato no chão. */
const Chao = ({ g, cx, cy, rx }: { g: G; cx: number; cy: number; rx: number }) => (
  <ellipse
    cx={cx}
    cy={cy}
    rx={rx}
    ry={rx * 0.16}
    fill="#1d1d1f"
    opacity="0.14"
    filter={`url(#${g("desfoque")})`}
  />
);

/* Cubo/caixa em perspectiva: frente, lado e topo em tons diferentes. */
function Caixa({
  x,
  y,
  w,
  h,
  d,
  frente,
  lado,
  topo,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  frente: string;
  lado: string;
  topo: string;
  children?: ReactNode;
}) {
  const dx = d * 0.7;
  const dy = -d * 0.42;
  return (
    <g>
      <path d={`M${x + w} ${y} l${dx} ${dy} v${h} l${-dx} ${-dy} z`} fill={lado} />
      <path d={`M${x} ${y} l${dx} ${dy} h${w} l${-dx} ${-dy} z`} fill={topo} />
      <rect x={x} y={y} width={w} height={h} rx="3" fill={frente} />
      <rect x={x} y={y} width={w * 0.22} height={h} rx="3" fill="#fff" opacity="0.14" />
      {children}
    </g>
  );
}

/* Presente com fita e laço (as fitas seguem as três faces). */
function Presente({
  g,
  x,
  y,
  w,
  h,
  d,
  cores,
  fita,
}: {
  g: G;
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  cores: [string, string, string];
  fita: [string, string];
}) {
  const dx = d * 0.7;
  const dy = -d * 0.42;
  const f = Math.max(7, w * 0.13);
  const cx = x + w / 2;
  const bx = cx + dx / 2;
  const by = y + dy / 2;
  return (
    <g>
      <Caixa x={x} y={y} w={w} h={h} d={d} frente={cores[0]} lado={cores[1]} topo={cores[2]} />
      {/* fita vertical na frente e no topo */}
      <rect x={cx - f / 2} y={y} width={f} height={h} fill={fita[0]} />
      <path d={`M${cx - f / 2} ${y} l${dx} ${dy} h${f} l${-dx} ${-dy} z`} fill={fita[0]} />
      {/* fita atravessando o topo e descendo pelo lado */}
      <path
        d={`M${x + dx / 2} ${y + dy / 2} h${w}`}
        stroke={fita[0]}
        strokeWidth={f * 0.9}
        opacity="0.95"
      />
      <path
        d={`M${x + w + dx * 0.42} ${y + dy * 0.42} v${h}`}
        stroke={fita[1]}
        strokeWidth={f * 0.75}
      />
      {/* laço */}
      <g filter={`url(#${g("sombra")})`}>
        <path
          d={`M${bx} ${by} C${bx - w * 0.42} ${by - w * 0.42} ${bx - w * 0.5} ${by - w * 0.02} ${bx - 3} ${by + 2} Z`}
          fill={fita[0]}
        />
        <path
          d={`M${bx} ${by} C${bx + w * 0.42} ${by - w * 0.42} ${bx + w * 0.5} ${by - w * 0.02} ${bx + 3} ${by + 2} Z`}
          fill={fita[1]}
        />
        <path
          d={`M${bx - 4} ${by + 2} q-6 ${w * 0.18} -14 ${w * 0.26}`}
          stroke={fita[0]}
          strokeWidth={f * 0.6}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M${bx + 4} ${by + 2} q6 ${w * 0.18} 14 ${w * 0.26}`}
          stroke={fita[1]}
          strokeWidth={f * 0.6}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx={bx} cy={by} rx={f * 0.75} ry={f * 0.6} fill={fita[0]} />
        <ellipse cx={bx - 2} cy={by - 2} rx={f * 0.28} ry={f * 0.18} fill="#fff" opacity="0.6" />
      </g>
    </g>
  );
}

/* Bloco de montar genérico (dois pinos), sem marca. */
function Bloco({
  x,
  y,
  s,
  cores,
}: {
  x: number;
  y: number;
  s: number;
  cores: [string, string, string];
}) {
  const dx = s * 0.7 * 0.6;
  const dy = -s * 0.42 * 0.6;
  return (
    <g>
      <Caixa
        x={x}
        y={y}
        w={s}
        h={s * 0.62}
        d={s * 0.6}
        frente={cores[0]}
        lado={cores[1]}
        topo={cores[2]}
      />
      {[0.3, 0.72].map((k) => (
        <g key={k}>
          <ellipse
            cx={x + s * k + dx / 2}
            cy={y + dy / 2 + 1}
            rx={s * 0.13}
            ry={s * 0.06}
            fill={cores[1]}
          />
          <rect
            x={x + s * k + dx / 2 - s * 0.13}
            y={y + dy / 2 - s * 0.08}
            width={s * 0.26}
            height={s * 0.09}
            fill={cores[0]}
          />
          <ellipse
            cx={x + s * k + dx / 2}
            cy={y + dy / 2 - s * 0.08}
            rx={s * 0.13}
            ry={s * 0.06}
            fill={cores[2]}
          />
        </g>
      ))}
    </g>
  );
}

function Esfera({
  g,
  id,
  cx,
  cy,
  r,
  claro,
  escuro,
}: {
  g: G;
  id: string;
  cx: number;
  cy: number;
  r: number;
  claro: string;
  escuro: string;
}) {
  return (
    <g>
      <defs>
        <radialGradient id={g(id)} cx="0.34" cy="0.3" r="0.8">
          <stop offset="0" stopColor={claro} />
          <stop offset="1" stopColor={escuro} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${g(id)})`} />
      <ellipse
        cx={cx - r * 0.34}
        cy={cy - r * 0.38}
        rx={r * 0.26}
        ry={r * 0.16}
        fill="#fff"
        opacity="0.55"
        transform={`rotate(-28 ${cx - r * 0.34} ${cy - r * 0.38})`}
      />
    </g>
  );
}

/* Estrela de pontas arredondadas. */
function Estrela({
  cx,
  cy,
  r,
  cor,
  brilho,
}: {
  cx: number;
  cy: number;
  r: number;
  cor: string;
  brilho: string;
}) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.46 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <g>
      <polygon points={pts} fill={cor} stroke={cor} strokeWidth={r * 0.28} strokeLinejoin="round" />
      <ellipse
        cx={cx - r * 0.22}
        cy={cy - r * 0.28}
        rx={r * 0.22}
        ry={r * 0.13}
        fill={brilho}
        opacity="0.7"
      />
    </g>
  );
}

/* ------------------------------------------------------------- cenas */

function CenaCriancas({ g }: { g: G }) {
  return (
    <>
      {/* brilho de fundo */}
      <circle
        cx="270"
        cy="150"
        r="130"
        fill="#fff"
        opacity="0.55"
        filter={`url(#${g("desfoque")})`}
      />
      {/* planeta com anel */}
      <g>
        <ellipse
          cx="318"
          cy="70"
          rx="40"
          ry="11"
          fill="none"
          stroke="#f2a35e"
          strokeWidth="5"
          opacity="0.9"
          transform="rotate(-16 318 70)"
        />
        <Esfera g={g} id="planeta" cx={318} cy={70} r={22} claro="#ffd3a3" escuro="#f08c4a" />
        <path
          d="M278 82 Q318 92 358 58"
          stroke="#f7b77a"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          transform="rotate(-2 318 70)"
        />
      </g>
      {/* pipa */}
      <g>
        <path d="M166 40 L196 70 L166 110 L136 70 Z" fill="#ff8a6a" />
        <path d="M166 40 L196 70 L166 74 Z" fill="#ffb199" />
        <path d="M166 40 L136 70 L166 74 Z" fill="#ff9d80" />
        <path d="M166 40 V110 M136 70 H196" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" />
        <path
          d="M166 110 C158 124 146 128 140 142 C136 152 128 156 122 164"
          stroke="#8a95a8"
          strokeWidth="1.6"
          fill="none"
        />
        {[
          [150, 126],
          [134, 148],
        ].map(([x, y], i) => (
          <path
            key={y}
            d={`M${x} ${y} l-7 -4 l0 8 z M${x} ${y} l7 -4 l0 8 z`}
            fill={i ? "#4aa3ff" : "#ffc93c"}
          />
        ))}
      </g>
      {/* estrelas */}
      <Estrela cx={238} cy={44} r={12} cor="#ffc93c" brilho="#fff2c2" />
      <Estrela cx={372} cy={140} r={8} cor="#4aa3ff" brilho="#d6ebff" />
      <Estrela cx={124} cy={208} r={7} cor="#ff8a6a" brilho="#ffe0d6" />
      {/* avião de papel */}
      <g transform="translate(352 196) rotate(-12)">
        <path d="M0 0 L-34 -10 L-22 4 Z" fill="#ffffff" />
        <path d="M0 0 L-22 4 L-20 12 Z" fill="#dfe8f5" />
      </g>
      {/* chão */}
      <Chao g={g} cx={262} cy={262} rx={120} />
      {/* blocos empilhados */}
      <Bloco x={176} y={214} s={46} cores={["#ff8a6a", "#e2674a", "#ffb199"]} />
      <Bloco x={186} y={176} s={46} cores={["#ffd25e", "#e8b432", "#ffe59a"]} />
      <Bloco x={168} y={138} s={46} cores={["#5aa9ff", "#2f86e6", "#a9d2ff"]} />
      {/* presente */}
      <g filter={`url(#${g("sombra")})`}>
        <Presente
          g={g}
          x={248}
          y={168}
          w={92}
          h={82}
          d={42}
          cores={["#9ed0ff", "#6fb1f2", "#c6e4ff"]}
          fita={["#ff8a6a", "#e8694c"]}
        />
      </g>
    </>
  );
}

function CenaNatal({ g }: { g: G }) {
  return (
    <>
      <circle
        cx="268"
        cy="150"
        r="130"
        fill="#f6dd94"
        opacity="0.18"
        filter={`url(#${g("desfoque")})`}
      />
      {/* fio de luzes */}
      <path d="M120 54 C190 96 262 30 392 74" stroke="#2c5a46" strokeWidth="2" fill="none" />
      {[
        [146, 70],
        [180, 82],
        [214, 76],
        [250, 62],
        [288, 56],
        [324, 60],
        [360, 66],
      ].map(([x, y], i) => (
        <g key={x}>
          <circle
            cx={x}
            cy={y! + 9}
            r="11"
            fill={i % 2 ? "#ffd27a" : "#ffe9b0"}
            opacity="0.35"
            filter={`url(#${g("desfoque")})`}
          />
          <rect x={x! - 2.5} y={y! - 2} width="5" height="5" rx="1" fill="#c9a24a" />
          <ellipse cx={x} cy={y! + 8} rx="4.5" ry="6.5" fill={i % 2 ? "#ffd27a" : "#fff1c8"} />
        </g>
      ))}
      <Estrela cx={340} cy={116} r={11} cor="#e2bf66" brilho="#fff1c8" />
      <Estrela cx={150} cy={130} r={7} cor="#f0d48a" brilho="#fff7e0" />
      <Chao g={g} cx={268} cy={262} rx={130} />
      <Estrela cx={180} cy={206} r={6} cor="#e2bf66" brilho="#fff7e0" />
      <Estrela cx={392} cy={186} r={5} cor="#f0d48a" brilho="#fff7e0" />
      <g filter={`url(#${g("sombra")})`}>
        <Presente
          g={g}
          x={268}
          y={150}
          w={86}
          h={92}
          d={40}
          cores={["#1f6b4c", "#164d37", "#2f8a63"]}
          fita={["#e2bf66", "#b8963f"]}
        />
        <Presente
          g={g}
          x={200}
          y={196}
          w={70}
          h={56}
          d={34}
          cores={["#c63a34", "#8e2420", "#e2625b"]}
          fita={["#f0d48a", "#c9a24a"]}
        />
      </g>
      <g filter={`url(#${g("sombra")})`}>
        <rect x="362" y="214" width="12" height="8" rx="2" fill="#c9a24a" />
        <Esfera g={g} id="bola" cx={368} cy={240} r={20} claro="#fff1c4" escuro="#b88e35" />
      </g>
    </>
  );
}

function CenaBlackFriday({ g }: { g: G }) {
  return (
    <>
      <circle
        cx="270"
        cy="150"
        r="130"
        fill="#7a5cff"
        opacity="0.25"
        filter={`url(#${g("desfoque")})`}
      />
      <defs>
        <radialGradient id={g("ponto")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#d4c8ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7a5cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[
        [150, 60, 10],
        [360, 50, 8],
        [384, 150, 12],
        [206, 34, 6],
      ].map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} fill={`url(#${g("ponto")})`} />
      ))}
      <Chao g={g} cx={270} cy={262} rx={130} />
      <g filter={`url(#${g("sombra")})`}>
        {/* sacola grafite */}
        <path
          d="M206 132 C206 100 248 100 248 132"
          stroke="#c8b8ff"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <Caixa
          x={186}
          y={130}
          w={82}
          h={122}
          d={26}
          frente="#2b2a38"
          lado="#1b1a24"
          topo="#141320"
        />
        {/* sacola violeta */}
        <path
          d="M284 150 C284 122 322 122 322 150"
          stroke="#efeaff"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <Caixa
          x={268}
          y={148}
          w={74}
          h={104}
          d={24}
          frente="#8b70ff"
          lado="#5e44d6"
          topo="#3c2a9e"
        />
      </g>
      {/* etiqueta em branco */}
      <g transform="rotate(-14 352 222)" filter={`url(#${g("sombra")})`}>
        <path d="M332 200 h44 v44 h-44 l-14 -22 z" fill="#f4f2ff" />
        <circle cx="330" cy="222" r="4" fill="#2b2a38" />
        <path
          d="M330 222 C312 210 304 190 314 176"
          stroke="#c8b8ff"
          strokeWidth="1.6"
          fill="none"
        />
      </g>
    </>
  );
}

function CenaTecnologia({ g }: { g: G }) {
  return (
    <>
      <circle
        cx="270"
        cy="150"
        r="130"
        fill="#ffffff"
        opacity="0.6"
        filter={`url(#${g("desfoque")})`}
      />
      {/* formas de vidro */}
      <rect
        x="150"
        y="54"
        width="34"
        height="34"
        rx="9"
        fill="#c9d8ff"
        opacity="0.7"
        transform="rotate(18 167 71)"
      />
      <circle cx="372" cy="70" r="16" fill="none" stroke="#b9b6ff" strokeWidth="6" opacity="0.8" />
      <circle cx="140" cy="168" r="7" fill="#a9c6ff" />
      <Chao g={g} cx={268} cy={262} rx={130} />
      {/* pedestais */}
      {[
        [210, 226, 52],
        [318, 210, 48],
      ].map(([cx, cy, rx]) => (
        <g key={cx}>
          <ellipse cx={cx} cy={cy! + 28} rx={rx} ry={rx! * 0.22} fill="#cfd8ea" />
          <rect x={cx! - rx!} y={cy} width={rx! * 2} height="28" fill="#e6ecf7" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={rx! * 0.22} fill="#ffffff" />
        </g>
      ))}
      {/* fone */}
      <g filter={`url(#${g("sombra")})`}>
        <path
          d="M186 206 C186 158 236 158 236 206"
          stroke="#dfe6f3"
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M186 206 C186 158 236 158 236 206"
          stroke="#ffffff"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
        />
        <rect x="174" y="192" width="22" height="32" rx="10" fill="#c7d0e2" />
        <rect x="226" y="192" width="22" height="32" rx="10" fill="#c7d0e2" />
        <rect x="178" y="196" width="8" height="24" rx="4" fill="#fff" opacity="0.6" />
      </g>
      {/* relógio e caixa de som */}
      <g filter={`url(#${g("sombra")})`}>
        <rect x="296" y="150" width="18" height="70" rx="8" fill="#5b5bd6" opacity="0.85" />
        <rect x="286" y="166" width="38" height="44" rx="12" fill="#1d1d1f" />
        <rect x="291" y="171" width="28" height="34" rx="8" fill="#0071e3" />
        <circle cx="300" cy="182" r="3" fill="#fff" opacity="0.8" />
        <rect x="334" y="180" width="34" height="30" rx="14" fill="#eef1f8" />
        <circle cx="351" cy="195" r="9" fill="#cfd8ea" />
      </g>
    </>
  );
}

function CenaCasa({ g }: { g: G }) {
  return (
    <>
      <circle
        cx="270"
        cy="150"
        r="130"
        fill="#ffe9cc"
        opacity="0.55"
        filter={`url(#${g("desfoque")})`}
      />
      <Chao g={g} cx={268} cy={262} rx={130} />
      {/* luminária */}
      <g filter={`url(#${g("sombra")})`}>
        <circle
          cx="330"
          cy="118"
          r="34"
          fill="#ffd89a"
          opacity="0.45"
          filter={`url(#${g("desfoque")})`}
        />
        <path d="M304 120 h52 l-10 -40 h-32 z" fill="#f2e6d6" />
        <path d="M304 120 h52 l-10 -40 h-6 l8 40 z" fill="#e6d3bd" />
        <rect x="327" y="120" width="6" height="104" fill="#b5643c" />
        <ellipse cx="330" cy="252" rx="26" ry="7" fill="#9c5532" />
        <rect x="304" y="224" width="52" height="28" rx="6" fill="#b5643c" />
      </g>
      {/* vaso com folhagem seca */}
      <g filter={`url(#${g("sombra")})`}>
        {[-24, -10, 6, 20].map((a, i) => (
          <ellipse
            key={a}
            cx={236 + a * 0.9}
            cy={124 + Math.abs(a) * 0.6}
            rx="9"
            ry="38"
            fill={i % 2 ? "#e9d3b0" : "#f3e2c4"}
            transform={`rotate(${a} 236 210)`}
          />
        ))}
        <path d="M214 186 C206 216 214 252 236 254 C258 252 266 216 258 186 Z" fill="#d9c2a7" />
        <path
          d="M214 186 C210 210 214 240 226 252 C214 250 206 220 214 186 Z"
          fill="#fff"
          opacity="0.25"
        />
      </g>
      {/* planta e vela */}
      <g filter={`url(#${g("sombra")})`}>
        {[-30, -8, 14, 34].map((a) => (
          <ellipse
            key={a}
            cx="172"
            cy="196"
            rx="9"
            ry="26"
            fill={a % 2 ? "#5f8f6a" : "#4f7f5b"}
            transform={`rotate(${a} 172 226)`}
          />
        ))}
        <path d="M152 222 h40 l-6 32 h-28 z" fill="#e8dcc9" />
        <rect x="374" y="226" width="20" height="28" rx="4" fill="#fbf4e8" />
        <ellipse cx="384" cy="220" rx="3" ry="6" fill="#ffb347" />
      </g>
    </>
  );
}

function CenaBeleza({ g }: { g: G }) {
  return (
    <>
      <circle
        cx="270"
        cy="150"
        r="130"
        fill="#ffffff"
        opacity="0.55"
        filter={`url(#${g("desfoque")})`}
      />
      {[
        [160, 70, 20],
        [376, 92, -30],
        [196, 168, 50],
      ].map(([x, y, a]) => (
        <ellipse
          key={x}
          cx={x}
          cy={y}
          rx="10"
          ry="6"
          fill="#f7b6cb"
          transform={`rotate(${a} ${x} ${y})`}
        />
      ))}
      <Chao g={g} cx={268} cy={262} rx={130} />
      {/* frasco */}
      <g filter={`url(#${g("sombra")})`}>
        <rect x="262" y="126" width="26" height="22" rx="4" fill="#d7a64a" />
        <rect x="236" y="146" width="78" height="106" rx="18" fill="#f9dbe6" opacity="0.95" />
        <rect x="246" y="160" width="58" height="84" rx="12" fill="#f3c2d4" />
        <rect x="248" y="160" width="14" height="84" rx="7" fill="#fff" opacity="0.5" />
      </g>
      {/* batom e estojo */}
      <g filter={`url(#${g("sombra")})`}>
        <rect x="334" y="196" width="22" height="56" rx="5" fill="#2a1d24" />
        <path d="M337 196 v-22 l16 -10 v32 z" fill="#c2456f" />
        <ellipse cx="190" cy="246" rx="38" ry="10" fill="#e8c9b7" />
        <rect x="152" y="228" width="76" height="18" rx="9" fill="#f1dccf" />
        <ellipse cx="190" cy="228" rx="38" ry="10" fill="#fbeee6" />
      </g>
    </>
  );
}

function CenaNeutra({ g }: { g: G }) {
  return (
    <>
      <circle
        cx="270"
        cy="150"
        r="130"
        fill="#ffffff"
        opacity="0.7"
        filter={`url(#${g("desfoque")})`}
      />
      <Chao g={g} cx={268} cy={262} rx={130} />
      {[
        [212, 222, 56],
        [326, 204, 50],
      ].map(([cx, cy, rx]) => (
        <g key={cx}>
          <ellipse cx={cx} cy={cy! + 30} rx={rx} ry={rx! * 0.22} fill="#d9dee7" />
          <rect x={cx! - rx!} y={cy} width={rx! * 2} height="30" fill="#eceff4" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={rx! * 0.22} fill="#ffffff" />
        </g>
      ))}
      <g filter={`url(#${g("sombra")})`}>
        <path
          d="M196 170 C196 146 230 146 230 170"
          stroke="#0071e3"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <Caixa
          x={180}
          y={168}
          w={64}
          h={52}
          d={22}
          frente="#ffffff"
          lado="#e3e8f0"
          topo="#f3f5f9"
        />
        <Presente
          g={g}
          x={302}
          y={162}
          w={50}
          h={42}
          d={24}
          cores={["#34c759", "#239a44", "#7ee29a"]}
          fita={["#0071e3", "#0058b0"]}
        />
      </g>
      {/* cartão com os ✓ */}
      <g filter={`url(#${g("sombra")})`}>
        <rect x="236" y="40" width="96" height="82" rx="14" fill="#ffffff" />
        {[0, 1, 2].map((i) => {
          const cy = 60 + i * 21;
          return (
            <g key={i}>
              <circle cx="254" cy={cy} r="7" fill="#34c759" />
              <path
                d={`M250.5 ${cy} l2.6 2.6 l4.6 -5`}
                stroke="#fff"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <rect x="268" y={cy - 4} width={i === 1 ? 36 : 50} height="8" rx="4" fill="#e3e8f0" />
            </g>
          );
        })}
      </g>
    </>
  );
}

const CENAS: Record<TemaVisualId, (p: { g: G }) => ReactNode> = {
  criancas: CenaCriancas,
  natal: CenaNatal,
  black_friday: CenaBlackFriday,
  tecnologia: CenaTecnologia,
  casa: CenaCasa,
  beleza: CenaBeleza,
  neutro: CenaNeutra,
};

const fotoGrande = (u: string) =>
  u.replace(/^http:/, "https:").replace(/-[A-Z](\.(?:webp|jpg|jpeg|png))$/i, "-O$1");

/** Cena do tema + fotos reais dos produtos em cartões separados. */
export function ArteCampanha({
  tema,
  fotos = [],
  className = "",
  compacta = false,
}: {
  tema: TemaVisualId;
  fotos?: Array<string | null | undefined>;
  className?: string;
  /* Celular / cartão pequeno: só a cena, sem os cartões de foto. */
  compacta?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const g: G = (n) => `${id}-${n}`;
  const t = TEMAS_VISUAIS[tema];
  const Cena = CENAS[tema];
  const reais = compacta
    ? []
    : fotos.filter((f): f is string => !!f && /^https?:\/\//.test(f)).slice(0, 2);
  return (
    <div
      className={`pointer-events-none relative select-none ${t.movimento === "entrada" ? "campanha-arte-entra" : ""} ${className}`}
      aria-hidden="true"
    >
      {t.imagem ? (
        <img
          src={t.imagem.src}
          width={t.imagem.largura}
          height={t.imagem.altura}
          alt=""
          className="h-full w-full object-contain"
        />
      ) : (
        <svg
          /* Com fotos, a cena abre espaço à esquerda para os cartões. */
          viewBox={reais.length ? "10 20 390 250" : "100 20 300 250"}
          className="h-full w-full"
          preserveAspectRatio={reais.length ? "xMaxYMid meet" : "xMidYMid meet"}
        >
          <Defs g={g} />
          <Cena g={g} />
        </svg>
      )}
      {reais.map((src, i) => (
        <span
          key={src}
          className={`absolute grid aspect-square place-items-center overflow-hidden rounded-2xl bg-white p-2.5 shadow-[0_14px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5 ${
            i === 0
              ? "bottom-[6%] left-[1%] z-10 w-[29%] -rotate-3"
              : "bottom-[30%] left-[18%] w-[22%] rotate-3"
          }`}
        >
          <img
            src={fotoGrande(src)}
            width={160}
            height={160}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain"
          />
        </span>
      ))}
    </div>
  );
}
