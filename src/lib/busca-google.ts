/* Anúncios do MESMO produto em outras lojas do Mercado Livre, achados pelo
   GOOGLE (SerpApi), sem nenhuma busca no site do Mercado Livre.

   Por quê (25/09): a busca do site passou a responder "tráfego suspeito"
   para leitura anônima, e anúncio fora do catálogo não aparece na API
   oficial. O Google já indexou esses anúncios: a SerpApi devolve os
   endereços, e a extensão lê só esses poucos anúncios (preço, loja, foto)
   para a Gemini conferir pela foto.

   Plano gratuito da SerpApi tem cota mensal pequena, então:
     - só é chamada quando o catálogo oficial não resolveu;
     - resultado guardado 6 horas por busca (memória do servidor);
     - chave SERPAPI_KEY nos Secrets do Lovable; sem ela, não faz nada. */

export type AnuncioGoogle = {
  url: string;
  item: string;
  titulo: string;
  preco: number | null;
  imagem: string | null;
};

const cache = new Map<string, { em: number; lista: AnuncioGoogle[] }>();
const VALIDADE_MS = 6 * 60 * 60 * 1000;

function itemDoLink(u: string): string | null {
  const w = /[?&#]wid=(MLB\d{6,})/i.exec(u) ?? /item_id(?:%3A|:)(MLB\d{6,})/i.exec(u);
  if (w?.[1]) return w[1].toUpperCase();
  const m = /MLB-?(\d{6,})/i.exec(u);
  return m ? `MLB${m[1]}` : null;
}

function precoDe(r: Record<string, unknown>): number | null {
  const rich = r["rich_snippet"] as
    { top?: { detected_extensions?: Record<string, unknown> } } | undefined;
  const ext = rich?.top?.detected_extensions ?? {};
  const n = Number(ext["price"] ?? ext["extracted_price"]);
  if (Number.isFinite(n) && n > 0) return n;
  const texto = `${String(r["snippet"] ?? "")} ${JSON.stringify(rich ?? "")}`;
  const m = /R\$\s*([\d.]+),(\d{2})/.exec(texto);
  return m ? Number(m[1]!.replace(/\./g, "")) + Number(m[2]) / 100 : null;
}

export async function anunciosPeloGoogle(
  consulta: string,
  trilha: string[],
): Promise<AnuncioGoogle[]> {
  const chave = process.env["SERPAPI_KEY"];
  if (!chave) {
    trilha.push("google sem SERPAPI_KEY");
    return [];
  }
  const q = consulta.replace(/\s+/g, " ").trim().slice(0, 120);
  if (q.length < 6) return [];
  const c = cache.get(q);
  if (c && Date.now() - c.em < VALIDADE_MS) {
    trilha.push(`google cache ${c.lista.length}`);
    return c.lista;
  }
  const params = new URLSearchParams({
    engine: "google",
    q: `${q} site:mercadolivre.com.br`,
    gl: "br",
    hl: "pt-br",
    google_domain: "google.com.br",
    num: "10",
    api_key: chave,
  });
  try {
    const r = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(12_000),
    });
    const j = (await r.json().catch(() => null)) as {
      organic_results?: Record<string, unknown>[];
      error?: string;
    } | null;
    if (!r.ok || !j) {
      trilha.push(`google ${r.status} ${String(j?.error ?? "").slice(0, 80)}`);
      return [];
    }
    const vistos = new Set<string>();
    const lista: AnuncioGoogle[] = [];
    for (const o of j.organic_results ?? []) {
      const url = String(o["link"] ?? "");
      if (!/^https:\/\/([a-z0-9-]+\.)*mercadolivre\.com\.br\//i.test(url)) continue;
      /* Só anúncio de produto (não lista, loja ou perfil). */
      if (/lista\.mercadolivre|\/pagina\/|\/perfil\/|\/social\/|_CustId_/i.test(url)) continue;
      const item = itemDoLink(url);
      const catalogo = /\/p\/(MLB\d{5,})/i.exec(url)?.[1];
      const chaveItem = item ?? catalogo ?? url;
      if (vistos.has(chaveItem)) continue;
      vistos.add(chaveItem);
      lista.push({
        url,
        item: item ?? "",
        titulo: String(o["title"] ?? "")
          .replace(/\s*\|\s*Mercado Livre.*$/i, "")
          .slice(0, 200),
        preco: precoDe(o),
        imagem: typeof o["thumbnail"] === "string" ? (o["thumbnail"] as string) : null,
      });
      if (lista.length >= 8) break;
    }
    trilha.push(`google 200 anuncios=${lista.length}`);
    if (cache.size > 300) cache.clear();
    cache.set(q, { em: Date.now(), lista });
    return lista;
  } catch (e) {
    trilha.push(`google erro ${String((e as Error)?.message ?? e).slice(0, 80)}`);
    return [];
  }
}
