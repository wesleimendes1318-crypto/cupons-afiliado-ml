/* Filtro final da intenção (27/10, "tomada para banheiro" não traz HDMI,
   antena nem tomada de móvel). Puro, sem rede: vale no servidor (antes de
   ler a oferta) e no navegador (produtos já conhecidos do site e respostas
   guardadas antes do filtro). */
import { normalizar } from "@/lib/busca-sugestoes";
import { diferencaDeModelo } from "@/lib/modelo-titulo";
import { tipoDoProduto } from "@/lib/termo-busca";

export type IntencaoDoFiltro = {
  tipoProduto?: string | null;
  termosNegativos?: string[];
  contextoUso?: string | null;
  /** Marca e modelo que a pessoa citou: o título tem de trazer os dois. */
  marca?: string | null;
  modelo?: string | null;
};

const junto = (s: string) => normalizar(s).replace(/ /g, "");

/** Outra marca, outro modelo ou outra versão (Pro, Max, geração) do que foi
    pedido (Weslei, 28/10: "muito assertiva, no modelo, versões tudo"; "Nike
    TC 7900" trazia Vans Old Skool). Sem marca nem modelo, não filtra. */
export function foraDoModelo(nome: string, marca?: string | null, modelo?: string | null) {
  const t = junto(nome);
  const pedidos = [marca, modelo].filter((v): v is string => !!v && junto(v).length >= 2);
  if (pedidos.some((v) => !t.includes(junto(v)))) return true;
  return !!modelo && diferencaDeModelo([marca, modelo].filter(Boolean).join(" "), nome) != null;
}

/* Negativos que valem sem o modelo. Por tipo: conector de outro sinal e
   tomada de outro uso (móvel, painel, industrial) no lugar da tomada de
   parede. Universais: miniatura, chaveiro e brinquedo no lugar do item de
   verdade (pneu, ração, peça de carro), salvo busca de presente ou infantil. */
const NEGATIVOS_ELETRICA = [
  "hdmi",
  "antena",
  "coaxial",
  "rj45",
  "rj11",
  "keystone",
  "cat5",
  "cat5e",
  "cat6",
  "vga",
  "telefone",
  "moveis",
  "movel",
  "painel",
  "industrial",
];
const NEGATIVOS_POR_TIPO: Record<string, string[]> = {
  tomada: NEGATIVOS_ELETRICA,
  tomadas: NEGATIVOS_ELETRICA,
  interruptor: NEGATIVOS_ELETRICA,
};
const NEGATIVOS_UNIVERSAIS = ["miniatura", "chaveiro", "maquete", "de brinquedo"];
const BUSCA_INFANTIL =
  /\b(brinquedos?|criancas?|infantil|menin[oa]s?|bebes?|presentes?|pelucias?|kids|colecao|colecionavel)\b/;

/** O título mostra outro produto? (termo negativo do modelo, do tipo ou
    universal, com plural simples; o que a pessoa digitou nunca exclui).
    Sem tipo informado, vale o tipo da própria consulta. */
export function foraDaIntencao(
  nome: string,
  intencao: IntencaoDoFiltro,
  consulta: string,
): boolean {
  if (foraDoModelo(nome, intencao.marca, intencao.modelo)) return true;
  const pedido = normalizar(`${consulta} ${intencao.contextoUso ?? ""}`.replace(/_/g, " "));
  const tipo = intencao.tipoProduto ?? tipoDoProduto(consulta) ?? "";
  const t = ` ${normalizar(nome)} `;
  const termos = [
    ...(intencao.termosNegativos ?? []),
    ...(NEGATIVOS_POR_TIPO[tipo] ?? []),
    ...(BUSCA_INFANTIL.test(pedido) ? [] : NEGATIVOS_UNIVERSAIS),
  ];
  return termos.some((n) => {
    if (` ${pedido} `.includes(` ${n} `)) return false;
    return [n, `${n}s`, `${n}es`].some((f) => t.includes(` ${f} `));
  });
}

/** Sem nada para mostrar (Weslei, 02/11: mensagem do comprador, sem jargão). */
export const MENSAGEM_SEM_OPCOES =
  "Não encontramos anúncios ativos para este termo exato no momento. Experimente buscar com outras palavras ou cole o link direto de uma oferta.";

/* ACESSÓRIO x APARELHO (Weslei, 02/11: "Capinha masculina iPhone 17 pro max"
   virou "O Apple iPhone 17 Pro Max não está no catálogo"). Com palavra de
   acessório, o produto é o acessório; o aparelho citado só filtra a
   compatibilidade. */
const ACESSORIOS: [RegExp, string][] = [
  [/\bcapinhas?\b/, "capinha"],
  [/\bpeliculas?\b/, "pelicula"],
  [/\bcapas?\b/, "capa"],
  [/\bcases?\b/, "case"],
  [/\bcarregador(es)?\b/, "carregador"],
  [/\bcabos?\b/, "cabo"],
  [/\bsuportes?\b/, "suporte"],
  [/\bfones?\b/, "fone"],
  [/\bbaterias?\b/, "bateria"],
];

/** O acessório pedido (sem acento, no singular) ou null. */
export function acessorioDoPedido(q: string): string | null {
  const t = normalizar(q);
  for (const [re, nome] of ACESSORIOS) {
    const m = re.exec(t);
    // "iPhone 15 com carregador" é o celular: o acessório só vale quando é o produto.
    if (m && !/\b(com|sem|e|mais|inclui|acompanha)\s*$/.test(t.slice(0, m.index))) return nome;
  }
  return null;
}

/** Aplica a regra do acessório à intenção: tipo = acessório e toda busca
    traz o acessório (nunca só o nome do aparelho). Sem acessório, igual. */
export function comAcessorio<
  T extends {
    buscas: string[];
    tipoProduto?: string | null;
    marca?: string | null;
    modelo?: string | null;
  },
>(intencao: T, q: string): T {
  const acessorio = acessorioDoPedido(q);
  if (!acessorio) return intencao;
  const buscas = intencao.buscas.map((b) =>
    acessorioDoPedido(b) ? b : `${acessorio} ${b}`.slice(0, 60),
  );
  return {
    ...intencao,
    tipoProduto: acessorio,
    buscas: buscas.length ? buscas : [q.slice(0, 60)],
    /* A marca citada é a do aparelho, não a da capinha ("Capinha iPhone 17
       Pro Max" de outra marca não traz "Apple" no título): só o modelo filtra. */
    ...(intencao.modelo ? { marca: null } : {}),
  };
}

const SINONIMOS_ACESSORIO: Record<string, string[]> = {
  capinha: ["capinha", "capa"],
  capa: ["capa", "capinha"],
  case: ["case", "capinha"],
  pelicula: ["pelicula"],
  carregador: ["carregador"],
  cabo: ["cabo"],
  suporte: ["suporte"],
  fone: ["fone"],
  bateria: ["bateria"],
};

const RE_PRECO =
  /\b(?:(ate|abaixo de|menos de|no maximo)|(a partir de|acima de|mais de|no minimo)|entre)\s+(\d+(?:[.,]\d+)?)(?:\s*reais)?(?:\s+(?:e|a)\s+(\d+(?:[.,]\d+)?)(?:\s*reais)?)?/;

const numero = (s: string | undefined) => {
  if (!s) return null;
  const n = Number(s.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Faixa de preço citada na frase ("até R$ 100", "menos de 200", "entre 50 e
    150", "a partir de 300") e a frase sem ela. */
export function faixaDePreco(q: string): { min: number | null; max: number | null; resto: string } {
  const t = normalizar(q.replace(/r\$\s*/gi, " ").replace(/(\d)\.(\d{3})\b/g, "$1$2"));
  const m = RE_PRECO.exec(t);
  if (!m) return { min: null, max: null, resto: t };
  const a = numero(m[3]);
  const b = numero(m[4]);
  const resto = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length))
    .replace(/\s+/g, " ")
    .trim();
  if (b != null && a != null) return { min: Math.min(a, b), max: Math.max(a, b), resto };
  if (m[2]) return { min: a, max: null, resto };
  return { min: null, max: a, resto };
}

/** Intenção sem rede, na hora (Weslei, 02/11: busca por texto rápida): vale
    quando a interpretação remota não responde em 3,5 s. Acessório vira o
    produto, com o sinônimo como segunda busca; faixa de preço pela frase. */
export function extrairIntencaoRapida(q: string): {
  buscas: string[];
  precoMin: number | null;
  precoMax: number | null;
  resumo: string;
  tipoProduto: string | null;
  contextoUso: null;
  termosNegativos: string[];
} {
  const { min, max, resto } = faixaDePreco(q);
  const frase = (resto || normalizar(q)).slice(0, 60);
  const acessorio = acessorioDoPedido(frase);
  let buscas = [frase];
  if (acessorio) {
    const sem = frase
      .replace(new RegExp(`\\b${acessorio}(e?s)?\\b`), " ")
      .replace(/\s+/g, " ")
      .trim();
    buscas = [
      ...new Set((SINONIMOS_ACESSORIO[acessorio] ?? [acessorio]).map((a) => `${a} ${sem}`.trim())),
    ];
  }
  return {
    buscas: buscas.filter((b) => b.length >= 2).slice(0, 3),
    precoMin: min,
    precoMax: max,
    resumo: "",
    tipoProduto: acessorio ?? tipoDoProduto(frase),
    contextoUso: null,
    termosNegativos: [],
  };
}
