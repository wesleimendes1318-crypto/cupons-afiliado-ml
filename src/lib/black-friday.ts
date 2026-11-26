/* BLACK FRIDAY CAMPAIGN PAGE (Weslei, 26/11): category selector and order by
   verified real discount, free shipping confirmed only. The pool is the
   curated campaign plus the showcase offers already validated by useOfertas
   (real discount or lowest price vs 2+ stores, rating, free shipping). */
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { RE_PECA_PARTE } from "@/lib/conferir-produto";
import { pareceFalso } from "@/lib/falsificado";
import type { Oferta } from "@/lib/ofertas-vitrine";
import { RE_CONDICAO_RUIM } from "@/lib/vitrine-recomendavel";

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
const RE_ACESSORIO =
  /\b(capa|capinha|pel[ií]cula|suporte|case|cabo|carregador|controle remoto|mochila|bolsa|pulseira|assadeira|forma|kit)\b/i;

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
    /* No link yet: the card's VerNaLoja generates his link on click. */
    if (o.freteGratis !== true || !(o.link || o.urlProduto)) continue;
    const nome = o.titulo.toLowerCase().replace(/\s+/g, " ").trim();
    if (vistas.has(o.chave) || vistas.has(nome)) continue;
    vistas.add(o.chave);
    vistas.add(nome);
    saida.push(o);
  }
  return saida.sort(
    (a, b) => percentualDoDesconto(b) - percentualDoDesconto(a) || b.economia - a.economia,
  );
}

/** Row of ofertas_black_friday (migration 20261126200000). */
export type LinhaBlackFriday = {
  chave: string;
  titulo: string | null;
  imagem: string | null;
  tipo: "mesmo" | "menor";
  preco: number | string | null;
  antes: number | string | null;
  economia: number | string | null;
  loja: string | null;
  link: string | null;
  url_produto: string | null;
  visto_em: string;
  loja_oficial: boolean | null;
  fonte: "comparado" | "catalogo";
};

/** Row as a card offer, or null when it is not a device of the season, is
    used/defective/fake/a part, or has no price or no buy path. */
export function ofertaExtraBlackFriday(l: LinhaBlackFriday, agora = Date.now()): Oferta | null {
  const titulo = (l.titulo ?? "").trim();
  const preco = Number(l.preco);
  const antes = Number(l.antes);
  const economia = Number(l.economia ?? 0);
  if (!titulo || !(preco > 0) || !Number.isFinite(antes) || !Number.isFinite(economia)) return null;
  if (!categoriaBlackFriday(titulo)) return null;
  if (RE_CONDICAO_RUIM.test(titulo) || RE_PECA_PARTE.test(titulo) || pareceFalso(titulo)) return null;
  const link = ehLinkDeAfiliado(l.link) ? l.link : null;
  const url = l.url_produto && /^https:\/\/(www\.)?mercadoli[vb]re\.com/i.test(l.url_produto) ? l.url_produto : null;
  if (!link && !url) return null;
  /* "mesmo" only with a measured cheaper store; otherwise just the price. */
  const mesmo = l.tipo === "mesmo" && economia > 0 && antes > preco;
  return {
    chave: l.chave,
    titulo,
    imagem: l.imagem,
    preco,
    antes: mesmo ? antes : preco,
    economia: mesmo ? economia : 0,
    loja: l.loja,
    link,
    tipo: mesmo ? "mesmo" : "menor",
    urlProduto: url,
    recente: agora - Date.parse(l.visto_em) < 24 * 3600_000,
    vistoEm: l.visto_em,
    freteGratis: true,
    ...(l.fonte === "catalogo" ? { lojaOficial: l.loja_oficial === true } : {}),
  };
}
