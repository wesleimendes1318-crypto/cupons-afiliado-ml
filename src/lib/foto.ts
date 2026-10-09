/* FOTOS NÍTIDAS (Weslei, 09/10: "melhore a qualidade das fotos!"). O
   mlstatic guarda cada foto em vários tamanhos: -O (até 500 px no maior
   lado, o que o site usava em tudo), D_NQ_NP_2X_…-V (até 640 px) e -F (a
   original, até 1200 px). Conferido em 09/10 em 13 fotos da vitrine: as
   três versões existem em todas.
   - "cartao": 640 px, e a original para telas de alta densidade (srcSet).
   - "grande": a original (galeria, destaque do topo, pedestais).
   Endereço fora do mlstatic não muda. Se a versão maior falhar, o <img>
   volta para o endereço gravado (voltarAoOriginal). */
import type { SyntheticEvent } from "react";

const RE_ML =
  /^https?:\/\/[a-z0-9.-]*mlstatic\.com\/D_(?:[A-Z0-9]+_)*?(\d{3,}-M[A-Z]{2,3}\d+_\d+)-[A-Z]{1,2}\b[^/]*\.(?:webp|jpe?g|png)$/i;

/** Código da foto no mlstatic ("601002-MLU70683691691_072023") ou null. */
export function idFotoMl(u: string | null | undefined): string | null {
  if (!u) return null;
  return RE_ML.exec(u.trim())?.[1] ?? null;
}

export type TamanhoFoto = "cartao" | "grande";

export function fotoNitida(u: string, tamanho?: TamanhoFoto): string;
export function fotoNitida(u: string | null | undefined, tamanho?: TamanhoFoto): string | null;
export function fotoNitida(
  u: string | null | undefined,
  tamanho: TamanhoFoto = "cartao",
): string | null {
  if (!u) return null;
  const id = idFotoMl(u);
  if (!id) return u;
  return tamanho === "grande"
    ? `https://http2.mlstatic.com/D_NQ_NP_${id}-F.webp`
    : `https://http2.mlstatic.com/D_NQ_NP_2X_${id}-V.webp`;
}

/** srcSet do cartão: 640 px e a original (1200 px) para telas densas. */
export function srcSetNitido(u: string | null | undefined): string | undefined {
  const id = idFotoMl(u);
  if (!id) return undefined;
  return `https://http2.mlstatic.com/D_NQ_NP_2X_${id}-V.webp 640w, https://http2.mlstatic.com/D_NQ_NP_${id}-F.webp 1200w`;
}

/** Versão JPEG da original (o Telegram não aceita webp por URL). */
export function fotoOriginalJpeg(u: string | null | undefined): string | null {
  const id = idFotoMl(u);
  return id ? `https://http2.mlstatic.com/D_NQ_NP_${id}-F.jpg` : null;
}

/** onError: uma vez só, volta para o endereço gravado (sem srcSet). */
export function voltarAoOriginal(original: string | null | undefined) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget;
    if (!original || im.dataset["reserva"] === "1") return;
    im.dataset["reserva"] = "1";
    im.removeAttribute("srcset");
    im.src = original;
  };
}

/** Atributos prontos para o <img> de um cartão de produto. */
export function propsFotoCartao(u: string, sizes = "(min-width: 640px) 220px, 50vw") {
  const srcSet = srcSetNitido(u);
  return {
    src: fotoNitida(u, "cartao"),
    ...(srcSet ? { srcSet, sizes } : {}),
    onError: voltarAoOriginal(u),
  };
}

/** Atributos prontos para uma foto grande (galeria, destaque). */
export function propsFotoGrande(u: string) {
  return { src: fotoNitida(u, "grande"), onError: voltarAoOriginal(u) };
}
