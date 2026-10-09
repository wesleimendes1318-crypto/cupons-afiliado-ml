/* VITRINE SÓ COM RECOMENDAÇÃO DE VERDADE (Weslei, 06/10: Apple Watch
   Series 4 de R$ 600, "todo arranhado e quebrado, frete não é grátis...
   péssima recomendação"). O anúncio veio de um agente, a comparação não
   achou nenhuma outra loja (lojas_comparadas 0) e o defeito só aparecia nas
   fotos. Na vitrine geral entra só:
   - o que foi comparado de verdade (outra loja do mesmo produto ou uma
     alternativa conferida);
   - sem sinal de usado/defeito no título;
   - com frete grátis confirmado (economia de outra loja com frete grátis,
     alternativa com frete grátis ou o próprio anúncio com frete grátis).
   Frete desconhecido não é grátis. */
import type { FreteDaVitrine } from "@/lib/frete-vitrine";
import { pareceFalso } from "@/lib/falsificado";

export const RE_CONDICAO_RUIM =
  /\b(usad[oa]s?|seminov[oa]s?|semi-nov[oa]s?|recondicionad[oa]s?|vitrine|mostru[aá]rio|open ?box|avariad[oa]s?|arranhad[oa]s?|riscad[oa]s?|quebrad[oa]s?|trincad[oa]s?|defeito|com detalhes?|marcas? de uso|para pe[cç]as|retirada de pe[cç]as|sem funcionar|n[aã]o liga|leia a descri[cç][aã]o|no estado|refurbished|used)\b/i;

type Item = {
  chave: string;
  titulo: string | null;
  economia: number | null;
  lojas_comparadas: number | null;
  alt_preco: number | null;
  alt_frete_gratis: boolean | null;
};

export function recomendavel(i: Item, fretes: Map<string, FreteDaVitrine>): boolean {
  if (RE_CONDICAO_RUIM.test(i.titulo ?? "")) return false;
  /* Produto falso nunca (Weslei, 09/10: "Não indique produtos falsos"). */
  if (pareceFalso(i.titulo)) return false;
  const temAlternativa = i.alt_preco != null && i.alt_frete_gratis === true;
  if ((i.lojas_comparadas ?? 0) < 1 && !temAlternativa) return false;
  const f = fretes.get(i.chave);
  const economiaComFrete = (i.economia ?? 0) > 0 && f?.melhor_frete_gratis === true;
  return economiaComFrete || temAlternativa || f?.frete_gratis === true;
}
