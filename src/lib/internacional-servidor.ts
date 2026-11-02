/* Envio internacional pela lista OFICIAL de ofertas da ficha (01/11, Switch 2):
   tags "cbt_item" / "cbt_fulfillment_us". Só leitura; cache de 6 h na memória. */
import { envioDasTags, type EnvioInternacional } from "@/lib/internacional";
import { mlGet } from "@/lib/ml-api";
import { itensDaAnalise } from "@/lib/prazo-servidor";

const cache = new Map<string, { em: number; itens: Record<string, EnvioInternacional> }>();
const SEIS_HORAS = 6 * 3600_000;
let consultasRecentes: number[] = [];

export async function ofertasDaFicha(produto: string): Promise<Record<string, EnvioInternacional>> {
  const g = cache.get(produto);
  if (g && Date.now() - g.em < SEIS_HORAS) return g.itens;
  consultasRecentes = consultasRecentes.filter((t) => Date.now() - t < 5 * 60_000);
  if (consultasRecentes.length > 200) return g?.itens ?? {};
  const itens: Record<string, EnvioInternacional> = {};
  for (let offset = 0; offset < 100; offset += 50) {
    consultasRecentes.push(Date.now());
    let j: { results?: { item_id?: string; tags?: unknown; shipping?: { tags?: unknown } }[] };
    try {
      j = await mlGet(`/products/${produto}/items?limit=50&offset=${offset}`);
    } catch {
      break;
    }
    const lista = j.results ?? [];
    for (const r of lista) {
      if (!r.item_id) continue;
      const tags = [
        ...(Array.isArray(r.tags) ? r.tags : []),
        ...(Array.isArray(r.shipping?.tags) ? r.shipping.tags : []),
      ];
      itens[r.item_id.toUpperCase()] = envioDasTags(tags);
    }
    if (lista.length < 50) break;
  }
  cache.set(produto, { em: Date.now(), itens });
  return itens;
}

export function fichasDoTexto(texto: string): string[] {
  let s = texto;
  try {
    s = decodeURIComponent(texto);
  } catch {
    /* como veio */
  }
  const out = new Set<string>();
  for (const m of s.matchAll(/\/p\/(MLB\d{6,})/gi)) if (m[1]) out.add(m[1].toUpperCase());
  return [...out].slice(0, 4);
}


/** Envio de cada oferta da análise, pelas chaves da tela (colado, alt-i,
    ref-i, par-i). Oferta fora da lista oficial fica sem resposta. */
export async function envioDaAnalise(
  analise: Record<string, unknown>,
  urlAlvo: string | null,
): Promise<Record<string, EnvioInternacional>> {
  const mapa = itensDaAnalise(analise, urlAlvo);
  const fichas = fichasDoTexto(`${urlAlvo ?? ""} ${JSON.stringify(analise)}`);
  const porItem: Record<string, EnvioInternacional> = {};
  const lidas = await Promise.allSettled(fichas.map((f) => ofertasDaFicha(f)));
  for (const l of lidas) if (l.status === "fulfilled") Object.assign(porItem, l.value);
  const envio: Record<string, EnvioInternacional> = {};
  for (const [chave, item] of Object.entries(mapa)) {
    const e = porItem[item];
    if (e) envio[chave] = e;
  }
  return envio;
}
