/* Trava final do que os outros marketplaces mostram na tela (09/10): vale
   para o resultado das APIs e para o gravado pela extensão. */
import { ehLinkDeCompra } from "@/lib/afiliado";
import type { LojaExterna } from "@/lib/coletor-multiloja";

export type RespostaMultiloja = {
  ativo: boolean;
  lojas: LojaExterna[];
  aguardar?: boolean;
  adiado?: boolean;
};

/* Foto só dos endereços das marketplaces (o resultado da extensão vem de
   páginas lidas: nada de endereço qualquer na tela). */
const RE_FOTO =
  /^https:\/\/(m\.media-amazon\.com|images-na\.ssl-images-amazon\.com|([a-z0-9-]+\.)*susercontent\.com|cf\.shopee\.com\.br)\//i;

/** Trava final de tudo que vai para a tela: só link de afiliado do próprio
    marketplace, preço válido e foto dos hosts conhecidos. */
export function limparResultado(r: unknown): RespostaMultiloja {
  const o = (r ?? {}) as Partial<RespostaMultiloja>;
  const lojas = (Array.isArray(o.lojas) ? o.lojas : [])
    .filter(
      (l) =>
        l &&
        (l.marketplace === "amazon" || l.marketplace === "shopee") &&
        typeof l.preco === "number" &&
        l.preco > 0 &&
        typeof l.titulo === "string" &&
        (l.relacao === "mesmo" || l.relacao === "parecido") &&
        ehLinkDeCompra(l.link, l.marketplace),
    )
    .map((l) => ({
      ...l,
      imagem: typeof l.imagem === "string" && RE_FOTO.test(l.imagem) ? l.imagem : null,
      titulo: l.titulo.slice(0, 300),
      selos: Array.isArray(l.selos) ? l.selos.filter((x) => x === "Prime") : [],
    }));
  return { ativo: o.ativo !== false, lojas };
}
