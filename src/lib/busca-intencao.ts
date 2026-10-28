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
