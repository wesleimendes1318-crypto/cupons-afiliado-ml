import { createFileRoute } from "@tanstack/react-router";

import { json } from "@/lib/public-ai-api";

/* REGIAO APROXIMADA DO VISITANTE (CEP automatico, 02/10): so para mostrar
   "Frete simulado para: Cidade/UF" e o visitante trocar se quiser. Le os
   cabecalhos de localizacao da hospedagem (Cloudflare: cf-ipcity, cf-region,
   cf-postal-code, ou request.cf); sem eles, a cidade pelo IP (ipwho.is /
   ipapi.co) e um CEP real da cidade (ViaCEP). Sem nada, a referencia nacional
   marcada como padrao. Nao grava nada e nao devolve o IP. */

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

type Regiao = {
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  aproximado: boolean;
  padrao: boolean;
  /* De onde veio (diagnóstico; nunca o IP). */
  fonte: "hospedagem" | "ip" | "padrao" | "fora";
};

const PADRAO: Regiao = {
  cidade: "São Paulo",
  uf: "SP",
  cep: "01001-000",
  aproximado: true,
  padrao: true,
  fonte: "padrao",
};

const formatar = (d: string) => `${d.slice(0, 5)}-${d.slice(5)}`;

/** Cabeçalhos/objeto de localização da Cloudflare, quando a hospedagem passa. */
function daHospedagem(request: Request) {
  const cf = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {};
  const h = (n: string) => decodificar(request.headers.get(n));
  const pais = (h("cf-ipcountry") ?? (cf["country"] as string | undefined) ?? "").toUpperCase();
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
  return { pais, cidade, uf, postal };
}

/* IP do visitante só para perguntar a cidade (não é gravado nem devolvido). */
function ipDoVisitante(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  if (!ip || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i.test(ip))
    return null;
  return ip;
}

/* Cidade pelo IP (03/10: a hospedagem não repassava a localização da
   Cloudflare e todo mundo via "São Paulo"). Dois serviços sem chave. */
async function porIp(ip: string) {
  try {
    const r = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region_code,city,postal`,
      { signal: AbortSignal.timeout(3_000) },
    );
    const j = (await r.json()) as {
      success?: boolean;
      country_code?: string;
      region_code?: string;
      city?: string;
      postal?: string;
    };
    if (j.success)
      return {
        pais: (j.country_code ?? "").toUpperCase(),
        cidade: j.city?.trim() || null,
        uf: (j.region_code ?? "").toUpperCase() || null,
        postal: String(j.postal ?? "").replace(/\D/g, ""),
      };
  } catch {
    /* tenta o próximo */
  }
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(3_000),
    });
    const j = (await r.json()) as {
      country_code?: string;
      region_code?: string;
      city?: string;
      postal?: string;
      error?: boolean;
    };
    if (!j.error && j.country_code)
      return {
        pais: j.country_code.toUpperCase(),
        cidade: j.city?.trim() || null,
        uf: (j.region_code ?? "").toUpperCase() || null,
        postal: String(j.postal ?? "").replace(/\D/g, ""),
      };
  } catch {
    /* sem cidade pelo IP */
  }
  return null;
}

/* Um CEP de verdade da cidade (ViaCEP), de preferência do Centro: o frete é
   simulado para a cidade do cliente, não para a capital. */
async function cepDaCidade(uf: string, cidade: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://viacep.com.br/ws/${uf}/${encodeURIComponent(cidade)}/Rua/json/`,
      { signal: AbortSignal.timeout(4_000) },
    );
    const lista = (await r.json()) as Array<{ cep?: string; bairro?: string; localidade?: string }>;
    if (!Array.isArray(lista) || !lista.length) return null;
    const mesma = lista.filter((x) => semAcento(x.localidade ?? "") === semAcento(cidade));
    const escolha = mesma.find((x) => /centro/i.test(x.bairro ?? "")) ?? mesma[0] ?? null;
    const d = (escolha?.cep ?? "").replace(/\D/g, "");
    return d.length === 8 ? formatar(d) : null;
  } catch {
    return null;
  }
}

export async function regiaoDoPedido(request: Request): Promise<Regiao> {
  let dados = daHospedagem(request);
  let fonte: Regiao["fonte"] = "hospedagem";
  if (!dados.uf || !dados.cidade) {
    const ip = ipDoVisitante(request);
    const peloIp = ip ? await porIp(ip) : null;
    if (peloIp) {
      dados = peloIp;
      fonte = "ip";
    }
  }
  if (dados.pais && dados.pais !== "BR")
    return { cidade: null, uf: null, cep: null, aproximado: true, padrao: false, fonte: "fora" };
  const uf = dados.uf && CEP_DA_CAPITAL[dados.uf] ? dados.uf : null;
  if (!uf) return { ...PADRAO };
  /* CEP completo vale; senão um CEP da própria cidade; senão o da capital. */
  const cep =
    dados.postal.length === 8
      ? formatar(dados.postal)
      : ((dados.cidade ? await cepDaCidade(uf, dados.cidade) : null) ?? CEP_DA_CAPITAL[uf] ?? null);
  if (!cep) return { ...PADRAO };
  return { cidade: dados.cidade, uf, cep, aproximado: true, padrao: false, fonte };
}

export const Route = createFileRoute("/api/public/regiao")({
  server: {
    handlers: {
      GET: async ({ request }) => json(request, await regiaoDoPedido(request)),
    },
  },
});
