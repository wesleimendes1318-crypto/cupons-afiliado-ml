/* Branded recommendation text for WhatsApp / copy (Weslei, 27/11/2026: answer
   friends from his own site in 1 tap). Two links: his affiliate buy link first
   (rule no. 1, the caller only passes a link from buscarLinkAfiliado) and the
   product page on melhorescolha.io so the friend finds the site next time.
   Nothing invented: no shipping, installments or discount lines (cards carry
   no confirmed data for them). The price line only when the site read it at
   most PRECO_ROBO_HORAS ago (27/11: an old price would mislead); without a
   read time it is left out. */
import { SITE_URL } from "@/lib/autor";
import { PRECO_ROBO_HORAS } from "@/lib/precos-robo";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function precoRecente(vistoEm: string | null | undefined, agora = Date.now()): boolean {
  const t = vistoEm ? Date.parse(vistoEm) : NaN;
  return Number.isFinite(t) && agora - t >= -5 * 60_000 && agora - t <= PRECO_ROBO_HORAS * 3600_000;
}

export function textoRecomendacao(o: {
  titulo: string;
  preco: number | null;
  /* When the site read that price (ISO); null/unknown = no price line. */
  vistoEm?: string | null | undefined;
  link: string;
  /* MLB id of /produto/$id, or null (Amazon/Shopee): then the home page. */
  pagina: string | null;
}, agora = Date.now()): string {
  const titulo = o.titulo.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
  const linhas = [`🔥 *${titulo}*`];
  if (o.preco != null && Number.isFinite(o.preco) && o.preco > 0 && precoRecente(o.vistoEm, agora))
    linhas.push(`💰 *${brl(o.preco)}* no site (confira o valor final no link)`);
  linhas.push(`👉 Comprar com segurança: ${o.link}`);
  linhas.push(
    o.pagina
      ? `🛡️ Conferido no Melhor Escolha: ${SITE_URL}/produto/${o.pagina}`
      : `🛡️ Compare preços no Melhor Escolha: ${SITE_URL}`,
  );
  return linhas.join("\n");
}
