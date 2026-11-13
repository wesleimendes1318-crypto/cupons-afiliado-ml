/* Author and publisher entities for JSON-LD (E-E-A-T, 13/11/2026).
   Bio facts come from Weslei (13/11). jobTitle never says "IA"/"Inteligência"
   (no AI wording in customer-facing text, CLAUDE.md). */
export const SITE_URL = "https://melhorescolha.io";

export const AUTOR_NOME = "Weslei Mendes Silva";
export const AUTOR_CARGO = "Especialista em Produtos Digitais e Comparação de Preços";

export const AUTOR_LD = {
  "@type": "Person",
  name: AUTOR_NOME,
  jobTitle: AUTOR_CARGO,
  url: `${SITE_URL}/sobre`,
  // LinkedIn left out until Weslei confirms the URL (13/11/2026).
  sameAs: [`${SITE_URL}/sobre`, "https://www.instagram.com/wslmendes/"],
  alumniOf: [{ "@type": "CollegeOrUniversity", name: "FIAP" }],
} as const;

export const EDITORA_LD = {
  "@type": "Organization",
  name: "Melhor Escolha",
  url: `${SITE_URL}/`,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
} as const;

/** "23/09/2026" -> "2026-09-23"; anything else -> undefined (dropped by JSON.stringify). */
export function dataIso(ddmmaaaa: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmaaaa.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}
