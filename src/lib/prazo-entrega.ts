/* PRAZO DE ENTREGA ("Receber até", Weslei, 06/10: "presente de aniversário
   ou até quando você pode receber"). A data vem da estimativa OFICIAL do
   Mercado Livre para o CEP do cliente (/items/{id}/shipping_options,
   estimated_delivery_time). Regra: a opção de envio só atende quando a data
   MAIS TARDIA da estimativa (offset.date na faixa "entre X e Y") é igual ou
   anterior à data escolhida. Sem estimativa = "prazo não confirmado" e nunca
   passa como rápida. Datas sempre no dia de Brasília (YYYY-MM-DD). */

import { ehLinkDeAfiliado } from "@/lib/afiliado";

export type OpcaoEnvio = {
  /* Frete que o comprador paga nesta opção (0 = grátis). */
  custo: number;
  /* Primeira e última data da estimativa (iguais quando é data única). */
  de: string;
  ate: string;
  /* Velocidade informada pela API (slow, two_days, three_days, same_day...). */
  tipo: string | null;
};

export type PrazoDoItem = { opcoes: OpcaoEnvio[] } | null;

export const AVISO_PRAZO =
  "⚠️ Estimativa oficial do Mercado Livre para o seu CEP. Compras feitas após o horário de corte do vendedor ou fins de semana podem sofrer alteração no prazo final de entrega.";

const FUSO = "America/Sao_Paulo";

/** Dia de hoje em Brasília, YYYY-MM-DD. */
export function obterHojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD. */
function diaDaSemana(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function obterAmanhaBrasilia(agora: Date = new Date()): string {
  return somarDias(obterHojeBrasilia(agora), 1);
}

/** Domingo deste fim de semana (hoje, se já for domingo). */
export function obterFimDeSemanaBrasilia(agora: Date = new Date()): string {
  const hoje = obterHojeBrasilia(agora);
  const dow = diaDaSemana(hoje);
  return somarDias(hoje, dow === 0 ? 0 : 7 - dow);
}

/** Data (YYYY-MM-DD) de um ISO com fuso ("2026-10-08T00:00:00-03:00"). */
export function diaDoIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (!m) return null;
  /* A API manda a data já no fuso do Brasil (-03:00): a parte da data vale. */
  return m[1] ?? null;
}

export function dataAtendePrazo(ate: string | null | undefined, limite: string): boolean {
  return Boolean(ate) && (ate as string) <= limite;
}

/** A opção de envio mais barata que chega até a data (empate: a que chega antes). */
export function melhorEnvioAte(p: PrazoDoItem, limite: string): OpcaoEnvio | null {
  if (!p) return null;
  return (
    p.opcoes
      .filter((o) => dataAtendePrazo(o.ate, limite))
      .sort((x, y) => x.custo - y.custo || x.ate.localeCompare(y.ate))[0] ?? null
  );
}

/** A opção que chega antes (empate: a mais barata). */
export function envioMaisRapido(p: PrazoDoItem): OpcaoEnvio | null {
  if (!p) return null;
  return [...p.opcoes].sort((x, y) => x.ate.localeCompare(y.ate) || x.custo - y.custo)[0] ?? null;
}

const SEMANA = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** "hoje", "amanhã" ou "sex., 10/10". */
export function formatarDataAmigavel(dia: string, agora: Date = new Date()): string {
  const hoje = obterHojeBrasilia(agora);
  if (dia === hoje) return "hoje";
  if (dia === somarDias(hoje, 1)) return "amanhã";
  const [, m, d] = dia.split("-");
  return `${SEMANA[diaDaSemana(dia)]}, ${d}/${m}`;
}

/** "10/10/2026". */
export function formatarDataCompleta(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/** Lê a resposta de /items/{id}/shipping_options. Só entrega no endereço
    (retirada em agência fica de fora) e só opção com data informada. */
export function lerOpcoesDeEnvio(j: unknown): OpcaoEnvio[] {
  const lista = (j as { options?: unknown[] } | null)?.options;
  if (!Array.isArray(lista)) return [];
  const out: OpcaoEnvio[] = [];
  for (const bruto of lista) {
    const o = bruto as {
      cost?: number;
      shipping_option_type?: string;
      shipping_method_type?: string;
      estimated_delivery_time?: { date?: string; offset?: { date?: string | null } };
    };
    if (o.shipping_option_type && o.shipping_option_type !== "address") continue;
    const custo = Number(o.cost);
    const de = diaDoIso(o.estimated_delivery_time?.date);
    if (!Number.isFinite(custo) || !de) continue;
    const ate = diaDoIso(o.estimated_delivery_time?.offset?.date) ?? de;
    out.push({ custo, de, ate: ate < de ? de : ate, tipo: o.shipping_method_type ?? null });
  }
  return out;
}

/** "13/10" no texto livre (Telegram): data futura deste ano ou do próximo. */
export function dataDoTexto(texto: string, agora: Date = new Date()): string | null {
  const t = texto.toLowerCase();
  const hoje = obterHojeBrasilia(agora);
  if (/\b(receb\w*|entreg\w*|chegar?)\b[^.\n]{0,20}\bhoje\b|\bat[ée] hoje\b/.test(t)) return hoje;
  if (/(?:^|\s)at[ée] amanh[ãa]|\b(receb\w*|entreg\w*|chegar?)\b[^.\n]{0,20}\bamanh[ãa]/.test(t))
    return somarDias(hoje, 1);
  if (/\bfim de semana\b/.test(t)) return obterFimDeSemanaBrasilia(agora);
  const m = /\bat[ée]\s+(?:o dia\s+|dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (!m) return null;
  const d = Number(m[1]);
  const mes = Number(m[2]);
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return null;
  let ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(hoje.slice(0, 4));
  let dia = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (!m[3] && dia < hoje) {
    ano += 1;
    dia = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return dia < hoje ? null : dia;
}

type ComPreco = {
  preco?: number | null;
  final?: number | null;
  vendedor?: string | null;
  titulo?: string | null;
  link?: string | null;
  freteGratis?: boolean | null;
  custoFrete?: number | null;
};

export type ForaDoPrazo = {
  nome: string;
  preco: number | null;
  /* Total com o frete mais barato do anúncio (sem frete conhecido: o preço). */
  total: number | null;
  link: string | null;
  /* Data mais cedo que a estimativa promete; null = sem data confirmada. */
  chega: string | null;
  tipo: "mesmo" | "parecido";
};

export type ResultadoPrazo<A> = {
  analise: A;
  fora: ForaDoPrazo[];
  /* null = sem data confirmada para o anúncio colado. */
  coladoChega: string | null;
  coladoAtende: boolean;
  algumAtende: boolean;
};

/** Aplica a data limite na análise: tira o que não chega a tempo e, no que
    chega, usa o frete da opção de envio que atende (pode ser paga). */
export function aplicarPrazo<
  A extends {
    preco?: number | null;
    freteGratis?: boolean | null;
    custoFrete?: number | null;
    outrasLojas?: ComPreco[] | null;
    referencias?: ComPreco[] | null;
    parecidos?: ComPreco[] | null;
  },
>(a: A, prazos: Record<string, PrazoDoItem>, limite: string): ResultadoPrazo<A> {
  const fora: ForaDoPrazo[] = [];
  let algumAtende = false;
  const filtrar = <T extends ComPreco>(
    lista: T[] | null | undefined,
    pref: string,
    tipo: ForaDoPrazo["tipo"],
  ): T[] | null | undefined => {
    if (!lista) return lista;
    const out: T[] = [];
    lista.forEach((o, i) => {
      const p = prazos[`${pref}-${i}`] ?? null;
      const ok = melhorEnvioAte(p, limite);
      if (ok) {
        algumAtende = true;
        out.push({ ...o, freteGratis: ok.custo === 0, custoFrete: ok.custo, prazoAte: ok.ate });
      } else {
        const preco = o.final ?? o.preco ?? null;
        const rapido = envioMaisRapido(p);
        fora.push({
          nome: (tipo === "parecido" ? o.titulo : o.vendedor) ?? "Outra loja",
          preco,
          total: preco == null ? null : preco + (rapido?.custo ?? 0),
          link: ehLinkDeAfiliado(o.link) ? (o.link as string) : null,
          chega: rapido?.de ?? null,
          tipo,
        });
      }
    });
    return out;
  };
  const pc = prazos["colado"] ?? null;
  const okColado = melhorEnvioAte(pc, limite);
  if (okColado) algumAtende = true;
  const analise = {
    ...a,
    ...(okColado ? { freteGratis: okColado.custo === 0, custoFrete: okColado.custo } : {}),
    outrasLojas: filtrar(a.outrasLojas, "alt", "mesmo"),
    referencias: filtrar(a.referencias, "ref", "mesmo"),
    parecidos: filtrar(a.parecidos, "par", "parecido"),
  } as A;
  return {
    analise,
    fora,
    coladoChega: envioMaisRapido(pc)?.de ?? null,
    coladoAtende: okColado != null,
    algumAtende,
  };
}
