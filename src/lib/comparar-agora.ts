/* COMPARAÇÃO PELO SERVIDOR (Weslei, 19/10: "Isso não pode ocorrer, deve
   sempre funcionar", print da tela "A conferência de links está pausada").
   A extensão roda no Chrome do notebook dele; com o notebook desligado, o
   cliente via só o aviso de pausa. Agora o próprio servidor do site compara:

   - produto de catálogo (/p/MLB... no link, ou o anúncio do link): a lista
     OFICIAL de ofertas da ficha (/products/{id}/items) é o MESMO produto por
     definição (a única lista que dispensa a conferência pela foto). Fora:
     condição diferente de novo (usado, recondicionado).
   - preço de cada loja e frete pela lista (shipping.cost 0 ou free_shipping
     = grátis; cost > 0 = pago, valor para o CEP não simulado aqui).
   - link de afiliado: só o meli.la já gerado antes para o MESMO anúncio
     (link_do_anuncio); sem ele, o botão da tela gera no clique (VerNaLoja)
     e, com a extensão parada, cai no link de reserva da página do produto.
   - sem ficha de catálogo (anúncio avulso ou link de perfil): devolve só o
     nome lido no endereço; a tela busca o produto no catálogo pelo nome.
   Nada de modelo de linguagem, nada da conta de afiliado: só a API oficial
   do Mercado Livre (só leitura) e o banco. */
import { analisarLink } from "@/lib/analisar-link";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { resolverEncurtado } from "@/lib/identificar-link";
import { mlGet } from "@/lib/ml-api";
import { apelidos, freteDaOferta, idsDoLink, ofertasDoCatalogo } from "@/lib/mesmo-produto";

type Ficha = {
  name?: string;
  pictures?: { url?: string; secure_url?: string }[];
  buy_box_winner?: { item_id?: string } | null;
};

type Oferta = {
  item: string;
  preco: number;
  sellerId: number;
  freteGratis: boolean | null;
  lojaOficial: boolean | null;
};

export type ResultadoAgora =
  | {
      ok: true;
      link: string | null;
      comparadoEm: string;
      analise: Record<string, unknown>;
    }
  | { ok: false; termo: string | null; perfil: boolean };

const MAX_LOJAS = 10;

const ehMl = (u: string) =>
  /^https?:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(\/|$)/i.test(u);

/* O endereço do anúncio de uma loja dentro da ficha: o botão da tela tira o
   item_id daqui e gera o link pelo endereço do ANÚNCIO, nunca da ficha. */
const urlDaOferta = (catalogo: string, item: string) =>
  `https://www.mercadolivre.com.br/p/${catalogo}?pdp_filters=item_id%3A${item}`;

function ofertaDaLista(o: Record<string, unknown>): Oferta | null {
  const item = String(o["item_id"] ?? o["id"] ?? "").toUpperCase();
  const preco = Number(o["price"]);
  const sellerId = Number(o["seller_id"] ?? (o["seller"] as { id?: number } | undefined)?.id);
  if (!/^MLB\d{6,}$/.test(item) || !Number.isFinite(preco) || preco <= 0) return null;
  if (!Number.isFinite(sellerId)) return null;
  /* Condição diferente nunca é o mesmo produto (usado, recondicionado). */
  const condicao = typeof o["condition"] === "string" ? o["condition"] : null;
  if (condicao && condicao !== "new") return null;
  return {
    item,
    preco,
    sellerId,
    freteGratis: freteDaOferta(o),
    lojaOficial: "official_store_id" in o ? o["official_store_id"] != null : null,
  };
}

async function linksConhecidos(itens: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pares = await Promise.all(
    itens.map(async (item) => {
      try {
        const { data } = await supabaseAdmin.rpc(
          "link_do_anuncio" as never,
          { p_item: item } as never,
        );
        const link: unknown = data;
        return [item, ehLinkDeAfiliado(link) ? link.trim() : null] as const;
      } catch {
        return [item, null] as const;
      }
    }),
  );
  return new Map(pares);
}

export async function compararAgora(entrada: string): Promise<ResultadoAgora> {
  let url = entrada.trim();
  if (!ehMl(url)) return { ok: false, termo: null, perfil: false };
  if (/^https?:\/\/(meli\.la|(www\.)?mercadolivre\.com\.br\/sec)\//i.test(url)) {
    const destino = await resolverEncurtado(url).catch(() => null);
    if (destino && ehMl(destino)) url = destino;
  }
  const perfil = /\/social\//i.test(url);
  const termo = analisarLink(url).termoIdentificado ?? null;
  const ids = idsDoLink(url);
  const catalogo = ids.catalogo;
  if (!catalogo) return { ok: false, termo, perfil };

  const [ficha, lista] = await Promise.all([
    mlGet<Ficha>(`/products/${catalogo}`).catch(() => null),
    ofertasDoCatalogo(catalogo).catch(() => [] as Record<string, unknown>[]),
  ]);
  const ofertas = lista.map(ofertaDaLista).filter((o): o is Oferta => o != null);
  if (!ficha?.name || !ofertas.length) return { ok: false, termo: ficha?.name ?? termo, perfil };

  /* A oferta que o cliente estava vendo: o anúncio do link; sem ele, a
     oferta em destaque da ficha (a que a página do produto abre) e, sem
     destaque (a página lista as lojas), a mais barata da lista. Anúncio do
     link fora da lista: o preço dele não é conhecido, então nada é afirmado. */
  const destaque = String(ficha.buy_box_winner?.item_id ?? "").toUpperCase();
  const maisBarata = [...ofertas].sort((a, b) => a.preco - b.preco)[0] ?? null;
  const colado = ids.item
    ? (ofertas.find((o) => o.item === ids.item) ?? null)
    : (ofertas.find((o) => o.item === destaque) ?? maisBarata);
  if (!colado) return { ok: false, termo: ficha.name, perfil };

  /* Uma linha por loja (a oferta mais barata dela); a loja do anúncio colado
     só entra com OUTRO anúncio mais barato. */
  const porLoja = new Map<number, Oferta>();
  for (const o of ofertas) {
    if (o.item === colado.item) continue;
    if (o.sellerId === colado.sellerId && colado.preco - o.preco < 0.5) continue;
    const atual = porLoja.get(o.sellerId);
    if (!atual || o.preco < atual.preco) porLoja.set(o.sellerId, o);
  }
  const outras = [...porLoja.values()].sort((a, b) => a.preco - b.preco).slice(0, MAX_LOJAS);

  const trilha: string[] = [];
  const [nomes, links] = await Promise.all([
    apelidos([colado.sellerId, ...outras.map((o) => o.sellerId)], trilha).catch(
      () => new Map<number, string | null>(),
    ),
    linksConhecidos([colado.item, ...outras.map((o) => o.item)]).catch(
      () => new Map<string, string | null>(),
    ),
  ]);
  const foto = ficha.pictures?.[0]?.secure_url ?? ficha.pictures?.[0]?.url ?? null;
  const imagem = foto ? foto.replace(/^http:/, "https:") : null;

  const referencias = outras.map((o) => ({
    vendedor: nomes.get(o.sellerId) ?? null,
    preco: o.preco,
    final: o.preco,
    diferenca: Math.round((o.preco - colado.preco) * 100) / 100,
    cupom: null,
    url: urlDaOferta(catalogo, o.item),
    imagem,
    link: links.get(o.item) ?? null,
    freteGratis: o.freteGratis,
    lojaOficial: o.lojaOficial,
    mesmaLoja: o.sellerId === colado.sellerId ? true : null,
  }));

  return {
    ok: true,
    link: links.get(colado.item) ?? null,
    comparadoEm: new Date().toISOString(),
    analise: {
      titulo: ficha.name,
      preco: colado.preco,
      vendedor: nomes.get(colado.sellerId) ?? null,
      temCupom: false,
      cupom: null,
      outraLoja: null,
      outrasLojas: [],
      procurouOutra: true,
      referencias,
      completa: true,
      final: true,
      freteGratis: colado.freteGratis,
      lojaOficial: colado.lojaOficial,
      imagem,
      /* Endereço do ANÚNCIO de referência: o botão do "anúncio colado" gera o
         link por ele, nunca pela ficha (o link da ficha abre outra oferta). */
      urlDaOferta: urlDaOferta(catalogo, colado.item),
      /* A tela diz de onde veio e esconde o que depende da extensão. */
      modoServidor: true,
    },
  };
}
