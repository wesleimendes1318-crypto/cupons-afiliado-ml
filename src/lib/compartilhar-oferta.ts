/* Branded recommendation text for WhatsApp / copy (Weslei, 27/11/2026: answer
   friends from his own site in 1 tap). Two links: his affiliate buy link first
   (rule no. 1, the caller only passes a link from buscarLinkAfiliado) and the
   product page on melhorescolha.io so the friend finds the site next time.
   Nothing invented: no shipping, installments or discount lines (cards carry
   no confirmed data for them); the price is the one the site shows, with a
   "confira no link" note because the store can change it. */
import { SITE_URL } from "@/lib/autor";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function textoRecomendacao(o: {
  titulo: string;
  preco: number | null;
  link: string;
  /* MLB id of /produto/$id, or null (Amazon/Shopee): then the home page. */
  pagina: string | null;
}): string {
  const titulo = o.titulo.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
  const linhas = [`🔥 *${titulo}*`];
  if (o.preco != null && Number.isFinite(o.preco) && o.preco > 0)
    linhas.push(`💰 *${brl(o.preco)}* no site (confira o valor final no link)`);
  linhas.push(`👉 Comprar com segurança: ${o.link}`);
  linhas.push(
    o.pagina
      ? `🛡️ Conferido no Melhor Escolha: ${SITE_URL}/produto/${o.pagina}`
      : `🛡️ Compare preços no Melhor Escolha: ${SITE_URL}`,
  );
  return linhas.join("\n");
}
