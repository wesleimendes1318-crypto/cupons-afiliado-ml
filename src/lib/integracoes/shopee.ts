/* SHOPEE (Weslei, 09/10). API de afiliados da Shopee Brasil (GraphQL em
   https://open-api.affiliate.shopee.com.br/graphql), assinatura SHA-256 de
   AppId + Timestamp + corpo + Secret no cabeçalho Authorization. Secrets:
   SHOPEE_AFFILIATE_APP_ID e SHOPEE_AFFILIATE_SECRET (painel de afiliados,
   Open API). Pede só nome, preço, foto, loja e links: comissão nunca é
   pedida nem mostrada. O link de compra é o offerLink (afiliado); fora do
   formato curto, gera um com generateShortLink. Frete: a API não informa
   (fica "confira no anúncio"). Sem Secrets, não faz nada. */
import { ehLinkDeAfiliadoShopee } from "@/lib/afiliado";
import type { OfertaExterna } from "@/lib/integracoes/tipos";

const API = "https://open-api.affiliate.shopee.com.br/graphql";

function credenciais() {
  const appId = process.env["SHOPEE_AFFILIATE_APP_ID"]?.trim();
  const segredo = process.env["SHOPEE_AFFILIATE_SECRET"]?.trim();
  return appId && segredo ? { appId, segredo } : null;
}

export const shopeeConfigurada = () => credenciais() != null;

async function sha256Hex(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function graphql<T>(
  c: NonNullable<ReturnType<typeof credenciais>>,
  query: string,
  variables: Record<string, unknown>,
  prazo: number,
): Promise<T | null> {
  const corpo = JSON.stringify({ query, variables });
  const ts = Math.floor(Date.now() / 1000);
  const assinatura = await sha256Hex(`${c.appId}${ts}${corpo}${c.segredo}`);
  const r = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${c.appId}, Timestamp=${ts}, Signature=${assinatura}`,
    },
    body: corpo,
    signal: AbortSignal.timeout(prazo),
  });
  const j = (await r.json().catch(() => null)) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  } | null;
  if (!r.ok || j?.errors?.length)
    throw new Error(`shopee ${r.status}: ${(j?.errors?.[0]?.message ?? "").slice(0, 80)}`);
  return j?.data ?? null;
}

type No = {
  itemId?: number | string;
  productName?: string;
  priceMin?: string | number;
  imageUrl?: string;
  offerLink?: string;
  productLink?: string;
  shopName?: string;
};

const BUSCA = `query Busca($kw: String) {
  productOfferV2(keyword: $kw, sortType: 1, page: 1, limit: 10) {
    nodes { itemId productName priceMin imageUrl offerLink productLink shopName }
  }
}`;

const LINK_CURTO = `mutation Curto($originUrl: String!) {
  generateShortLink(input: { originUrl: $originUrl }) { shortLink }
}`;

export async function buscarNaShopee(termo: string, prazo = 9_000): Promise<OfertaExterna[]> {
  const c = credenciais();
  if (!c) return [];
  const fim = Date.now() + prazo;
  const d = await graphql<{ productOfferV2?: { nodes?: No[] } }>(
    c,
    BUSCA,
    { kw: termo.slice(0, 120) },
    prazo,
  );
  const saida: OfertaExterna[] = [];
  for (const n of d?.productOfferV2?.nodes ?? []) {
    const id = String(n.itemId ?? "");
    const titulo = n.productName?.trim();
    const preco = Number(n.priceMin);
    if (!/^\d+$/.test(id) || !titulo || !Number.isFinite(preco) || preco <= 0) continue;
    let link = ehLinkDeAfiliadoShopee(n.offerLink) ? (n.offerLink as string) : null;
    if (!link && n.productLink && /^https:\/\/shopee\.com\.br\//.test(n.productLink)) {
      const resta = fim - Date.now();
      if (resta > 1_500) {
        try {
          const g = await graphql<{ generateShortLink?: { shortLink?: string } }>(
            c,
            LINK_CURTO,
            { originUrl: n.productLink },
            resta,
          );
          const curto = g?.generateShortLink?.shortLink;
          if (ehLinkDeAfiliadoShopee(curto)) link = curto as string;
        } catch {
          /* sem link de afiliado: fica de fora */
        }
      }
    }
    if (!link) continue;
    saida.push({
      marketplace: "shopee",
      id,
      titulo: titulo.slice(0, 200),
      preco: Math.round(preco * 100) / 100,
      link,
      imagem: n.imageUrl && /^https:\/\//.test(n.imageUrl) ? n.imageUrl : null,
      loja: n.shopName?.trim() || null,
      freteGratis: null,
      custoFrete: null,
      notaFrete: null,
      selos: [],
    });
  }
  return saida;
}
