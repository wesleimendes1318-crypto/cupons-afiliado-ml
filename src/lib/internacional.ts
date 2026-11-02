/* ENVIO INTERNACIONAL E TRIBUTOS (Weslei, 01/11, Switch 2 MLB49200061: a
   oferta de R$ 2.906,32 vinha dos EUA e, no pagamento, somava R$ 1.579,89 de
   imposto de importação + R$ 918,71 de ICMS = R$ 5.404,92, MAIS CARA que a
   nacional de R$ 4.277,91; a tela dizia "R$ 1.371 a menos").
   Regra: "nunca afirmar o preço que não entrega". O custo de uma oferta
   internacional é produto + frete conhecido + tributos LIDOS na página. Sem
   os tributos lidos, o custo é desconhecido: ela nunca vira recomendação nem
   "mais barata", e a tela diz que pode haver impostos no pagamento.
   Nada aqui estima imposto por conta própria (a regra muda e não inventamos
   valores). Fontes: lista oficial de ofertas da ficha (tags "cbt_item",
   "cbt_fulfillment_us") e a página do anúncio (texto "Tributações
   estimadas", lido pela extensão). */

export type EnvioInternacional = {
  internacional: boolean;
  paisOrigem: string | null;
};

export type Tributos = {
  impostoImportacao: number | null;
  icms: number | null;
  total: number;
};

const PAISES: Record<string, string> = {
  us: "EUA",
  usa: "EUA",
  cn: "China",
  hk: "Hong Kong",
  mx: "México",
  co: "Colômbia",
  cl: "Chile",
  ar: "Argentina",
};

/** Lê as tags da lista oficial de ofertas: "cbt_item" / "cbt_fulfillment_us". */
export function envioDasTags(tags: unknown): EnvioInternacional {
  const lista = Array.isArray(tags) ? tags.map((t) => String(t).toLowerCase()) : [];
  const cbt = lista.some((t) => t === "cbt_item" || t.startsWith("cbt_"));
  if (!cbt) return { internacional: false, paisOrigem: null };
  let pais: string | null = null;
  for (const t of lista) {
    const m = /^cbt_(?:fulfillment|item|shipping)_([a-z]{2,3})$/.exec(t);
    const sigla = m?.[1];
    if (sigla && PAISES[sigla]) {
      pais = PAISES[sigla];
      break;
    }
  }
  return { internacional: true, paisOrigem: pais };
}

/** "1.579,89" -> 1579.89 */
export function numeroBr(s: string | null | undefined): number | null {
  if (!s) return null;
  const limpo = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
}

/** Bloco "Tributações estimadas" da página (Remessa Conforme). */
export function tributosDoTexto(texto: string | null | undefined): Tributos | null {
  if (!texto) return null;
  const t = String(texto)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/\s+/g, " ");
  const bloco = /Tributa[çc][õo]es\s+estimadas([\s\S]{0,600})/i.exec(t)?.[1];
  if (!bloco) return null;
  const ii = /Imposto\s+de\s+importa[çc][ãa]o\s*:?\s*R\$\s*([\d.]+,\d{2})/i.exec(bloco);
  const icms = /ICMS\s*:?\s*R\$\s*([\d.]+,\d{2})/i.exec(bloco);
  const vII = numeroBr(ii?.[1]);
  const vICMS = numeroBr(icms?.[1]);
  if (vII == null && vICMS == null) return null;
  return {
    impostoImportacao: vII,
    icms: vICMS,
    total: Math.round(((vII ?? 0) + (vICMS ?? 0)) * 100) / 100,
  };
}

/** Tributos guardados na análise, conferidos (número positivo). */
export function tributosValidos(v: unknown): number | null {
  const n = typeof v === "number" ? v : null;
  return n != null && Number.isFinite(n) && n > 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
}

export type OfertaComCusto = {
  final?: number | null;
  freteGratis?: boolean | null;
  custoFrete?: number | null;
  internacional?: boolean | null;
  tributosEstimados?: number | null;
};

/** Custo que o cliente paga: produto + frete conhecido + tributos lidos.
    Frete pago sem valor ou internacional sem tributos lidos: null. */
export function custoTotalDaOferta(o: OfertaComCusto): number | null {
  if (o.final == null) return null;
  let total = o.final;
  if (o.freteGratis === false) {
    if (o.custoFrete == null || !(o.custoFrete > 0)) return null;
    total += o.custoFrete;
  }
  if (o.internacional === true) {
    const t = tributosValidos(o.tributosEstimados);
    if (t == null) return null;
    total += t;
  }
  return Math.round(total * 100) / 100;
}

/** Custo da oferta é incompleto por ser internacional sem tributos lidos. */
export function custoIncompleto(o: OfertaComCusto): boolean {
  return o.internacional === true && tributosValidos(o.tributosEstimados) == null;
}

/** Texto do selo: "Internacional · EUA". */
export function rotuloInternacional(pais: string | null | undefined): string {
  return pais ? `Envio internacional · ${pais}` : "Envio internacional";
}

/** Diferença de procedência entre o colado e outra oferta, para o "Muda". */
export function mudaProcedencia(
  colado: EnvioInternacional | null | undefined,
  outro: EnvioInternacional | null | undefined,
): string | null {
  if (!colado || !outro || colado.internacional === outro.internacional) return null;
  const txt = (e: EnvioInternacional) =>
    e.internacional ? `Envio internacional (${e.paisOrigem ?? "exterior"})` : "Envio nacional";
  return `Procedência: ${txt(colado)} -> ${txt(outro)}`;
}

type ComUrl = {
  item?: string | null;
  url?: string | null;
  internacional?: boolean | null;
  paisOrigem?: string | null;
};

/** Marca cada oferta da análise com o envio lido no servidor (por chave
    colado / alt-i / ref-i / par-i). O que a extensão já leu manda. */
export function aplicarEnvio<
  A extends {
    internacional?: boolean | null;
    paisOrigem?: string | null;
    outrasLojas?: ComUrl[] | null;
    referencias?: ComUrl[] | null;
    parecidos?: ComUrl[] | null;
  },
>(a: A, mapa: Record<string, EnvioInternacional | null> | null | undefined): A {
  if (!mapa || !Object.keys(mapa).length) return a;
  const marcar = <T extends ComUrl>(o: T, chave: string): T => {
    const e = mapa[chave];
    if (!e || o.internacional != null) return o;
    return { ...o, internacional: e.internacional, paisOrigem: e.paisOrigem };
  };
  const lista = <T extends ComUrl>(l: T[] | null | undefined, pref: string) =>
    l ? l.map((o, i) => marcar(o, `${pref}-${i}`)) : l;
  const c = mapa["colado"];
  return {
    ...a,
    ...(c && a.internacional == null
      ? { internacional: c.internacional, paisOrigem: c.paisOrigem }
      : {}),
    outrasLojas: lista(a.outrasLojas, "alt"),
    referencias: lista(a.referencias, "ref"),
    parecidos: lista(a.parecidos, "par"),
  };
}
