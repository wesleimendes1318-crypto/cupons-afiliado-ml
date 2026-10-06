/* Prazo de entrega no SERVIDOR (06/10): estimativa oficial por anúncio e
   CEP, guardada 30 min em prazo_entrega_cache (só serviço). Freio: com mais
   de 400 consultas novas em 5 min no site todo, só responde o que já está
   guardado (protege a cota da API). */
import { envioParaCep } from "@/lib/ml-api";
import { lerOpcoesDeEnvio, type PrazoDoItem } from "@/lib/prazo-entrega";

const RE_ITEM = /^MLB\d{6,}$/;

export function itemDoEndereco(u: unknown): string | null {
  if (typeof u !== "string" || !u) return null;
  let s = u;
  try {
    s = decodeURIComponent(u);
  } catch {
    /* fica o texto como veio */
  }
  const f = /item_id[:=](MLB\d{6,})/i.exec(s) || /[?&#]wid=(MLB\d{6,})/i.exec(s);
  if (f?.[1]) return f[1].toUpperCase();
  const b = /\/MLB-?(\d{6,})/i.exec(s);
  return b?.[1] ? `MLB${b[1]}` : null;
}

type Bruto = Record<string, unknown>;

/** Anúncio de cada opção da análise, pelas chaves da tela: colado, alt-i
    (outrasLojas), ref-i (referencias) e par-i (parecidos, índice original). */
export function itensDaAnalise(a: Bruto | null, urlAlvo: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  const colado = itemDoEndereco(urlAlvo);
  if (colado) out["colado"] = colado;
  const lista = (k: string) => (Array.isArray(a?.[k]) ? (a?.[k] as Bruto[]) : []);
  const de = (o: Bruto) => {
    const i = typeof o["item"] === "string" ? o["item"].toUpperCase() : null;
    return i && RE_ITEM.test(i) ? i : itemDoEndereco(o["url"]);
  };
  lista("outrasLojas").forEach((o, i) => {
    const it = de(o);
    if (it) out[`alt-${i}`] = it;
  });
  lista("referencias").forEach((o, i) => {
    const it = de(o);
    if (it) out[`ref-${i}`] = it;
  });
  lista("parecidos").forEach((o, i) => {
    const it = de(o);
    if (it) out[`par-${i}`] = it;
  });
  return out;
}

export async function prazosDosItens(
  itens: string[],
  cep: string,
): Promise<Record<string, PrazoDoItem>> {
  const cep8 = cep.replace(/\D/g, "");
  const unicos = [...new Set(itens.filter((i) => RE_ITEM.test(i)))].slice(0, 30);
  const out: Record<string, PrazoDoItem> = {};
  if (!unicos.length || cep8.length !== 8) return out;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const desde = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: guardados } = (await db
    .from("prazo_entrega_cache")
    .select("item, opcoes, status")
    .eq("cep", cep8)
    .in("item", unicos)
    .gte("em", desde)) as { data: { item: string; opcoes: unknown; status: number }[] | null };
  for (const g of guardados ?? [])
    out[g.item] =
      g.status === 200 ? { opcoes: Array.isArray(g.opcoes) ? (g.opcoes as never) : [] } : null;
  const faltam = unicos.filter((i) => !(i in out));
  if (!faltam.length) return out;

  const { count } = (await db
    .from("prazo_entrega_cache")
    .select("item", { count: "exact", head: true })
    .gte("em", new Date(Date.now() - 5 * 60_000).toISOString())) as { count: number | null };
  if ((count ?? 0) > 400) return out;

  const novos: { item: string; cep: string; opcoes: unknown; status: number; em: string }[] = [];
  for (let i = 0; i < faltam.length; i += 6) {
    const lote = faltam.slice(i, i + 6);
    const res = await Promise.all(lote.map((it) => envioParaCep(it, cep8)));
    res.forEach((r, k) => {
      const it = lote[k] as string;
      const opcoes = r.status === 200 ? lerOpcoesDeEnvio(r.json) : [];
      out[it] = r.status === 200 ? { opcoes } : null;
      if (r.status !== 0)
        novos.push({ item: it, cep: cep8, opcoes, status: r.status, em: new Date().toISOString() });
    });
  }
  if (novos.length)
    await db
      .from("prazo_entrega_cache")
      .upsert(novos, { onConflict: "item,cep" })
      .then(
        () => null,
        () => null,
      );
  return out;
}
