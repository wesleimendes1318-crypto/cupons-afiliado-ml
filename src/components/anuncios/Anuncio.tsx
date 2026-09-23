/* Espaços de publicidade — hoje desligados de propósito.

   Regras que este arquivo garante sozinho:
   - sem VITE_ADSENSE_CLIENT_ID válido, nada é renderizado e nenhum script de
     terceiro é baixado (nada de ID fictício);
   - sem consentimento de publicidade do visitante, também não carrega;
   - todo bloco sai rotulado como "Publicidade", com respiro em relação a
     botões de ação, para não ser confundido com cupom ou botão de compra. */

import { useEffect, useRef } from "react";

import { useConsentimento } from "@/hooks/useConsentimento";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENTE = (import.meta.env["VITE_ADSENSE_CLIENT_ID"] ?? "").trim();

/** Só aceita o formato oficial do Google. Qualquer outra coisa mantém tudo desligado. */
export const ADSENSE_ATIVO = /^ca-pub-\d{10,}$/.test(CLIENTE);

type Formato = "banner" | "in-article" | "responsivo" | "lateral";

const ALTURA: Record<Formato, string> = {
  banner: "min-h-[90px]",
  "in-article": "min-h-[250px]",
  responsivo: "min-h-[250px]",
  lateral: "min-h-[600px]",
};

function Etiqueta() {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      Publicidade
    </span>
  );
}

function BlocoAdSense({ slot, formato }: { slot: string; formato: Formato }) {
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* bloqueador de anúncios: o conteúdo da página continua inteiro */
    }
  }, []);

  return (
    <ins
      className="adsbygoogle block w-full"
      data-ad-client={CLIENTE}
      data-ad-slot={slot}
      data-ad-format={formato === "in-article" ? "fluid" : "auto"}
      {...(formato === "in-article" ? { "data-ad-layout": "in-article" } : {})}
      data-full-width-responsive="true"
    />
  );
}

function Espaco({
  slot,
  formato,
  className,
}: {
  slot?: string | undefined;
  formato: Formato;
  className?: string | undefined;
}) {
  const { preferencias, pronto } = useConsentimento();
  const liberado = ADSENSE_ATIVO && Boolean(slot) && pronto && preferencias?.publicidade === true;

  // Desligado: não ocupa espaço nem desloca o conteúdo da página.
  if (!liberado) return null;

  return (
    <aside
      aria-label="Publicidade"
      className={cn("my-8 w-full overflow-hidden", ALTURA[formato], className)}
    >
      <Etiqueta />
      <BlocoAdSense slot={slot as string} formato={formato} />
    </aside>
  );
}

export function AdBanner({ slot, className }: { slot?: string | undefined; className?: string | undefined }) {
  return <Espaco slot={slot} formato="banner" className={className} />;
}

export function AdInArticle({ slot, className }: { slot?: string | undefined; className?: string | undefined }) {
  return <Espaco slot={slot} formato="in-article" className={className} />;
}

export function AdResponsive({ slot, className }: { slot?: string | undefined; className?: string | undefined }) {
  return <Espaco slot={slot} formato="responsivo" className={className} />;
}

export function AdSidebar({ slot, className }: { slot?: string | undefined; className?: string | undefined }) {
  return <Espaco slot={slot} formato="lateral" className={className} />;
}
