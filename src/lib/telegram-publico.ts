/* Canal de ofertas e bot do Telegram (Weslei, 05/10). Fonte única dos nomes
   públicos: site, rodapé, página /telegram e o garimpo usam daqui. Nomes de
   usuário são públicos (não são segredo); o token do bot fica em API_TELEGRAM. */

export const TELEGRAM_BOT = "AfiliadosMELI_bot";
export const TELEGRAM_CANAL = "melhorescolha_ofertas";
export const LINK_CANAL = `https://t.me/${TELEGRAM_CANAL}`;

/* De onde veio a conversa com o bot (/start <origem>). */
export const ORIGENS_TELEGRAM = [
  "topo",
  "home",
  "resultado",
  "meus_precos",
  "rodape",
  "pagina_telegram",
  "canal",
] as const;
export type OrigemTelegram = (typeof ORIGENS_TELEGRAM)[number];

/** Deep link do bot com origem, para saber de onde veio a conversa. */
export function linkDoBot(origem: OrigemTelegram): string {
  return `https://t.me/${TELEGRAM_BOT}?start=${origem}`;
}

/** Origem válida de um "/start <origem>" (ou null). */
export function origemDoStart(texto: string): OrigemTelegram | null {
  const m = /^\/start(?:@\w+)?\s+([a-z0-9_]{1,32})\b/i.exec(texto.trim());
  const o = m?.[1]?.toLowerCase();
  return o && (ORIGENS_TELEGRAM as readonly string[]).includes(o) ? (o as OrigemTelegram) : null;
}
