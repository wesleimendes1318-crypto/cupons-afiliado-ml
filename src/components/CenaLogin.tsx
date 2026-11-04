/* Cena do login no estilo de AnimacaoAcompanhar (Weslei, 04/11: "as
   animações precisam seguir esse estilo"): cartão #f5f5f7, linha azul que se
   desenha do e-mail até o código, ponto verde e pílula branca com o aviso.
   Só mostra "Código enviado!" depois do envio real (etapa codigo/ok). */
import { Bell, Mail, ShieldCheck } from "lucide-react";

export function CenaLogin({
  etapa,
  enviando,
}: {
  etapa: "email" | "codigo" | "ok";
  enviando: boolean;
}) {
  const aviso =
    etapa === "ok" ? "Você entrou!" : etapa === "codigo" ? "Código enviado!" : null;
  return (
    <figure className="relative w-full" aria-hidden="true">
      <svg viewBox="0 0 320 120" className="h-auto w-full">
        <rect x="0" y="0" width="320" height="120" rx="22" fill="#f5f5f7" />
        {[35, 65, 95].map((y) => (
          <line key={y} x1="20" x2="300" y1={y} y2={y} stroke="#e3e3e8" strokeWidth="1" />
        ))}
        <line x1="20" x2="300" y1="88" y2="88" stroke="#34c759" strokeWidth="2" strokeDasharray="6 6" />
        <text x="24" y="108" fontSize="11" fill="#1f7a3a" fontWeight="600">
          sua caixa de entrada
        </text>
        {(enviando || etapa !== "email") && (
          <path
            key={etapa + String(enviando)}
            className={etapa === "email" ? "login-linha-envia" : "login-linha"}
            pathLength={1}
            d="M44 52 C 80 40, 110 70, 150 58 S 220 40, 250 70 S 280 86, 292 88"
            fill="none"
            stroke="#0071e3"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
        {etapa !== "email" && (
          <circle className="acomp-ponto" cx="292" cy="88" r="7" fill="#34c759" stroke="#fff" strokeWidth="3" />
        )}
      </svg>
      <span className="absolute left-[6%] top-[28%] grid size-8 place-items-center rounded-full bg-white text-[#0071e3] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]">
        <Mail className="size-4" />
      </span>
      {aviso && (
        <figcaption
          key={aviso}
          className="login-aviso absolute right-2 top-2 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
        >
          <span className="acomp-sino grid size-6 place-items-center rounded-full bg-[#34c759] text-white">
            {etapa === "ok" ? <ShieldCheck className="size-3.5" /> : <Bell className="size-3.5" />}
          </span>
          {aviso}
        </figcaption>
      )}
    </figure>
  );
}
