/* BLACK FRIDAY CAMPAIGN PAGE (Weslei, 26/11): category selector and order by
   verified real discount, free shipping confirmed only. The pool is the
   curated campaign plus the showcase offers already validated by useOfertas
   (real discount or lowest price vs 2+ stores, rating, free shipping). */
import type { Oferta } from "@/lib/ofertas-vitrine";

export const CATEGORIAS_BLACK_FRIDAY = [
  {
    id: "games",
    nome: "Games",
    re: /\b(ps5|ps4|playstation|xbox|nintendo|switch 2|console|dualsense|gift ?card|gta)\b/i,
  },
  {
    id: "celulares",
    nome: "Celulares",
    re: /\b(celular|smartphone|iphone|galaxy [asmz]\d|redmi|poco [xfm]\d|moto g\d*|motorola edge)\b/i,
  },
  { id: "tvs", nome: "Smart TVs", re: /\b(smart ?tv|tv \d{2}|televis[aã]o)\b/i },
  {
    id: "eletrodomesticos",
    nome: "Eletrodomésticos",
    re: /\b(air ?fryer|fritadeira|geladeira|refrigerador|lava (e seca|roupas|lou[cç]as)|lavadora|micro-?ondas|aspirador|ar[- ]condicionado|cafeteira|liquidificador|forno el[eé]trico|fog[aã]o|batedeira)\b/i,
  },
  {
    id: "informatica",
    nome: "Informática",
    re: /\b(notebook|monitor|ssd|mem[oó]ria ram|teclado|mouse|tablet|ipad|impressora|roteador|placa de v[ií]deo|processador)\b/i,
  },
] as const;

export type CategoriaBlackFriday = (typeof CATEGORIAS_BLACK_FRIDAY)[number]["id"];

/* Accessories are not the device (capa de celular is not Celulares). */
const RE_ACESSORIO = /\b(capa|capinha|pel[ií]cula|suporte|case|cabo|carregador|controle remoto)\b/i;

export function categoriaBlackFriday(titulo: string): CategoriaBlackFriday | null {
  if (RE_ACESSORIO.test(titulo)) return null;
  return CATEGORIAS_BLACK_FRIDAY.find((c) => c.re.test(titulo))?.id ?? null;
}

/** Verified discount share (0 when there is no measured second price). */
export const percentualDoDesconto = (o: Oferta) =>
  o.antes > o.preco && o.antes > 0 ? (o.antes - o.preco) / o.antes : 0;

/** Pool for the page: free shipping confirmed, no repeats, biggest real
    discount first (ties: bigger saving in R$). */
export function ofertasBlackFriday(listas: Oferta[][]): Oferta[] {
  const vistas = new Set<string>();
  const saida: Oferta[] = [];
  for (const o of listas.flat()) {
    if (o.freteGratis !== true || !o.link || vistas.has(o.chave)) continue;
    vistas.add(o.chave);
    saida.push(o);
  }
  return saida.sort(
    (a, b) => percentualDoDesconto(b) - percentualDoDesconto(a) || b.economia - a.economia,
  );
}
