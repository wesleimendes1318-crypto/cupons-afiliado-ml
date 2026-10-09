/* AMAZON (Weslei, 09/10). A Product Advertising API 5 foi desligada em
   2026; a busca usa a Creators API (o mesmo programa de associados),
   conforme o SDK oficial: token OAuth2 (client_credentials) no endpoint da
   versão da credencial e POST https://creatorsapi.amazon/catalog/v1/
   searchItems com o cabeçalho x-marketplace. Secrets:
   AMAZON_CREATORS_CREDENTIAL_ID, AMAZON_CREATORS_CREDENTIAL_SECRET e
   AMAZON_CREATORS_VERSION (a versão mostrada junto da credencial no
   Associates Central; padrão 3.1, América do Norte, que atende o Brasil).
   Tag: melhoresc0fff-20. Sem Secrets, não faz nada. Nada de raspar páginas
   da Amazon (proibido pelo contrato de associados). */
import { ehLinkDeAfiliadoAmazon, gerarUrlAfiliadoAmazon, TAG_AMAZON } from "@/lib/afiliado";
import type { OfertaExterna } from "@/lib/integracoes/tipos";

const TOKEN_POR_VERSAO: Record<string, string> = {
  "2.1": "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token",
  "2.2": "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token",
  "2.3": "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token",
  "3.1": "https://api.amazon.com/auth/o2/token",
  "3.2": "https://api.amazon.co.uk/auth/o2/token",
  "3.3": "https://api.amazon.co.jp/auth/o2/token",
};
const BUSCA = "https://creatorsapi.amazon/catalog/v1/searchItems";
const MARKETPLACE = "www.amazon.com.br";
const RECURSOS = [
  "itemInfo.title",
  "images.primary.large",
  "offersV2.listings.price",
  "offersV2.listings.condition",
  "offersV2.listings.availability",
  "offersV2.listings.merchantInfo",
  "offersV2.listings.isBuyBoxWinner",
];

function credenciais() {
  const id = process.env["AMAZON_CREATORS_CREDENTIAL_ID"]?.trim();
  const segredo = process.env["AMAZON_CREATORS_CREDENTIAL_SECRET"]?.trim();
  const versao = process.env["AMAZON_CREATORS_VERSION"]?.trim() || "3.1";
  if (!id || !segredo || !TOKEN_POR_VERSAO[versao]) return null;
  return { id, segredo, versao, lwa: versao.startsWith("3.") };
}

export const amazonConfigurada = () => credenciais() != null;

let token: { valor: string; ate: number } | null = null;

async function pegarToken(c: NonNullable<ReturnType<typeof credenciais>>, prazo: number) {
  if (token && Date.now() < token.ate) return token.valor;
  const url = TOKEN_POR_VERSAO[c.versao]!;
  const escopo = c.lwa ? "creatorsapi::default" : "creatorsapi/default";
  const tentativas: Array<() => Promise<Response>> = c.lwa
    ? [
        /* SDK oficial (Python): corpo JSON. */
        () =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              grant_type: "client_credentials",
              client_id: c.id,
              client_secret: c.segredo,
              scope: escopo,
            }),
            signal: AbortSignal.timeout(prazo),
          }),
        /* Reserva (cliente Go): Basic + formulário. */
        () =>
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
              Authorization: `Basic ${btoa(`${c.id}:${c.segredo}`)}`,
            },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              scope: escopo,
            }).toString(),
            signal: AbortSignal.timeout(prazo),
          }),
      ]
    : [
        () =>
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: c.id,
              client_secret: c.segredo,
              scope: escopo,
            }).toString(),
            signal: AbortSignal.timeout(prazo),
          }),
      ];
  let erro = "sem resposta";
  for (const tentar of tentativas) {
    const r = await tentar();
    const j = (await r.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (r.ok && j?.access_token) {
      token = {
        valor: j.access_token,
        ate: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 60) * 1000,
      };
      return token.valor;
    }
    erro = `token ${r.status}`;
  }
  throw new Error(erro);
}

type Item = {
  asin?: string;
  detailPageURL?: string;
  itemInfo?: { title?: { displayValue?: string } };
  images?: { primary?: { large?: { url?: string }; medium?: { url?: string } } };
  offersV2?: {
    listings?: Array<{
      price?: { money?: { amount?: number } };
      condition?: { value?: string };
      availability?: { type?: string };
      merchantInfo?: { name?: string };
      isBuyBoxWinner?: boolean;
    }>;
  };
};

/** Busca na Amazon Brasil; Prime primeiro (entrega pela Amazon). */
export async function buscarNaAmazon(termo: string, prazo = 9_000): Promise<OfertaExterna[]> {
  const c = credenciais();
  if (!c) return [];
  const fim = Date.now() + prazo;
  const valor = await pegarToken(c, Math.min(4_000, prazo));
  const buscar = async (prime: boolean) => {
    const resta = fim - Date.now();
    if (resta < 1_000) return [] as OfertaExterna[];
    const r = await fetch(BUSCA, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "x-marketplace": MARKETPLACE,
        Authorization: c.lwa ? `Bearer ${valor}` : `Bearer ${valor}, Version ${c.versao}`,
      },
      body: JSON.stringify({
        keywords: termo.slice(0, 120),
        searchIndex: "All",
        itemCount: 10,
        partnerTag: TAG_AMAZON,
        condition: "New",
        ...(prime ? { deliveryFlags: ["Prime"] } : {}),
        resources: RECURSOS,
      }),
      signal: AbortSignal.timeout(resta),
    });
    if (r.status === 401) token = null;
    if (!r.ok) throw new Error(`busca ${r.status}`);
    const j = (await r.json().catch(() => null)) as { searchResult?: { items?: Item[] } } | null;
    return (j?.searchResult?.items ?? []).flatMap((it): OfertaExterna[] => {
      const asin = String(it.asin ?? "").toUpperCase();
      const titulo = it.itemInfo?.title?.displayValue?.trim();
      const oferta =
        it.offersV2?.listings?.find((l) => l.isBuyBoxWinner) ?? it.offersV2?.listings?.[0];
      const preco = Number(oferta?.price?.money?.amount);
      if (!/^[A-Z0-9]{10}$/.test(asin) || !titulo || !Number.isFinite(preco) || preco <= 0)
        return [];
      if (oferta?.condition?.value && !/^new$/i.test(oferta.condition.value)) return [];
      const link = ehLinkDeAfiliadoAmazon(it.detailPageURL)
        ? (it.detailPageURL as string)
        : gerarUrlAfiliadoAmazon(`https://www.amazon.com.br/dp/${asin}`);
      if (!link || !ehLinkDeAfiliadoAmazon(link)) return [];
      const foto = it.images?.primary?.large?.url ?? it.images?.primary?.medium?.url ?? null;
      return [
        {
          marketplace: "amazon",
          id: asin,
          titulo: titulo.slice(0, 200),
          preco: Math.round(preco * 100) / 100,
          link,
          imagem: foto && /^https:\/\//.test(foto) ? foto : null,
          loja: oferta?.merchantInfo?.name?.trim() || null,
          freteGratis: null,
          custoFrete: null,
          notaFrete: prime ? "Frete grátis para assinantes Prime" : null,
          selos: prime ? ["Prime"] : [],
        },
      ];
    });
  };
  const prime = await buscar(true);
  return prime.length ? prime : buscar(false);
}
