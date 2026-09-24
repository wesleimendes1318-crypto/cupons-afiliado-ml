/* Google com consentimento (Consent Mode v2 + LGPD).

   - O padrão, gravado no <head> antes de qualquer script do Google, é TUDO
     negado (analytics_storage, ad_storage, ad_user_data, ad_personalization).
   - Este componente só troca para "granted" o que o visitante autorizou no
     aviso de cookies, e troca de volta se ele mudar de ideia.
   - Google Analytics 4 só carrega com medição autorizada e com
     VITE_GA_ID válido (G-XXXXXXX). AdSense só carrega com publicidade
     autorizada e VITE_ADSENSE_CLIENT_ID válido. Sem ID, nada é baixado. */

import { useEffect } from "react";

import { ADSENSE_ATIVO } from "@/components/anuncios/Anuncio";
import { useConsentimento } from "@/hooks/useConsentimento";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = (import.meta.env["VITE_GA_ID"] ?? "").trim();
const GA_ATIVO = /^G-[A-Z0-9]{4,}$/.test(GA_ID);
const ADSENSE_CLIENTE = (import.meta.env["VITE_ADSENSE_CLIENT_ID"] ?? "").trim();

/* Vai no <head> (ver __root.tsx): define o gtag e nega tudo por padrão. */
export const SCRIPT_CONSENTIMENTO_PADRAO = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});gtag('set','ads_data_redaction',true);`;

function carregarScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  if (src.includes("adsbygoogle")) s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

export function GoogleConsentimento() {
  const { preferencias, pronto } = useConsentimento();

  useEffect(() => {
    if (!pronto || typeof window === "undefined" || !window.gtag) return;
    const analise = Boolean(preferencias?.analise);
    const publicidade = Boolean(preferencias?.publicidade);

    window.gtag("consent", "update", {
      analytics_storage: analise ? "granted" : "denied",
      ad_storage: publicidade ? "granted" : "denied",
      ad_user_data: publicidade ? "granted" : "denied",
      ad_personalization: publicidade ? "granted" : "denied",
    });

    if (analise && GA_ATIVO) {
      carregarScript("ga4", `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
      window.gtag("js", new Date());
      window.gtag("config", GA_ID, { anonymize_ip: true });
    }
    if (publicidade && ADSENSE_ATIVO) {
      carregarScript(
        "adsense",
        `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENTE}`,
      );
    }
  }, [pronto, preferencias]);

  return null;
}
