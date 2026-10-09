/* CURADORIA DAS CAMPANHAS (Weslei, 09/10, gestão autônoma de campanhas e
   vitrines). Ordem de decisão do Weslei: regras legais e termos >
   vendedor confiável e qualidade > verdade e frescor > relevância >
   comissão > custo. Comissão nunca entra na conta.

   Um produto só entra numa campanha com:
   - link de afiliado (meli.la);
   - sem sinal de usado/defeito no título nem condição usada no anúncio;
   - não é peça no lugar do aparelho (RE_PECA_PARTE, igual à extensão);
   - desconto real (regra-economia) ou menor preço contra 2+ lojas;
   - frete grátis confirmado (aplicado antes, como na vitrine);
   - comparação de no máximo 7 dias (nada de oferta zumbi);
   - nota do produto >= 4,5 quando conhecida (recomendados do hub);
   - vendedor CONFIÁVEL na oferta mostrada: loja oficial ou MercadoLíder
     (selos lidos na comparação). Sem o selo confirmado, fica de fora.
   Ordem: loja oficial e MercadoLíder Platinum primeiro, depois o mais
   recente (até 48 h) e a maior economia. */
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { RE_PECA_PARTE } from "@/lib/conferir-produto";
import type { Oferta } from "@/lib/ofertas-vitrine";
import { descontoReal } from "@/lib/regra-economia";
import { RE_CONDICAO_RUIM } from "@/lib/vitrine-recomendavel";

export type Confiabilidade = {
  chave: string;
  conferido_em: string | null;
  categoria: string | null;
  melhor_oficial: boolean | null;
  melhor_lider: string | null;
  alt_oficial: boolean | null;
  alt_lider: string | null;
  colado_oficial: boolean | null;
  colado_condicao: string | null;
  colado_lider?: string | null;
};

export type Vendedor = { oficial: boolean; lider: string | null };

export const NOTA_MINIMA = 4.5;
export const MAX_DIAS_CONFERIDO = 7;
const LIDERES = ["platinum", "gold", "silver"];
const RE_CONDICAO_USADA = /usad|used|recondic|refurb|seminov/i;

/** Selos do vendedor da oferta que o cartão mostra. */
export function vendedorDaOferta(o: Oferta, c: Confiabilidade | undefined): Vendedor {
  if (o.tipo === "mesmo")
    return { oficial: c?.melhor_oficial === true, lider: c?.melhor_lider ?? null };
  if (o.tipo === "parecido")
    return { oficial: c?.alt_oficial === true, lider: c?.alt_lider ?? null };
  return { oficial: c?.colado_oficial === true, lider: c?.colado_lider ?? null };
}

export const vendedorConfiavel = (v: Vendedor) =>
  v.oficial || LIDERES.includes((v.lider ?? "").toLowerCase());

export type Veto = "link" | "condicao" | "peca" | "desconto" | "velho" | "nota" | "vendedor";

/** Motivo para ficar de fora da campanha (null = aprovado). */
export function vetoDaCuradoria(
  o: Oferta,
  c: Confiabilidade | undefined,
  nota: number | null,
  agora = Date.now(),
): Veto | null {
  if (!ehLinkDeAfiliado(o.link)) return "link";
  if (RE_CONDICAO_RUIM.test(o.titulo) || RE_CONDICAO_USADA.test(c?.colado_condicao ?? ""))
    return "condicao";
  if (RE_PECA_PARTE.test(o.titulo)) return "peca";
  if (o.tipo !== "menor" && !descontoReal(o.economia, o.antes)) return "desconto";
  const quando = Date.parse(c?.conferido_em ?? o.vistoEm ?? "");
  if (!Number.isFinite(quando) || agora - quando > MAX_DIAS_CONFERIDO * 86_400_000) return "velho";
  if (nota != null && nota < NOTA_MINIMA) return "nota";
  if (!vendedorConfiavel(vendedorDaOferta(o, c))) return "vendedor";
  return null;
}

const PESO_LIDER: Record<string, number> = { platinum: 2, gold: 1.5, silver: 1 };
const pesoDoVendedor = (v: Vendedor) =>
  (v.oficial ? 3 : 0) + (PESO_LIDER[(v.lider ?? "").toLowerCase()] ?? 0);

/** Ordem da vitrine da campanha (vendedor > frescor > economia). */
export function ordenarDaCuradoria(
  lista: Array<{ o: Oferta; v: Vendedor; conferido: number }>,
  agora = Date.now(),
) {
  const recente = (t: number) => (agora - t <= 48 * 3600_000 ? 1 : 0);
  return [...lista].sort(
    (a, b) =>
      pesoDoVendedor(b.v) - pesoDoVendedor(a.v) ||
      recente(b.conferido) - recente(a.conferido) ||
      b.o.economia - a.o.economia,
  );
}

/* Datas das campanhas do calendário (Brasília). Antecipadas (Natal, Dia
   das Crianças) entram 45 dias antes, como a vitrine sazonal; a Black
   Friday só no dia do início. Termina no fim do último dia. */
export const DIAS_ANTECIPACAO = 45;

export function janelaDaTemporada(t: { inicio: string; fim: string; ofertasAntecipadas: boolean }) {
  const inicio = new Date(`${t.inicio}T00:00:00-03:00`);
  if (t.ofertasAntecipadas) inicio.setTime(inicio.getTime() - DIAS_ANTECIPACAO * 86_400_000);
  const fim = new Date(`${t.fim}T00:00:00-03:00`);
  fim.setTime(fim.getTime() + 86_400_000);
  return { inicia_em: inicio.toISOString(), termina_em: fim.toISOString() };
}
