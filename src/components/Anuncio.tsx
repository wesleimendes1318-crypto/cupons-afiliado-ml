/* Espaço de anúncio do Google AdSense — inerte por padrão (ver docs/adsense.md).

   - Sem VITE_ADSENSE_CLIENT no formato ca-pub-XXXXXXXXXXXXXXXX: nada é
     renderizado, nada ocupa altura e nenhum script é baixado.
   - Sem consentimento na categoria "publicidade": também null. Se a pessoa
     revogar, o espaço some na hora (o hook observa a mudança).
   - Sem slot: null (posicionamento só manual, nunca Anúncios Automáticos).
   - SSR: nada de window no render; o push para adsbygoogle acontece só no
     efeito, uma vez por <ins> (ref + data-adsbygoogle-status). Quem usa deve
     passar key por página (ex.: o slug do guia) para a troca de rota montar
     uma unidade nova. */

import { useEffect, useRef } from "react";

import { useConsentimento } from "@/hooks/useConsentimento";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/* Publisher ID público (02/11, conta aprovada); VITE_ADSENSE_CLIENT ainda pode trocar. */
export const ADSENSE_CLIENTE =
  (import.meta.env.VITE_ADSENSE_CLIENT ?? "").trim() || "ca-pub-5848712376900651";

/** Só o formato oficial do Google liga os anúncios. */
export const ADSENSE_ATIVO = /^ca-pub-\d{10,20}$/.test(ADSENSE_CLIENTE);

/* Blocos manuais dos guias (02/11); as variáveis de ambiente ainda podem trocar. */
export const ADSENSE_SLOT_GUIA_MEIO =
  (import.meta.env.VITE_ADSENSE_SLOT_GUIA_MEIO ?? "").trim() || "2786465840";
export const ADSENSE_SLOT_GUIA_FIM =
  (import.meta.env.VITE_ADSENSE_SLOT_GUIA_FIM ?? "").trim() || "7847220834";

function Unidade({ slot }: { slot: string }) {
  const ref = useRef<HTMLModElement>(null);
  const enviado = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || enviado.current || el.getAttribute("data-adsbygoogle-status")) return;
    enviado.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* bloqueador de anúncios: o artigo continua inteiro */
    }
  }, []);

  return (
    <ins
      ref={ref}
      className="adsbygoogle block w-full"
      data-ad-client={ADSENSE_CLIENTE}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

export function Anuncio({ slot }: { slot?: string | null | undefined }) {
  const { preferencias, pronto } = useConsentimento();
  const s = (slot ?? "").trim();
  if (!ADSENSE_ATIVO || !s || !pronto || preferencias?.publicidade !== true) return null;

  return (
    <aside aria-label="Publicidade" className="not-prose my-8 w-full overflow-hidden">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Publicidade
      </span>
      <Unidade slot={s} />
    </aside>
  );
}
