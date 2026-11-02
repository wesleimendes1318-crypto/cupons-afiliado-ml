import { avaliacoesValidas } from "@/lib/avaliacoes";
import { brl } from "@/lib/placar-garimpo";

/* VANTAGENS DA OFERTA (Weslei, 02/11: a recomendação precisa mostrar as
   vantagens). Só o que foi lido: economia contra o colado, frete grátis,
   envio do Brasil contra um importado, loja oficial / MercadoLíder e nota
   4,5 ou mais. Nada é estimado. */
export type OfertaComVantagens = {
  preco: number | null;
  freteGratis?: boolean | null | undefined;
  lojaOficial?: boolean | null | undefined;
  mercadoLider?: string | null | undefined;
  avaliacoes?: unknown;
  internacional?: boolean | null | undefined;
};

export function vantagensDaOferta(
  o: OfertaComVantagens,
  colado: { preco: number | null; internacional?: boolean | null | undefined },
  economia: number | null = null,
): string[] {
  const v: string[] = [];
  const menos =
    economia ?? (colado.preco != null && o.preco != null ? colado.preco - o.preco : null);
  if (menos != null && menos >= 0.5) v.push(`${brl(menos)} a menos que o anúncio que você colou`);
  if (o.freteGratis === true) v.push("Frete grátis");
  if (colado.internacional === true && o.internacional !== true)
    v.push("Enviado do Brasil, sem imposto de importação no pagamento");
  if (o.lojaOficial === true) v.push("Loja oficial");
  else if (o.mercadoLider) v.push("Vendedor MercadoLíder");
  const nota = avaliacoesValidas(o.avaliacoes);
  if (nota && nota.nota >= 4.5)
    v.push(
      `Nota ${nota.nota.toLocaleString("pt-BR")} de 5 de quem comprou (${nota.total.toLocaleString("pt-BR")} avaliações)`,
    );
  return v;
}
