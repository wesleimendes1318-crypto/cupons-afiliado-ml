/* Cena do login (Weslei, 04/11: a curva do gráfico de preço "parece uma
   cotação em queda livre"). Agora conta o que acontece de verdade:
   1. e-mail: envelope à esquerda, pulsos azuis seguindo pelas linhas até a
      caixa de entrada à direita (mais rápidos enquanto envia);
   2. código: o envelope solta 8 blocos que descem até a fileira de baixo,
      a mesma das 8 caixas do código logo abaixo da cena;
   3. pronto: os blocos se juntam num escudo verde com o ✓ desenhado.
   Só diz "Código enviado!" depois do envio real. prefers-reduced-motion:
   tudo parado no estado final (styles.css, login-*). */
import { Bell, Inbox, Mail, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";

const SLOTS = Array.from({ length: 8 }, (_, i) => 66 + i * 25);
const ENVELOPE = { x: 44, y: 54 };
const CENTRO = { x: 160, y: 58 };

export function CenaLogin({
  etapa,
  enviando,
}: {
  etapa: "email" | "codigo" | "ok";
  enviando: boolean;
}) {
  const aviso =
    etapa === "ok"
      ? "Você entrou! Preços sincronizados"
      : etapa === "codigo"
        ? "Código enviado!"
        : null;
  return (
    <figure className={"relative w-full" + (enviando ? " login-rapido" : "")} aria-hidden="true">
      <svg viewBox="0 0 320 120" className="h-auto w-full overflow-visible">
        <defs>
          <filter id="login-sombra" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.12" />
          </filter>
        </defs>
        <rect x="0.5" y="0.5" width="319" height="119" rx="22" fill="#f5f5f7" stroke="#e3e3e8" />

        {/* Linhas de transmissão entre o envelope e a caixa de entrada. */}
        {etapa === "email" &&
          [44, 54, 64].map((y, i) => (
            <g key={y}>
              <line
                x1="78"
                x2="242"
                y1={y}
                y2={y}
                stroke="#e3e3e8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {[0, 1].map((k) => (
                <circle
                  key={k}
                  className="login-pulso"
                  style={{ animationDelay: `${i * 0.35 + k * 0.9}s` } as CSSProperties}
                  cx="80"
                  cy={y}
                  r="2.6"
                  fill="#0071e3"
                />
              ))}
            </g>
          ))}

        {/* Fileira dos 8 dígitos: liga a cena às 8 caixas do código. */}
        {etapa !== "email" &&
          SLOTS.map((x, i) => (
            <g key={x}>
              {etapa === "codigo" && (
                <line
                  className="login-feixe"
                  style={{ animationDelay: `${i * 60}ms` } as CSSProperties}
                  x1={ENVELOPE.x}
                  y1={ENVELOPE.y + 10}
                  x2={x + 7}
                  y2="92"
                  stroke="#0071e3"
                  strokeOpacity="0.18"
                  strokeWidth="1.2"
                />
              )}
              <rect
                className={etapa === "ok" ? "login-converge" : "login-bloco"}
                style={
                  {
                    "--dx": `${ENVELOPE.x - (x + 7)}px`,
                    "--dy": `${ENVELOPE.y - 98}px`,
                    "--cx": `${CENTRO.x - (x + 7)}px`,
                    "--cy": `${CENTRO.y - 98}px`,
                    animationDelay: `${i * 60}ms`,
                  } as CSSProperties
                }
                x={x}
                y="91"
                width="14"
                height="15"
                rx="4"
                fill="#fff"
                stroke="#0071e3"
                strokeWidth="1.5"
              />
            </g>
          ))}

        {/* Pronto: escudo verde com o ✓ desenhado. */}
        {etapa === "ok" && (
          <g className="login-escudo">
            <path
              d="M160 30 L182 38 V58 C182 72 172 82 160 87 C148 82 138 72 138 58 V38 Z"
              fill="#34c759"
            />
            <path
              className="login-check"
              pathLength={1}
              d="M150 58 L157 65 L171 50"
              fill="none"
              stroke="#fff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Envelope e caixa de entrada em pílulas brancas suspensas. */}
        <g filter="url(#login-sombra)">
          <rect x="18" y="32" width="52" height="44" rx="16" fill="#fff" />
          {etapa === "email" && <rect x="250" y="32" width="52" height="44" rx="16" fill="#fff" />}
        </g>
      </svg>
      <span className="pointer-events-none absolute left-[5.6%] top-[26.6%] grid h-[36.6%] w-[16.25%] place-items-center text-[#0071e3]">
        <Mail className={"size-5" + (etapa === "codigo" ? " login-envelope" : "")} />
      </span>
      {etapa === "email" && (
        <span className="pointer-events-none absolute left-[78.1%] top-[26.6%] grid h-[36.6%] w-[16.25%] place-items-center text-[#0071e3]">
          <Inbox className="size-5" />
        </span>
      )}
      {aviso && (
        <figcaption
          key={aviso}
          className="login-aviso absolute right-2 top-2 flex max-w-[70%] items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
        >
          <span
            className={
              "grid size-6 shrink-0 place-items-center rounded-full bg-[#34c759] text-white" +
              (etapa === "codigo" ? " login-sino" : "")
            }
          >
            {etapa === "ok" ? <ShieldCheck className="size-3.5" /> : <Bell className="size-3.5" />}
          </span>
          {aviso}
        </figcaption>
      )}
    </figure>
  );
}
