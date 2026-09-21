import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock3, Copy, Info, MessageCircle, Search, ShieldAlert, ShieldCheck, Sparkles, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WHATSAPP } from "@/config";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cupons Afiliado ML — descubra o desconto real" },
      {
        name: "description",
        content:
          "Consulte o teto real, a compra mínima e as condições dos cupons de afiliado do Mercado Livre.",
      },
      { property: "og:title", content: "Cupons Afiliado ML — descubra o desconto real" },
      {
        property: "og:description",
        content: "Compare o percentual anunciado com o teto real de desconto de cada cupom.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Qualidade = "bom" | "armadilha";
type Cupom = {
  id: number;
  vendedor: string;
  desconto: string | null;
  tipo: string | null;
  valor: number | null;
  orcamento: number | null;
  vence: string | null;
  busca: string | null;
  compra_min: number | null;
  teto: number | null;
  sem_teto: boolean | null;
  qualidade: string | null;
  categoria: string | null;
  updated_at: string | null;
};

type CupomIndexado = Cupom & { chave: string; dias: number | null; score: number | null };
type Ordem = "score" | "desconto" | "teto" | "orcamento" | "termina" | "vendedor";
type Urgencia = "normal" | "atencao" | "urgente" | "ultimas" | "encerrado" | "sem-data";
type FaixaEconomia = "semlimite" | "ate50" | "50a200" | "200a1000" | "acima1000";
type EscolhaIa = { id: number; motivo: string };
type Comparacao = { vencedor_id: number | null; veredito: string; observacoes: string[] };

const FAIXAS: Array<{ id: FaixaEconomia; rotulo: string; aceita: (cupom: Cupom) => boolean }> = [
  { id: "semlimite", rotulo: "sem limite", aceita: (cupom) => semLimite(cupom) },
  { id: "ate50", rotulo: "até R$ 50", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! <= 50 },
  { id: "50a200", rotulo: "R$ 50 a R$ 200", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! > 50 && tetoReal(cupom)! <= 200 },
  { id: "200a1000", rotulo: "R$ 200 a R$ 1.000", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! > 200 && tetoReal(cupom)! <= 1000 },
  { id: "acima1000", rotulo: "acima de R$ 1.000", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! > 1000 },
];

const PAGE_SIZE = 50;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCurto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function dataDoBanco(data: string) {
  return new Date(`${data}T00:00:00Z`);
}

function fimDoDiaEmSaoPaulo(data: string) {
  return new Date(`${data}T23:59:59.999-03:00`).getTime();
}

function contagemRegressiva(vence: string | null, agora: number | null) {
  if (!vence) return { texto: "Validade não informada", urgencia: "sem-data" as Urgencia };
  if (agora == null) return { texto: "Calculando validade...", urgencia: "normal" as Urgencia };

  const minutosRestantes = Math.ceil((fimDoDiaEmSaoPaulo(vence) - agora) / 60_000);
  if (minutosRestantes <= 0) return { texto: "Encerrado", urgencia: "encerrado" as Urgencia };

  const horasRestantes = minutosRestantes / 60;
  if (horasRestantes > 48) {
    const dias = Math.ceil(horasRestantes / 24);
    return { texto: `Faltam ${dias} ${dias === 1 ? "dia" : "dias"}`, urgencia: "normal" as Urgencia };
  }
  if (horasRestantes >= 24) {
    return { texto: `Faltam ${Math.ceil(horasRestantes)} horas`, urgencia: "atencao" as Urgencia };
  }

  const horas = Math.floor(minutosRestantes / 60);
  const minutos = minutosRestantes % 60;
  const texto = `Faltam ${horas}h ${minutos}min`;
  return {
    texto: horasRestantes < 6 ? `ÚLTIMAS HORAS · ${texto}` : texto,
    urgencia: horasRestantes < 6 ? ("ultimas" as Urgencia) : ("urgente" as Urgencia),
  };
}

function diasAte(data: string | null) {
  if (!data) return null;
  const hoje = new Date();
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((dataDoBanco(data).getTime() - hojeUtc) / 86400000);
}

function calcularScore(cupom: Cupom, agora: number | null) {
  const base = semLimite(cupom) ? (cupom.valor ?? 0) * 40 : tetoReal(cupom);
  if (base == null || base <= 0) return null;
  let score = base;
  if (cupom.compra_min != null && cupom.compra_min <= 50) score *= 1.3;
  else if (cupom.compra_min != null && cupom.compra_min <= 150) score *= 1.15;
  if ((cupom.orcamento ?? 0) > 50_000) score *= 1.2;
  if (agora != null && cupom.vence) {
    const horas = (fimDoDiaEmSaoPaulo(cupom.vence) - agora) / 3_600_000;
    if (horas > 0 && horas < 24) score *= 0.5;
  }
  return score;
}

function formatarMoeda(valor: number | null) {
  return valor == null ? "Não informado" : brl.format(valor);
}

/** Tetos absurdos cadastrados (ex.: 99.999.999) significam "sem limite informado", não um valor real. */
const TETO_IRREAL = 9_999_999;
/** Compra necessária acima disso: o teto nunca é alcançado numa compra normal. */
const COMPRA_INALCANCAVEL = 2_000;

type CupomLimite = Pick<Cupom, "teto" | "valor" | "tipo" | "sem_teto">;

function tetoReal(cupom: Pick<Cupom, "teto">) {
  return cupom.teto != null && cupom.teto >= TETO_IRREAL ? null : cupom.teto;
}

/** Quanto a pessoa precisaria gastar para chegar ao teto do cupom. */
function compraParaAtingirTeto(cupom: CupomLimite) {
  const teto = tetoReal(cupom);
  if (teto == null || cupom.tipo !== "%" || !cupom.valor) return null;
  return (teto * 100) / cupom.valor;
}

/** Sem limite na prática: marcado no banco, sem teto informado ou teto inalcançável numa compra normal. */
function semLimite(cupom: CupomLimite) {
  if (cupom.sem_teto === true) return true;
  const compra = compraParaAtingirTeto(cupom);
  return compra != null && compra > COMPRA_INALCANCAVEL;
}

/** Teto que vale a pena anunciar: só quando é alcançável numa compra realista. */
function tetoUtil(cupom: CupomLimite) {
  return semLimite(cupom) ? null : tetoReal(cupom);
}

function formatarTeto(cupom: CupomLimite) {
  if (semLimite(cupom)) return "sem limite prático";
  const teto = tetoReal(cupom);
  return teto == null ? "Limite não informado" : brl.format(teto);
}

/** "30% de desconto" quando o cupom é percentual; senão o texto cadastrado. */
function percentualTexto(cupom: Pick<Cupom, "tipo" | "valor" | "desconto">) {
  if (cupom.tipo === "%" && cupom.valor) {
    return `${cupom.valor.toLocaleString("pt-BR")}% de desconto`;
  }
  return cupom.desconto ?? "desconto não informado";
}

function linkWa(mensagem: string) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
}

/** Texto do limite dentro das mensagens: "desconta até R$ 50" ou "sem limite prático de desconto". */
function limiteNaMensagem(cupom: Cupom) {
  if (semLimite(cupom)) return "sem limite prático de desconto";
  const teto = tetoReal(cupom);
  return teto == null ? "limite não informado" : `desconta até ${brl.format(teto)}`;
}

function resumoCupom(cupom: Cupom) {
  const compra = cupom.compra_min != null ? `, compra mínima de ${formatarMoeda(cupom.compra_min)}` : "";
  return `${percentualTexto(cupom)}, ${limiteNaMensagem(cupom)}${compra}`;
}

function linkWhatsApp(cupom: Cupom, extra?: string) {
  const mensagem =
    `Oi! Vi no seu site o cupom da ${cupom.vendedor} (${resumoCupom(cupom)}).\n` +
    (extra ? `${extra}\n` : "") +
    `Ainda não escolhi o produto. O que eu quero comprar é: `;
  return linkWa(mensagem);
}

function linkWhatsAppLista(cupons: Cupom[], fechoPersonalizado?: string) {
  const itens = cupons
    .map((cupom, indice) => `${indice + 1}) ${cupom.vendedor} — ${percentualTexto(cupom)}, ${limiteNaMensagem(cupom)}.`)
    .join("\n");
  const fecho = fechoPersonalizado ?? "O que eu quero comprar é: ";
  return linkWa(`Oi! Me interessei por estas lojas do seu site:\n${itens}\n${fecho}`);
}

function linkWhatsAppIa(cupons: Cupom[], consulta: string) {
  const itens = cupons
    .map((cupom, indice) => `${indice + 1}) ${cupom.vendedor} — ${percentualTexto(cupom)}, ${limiteNaMensagem(cupom)}.`)
    .join("\n");
  return linkWa(`Oi! Pesquisei no seu site: "${consulta}".\nAs sugestões foram:\n${itens}\nQual dessas vale mais a pena para mim?`);
}

function IconeWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className ?? "size-5"}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2 22l5.35-1.4a9.82 9.82 0 0 0 4.69 1.19h.01c5.43 0 9.85-4.42 9.85-9.86 0-2.63-1.02-5.1-2.88-6.96A9.78 9.78 0 0 0 12.04 2Zm0 17.98h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.14 8.14 0 0 1-1.25-4.34c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.17-8.21 8.17Z" />
    </svg>
  );
}

function descontoRealEm200(cupom: Cupom) {
  const teto = tetoReal(cupom) ?? Number.POSITIVE_INFINITY;
  const descontoCalculado = cupom.tipo === "%" ? 200 * ((cupom.valor ?? 0) / 100) : (cupom.valor ?? 0);
  return Math.min(descontoCalculado, teto);
}

async function carregarCupons(): Promise<Cupom[]> {
  const todos: Cupom[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await supabase
      .from("cupons")
      .select(
        "id,vendedor,desconto,tipo,valor,orcamento,vence,busca,compra_min,teto,sem_teto,qualidade,categoria,updated_at",
      )
      .order("valor", { ascending: false })
      .range(de, de + passo - 1);
    if (error) throw error;
    const lote = (data ?? []) as Cupom[];
    todos.push(...lote);
    if (lote.length < passo) break;
  }
  return todos;
}

function Index() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cupons"],
    queryFn: carregarCupons,
    staleTime: 60_000,
  });
  const cupons = useMemo(() => data ?? [], [data]);

  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  const [vitrine, setVitrine] = useState<"recomendados" | "todos">("recomendados");
  const [tipo, setTipo] = useState<"todos" | "%" | "R$">("todos");
  const [descontoMin, setDescontoMin] = useState("");
  const [orcamentoMin, setOrcamentoMin] = useState("");
  const [tetoMin, setTetoMin] = useState("");
  const [compraMax, setCompraMax] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("score");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [faixas, setFaixas] = useState<FaixaEconomia[]>([]);
  const [pagina, setPagina] = useState(1);
  const [cupomAberto, setCupomAberto] = useState<CupomIndexado | null>(null);
  const [agora, setAgora] = useState<number | null>(null);
  const [pedidoIa, setPedidoIa] = useState("");
  const [escolhasIa, setEscolhasIa] = useState<EscolhaIa[]>([]);
  const [mensagemIa, setMensagemIa] = useState("");
  const [erroIa, setErroIa] = useState("");
  const [recomendando, setRecomendando] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [statusClassificacao, setStatusClassificacao] = useState("");
  const [comparadorAberto, setComparadorAberto] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [erroComparacao, setErroComparacao] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermo(texto), 150);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setAgora(Date.now());
    const intervalo = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [termo, vitrine, tipo, descontoMin, orcamentoMin, tetoMin, compraMax, ordem, categorias, faixas]);

  const indexado = useMemo(
    () =>
      cupons.map((c) => ({
        ...c,
        chave: normalizar(c.busca ?? c.vendedor ?? ""),
        dias: diasAte(c.vence),
        score: calcularScore(c, agora),
      })),
    [cupons, agora],
  );

  const termos = useMemo(
    () =>
      termo
        .split(",")
        .map((item) => normalizar(item))
        .filter(Boolean),
    [termo],
  );

  const filtrados = useMemo(() => {
    const dMin = Number(descontoMin) || 0;
    const oMin = Number(orcamentoMin) || 0;
    const tMin = Number(tetoMin) || 0;
    const cMax = compraMax === "" ? null : Number(compraMax);
    const lista = indexado.filter((cupom) => {
      const buscaAtiva = termos.length > 0;
      if (!buscaAtiva && vitrine === "recomendados" && cupom.qualidade !== "bom") return false;
      if (tipo !== "todos" && cupom.tipo !== tipo) return false;
      if (dMin && (cupom.valor ?? 0) < dMin) return false;
      if (oMin && (cupom.orcamento ?? 0) < oMin) return false;
      if (tMin && (tetoReal(cupom) ?? 0) < tMin) return false;
      if (cMax !== null && (cupom.compra_min == null || cupom.compra_min > cMax)) return false;
      if (termos.length && !termos.some((item) => cupom.chave.includes(item))) return false;
      if (categorias.length && (!cupom.categoria || !categorias.includes(cupom.categoria))) return false;
      if (faixas.length && !FAIXAS.some((faixa) => faixas.includes(faixa.id) && faixa.aceita(cupom))) return false;
      return true;
    });

    return [...lista].sort((a, b) => {
      switch (ordem) {
        case "teto":
          return (b.teto ?? 0) - (a.teto ?? 0);
        case "orcamento":
          return (b.orcamento ?? 0) - (a.orcamento ?? 0);
        case "termina": {
          const fimA = a.vence ? fimDoDiaEmSaoPaulo(a.vence) : Number.POSITIVE_INFINITY;
          const fimB = b.vence ? fimDoDiaEmSaoPaulo(b.vence) : Number.POSITIVE_INFINITY;
          const ordemA = agora != null && fimA <= agora ? Number.POSITIVE_INFINITY : fimA;
          const ordemB = agora != null && fimB <= agora ? Number.POSITIVE_INFINITY : fimB;
          return ordemA - ordemB;
        }
        case "vendedor":
          return a.vendedor.localeCompare(b.vendedor, "pt-BR");
        case "score":
          if (a.score == null) return b.score == null ? 0 : 1;
          if (b.score == null) return -1;
          return b.score - a.score;
        default:
          return (b.valor ?? 0) - (a.valor ?? 0);
      }
    });
  }, [indexado, termos, vitrine, tipo, descontoMin, orcamentoMin, tetoMin, compraMax, ordem, agora, categorias, faixas]);

  const recomendadosFiltrados = useMemo(
    () => filtrados.filter((cupom) => cupom.qualidade === "bom"),
    [filtrados],
  );
  const escolhidos = useMemo(
    () => escolhasIa.map((escolha) => ({ cupom: indexado.find((item) => item.id === escolha.id), motivo: escolha.motivo })).filter((item): item is { cupom: CupomIndexado; motivo: string } => Boolean(item.cupom)),
    [escolhasIa, indexado],
  );
  const cupomSelecionados = useMemo(
    () => indexado.filter((cupom) => selecionados.includes(cupom.id)),
    [indexado, selecionados],
  );
  const economiaSomada = useMemo(
    () => cupomSelecionados.reduce((total, cupom) => total + (tetoUtil(cupom) ?? descontoRealEm200(cupom)), 0),
    [cupomSelecionados],
  );
  const armadilhasDaBusca = useMemo(
    () => (termos.length ? filtrados.filter((cupom) => cupom.qualidade === "armadilha") : []),
    [filtrados, termos.length],
  );

  const categoriasDisponiveis = useMemo(() => {
    const contagens = new Map<string, number>();
    indexado.forEach((cupom) => {
      if (cupom.categoria) contagens.set(cupom.categoria, (contagens.get(cupom.categoria) ?? 0) + 1);
    });
    return [...contagens.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [indexado]);
  const contagensFaixa = useMemo(
    () => new Map(FAIXAS.map((faixa) => [faixa.id, indexado.filter((cupom) => faixa.aceita(cupom)).length])),
    [indexado],
  );
  const filtrosAtivos = Boolean(texto || tipo !== "todos" || descontoMin || orcamentoMin || tetoMin || compraMax || categorias.length || faixas.length || vitrine !== "recomendados" || ordem !== "score");

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const indicadores = useMemo(() => {
    const vendedores = new Set(indexado.map((cupom) => cupom.vendedor));
    return {
      total: indexado.length,
      vendedores: vendedores.size,
      bons: indexado.filter((cupom) => cupom.qualidade === "bom").length,
      armadilhas: indexado.filter((cupom) => cupom.qualidade === "armadilha").length,
    };
  }, [indexado]);

  const atualizado = useMemo(() => {
    const datas = cupons
      .map((cupom) => (cupom.updated_at ? new Date(cupom.updated_at).getTime() : 0))
      .filter(Boolean);
    if (!datas.length) return null;
    return new Date(Math.max(...datas)).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }, [cupons]);

  function exportarCsv() {
    const cabecalho = [
      "Desconto",
      "Vendedor",
      "Compra mínima",
      "Teto de desconto",
      "Qualidade",
      "Orçamento restante",
      "Vence em",
    ];
    const linhas = filtrados.map((cupom) => [
      cupom.desconto ?? "",
      cupom.vendedor,
      cupom.compra_min != null ? cupom.compra_min.toFixed(2).replace(".", ",") : "",
      tetoReal(cupom) != null ? tetoReal(cupom)!.toFixed(2).replace(".", ",") : "",
      cupom.qualidade ?? "",
      cupom.orcamento != null ? cupom.orcamento.toFixed(2).replace(".", ",") : "",
      cupom.vence ? dataCurta.format(dataDoBanco(cupom.vence)) : "",
    ]);
    const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
    const csv = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cupons-afiliado-ml.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function alternarSelecao(id: number) {
    setSelecionados((atuais) => (atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]));
  }

  function alternarCategoria(categoria: string) {
    setCategorias((atuais) => atuais.includes(categoria) ? atuais.filter((item) => item !== categoria) : [...atuais, categoria]);
  }

  function alternarFaixa(faixa: FaixaEconomia) {
    setFaixas((atuais) => atuais.includes(faixa) ? atuais.filter((item) => item !== faixa) : [...atuais, faixa]);
  }

  function limparFiltros() {
    setTexto("");
    setTermo("");
    setVitrine("recomendados");
    setTipo("todos");
    setDescontoMin("");
    setOrcamentoMin("");
    setTetoMin("");
    setCompraMax("");
    setCategorias([]);
    setFaixas([]);
    setOrdem("score");
  }

  async function recomendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pedidoIa.trim().length < 3) return;
    setRecomendando(true);
    setErroIa("");
    setEscolhasIa([]);
    setMensagemIa("");
    try {
      const resposta = await fetch("/api/public/recomendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido: pedidoIa, cupons: recomendadosFiltrados.map(({ id, vendedor, categoria, desconto, teto, compra_min }) => ({ id, vendedor, categoria, desconto, teto, compra_min })) }),
      });
      const dados = (await resposta.json()) as { escolhas?: EscolhaIa[]; mensagem?: string; erro?: string };
      if (!resposta.ok || !dados.escolhas || !dados.mensagem) throw new Error(dados.erro ?? "Não foi possível buscar recomendações.");
      setEscolhasIa(dados.escolhas);
      setMensagemIa(dados.mensagem);
    } catch (motivo) {
      setErroIa(motivo instanceof Error ? motivo.message : "Não foi possível buscar recomendações.");
    } finally {
      setRecomendando(false);
    }
  }

  async function abrirComparador() {
    const escolhidosParaComparar = cupomSelecionados.slice(0, 3);
    if (escolhidosParaComparar.length < 2) return;
    setComparadorAberto(true);
    setComparando(true);
    setComparacao(null);
    setErroComparacao("");
    try {
      const resposta = await fetch("/api/public/comparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cupons: escolhidosParaComparar.map(({ id, vendedor, categoria, desconto, teto, compra_min, vence, qualidade }) => ({ id, vendedor, categoria, desconto, teto, compra_min, vence, qualidade })),
        }),
      });
      const dados = (await resposta.json()) as Partial<Comparacao> & { erro?: string };
      if (!resposta.ok || typeof dados.veredito !== "string") throw new Error(dados.erro ?? "Não foi possível comparar os cupons.");
      setComparacao({ vencedor_id: dados.vencedor_id ?? null, veredito: dados.veredito, observacoes: dados.observacoes ?? [] });
    } catch (motivo) {
      setErroComparacao(motivo instanceof Error ? motivo.message : "Não foi possível comparar os cupons.");
    } finally {
      setComparando(false);
    }
  }

  async function classificar() {
    setClassificando(true);
    setStatusClassificacao("Classificando as lojas em lotes de até 40...");
    try {
      const resposta = await fetch("/api/public/classificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const dados = (await resposta.json()) as { classificados?: number; total?: number; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível classificar as lojas.");
      setStatusClassificacao(`${dados.classificados ?? 0} de ${dados.total ?? 0} lojas classificadas.`);
      await refetch();
    } catch (motivo) {
      setStatusClassificacao(motivo instanceof Error ? motivo.message : "Não foi possível classificar as lojas.");
    } finally {
      setClassificando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full bg-ml-yellow text-ml-yellow-foreground">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 size-7 shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Cupons Afiliado ML</h1>
              <p className="mt-1 max-w-2xl text-sm font-medium sm:text-base">
                Muito cupom anuncia 40% e desconta R$ 2. Eu confiro o limite real antes de indicar.
              </p>
              <Button asChild className="mt-3 h-auto min-h-10 bg-card px-4 py-2 font-bold text-foreground hover:bg-card/90">
                <a href={linkWa("Oi! Vi seu site de cupons e quero ajuda para escolher.")} target="_blank" rel="noopener noreferrer">
                  <IconeWhatsApp className="size-5 text-whatsapp" />
                  Falar comigo
                </a>
              </Button>
              <p className="mt-2 text-xs text-secondary-ink">
                {atualizado ? `Dados atualizados em ${atualizado}` : "Aguardando a primeira carga de dados"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-card" aria-label="Como funciona">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <ol className="grid gap-3 text-sm sm:grid-cols-3">
            {[
              { icone: Search, texto: "Você escolhe uma loja aqui" },
              { icone: MessageCircle, texto: "Me chama e diz o que quer comprar" },
              { icone: ShieldCheck, texto: "Confiro as condições e te mando o link certo" },
            ].map((passo, indice) => (
              <li key={passo.texto} className="flex min-w-0 items-start gap-2">
                <passo.icone className="mt-0.5 size-4 shrink-0 text-ml-blue" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{indice + 1}.</span> {passo.texto}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-secondary-ink">
            Sem custo para você. Eu recebo comissão do Mercado Livre, não de quem compra.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Assistente de cupons">
          <div className="flex items-center gap-2">
            <WandSparkles className="size-5 text-ml-blue" aria-hidden="true" />
            <h2 className="font-semibold">Encontre uma oportunidade com IA</h2>
          </div>
          <form onSubmit={recomendar} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={pedidoIa}
              onChange={(event) => setPedidoIa(event.target.value)}
              maxLength={500}
              placeholder="O que você está procurando? Ex: presente para minha mãe até R$ 150"
              aria-label="O que você está procurando?"
              className="min-h-12 flex-1 rounded-lg border border-border bg-background px-4 outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2"
            />
            <Button disabled={recomendando || pedidoIa.trim().length < 3} className="min-h-12 bg-ml-blue text-ml-blue-foreground hover:bg-ml-blue/90">
              <Sparkles aria-hidden="true" />
              {recomendando ? "Procurando..." : "Encontrar cupons"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-secondary-ink">A IA escolhe somente entre os cupons recomendados e os filtros ativos.</p>
          {erroIa && <p className="mt-3 rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger" role="alert">{erroIa}</p>}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo dos cupons">
          <Indicador titulo="Cupons" valor={indicadores.total.toLocaleString("pt-BR")} />
          <Indicador titulo="Vendedores" valor={indicadores.vendedores.toLocaleString("pt-BR")} />
          <Indicador titulo="Vale a pena" valor={indicadores.bons.toLocaleString("pt-BR")} tom="bom" />
          <Indicador
            titulo="Armadilhas"
            valor={indicadores.armadilhas.toLocaleString("pt-BR")}
            tom="armadilha"
          />
        </section>

        <section className="mt-6" aria-label="Filtros de cupons">
          <div className="flex border-b border-border" role="tablist" aria-label="Qualidade do cupom">
            {([
              ["recomendados", "Recomendados"],
              ["todos", "Ver todos"],
            ] as const).map(([valor, rotulo]) => (
              <Button
                key={valor}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={vitrine === valor}
                onClick={() => setVitrine(valor)}
                className={cn(
                  "h-11 rounded-none border-b-2 px-3 sm:px-5",
                  vitrine === valor
                    ? "border-ml-blue text-ml-blue"
                    : "border-transparent text-secondary-ink",
                )}
              >
                {rotulo}
              </Button>
            ))}
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              inputMode="search"
              aria-label="Buscar vendedor"
              placeholder="Buscar vendedor (separe vários nomes por vírgula)"
              className="w-full rounded-lg border border-border bg-card py-3 pl-11 pr-4 text-base outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Campo rotulo="Tipo">
              <select
                value={tipo}
                onChange={(event) => setTipo(event.target.value as typeof tipo)}
                className="campo-filtro"
              >
                <option value="todos">Todos</option>
                <option value="%">Só %</option>
                <option value="R$">Só R$</option>
              </select>
            </Campo>
            <Campo rotulo="Desconto mínimo">
              <InputNumero valor={descontoMin} aoMudar={setDescontoMin} />
            </Campo>
            <Campo rotulo="Orçamento mínimo (R$)">
              <InputNumero valor={orcamentoMin} aoMudar={setOrcamentoMin} />
            </Campo>
            <Campo rotulo="Teto mínimo (R$)">
              <InputNumero valor={tetoMin} aoMudar={setTetoMin} />
            </Campo>
            <Campo rotulo="Compra máxima que aceito (R$)">
              <InputNumero valor={compraMax} aoMudar={setCompraMax} />
            </Campo>
            <Campo rotulo="Ordenar por">
              <select
                value={ordem}
                onChange={(event) => setOrdem(event.target.value as typeof ordem)}
                className="campo-filtro"
              >
                <option value="score">Melhores oportunidades</option>
                <option value="desconto">Maior desconto</option>
                <option value="teto">Maior teto de desconto</option>
                <option value="orcamento">Maior orçamento</option>
                <option value="termina">Termina primeiro</option>
                <option value="vendedor">Vendedor A-Z</option>
              </select>
            </Campo>
          </div>

          {categoriasDisponiveis.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-secondary-ink">Categorias — categoria estimada pelo nome da loja</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoriasDisponiveis.map(([categoria, quantidade]) => (
                  <button
                    key={categoria}
                    type="button"
                    aria-pressed={categorias.includes(categoria)}
                    onClick={() => alternarCategoria(categoria)}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", categorias.includes(categoria) ? "border-ml-blue bg-ml-blue text-ml-blue-foreground" : "border-border bg-card hover:border-ml-blue")}
                  >
                    {categoria} ({quantidade})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs font-semibold text-secondary-ink">Faixa de economia real</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FAIXAS.map((faixa) => (
                <button
                  key={faixa.id}
                  type="button"
                  aria-pressed={faixas.includes(faixa.id)}
                  onClick={() => alternarFaixa(faixa.id)}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", faixas.includes(faixa.id) ? "border-ml-blue bg-ml-blue text-ml-blue-foreground" : "border-border bg-card hover:border-ml-blue")}
                >
                  {faixa.rotulo} ({contagensFaixa.get(faixa.id) ?? 0})
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary-ink" aria-live="polite">
              {isLoading
                ? "Carregando cupons..."
                : filtrados.length === 1
                  ? "1 cupom encontrado"
                  : `${filtrados.length.toLocaleString("pt-BR")} cupons encontrados`}
            </p>
            <div className="flex flex-wrap gap-2">
              {filtrosAtivos && <Button variant="outline" onClick={limparFiltros}><X aria-hidden="true" />Limpar filtros</Button>}
              <Button onClick={exportarCsv} disabled={!filtrados.length} className="bg-ml-blue text-ml-blue-foreground hover:bg-ml-blue/90">Exportar CSV</Button>
            </div>
          </div>
        </section>

        <section className="mt-4" aria-label="Cupons encontrados">
          <p className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-secondary-ink">
            Analisei 361 cupons. 49 descontam menos de R$ 20. Os 312 aqui embaixo passaram no teste.
          </p>
          {armadilhasDaBusca.length > 0 && (
            <div className="mb-4 rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger" role="alert">
              <strong>Atenção:</strong>{" "}
              {armadilhasDaBusca.map((cupom, indice) => (
                <span key={cupom.id}>{indice > 0 ? " · " : ""}{cupom.vendedor}: este cupom desconta no máximo {formatarTeto(cupom)}. Não recomendo usar como argumento de venda.</span>
              ))}
            </div>
          )}
          {(mensagemIa || escolhidos.length > 0) && (
            <div className="mb-6 rounded-xl border-2 border-ml-blue/30 bg-ml-blue/5 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-semibold text-ml-blue">Escolhidos para você</h2><p className="mt-1 text-sm text-secondary-ink">{mensagemIa}</p></div>
                <Button variant="ghost" size="icon" aria-label="Fechar recomendações" onClick={() => { setEscolhasIa([]); setMensagemIa(""); }}><X aria-hidden="true" /></Button>
              </div>
              {escolhidos.length > 0 && (
                <>
                  <Button asChild size="lg" className="mt-4 h-auto min-h-12 w-full whitespace-normal bg-whatsapp py-3 text-base font-bold text-whatsapp-foreground hover:bg-whatsapp/90">
                    <a href={linkWhatsAppIa(escolhidos.map(({ cupom }) => cupom), pedidoIa)} target="_blank" rel="noopener noreferrer">
                      <IconeWhatsApp className="size-5" />
                      Falar sobre essas opções
                    </a>
                  </Button>
                  <div className="mt-4 grid items-stretch gap-4 md:grid-cols-2">
                    {escolhidos.map(({ cupom, motivo }) => (
                      <div key={cupom.id} className="flex flex-col gap-2">
                        <p className="rounded-md bg-card px-3 py-2 text-sm font-medium">{motivo}</p>
                        <CupomCard cupom={cupom} agora={agora} abrirCondicoes={setCupomAberto} selecionado={selecionados.includes(cupom.id)} alternarSelecao={alternarSelecao} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {error ? (
            <Aviso titulo="Não foi possível carregar os cupons" texto="Tente atualizar a página em alguns instantes." />
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, indice) => (
                <div key={indice} className="h-56 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !cupons.length ? (
            <Aviso
              titulo="Nenhum cupom cadastrado ainda"
              texto="Assim que os cupons forem carregados, eles aparecem aqui automaticamente."
            />
          ) : !filtrados.length ? (
            <Aviso
              titulo="Nenhum resultado para esses filtros"
              texto="Tente outro vendedor ou ajuste os limites de desconto, teto e compra."
            >
              <Button asChild className="mt-4 h-auto min-h-11 bg-whatsapp px-4 py-2 font-bold text-whatsapp-foreground hover:bg-whatsapp/90">
                <a href={linkWa("Oi! Busquei um cupom no seu site e não encontrei. Pode me ajudar?")} target="_blank" rel="noopener noreferrer">
                  <IconeWhatsApp className="size-5" />
                  Pedir ajuda no WhatsApp
                </a>
              </Button>
            </Aviso>
          ) : (
            <>
              <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-whatsapp/40 bg-whatsapp/10 p-4 sm:flex-row sm:items-center">
                <p className="text-sm font-medium">
                  Não achou o que procura? Me chama que eu procuro um cupom para o produto que você quer.
                </p>
                <Button asChild className="h-auto min-h-11 shrink-0 bg-whatsapp px-4 py-2 font-bold text-whatsapp-foreground hover:bg-whatsapp/90">
                  <a href={linkWa("Oi! Não achei no site o cupom que eu queria. Pode me ajudar a encontrar?")} target="_blank" rel="noopener noreferrer">
                    <IconeWhatsApp className="size-5" />
                    Pedir ajuda no WhatsApp
                  </a>
                </Button>
              </div>
              <div className="grid items-stretch gap-4 md:grid-cols-2">
                {visiveis.map((cupom) => (
                  <CupomCard key={cupom.id} cupom={cupom} agora={agora} abrirCondicoes={setCupomAberto} selecionado={selecionados.includes(cupom.id)} alternarSelecao={alternarSelecao} />
                ))}
              </div>

              {totalPaginas > 1 && (
                <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Paginação">
                  <Button
                    variant="outline"
                    onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
                    disabled={paginaAtual === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-secondary-ink">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
                    disabled={paginaAtual === totalPaginas}
                  >
                    Próxima
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>
      </main>

      {cupomSelecionados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 shadow-modal backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">
              {cupomSelecionados.length} {cupomSelecionados.length === 1 ? "loja selecionada" : "lojas selecionadas"} · economia somada de até {formatarMoeda(economiaSomada)}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>Limpar seleção</Button>
              <Button
                variant="outline"
                className="h-auto min-h-11 font-semibold"
                disabled={cupomSelecionados.length < 2}
                title={cupomSelecionados.length > 3 ? "A comparação usa os 3 primeiros cupons selecionados." : undefined}
                onClick={abrirComparador}
              >
                <Sparkles aria-hidden="true" />
                Comparar economia
              </Button>
              <Button asChild className="h-auto min-h-11 bg-whatsapp px-4 py-2 font-bold text-whatsapp-foreground hover:bg-whatsapp/90">
                <a href={linkWhatsAppLista(cupomSelecionados)} target="_blank" rel="noopener noreferrer">
                  <IconeWhatsApp className="size-5" />
                  Falar sobre {cupomSelecionados.length} {cupomSelecionados.length === 1 ? "loja" : "lojas"}
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      <a
        href={linkWa("Oi! Vi seu site de cupons e quero ajuda para escolher.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar comigo no WhatsApp"
        className={cn(
          "fixed right-4 z-50 flex size-14 items-center justify-center rounded-full bg-whatsapp font-bold text-whatsapp-foreground shadow-modal transition hover:brightness-95 sm:size-auto sm:gap-2 sm:rounded-full sm:px-5 sm:py-3",
          cupomSelecionados.length > 0 ? "bottom-24" : "bottom-4",
        )}
      >
        <IconeWhatsApp className="size-7 sm:size-5" />
        <span className="hidden sm:inline">Falar comigo</span>
      </a>


      <CondicoesModal cupom={cupomAberto} fechar={() => setCupomAberto(null)} />

      <ComparadorModal
        aberto={comparadorAberto}
        fechar={() => setComparadorAberto(false)}
        cupons={cupomSelecionados.slice(0, 3)}
        excedeu={cupomSelecionados.length > 3}
        carregando={comparando}
        comparacao={comparacao}
        erro={erroComparacao}
      />

      <footer className="mt-8 border-t border-border py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-secondary-ink">Fotografia dos cupons, não é tempo real. Cupom é campanha do vendedor e pode acabar antes da validade.</p>
          <div className="text-left sm:text-right">
            <Button type="button" variant="ghost" size="sm" disabled={classificando} onClick={classificar} className="px-2 text-xs text-secondary-ink">
              <WandSparkles aria-hidden="true" />{classificando ? "Classificando lojas..." : "Classificar lojas com IA"}
            </Button>
            {statusClassificacao && <p className="mt-1 text-xs text-secondary-ink" aria-live="polite">{statusClassificacao}</p>}
          </div>
        </div>
      </footer>
    </div>
  );
}

function ComparadorModal({
  aberto,
  fechar,
  cupons,
  excedeu,
  carregando,
  comparacao,
  erro,
}: {
  aberto: boolean;
  fechar: () => void;
  cupons: CupomIndexado[];
  excedeu: boolean;
  carregando: boolean;
  comparacao: Comparacao | null;
  erro: string;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(estado) => { if (!estado) fechar(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Qual compensa mais</DialogTitle>
          <DialogDescription>
            Comparação entre {cupons.length} cupons selecionados, com os valores reais de cada um.
          </DialogDescription>
        </DialogHeader>

        {excedeu && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-secondary-ink">
            A comparação usa no máximo 3 cupons. Estamos comparando os 3 primeiros que você marcou.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold text-secondary-ink">
              <tr>
                <th className="py-2 pr-3 font-semibold">Loja</th>
                <th className="py-2 pr-3 font-semibold">Desconto</th>
                <th className="py-2 pr-3 font-semibold">Economia máxima</th>
                <th className="py-2 pr-3 font-semibold">Compra mínima</th>
                <th className="py-2 font-semibold">Vence em</th>
              </tr>
            </thead>
            <tbody>
              {cupons.map((cupom) => (
                <tr
                  key={cupom.id}
                  className={cn("border-t border-border align-top", comparacao?.vencedor_id === cupom.id && "bg-success-soft")}
                >
                  <td className="py-2 pr-3 font-semibold">
                    {cupom.vendedor}
                    {comparacao?.vencedor_id === cupom.id && (
                      <span className="ml-2 rounded border border-success px-1.5 py-0.5 text-[10px] font-bold text-success">MELHOR</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{cupom.desconto ?? "Não informado"}</td>
                  <td className="py-2 pr-3 font-semibold text-success">{formatarTeto(cupom)}</td>
                  <td className="py-2 pr-3">{formatarMoeda(cupom.compra_min)}</td>
                  <td className="py-2">{cupom.vence ? dataCurta.format(dataDoBanco(cupom.vence)) : "Sem data"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {carregando && <p className="text-sm text-secondary-ink" aria-live="polite">Analisando os cupons...</p>}

        {!carregando && erro && (
          <p className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{erro}</p>
        )}

        {!carregando && comparacao && (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold text-ml-blue">Veredito</p>
            <p className="mt-1 whitespace-pre-line text-sm">{comparacao.veredito}</p>
            {comparacao.observacoes.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary-ink">
                {comparacao.observacoes.map((observacao) => (
                  <li key={observacao}>{observacao}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {cupons.length > 0 && (
          <Button asChild className="h-auto min-h-12 w-full bg-whatsapp py-3 text-base font-bold text-whatsapp-foreground hover:bg-whatsapp/90">
            <a href={linkWhatsAppLista(cupons)} target="_blank" rel="noopener noreferrer">
              <IconeWhatsApp className="size-5" />
              Falar sobre essas {cupons.length} lojas
            </a>
          </Button>
        )}
        <p className="text-xs text-secondary-ink">
          Comparação feita com os dados cadastrados de cada cupom. A categoria é estimada pelo nome da loja.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function CupomCard({
  cupom,
  agora,
  abrirCondicoes,
  selecionado,
  alternarSelecao,
}: {
  cupom: CupomIndexado;
  agora: number | null;
  abrirCondicoes: (cupom: CupomIndexado) => void;
  selecionado: boolean;
  alternarSelecao: (id: number) => void;
}) {
  const armadilha = cupom.qualidade === "armadilha";
  const contagem = contagemRegressiva(cupom.vence, agora);
  const encerrado = contagem.urgencia === "encerrado";
  const urgente = contagem.urgencia === "urgente" || contagem.urgencia === "ultimas";
  const ilimitado = semLimite(cupom);
  const teto = tetoUtil(cupom);
  const em200 = descontoRealEm200(cupom);
  const rotuloQualidade = ilimitado
    ? `${percentualTexto(cupom)}, sem teto`
    : teto == null
      ? "Limite não informado"
      : armadilha
        ? `Desconta só ${brlCurto.format(teto)}`
        : `Desconta até ${brlCurto.format(teto)}`;

  return (
    <article
      className={cn(
        "flex min-h-56 min-w-0 flex-col rounded-lg border bg-card p-5 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-card",
        armadilha ? "border-danger" : "border-border",
        urgente && "border-t-4 border-t-urgency-danger",
        encerrado && "grayscale opacity-55 hover:translate-y-0 hover:shadow-none",
      )}
    >
      <div className="flex min-h-10 min-w-0 items-start justify-between gap-3">
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-secondary-ink">
          <input
            type="checkbox"
            checked={selecionado}
            onChange={() => alternarSelecao(cupom.id)}
            className="size-4 accent-[var(--whatsapp)]"
            aria-label={`Selecionar a loja ${cupom.vendedor}`}
          />
        </label>
        <p
          title={cupom.vence ? dataCurta.format(dataDoBanco(cupom.vence)) : undefined}
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs text-secondary-ink",
            contagem.urgencia === "atencao" && "font-semibold text-urgency-warning",
            urgente && "animate-urgency-pulse bg-urgency-soft font-bold text-urgency-danger",
          )}
        >
          <Clock3 className="size-4 shrink-0" aria-hidden="true" />
          {contagem.texto}
        </p>
        <span
          className={cn(
            "max-w-[58%] rounded-sm px-2 py-1 text-right text-xs font-semibold leading-4",
            armadilha ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
          )}
        >
          {rotuloQualidade}
        </span>
      </div>

      <div className="my-5 min-w-0">
        {ilimitado ? (
          <>
            <p className="text-xl font-extrabold leading-tight text-success sm:text-2xl">{percentualTexto(cupom)} sem teto</p>
            <p className="mt-1 text-sm text-secondary-ink">
              o desconto é o percentual cheio sobre a compra
              {em200 > 0 ? `: numa compra de R$ 200, a economia é de ${brl.format(em200)}` : ""}
            </p>
          </>
        ) : teto != null ? (
          <>
            <p className="text-xl font-extrabold leading-tight text-success sm:text-2xl">Economia de até {brl.format(teto)}</p>
            <p className="mt-1 text-sm text-secondary-ink">{percentualTexto(cupom)} até esse limite</p>
          </>
        ) : (
          <p className="text-base font-semibold leading-tight text-secondary-ink">{percentualTexto(cupom)}, com limite não informado</p>
        )}
        {cupom.compra_min != null && (
          <p className="mt-1 text-sm text-secondary-ink">a partir de {formatarMoeda(cupom.compra_min)} em compras</p>
        )}



        <p className="mt-4 min-w-0 break-words text-sm text-secondary-ink [overflow-wrap:anywhere]">
          Em produtos de <span className="font-bold text-foreground">{cupom.vendedor}</span>
        </p>
        {cupom.categoria && (
          <p className="mt-1 text-[11px] leading-4 text-secondary-ink">
            <span className="font-medium">{cupom.categoria}</span> · categoria estimada pelo nome da loja
          </p>
        )}

        <Button
          asChild
          className={cn(
            "mt-4 h-auto min-h-11 w-full min-w-0 px-3 py-2 text-center text-sm font-bold",
            armadilha
              ? "bg-muted text-secondary-ink shadow-none hover:bg-muted/80"
              : "bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90",
          )}
        >
          <a href={linkWhatsApp(cupom)} target="_blank" rel="noopener noreferrer">
            <IconeWhatsApp className="size-4 shrink-0" />
            Conferir esse cupom
          </a>
        </Button>
        <p className="mt-2 text-[11px] leading-4 text-secondary-ink">
          Me diz o que você procura e eu confirmo se o cupom vale para esse produto.
        </p>
      </div>

      <div className="mt-auto min-w-0 border-t border-border pt-3 text-xs text-secondary-ink">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Button
            variant="link"
            className="h-auto p-0 text-xs font-medium text-secondary-ink"
            onClick={() => abrirCondicoes(cupom)}
            aria-label={`Abrir condições do cupom ${cupom.desconto ?? cupom.id}`}
          >
            Condições do cupom <Info className="size-3.5" aria-hidden="true" />
          </Button>
          <span aria-hidden="true">|</span>
          <span>
            {cupom.orcamento == null
              ? "Orçamento: não informado"
              : cupom.orcamento < 1_000
                ? `Orçamento quase no fim: ${brl.format(cupom.orcamento)}`
                : "Orçamento ainda disponível"}
          </span>
        </div>
        <p className="mt-2 text-[11px]">O link do produto é enviado por WhatsApp</p>
      </div>
    </article>
  );
}

function CondicoesModal({ cupom, fechar }: { cupom: CupomIndexado | null; fechar: () => void }) {
  if (!cupom) return null;

  const validade = cupom.vence ? dataCurta.format(dataDoBanco(cupom.vence)) : "não informada";
  const tetoCadastrado = tetoReal(cupom);
  const compraParaTeto = compraParaAtingirTeto(cupom);
  const texto = `ID ${cupom.id} - Cupom válido no Brasil, até ${validade}, incluindo ambas as datas, para compras de produtos realizadas no site e no aplicativo Mercado Livre. Válido apenas para os produtos selecionados e enquanto durarem os estoques. O cupom será aplicado automaticamente no carrinho elegível, sem necessidade de ativação pelo usuário. O cupom é aplicável apenas para compras mínimas de produtos selecionados cujo valor seja igual ou superior a ${formatarMoeda(cupom.compra_min)}. O cupom consiste em ${cupom.desconto ?? "desconto não informado"} sobre o valor da compra dos produtos selecionados. Não será aplicado sobre o custo de envio. O cupom é limitado a 1 (um) uso por CPF. ${tetoCadastrado != null ? `Máximo de desconto de ${brl.format(tetoCadastrado)}. ` : ""}Este cupom é de responsabilidade do vendedor dos produtos participantes.`;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border-border bg-card p-0 text-card-foreground shadow-modal sm:rounded-lg">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold">{cupom.desconto ?? "Condições do cupom"}</DialogTitle>
          <DialogDescription>Condições e limite real do desconto</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 pb-6 sm:px-6">
          <div className="divide-y divide-border rounded-lg border border-border bg-muted/50">
            <ResumoModal rotulo="Compra mínima" valor={formatarMoeda(cupom.compra_min)} />
            <ResumoModal rotulo="Teto de desconto" valor={formatarTeto(cupom)} destaque />
            {compraParaTeto != null && (
              <ResumoModal
                rotulo="Compra necessária para atingir o teto"
                valor={brl.format(compraParaTeto)}
              />
            )}
            <ResumoModal
              rotulo="Desconto real se a compra for de R$ 200"
              valor={formatarMoeda(descontoRealEm200(cupom))}
              destaque
            />
          </div>
          <Button
            asChild
            size="lg"
            className={cn(
              "h-auto min-h-12 w-full whitespace-normal py-3 text-base font-bold",
              cupom.qualidade === "armadilha"
                ? "bg-muted text-secondary-ink shadow-none hover:bg-muted/80"
                : "bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90",
            )}
          >
            <a
              href={linkWhatsApp(cupom)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconeWhatsApp className="size-5" />
              Conferir esse cupom
            </a>
          </Button>
          <p className="-mt-3 text-xs text-secondary-ink">
            Me diz o que você procura e eu confirmo se o cupom vale para esse produto.
          </p>
          <p className="text-sm leading-6 text-secondary-ink">{texto}</p>
          <GeradorTexto cupom={cupom} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeradorTexto({ cupom }: { cupom: CupomIndexado }) {
  const [canal, setCanal] = useState<"WhatsApp" | "Instagram">("WhatsApp");
  const [resultado, setResultado] = useState("");
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro("");
    setResultado("");
    setCopiado(false);
    try {
      const resposta = await fetch("/api/public/gerar-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendedor: cupom.vendedor,
          desconto: cupom.desconto ?? "Desconto não informado",
          teto: tetoReal(cupom),
          compra_min: cupom.compra_min,
          canal,
          qualidade: cupom.qualidade === "armadilha" ? "armadilha" : "bom",
        }),
      });
      const dados = (await resposta.json()) as { texto?: string; erro?: string };
      if (!resposta.ok || !dados.texto) throw new Error(dados.erro ?? "Não foi possível gerar o texto.");
      setResultado(dados.texto);
    } catch (motivo) {
      setErro(motivo instanceof Error ? motivo.message : "Não foi possível gerar o texto.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    const copiarModoCompativel = () => {
      const campo = document.createElement("textarea");
      campo.value = resultado;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      const copiou = document.execCommand("copy");
      campo.remove();
      return copiou;
    };
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(resultado);
        } catch {
          if (!copiarModoCompativel()) throw new Error("Falha ao copiar");
        }
      } else {
        if (!copiarModoCompativel()) throw new Error("Falha ao copiar");
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2_000);
    } catch {
      setErro("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <section className="border-t border-border pt-5" aria-label="Gerador de texto de venda">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo rotulo="Canal da mensagem">
          <select
            value={canal}
            onChange={(event) => {
              setCanal(event.target.value as typeof canal);
              setResultado("");
              setErro("");
            }}
            className="campo-filtro sm:min-w-44"
            aria-label="Canal da mensagem"
          >
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
          </select>
        </Campo>
        <Button
          type="button"
          onClick={gerar}
          disabled={gerando}
          className="bg-ml-blue text-ml-blue-foreground hover:bg-ml-blue/90 sm:mb-0 sm:w-auto"
        >
          <Sparkles aria-hidden="true" />
          {gerando ? "Gerando..." : "Gerar texto de venda"}
        </Button>
      </div>

      {erro && <p className="mt-3 rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger" role="alert">{erro}</p>}
      {resultado && (
        <div className="mt-3 rounded-lg border border-border bg-muted/50 p-4">
          <p className="whitespace-pre-line text-sm leading-6">{resultado}</p>
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={copiar}>
              {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ResumoModal({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-secondary-ink">{rotulo}</span>
      <strong className={cn("text-right text-sm", destaque && "text-ml-blue")}>{valor}</strong>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  tom,
}: {
  titulo: string;
  valor: string;
  tom?: Qualidade;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-secondary-ink">{titulo}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", tom === "bom" && "text-success", tom === "armadilha" && "text-danger")}>
        {valor}
      </p>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block min-h-8 text-xs leading-4 text-secondary-ink">{rotulo}</span>
      {children}
    </label>
  );
}

function InputNumero({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={valor}
      onChange={(event) => aoMudar(event.target.value)}
      placeholder="0"
      className="campo-filtro"
    />
  );
}

function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
      <p className="text-base font-semibold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-secondary-ink">{texto}</p>
      {children}
    </div>
  );
}
