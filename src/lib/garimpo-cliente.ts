/* GARIMPO NO PLAYER DE ORIGEM (11/10) no navegador: pede (pedir_garimpo),
   acompanha (ver_garimpo, só com a chave do pedido) e limpa o que a
   extensão gravou antes de ir para a tela. Mesma trava da comparação dos 3:
   só link de afiliado do próprio player (regra nº 1), nada usado nem falso,
   foto dos servidores da Amazon/Shopee, "mesmo produto" só conferido pela
   foto (o "encontrado pela busca" nunca vira mesmo produto). */
import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeCompra } from "@/lib/afiliado";
import type { LojaExterna } from "@/lib/coletor-multiloja";
import { pareceFalso } from "@/lib/falsificado";
import { limparResultado } from "@/lib/multiloja-resultado";

export type PlayerGarimpo = "amazon" | "shopee";

export type OfertaGarimpo = Omit<LojaExterna, "relacao"> & {
  relacao: "mesmo" | "parecido" | "busca";
};

export type ResultadoGarimpo = {
  player: PlayerGarimpo;
  original: {
    titulo: string | null;
    preco: number | null;
    imagem: string | null;
    /** Link de afiliado do produto de origem (só quando é do mesmo player). */
    link: string | null;
    selos: string[];
  };
  ofertas: OfertaGarimpo[];
  lidas: number;
  conferidas: number;
  /** "ok", "sem_foto" (sem foto da origem: nada conferido) ou "falhou". */
  conferencia: "ok" | "sem_foto" | "falhou" | null;
  em: string | null;
};

const RE_FOTO =
  /^https:\/\/(m\.media-amazon\.com|images-na\.ssl-images-amazon\.com|([a-z0-9-]+\.)*susercontent\.com|cf\.shopee\.com\.br)\//i;
const RE_CONDICAO_RUIM =
  /\b(usad[oa]s?|recondicionad[oa]s?|seminov[oa]s?|renovad[oa]s?|vitrine|open ?box|mostru[aá]rio)\b/i;

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1_000_000 ? v : null;
const texto = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const inteiro = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 999) : 0;

/** Trava final do resultado gravado pela extensão. */
export function limparGarimpo(r: unknown, player: PlayerGarimpo): ResultadoGarimpo | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const orig = (o["original"] ?? {}) as Record<string, unknown>;
  const tituloOriginal = texto(orig["titulo"], 300);
  const brutas = (Array.isArray(o["ofertas"]) ? o["ofertas"] : []) as Array<
    Record<string, unknown>
  >;
  const daPlataforma = brutas.filter((x) => x && x["marketplace"] === player);
  /* Mesmo produto e parecido: a mesma limpeza da comparação dos 3. */
  const conferidas = limparResultado(
    { lojas: daPlataforma.filter((x) => x["relacao"] === "mesmo" || x["relacao"] === "parecido") },
    tituloOriginal,
  ).lojas as OfertaGarimpo[];
  /* Encontrado pela busca (sem foto da origem para conferir). */
  const daBusca: OfertaGarimpo[] = daPlataforma
    .filter((x) => x["relacao"] === "busca")
    .map((x) => x as unknown as OfertaGarimpo)
    .filter(
      (x) =>
        num(x.preco) != null &&
        typeof x.titulo === "string" &&
        !RE_CONDICAO_RUIM.test(x.titulo) &&
        !pareceFalso(x.titulo) &&
        ehLinkDeCompra(x.link, player),
    )
    .map((x) => ({
      ...x,
      titulo: x.titulo.slice(0, 300),
      imagem: typeof x.imagem === "string" && RE_FOTO.test(x.imagem) ? x.imagem : null,
      notaFrete: texto(x.notaFrete, 80),
      selos: Array.isArray(x.selos) ? x.selos.filter((s) => s === "Prime") : [],
      muda: null,
      qualidade: null,
      qualidadeMotivo: null,
      desvantagens: null,
      mesmaFoto: false,
      relacao: "busca" as const,
    }))
    .slice(0, 4);
  const linkOriginal = ehLinkDeCompra(orig["link"], player) ? (orig["link"] as string) : null;
  const conf = o["conferencia"];
  return {
    player,
    original: {
      titulo: tituloOriginal,
      preco: num(orig["preco"]),
      imagem:
        typeof orig["imagem"] === "string" && RE_FOTO.test(orig["imagem"]) ? orig["imagem"] : null,
      link: linkOriginal,
      selos: Array.isArray(orig["selos"])
        ? ((orig["selos"] as unknown[]).filter((s) => s === "Prime") as string[])
        : [],
    },
    ofertas: [...conferidas, ...daBusca],
    lidas: inteiro(o["lidas"]),
    conferidas: inteiro(o["conferidas"]),
    conferencia: conf === "ok" || conf === "sem_foto" || conf === "falhou" ? conf : null,
    em: texto(o["em"], 40),
  };
}

/** Mais barato do mesmo produto (conferido pela foto). */
export function melhorDoMesmo(r: ResultadoGarimpo | null): OfertaGarimpo | null {
  return (
    (r?.ofertas ?? []).filter((o) => o.relacao === "mesmo").sort((a, b) => a.preco - b.preco)[0] ??
    null
  );
}

export type PedidoGarimpo = {
  player: PlayerGarimpo;
  origem: "amazon" | "shopee" | "outro";
  url: string;
  termo: string;
  idOrigem?: string | null;
  loja?: string | null;
  preco?: number | null;
  imagem?: string | null;
};

export async function pedirGarimpo(
  p: PedidoGarimpo,
): Promise<{ id: number; chave: string } | { erro: string }> {
  try {
    const { data, error } = await supabase.rpc(
      "pedir_garimpo" as never,
      {
        p_player: p.player,
        p_origem: p.origem,
        p_url: p.url,
        p_termo: p.termo.slice(0, 200),
        p_id_origem: p.idOrigem ?? null,
        p_loja: p.loja ?? null,
        p_preco: p.preco ?? null,
        p_imagem: p.imagem ?? null,
      } as never,
    );
    const r = data as { ok?: boolean; id?: number; chave?: string; motivo?: string } | null;
    if (error || !r?.ok || r.id == null || !r.chave) {
      return {
        erro:
          r?.motivo === "limite"
            ? "Muitas buscas agora. Tente de novo em alguns minutos."
            : r?.motivo === "desligado"
              ? "Esta loja está fora do ar no comparador agora."
              : "Não deu para pedir agora. Tente de novo.",
      };
    }
    try {
      window.postMessage(
        { de: "cupons-afiliado-ml", tipo: "pedido-novo", id: r.id },
        window.location.origin,
      );
    } catch {
      /* sem extensão: o alarme cobre */
    }
    return { id: r.id, chave: r.chave };
  } catch {
    return { erro: "Sem conexão agora. Tente de novo." };
  }
}

export type EstadoGarimpo = {
  status: "pendente" | "processando" | "pronto" | "falhou";
  parado: boolean;
  resultado: ResultadoGarimpo | null;
};

export async function verGarimpo(
  id: number,
  chave: string,
  player: PlayerGarimpo,
): Promise<EstadoGarimpo | null> {
  try {
    const { data } = await supabase.rpc(
      "ver_garimpo" as never,
      { p_id: id, p_chave: chave } as never,
    );
    const r = data as { status?: string; parado?: boolean; resultado?: unknown } | null;
    if (!r?.status) return null;
    const status = (["pendente", "processando", "pronto", "falhou"] as const).find(
      (s) => s === r.status,
    );
    if (!status) return null;
    return {
      status,
      parado: r.parado === true,
      resultado: status === "pronto" ? limparGarimpo(r.resultado, player) : null,
    };
  } catch {
    return null;
  }
}
