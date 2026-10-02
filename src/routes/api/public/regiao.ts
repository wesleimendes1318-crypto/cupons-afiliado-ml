import { createFileRoute } from "@tanstack/react-router";

import { json } from "@/lib/public-ai-api";

/* REGIAO APROXIMADA DO VISITANTE (CEP automatico, 02/10): so para mostrar
   "Frete simulado para: Cidade/UF" e o visitante trocar se quiser. Le os
   cabecalhos de localizacao da hospedagem (Cloudflare: cf-ipcity, cf-region,
   cf-postal-code, ou request.cf). Sem esses dados devolve tudo null e a tela
   pede o CEP: nunca inventa. Nao grava nada e nao devolve o IP. */

/* CEP do centro da capital de cada UF (aproximado: o visitante troca). */
const CEP_DA_CAPITAL: Record<string, string> = {
  AC: "69900-000",
  AL: "57020-000",
  AP: "68900-000",
  AM: "69005-010",
  BA: "40020-000",
  CE: "60030-000",
  DF: "70040-010",
  ES: "29010-000",
  GO: "74003-010",
  MA: "65010-000",
  MT: "78005-000",
  MS: "79002-000",
  MG: "30110-012",
  PA: "66010-000",
  PB: "58010-000",
  PR: "80010-000",
  PE: "50010-000",
  PI: "64000-000",
  RJ: "20040-002",
  RN: "59012-000",
  RS: "90010-000",
  RO: "76801-000",
  RR: "69301-000",
  SC: "88010-000",
  SP: "01001-000",
  SE: "49010-000",
  TO: "77001-000",
};
const NOME_DA_UF: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "federal district": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function decodificar(v: string | null | undefined) {
  if (!v) return null;
  try {
    return decodeURIComponent(v).trim() || null;
  } catch {
    return v.trim() || null;
  }
}

export function regiaoDoPedido(request: Request) {
  const cf = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {};
  const h = (n: string) => decodificar(request.headers.get(n));
  const pais = (h("cf-ipcountry") ?? (cf["country"] as string | undefined) ?? "").toUpperCase();
  if (pais && pais !== "BR") return { cidade: null, uf: null, cep: null, aproximado: true };
  const cidade = h("cf-ipcity") ?? decodificar(cf["city"] as string | undefined);
  const codigoUf = (
    h("cf-region-code") ??
    (cf["regionCode"] as string | undefined) ??
    ""
  ).toUpperCase();
  const nomeUf = h("cf-region") ?? decodificar(cf["region"] as string | undefined);
  const uf = CEP_DA_CAPITAL[codigoUf]
    ? codigoUf
    : ((nomeUf ? NOME_DA_UF[semAcento(nomeUf)] : undefined) ?? null);
  const postal = (h("cf-postal-code") ?? String(cf["postalCode"] ?? "")).replace(/\D/g, "");
  /* CEP completo da hospedagem vale; senao, o da capital da UF. */
  const cep =
    postal.length === 8
      ? `${postal.slice(0, 5)}-${postal.slice(5)}`
      : uf
        ? (CEP_DA_CAPITAL[uf] ?? null)
        : null;
  return { cidade: postal.length === 8 ? cidade : uf ? cidade : null, uf, cep, aproximado: true };
}

export const Route = createFileRoute("/api/public/regiao")({
  server: {
    handlers: {
      GET: async ({ request }) => json(request, regiaoDoPedido(request)),
    },
  },
});
