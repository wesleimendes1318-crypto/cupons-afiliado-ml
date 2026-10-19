/* RECOMENDAÇÃO SEGURA (Weslei, 18/10: "Pode recomendar, desde que seja
   afiliado. Nestes casos considere a avaliação também. De forma geral
   preciso oferecer segurança para quem compra"). Caso: ar-condicionado LG
   (pedido 1000048) a R$ 1.199 numa loja sem selo, contra R$ 2.250 a
   R$ 4.800 nas outras, saía como "Minha recomendação".
   Régua única da tela (BuscaPorLink), do bot e do "Me ajude a escolher"
   (decisaoDaTela) para uma oferta de OUTRA loja virar a recomendação:
   - nota baixa conhecida (abaixo de 4,5) nunca vira recomendação;
   - preço muito abaixo das outras lojas (abaixo de 70% da mediana, com 3 ou
     mais preços: a mesma conta do aviso da tabela) só com o link de
     afiliado já gerado (o programa aceitou o vendedor: reputação amarela ou
     melhor) E boa avaliação (nota 4,5 ou mais com pelo menos 5 avaliações;
     sem nota lida, só loja oficial), a mesma régua do canal.
   Quem não passa continua na tabela, com o aviso de sempre; o anúncio
   colado segue sendo a "Melhor opção" quando nenhuma outra passa. */
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { avaliacoesValidas } from "@/lib/avaliacoes";
import { precoMuitoAbaixo } from "@/lib/preco-suspeito";
import { NOTA_MINIMA, aprovadaParaCanal } from "@/lib/qualidade-avaliacao";

export type OfertaParaRecomendar = {
  preco: number | null | undefined;
  link?: string | null | undefined;
  avaliacoes?: unknown;
  lojaOficial?: boolean | null | undefined;
};

export function seguraParaRecomendar(o: OfertaParaRecomendar, precos: number[]): boolean {
  const a = avaliacoesValidas(o.avaliacoes);
  if (a && a.nota < NOTA_MINIMA) return false;
  if (!precoMuitoAbaixo(o.preco, precos)) return true;
  return ehLinkDeAfiliado(o.link) && aprovadaParaCanal(a, o.lojaOficial === true);
}
