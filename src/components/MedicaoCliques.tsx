/* MEDIÇÃO DE CLIQUES (Weslei, 05/10): conta cliques nos botões de compra
   (link de afiliado meli.la) e nos convites do Telegram, para saber o que o
   visitante usa. Só com consentimento de análise; sem IP, sem cookie, sem id
   de visitante (tabela eventos_site, função registrar_evento). Não mede
   compra: clique não é venda. Origem pelo data-origem mais próximo (ou o
   ?start= do link do bot) e o pedido pelo data-pedido do resultado. */

import { useEffect } from "react";

import { lerConsentimento } from "@/lib/consentimento";

const URL_RPC = `${import.meta.env["VITE_SUPABASE_URL"] ?? ""}/rest/v1/rpc/registrar_evento`;
const CHAVE = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";

function enviar(corpo: Record<string, unknown>) {
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

export function MedicaoCliques() {
  useEffect(() => {
    const aoClicar = (ev: MouseEvent) => {
      const alvo = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!alvo) return;
      const href = alvo.href;
      const afiliado = /^https:\/\/meli\.la\//i.test(href);
      const telegram = /^https:\/\/t\.me\//i.test(href);
      if (!afiliado && !telegram) return;
      if (lerConsentimento()?.analise !== true) return;
      const origemAttr = (alvo.closest("[data-origem]") as HTMLElement | null)?.dataset["origem"];
      const pedidoAttr = (alvo.closest("[data-pedido]") as HTMLElement | null)?.dataset["pedido"];
      const pedido = pedidoAttr && /^\d+$/.test(pedidoAttr) ? Number(pedidoAttr) : null;
      let origem = origemAttr ?? null;
      let destino = "loja";
      if (telegram) {
        const u = new URL(href);
        destino = u.searchParams.has("start") ? "bot" : "canal";
        origem = origem ?? u.searchParams.get("start");
      }
      enviar({
        p_tipo: afiliado ? "clique_afiliado" : "clique_telegram",
        p_origem: origem,
        p_destino: destino,
        p_pedido: pedido,
        p_pagina: window.location.pathname.slice(0, 120),
      });
    };
    document.addEventListener("click", aoClicar, { capture: true });
    return () => document.removeEventListener("click", aoClicar, { capture: true });
  }, []);
  return null;
}
