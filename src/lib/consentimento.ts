/* Consentimento de cookies (LGPD).

   Nada de "banner enfeite": a preferência guardada aqui é lida antes de
   qualquer script de medição ou publicidade ser carregado. Sem decisão do
   visitante, só o essencial roda. */

export type Preferencias = {
  essenciais: true;
  analise: boolean;
  publicidade: boolean;
  decididoEm: string;
  versao: number;
};

export const VERSAO_CONSENTIMENTO = 1;
const CHAVE = "consentimento-cookies";

const OUVINTES = new Set<(p: Preferencias | null) => void>();

export function lerConsentimento(): Preferencias | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as Partial<Preferencias>;
    if (dado?.versao !== VERSAO_CONSENTIMENTO) return null;
    return {
      essenciais: true,
      analise: Boolean(dado.analise),
      publicidade: Boolean(dado.publicidade),
      decididoEm: typeof dado.decididoEm === "string" ? dado.decididoEm : new Date().toISOString(),
      versao: VERSAO_CONSENTIMENTO,
    };
  } catch {
    return null;
  }
}

export function salvarConsentimento(escolha: { analise: boolean; publicidade: boolean }): Preferencias {
  const preferencias: Preferencias = {
    essenciais: true,
    analise: escolha.analise,
    publicidade: escolha.publicidade,
    decididoEm: new Date().toISOString(),
    versao: VERSAO_CONSENTIMENTO,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(preferencias));
    } catch {
      /* navegação privada pode bloquear; a preferência vale só para esta visita */
    }
  }
  OUVINTES.forEach((ouvinte) => ouvinte(preferencias));
  return preferencias;
}

export function limparConsentimento() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
  }
  OUVINTES.forEach((ouvinte) => ouvinte(null));
}

export function observarConsentimento(ouvinte: (p: Preferencias | null) => void) {
  OUVINTES.add(ouvinte);
  return () => {
    OUVINTES.delete(ouvinte);
  };
}

export function abrirPreferencias() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("abrir-preferencias-cookies"));
  }
}
