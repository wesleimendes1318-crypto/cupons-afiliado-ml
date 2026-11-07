/* Hub collector follow-up for /admin (Weslei 07/11/2026: "preciso ter uma
   forma de validar a lista enviada, o status, o link"). Data comes only from
   hub_coletados_fundador(), which checks eh_fundador() in the database. */
import { CATEGORIAS } from "@/content/categorias";

export type StatusColetado =
  | "no_site"
  | "link_pronto"
  | "sem_link"
  | "gerando"
  | "na_fila"
  | "falhou"
  | "nota_baixa"
  | "aguardando";

export type Coletado = {
  item: string;
  titulo: string | null;
  imagem: string | null;
  preco: number | null;
  preco_original: number | null;
  desconto_pct: number | null;
  mais_vendido: boolean | null;
  avaliacao: number | null;
  vendidos: string | null;
  comissao_pct: number | null;
  lido_em: string;
  enfileirado_em: string | null;
  url: string;
  pedido: number | null;
  pedido_status: string | null;
  erro: string | null;
  atendido_em: string | null;
  link: string | null;
  no_site_em: string | null;
  categoria_site: string | null;
  status: StatusColetado;
};

// Order = funnel order on screen.
export const STATUS: Record<StatusColetado, { rotulo: string; cor: string; dica: string }> = {
  no_site: {
    rotulo: "No site",
    cor: "bg-[#34c759]/15 text-[#1d6b31]",
    dica: "Comparado, com seu meli.la e na vitrine.",
  },
  link_pronto: {
    rotulo: "Link pronto",
    cor: "bg-[#0071e3]/10 text-[#0071e3]",
    dica: "Tem seu meli.la, mas a vitrine barrou (filtro de produto ou sem título).",
  },
  gerando: {
    rotulo: "Gerando",
    cor: "bg-[#0071e3]/10 text-[#0071e3]",
    dica: "A extensão está gerando o link agora.",
  },
  na_fila: {
    rotulo: "Na fila",
    cor: "bg-[#ff9500]/15 text-[#c93400]",
    dica: "Aguardando a extensão.",
  },
  aguardando: {
    rotulo: "Aguardando fila",
    cor: "bg-[#767680]/12 text-[#3a3a3c]",
    dica: "Entra na fila sozinho a cada 10 min, respeitando o limite do dia.",
  },
  nota_baixa: {
    rotulo: "Nota baixa",
    cor: "bg-[#767680]/12 text-[#3a3a3c]",
    dica: "Nota abaixo de 4,5: não vai para o site.",
  },
  sem_link: {
    rotulo: "Sem link",
    cor: "bg-[#ff3b30]/12 text-[#c4281c]",
    dica: "Comparado, mas sem meli.la: não aparece.",
  },
  falhou: {
    rotulo: "Falhou",
    cor: "bg-[#ff3b30]/12 text-[#c4281c]",
    dica: "A comparação falhou; veja o motivo.",
  },
};

export const ORDEM_STATUS = Object.keys(STATUS) as StatusColetado[];

export function contarPorStatus(lista: Coletado[]) {
  const c = Object.fromEntries(ORDEM_STATUS.map((s) => [s, 0])) as Record<StatusColetado, number>;
  for (const x of lista) c[x.status] = (c[x.status] ?? 0) + 1;
  return c;
}

const SITE = "https://melhorescolha.io";
const SLUGS = new Set(CATEGORIAS.map((c) => c.slug));

/* Where the item shows on the site: its category showcase ("outros" only on
   the home showcase), and the result page a visitor gets for this listing. */
export function ondeNoSite(c: Pick<Coletado, "categoria_site" | "url" | "status">) {
  if (c.status !== "no_site") return null;
  const cat = c.categoria_site && SLUGS.has(c.categoria_site) ? c.categoria_site : null;
  return {
    vitrine: cat ? `${SITE}/categorias/${cat}` : `${SITE}/`,
    nomeVitrine: cat ? (CATEGORIAS.find((x) => x.slug === cat)?.nome ?? cat) : "Início",
    resultado: `${SITE}/?link=${encodeURIComponent(c.url)}`,
  };
}

export const precoBR = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function carregarColetados(dias = 30): Promise<Coletado[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.rpc(
    "hub_coletados_fundador" as never,
    { p_dias: dias } as never,
  );
  if (error) throw new Error(error.message);
  return (data as Coletado[] | null) ?? [];
}
