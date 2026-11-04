/* VALE A PENA COMPRAR AGORA? (Weslei, 04/11). Veredito curto a partir do
   histórico conferido do anúncio. Regra fixa e conferível, sem modelo: só
   afirma o que a série mostra (nada de "cai em tal dia da semana"). */

export type PontoPreco = { p: number; em: string };
export type Veredito = { tipo: "menor" | "media" | "alto" | "inflado"; texto: string };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DIA = 86400000;

function mediana(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** null quando a série é curta demais (menos de 4 leituras ou 3 dias). */
export function vereditoDoPreco(pontos: PontoPreco[], agora: number | null): Veredito | null {
  if (agora == null || agora <= 0) return null;
  const lista = pontos
    .filter((x) => x.p > 0 && !Number.isNaN(new Date(x.em).getTime()))
    .sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
  if (lista.length < 4) return null;
  const t0 = new Date(lista[0]!.em).getTime();
  const t1 = new Date(lista[lista.length - 1]!.em).getTime();
  const dias = Math.round((t1 - t0) / DIA);
  if (dias < 3) return null;
  const precos = lista.map((x) => x.p);
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  const media = precos.reduce((a, b) => a + b, 0) / precos.length;

  /* Alta antes do "desconto": pico 10%+ acima do preço de antes e o preço
     de agora voltou ao patamar anterior. */
  const iPico = precos.indexOf(max);
  if (iPico >= 2 && agora < max) {
    const antes = mediana(precos.slice(0, iPico));
    if (max >= antes * 1.1 && agora >= antes * 0.98)
      return {
        tipo: "inflado",
        texto: `Atenção ao "desconto": o preço subiu para ${brl(max)} e voltou para perto de ${brl(antes)}, que era o preço de antes da alta. Não é uma queda real.`,
      };
  }
  if (max - min < 0.5)
    return { tipo: "media", texto: `Preço estável nos últimos ${dias} dias: ${brl(min)}.` };
  if (agora <= min * 1.005)
    return {
      tipo: "menor",
      texto: `🔥 Menor preço dos últimos ${dias} dias! Bom momento para comprar.`,
    };
  if (agora > media * 1.03) {
    const pct = Math.round((agora / media - 1) * 100);
    return {
      tipo: "alto",
      texto: `Preço ${pct}% acima da média recente (${brl(media)}). Vale definir seu preço-alvo e aguardar.`,
    };
  }
  return {
    tipo: "media",
    texto: `Preço dentro da média dos últimos ${dias} dias. O menor visto foi ${brl(min)}.`,
  };
}

/** Atalhos de um toque para o preço-alvo, em reais inteiros abaixo do preço de agora. */
export function atalhosDoAlvo(preco: number | null): { rotulo: string; valor: number }[] {
  if (preco == null || preco < 2) return [];
  return [5, 10, 15].map((p) => ({ rotulo: `-${p}%`, valor: Math.floor(preco * (1 - p / 100)) }));
}

/** "1.234,56" / "1234.5" / "R$ 99" -> número; null se vazio ou inválido. */
export function lerReais(texto: string): number | null {
  const t = texto.replace(/[^\d.,]/g, "");
  if (!t) return null;
  const n = Number(
    /,\d{1,2}$/.test(t)
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."),
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}
