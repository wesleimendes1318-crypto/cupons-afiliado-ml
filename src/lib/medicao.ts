/* Envio dos eventos de medição (registrar_evento): cliques em meli.la e
   t.me (MedicaoCliques) e impressões das campanhas. Só com consentimento de
   análise; sem IP, sem cookie, sem id de visitante. */
import { lerConsentimento } from "@/lib/consentimento";

const URL_RPC = `${import.meta.env["VITE_SUPABASE_URL"] ?? ""}/rest/v1/rpc/registrar_evento`;
const CHAVE = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";

export function enviarEvento(corpo: Record<string, unknown>) {
  if (!URL_RPC.startsWith("https://") || !CHAVE) return;
  try {
    /* keepalive: o clique costuma abrir outra página; a contagem não pode se perder. */
    void fetch(URL_RPC, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: CHAVE,
        Authorization: `Bearer ${CHAVE}`,
      },
      body: JSON.stringify(corpo),
    }).catch(() => undefined);
  } catch {
    /* sem rede: segue sem medir */
  }
}

/** Origem da medição de uma campanha (registrar_evento aceita [a-z0-9_];
    consolidar_metricas_campanhas faz a mesma conta). */
export const origemDaCampanha = (slug: string) =>
  `campanha_${slug.replace(/-/g, "_")}`.slice(0, 32);

/* Uma impressão por campanha por página aberta. */
const vistas = new Set<string>();

export function registrarImpressaoCampanha(slug: string) {
  if (typeof window === "undefined" || vistas.has(slug)) return;
  if (lerConsentimento()?.analise !== true) return;
  vistas.add(slug);
  enviarEvento({
    p_tipo: "impressao_campanha",
    p_origem: origemDaCampanha(slug),
    p_pagina: window.location.pathname.slice(0, 120),
  });
}
