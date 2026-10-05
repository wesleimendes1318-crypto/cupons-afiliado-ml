/* INSTALAR O APP (05/10): o site já é instalável (public/manifest.json, com
   share_target: compartilhar um anúncio com o app abre a comparação). Este
   convite discreto aparece só quando dá para instalar:
   - Android/Chrome/Edge: guarda o evento beforeinstallprompt e instala com
     um toque;
   - iPhone/iPad (Safari): explica "Compartilhar > Adicionar à Tela de
     Início".
   Some quando o site já está aberto como app ou quando a pessoa dispensa
   (lembrança só no navegador; sem ela o convite apenas volta). */
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CHAVE = "melhorescolha:instalar-dispensado";

function lerDispensa() {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

export function InstalarApp({ className = "" }: { className?: string }) {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [ios, setIos] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const comoApp =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (comoApp || lerDispensa()) return;
    const ua = navigator.userAgent;
    const ehIos = /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
    if (ehIos) {
      setIos(true);
      setVisivel(true);
    }
    const aoPoder = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setVisivel(true);
    };
    const aoInstalar = () => setVisivel(false);
    window.addEventListener("beforeinstallprompt", aoPoder);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoder);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (!visivel) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {
      /* sem armazenamento: só fecha agora */
    }
    setVisivel(false);
  };

  return (
    <aside
      aria-label="Instalar o app"
      className={`flex items-start gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm ${className}`}
    >
      <img src="/icon-192.png" alt="" width={44} height={44} className="size-11 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Tenha o Melhor Escolha na tela do celular</p>
        {ios && !evento ? (
          <p className="mt-0.5 text-xs text-secondary-ink">
            No Safari, toque em{" "}
            <Share className="inline size-3.5 align-[-2px]" aria-hidden="true" />{" "}
            <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
            Depois é só compartilhar um anúncio com o app para comparar.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-secondary-ink">
              Abre como app e compara na hora: compartilhe o anúncio com o Melhor Escolha.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!evento) return;
                await evento.prompt();
                await evento.userChoice.catch(() => null);
                setEvento(null);
                setVisivel(false);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-1.5 text-xs font-bold text-white hover:brightness-110"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Instalar o app
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dispensar}
        aria-label="Agora não"
        className="grid size-8 shrink-0 place-items-center rounded-full text-secondary-ink hover:bg-[#f5f5f7]"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
