import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, ChevronDown, Clock3, Copy, Info, Link2, LoaderCircle, Search, Share2, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, WandSparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import BuscaPorLink from "@/components/BuscaPorLink";
import { AvisoAfiliado, RodapeInstitucional } from "@/components/RodapeInstitucional";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIAS } from "@/content/categorias";
import { GUIAS } from "@/content/guias";
import { marcarConsultado, useConsultado } from "@/lib/cupons-consultados";
import { supabase } from "@/integrations/supabase/client";
import { ICONE_CATEGORIA, TOM_CATEGORIA } from "@/routes/categorias.index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cupons de Lojas Afiliadas — descubra o desconto real" },
      {
        name: "description",
        content:
          "Consulte o limite real, a compra mínima e as condições de cada cupom de afiliado.",
      },
      { property: "og:title", content: "Cupons de Lojas Afiliadas — descubra o desconto real" },
      {
        property: "og:description",
        content: "Compare o percentual anunciado com o teto real de desconto de cada cupom.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cupons-afiliado-ml.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://cupons-afiliado-ml.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Cupons de Lojas Afiliadas",
          url: "https://cupons-afiliado-ml.lovable.app/",
          inLanguage: "pt-BR",
          description:
            "Ferramenta independente para descobrir o desconto real de cupons, com teto e compra mínima informados.",
        }),
      },
    ],
  }),
  component: Index,
});

type Qualidade = "bom" | "armadilha";
export type Cupom = {
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
  /* A etiqueta do cupom: o codigo gerado no hub de afiliados, com o prefixo
     do Weslei (#WSLMENDES...). E a prova que a pessoa leva para o carrinho:
     ela cola, ve o desconto cair e sabe de onde veio. Null enquanto esse
     cupom nao tem etiqueta gerada. */
  codigo_cupom: string | null;
  /* false = a vitrine desse cupom esta sem nenhum produto no ar. O cupom
     existe e tem orcamento, mas nao ha item participante, entao o link cai
     numa lista vazia e o codigo nao aplica em nada. Cupom assim nao entra na
     vitrine do site: prometer desconto que nao da para usar e pior do que
     nao mostrar nada. null = ainda nao conferido. */
  vitrine_ok: boolean | null;
  vitrine_motivo: string | null;
  /* Link de afiliado da vitrine do cupom: a lista exata de produtos que aquele
     cupom cobre, ja com a etiqueta do Weslei. Gerado pela extensao uma vez por
     cupom e guardado no banco, entao chega pronto aqui. Null enquanto a fila
     nao chegou nesse cupom. */
  link_afiliado: string | null;
  /* Endereço PÚBLICO da loja no Mercado Livre, sem etiqueta nenhuma.
     É o que o botão abre agora. Ver o comentário do useLinkDaLoja. */
  link_origem: string | null;
  /* Página oficial da loja, do jeito que o próprio Mercado Livre a publica:
     https://lista.mercadolivre.com.br/pagina/<apelido-da-loja>/
     A extensão descobre esse endereço UMA vez por loja, seguindo o redirecionamento
     de _CustId_, e guarda aqui. Não dá para adivinhar: "Augustusmobiliario" mora em
     /pagina/augustusmvrc/ e "Sied20240106044007" em /pagina/k4p5vnd2/. Null enquanto
     a extensão não passou por essa loja. */
  link_loja: string | null;
};

export type CupomIndexado = Cupom & { chave: string; dias: number | null; score: number | null };
type Ordem = "score" | "desconto" | "teto" | "orcamento" | "termina" | "vendedor";
type Urgencia = "normal" | "atencao" | "urgente" | "ultimas" | "encerrado" | "sem-data";
type FaixaEconomia = "semlimite" | "ate50" | "50a200" | "200a1000" | "acima1000";
type EscolhaIa = { id: number; motivo: string };
type Comparacao = {
  vencedor_id: number | null;
  veredito: string;
  observacoes: string[];
  chamada: string;
  urgencia: string | null;
};

const FAIXAS: Array<{ id: FaixaEconomia; rotulo: string; aceita: (cupom: Cupom) => boolean }> = [
  { id: "semlimite", rotulo: "sem limite", aceita: (cupom) => semLimite(cupom) },
  { id: "ate50", rotulo: "até R$ 50", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! <= 50 },
  { id: "50a200", rotulo: "R$ 50 a R$ 200", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! > 50 && tetoReal(cupom)! <= 200 },
  { id: "200a1000", rotulo: "R$ 200 a R$ 1.000", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! > 200 && tetoReal(cupom)! <= 1000 },
  { id: "acima1000", rotulo: "acima de R$ 1.000", aceita: (cupom) => !semLimite(cupom) && tetoReal(cupom) != null && tetoReal(cupom)! > 1000 },
];

type EtiquetaId = "cometiqueta" | "termina24" | "termina48" | "semlimite" | "comprabaixa" | "economiaalta" | "semcompramin";

/** Etiquetas inteligentes: recortes prontos que respondem a intenções comuns. */
const ETIQUETAS: Array<{ id: EtiquetaId; rotulo: string; aceita: (cupom: Cupom, agora: number | null) => boolean }> = [
  // Primeiro da fila de proposito: e o unico atalho que muda o que a pessoa
  // leva embora, e nao so quais cupons ela ve.
  { id: "cometiqueta", rotulo: "Cupom com código gerado", aceita: (cupom) => Boolean(cupom.codigo_cupom) },
  { id: "termina24", rotulo: "Termina em 24h", aceita: (cupom, agora) => dentroDe(cupom, agora, 24) },
  { id: "termina48", rotulo: "Termina em 2 dias", aceita: (cupom, agora) => dentroDe(cupom, agora, 48) },
  { id: "semlimite", rotulo: "Desconto sem limite", aceita: (cupom) => semLimite(cupom) },
  { id: "economiaalta", rotulo: "Economia acima de R$ 200", aceita: (cupom) => semLimite(cupom) || (tetoUtil(cupom) ?? 0) > 200 },
  /* Cupom SEM compra minima passa neste filtro. Ele exigia compra_min preenchido,
     entao os cupons sem exigencia nenhuma - os melhores desse filtro - eram os
     unicos que ficavam de fora. */
  { id: "comprabaixa", rotulo: "Compra até R$ 50", aceita: (cupom) => (cupom.compra_min ?? 0) <= 50 },
  { id: "semcompramin", rotulo: "Sem compra mínima", aceita: (cupom) => cupom.compra_min == null || cupom.compra_min === 0 },
];

/** Sugestões que giram no campo da IA, para mostrar o que dá para pedir. */
const SUGESTOES_IA = [
  "presente para minha mãe até R$ 150",
  "fone de ouvido bom e barato",
  "itens de casa com desconto alto",
  "ração e petiscos para cachorro",
  "tênis para corrida até R$ 300",
  "ferramentas para reforma",
  "maquiagem e perfume",
  "suplemento de whey protein",
  "cadeira de escritório confortável",
  "brinquedo para criança de 5 anos",
];

const PAGE_SIZE = 50;
const SEM_CATEGORIA = "Sem categoria";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCurto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

/** Verdadeiro quando o cupom ainda vale e termina dentro das próximas `horas`. */
function dentroDe(cupom: Cupom, agora: number | null, horas: number) {
  if (agora == null || !cupom.vence) return false;
  const restante = fimDoDiaEmSaoPaulo(cupom.vence) - agora;
  return restante > 0 && restante <= horas * 3_600_000;
}

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
    return { texto: dias === 1 ? "Falta 1 dia" : `Faltam ${dias} dias`, urgencia: "normal" as Urgencia };
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

export function diasAte(data: string | null) {
  if (!data) return null;
  const hoje = new Date();
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((dataDoBanco(data).getTime() - hojeUtc) / 86400000);
}

/* Ordem dos melhores cupons.

   A versao anterior ranqueava pelo TETO anunciado: um cupom com "teto de
   R$ 50.000" ficava na frente de tudo mesmo descontando 2% com compra minima
   de R$ 10.000. Ou seja, a lista colocava em primeiro lugar exatamente o tipo
   de cupom que este site existe para denunciar.

   Agora o que manda e o desconto que a pessoa REALMENTE leva, medido na menor
   compra em que o cupom ja vale, e o quanto isso representa da compra. Dinheiro
   que ela e obrigada a gastar antes de ganhar qualquer coisa conta contra. */
export function calcularScore(cupom: Cupom, agora: number | null) {
  const minimo = cupom.compra_min ?? 0;
  /* Cesta de referencia: a menor compra em que este cupom funciona. Sem compra
     minima, R$ 200, que e um ticket comum. */
  const cesta = Math.max(minimo, 200);
  const desconto = descontoEm(cupom, cesta);
  if (!(desconto > 0)) return null;

  /* Quanto da compra volta para o cliente. E isso que faz um cupom ser bom. */
  const eficiencia = desconto / cesta;
  let score = eficiencia * 1000;

  /* Empurrao pelo valor absoluto, saturado: R$ 300 de desconto vale mais que
     R$ 30, mas nao trinta vezes mais. */
  score *= 1 + Math.min(desconto, 500) / 1000;

  /* Compra minima alta e barreira real, nao detalhe. */
  if (minimo > 200) score *= Math.max(0.35, 200 / minimo);

  /* Ja tem codigo gerado: da para usar agora, sem esperar nada. */
  if (cupom.codigo_cupom) score *= 1.25;
  /* Vitrine conferida com produto no ar. */
  if (cupom.vitrine_ok === true) score *= 1.15;
  /* Orcamento gordo: menos risco de acabar no meio do caminho. */
  if ((cupom.orcamento ?? 0) > 50_000) score *= 1.1;
  /* Vence hoje: pouco util para quem ainda vai escolher o produto. */
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
const COMPRA_INALCANCAVEL = 1_500;
/** Quantidade máxima de cupons que podem ser comparados de uma vez. */
const MAX_COMPARACAO = 3;

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

/** Sem limite de verdade: só quando o banco marcou assim ou não existe teto informado.
 *  Um teto alto continua sendo um teto — dizer "sem limite" quando existe limite de
 *  R$ 1.000 é impreciso, e é exatamente o tipo de meia verdade que este site combate. */
function semLimite(cupom: CupomLimite) {
  if (cupom.sem_teto === true) return true;
  // Desconto em reais já é o próprio limite: "R$ 30 OFF" desconta R$ 30, nunca mais.
  if (cupom.tipo !== "%") return false;
  return tetoReal(cupom) == null;
}

/** Existe teto, mas só se alcança numa compra grande. Continua sendo informado. */
function tetoFolgado(cupom: CupomLimite) {
  if (semLimite(cupom)) return false;
  const compra = compraParaAtingirTeto(cupom);
  return compra != null && compra > COMPRA_INALCANCAVEL;
}

/** O teto real, sempre que existir. Um limite folgado ainda é um limite.
 *  Em cupom de valor fixo, o próprio desconto é o teto. */
function tetoUtil(cupom: CupomLimite) {
  const teto = tetoReal(cupom);
  if (teto != null) return teto;
  if (cupom.tipo !== "%" && cupom.valor != null) return cupom.valor;
  return null;
}

/** Quanto a pessoa realmente economiza numa compra normal.
 *  Somar o teto quando ele só é alcançável numa compra enorme infla o número,
 *  e número inflado é exatamente o que este site existe para denunciar. */
function economiaRealista(cupom: Cupom) {
  if (semLimite(cupom) || tetoFolgado(cupom)) return descontoRealEm200(cupom);
  return tetoUtil(cupom) ?? descontoRealEm200(cupom);
}

function formatarTeto(cupom: CupomLimite) {
  if (semLimite(cupom)) return "sem limite de valor";
  const teto = tetoUtil(cupom);
  return teto == null ? "Limite não informado" : brl.format(teto);
}

/** Frase curta de economia, usada na curadoria e nos destaques.
 *  Teto de R$ 50.000 é verdade, mas anunciar isso parece defeito e não ajuda
 *  ninguém. Quando o teto só se alcança numa compra absurda, a gente diz isso
 *  com todas as letras e mantém o número à vista. */
function economiaCurta(cupom: Cupom) {
  if (semLimite(cupom)) return "Desconto sem limite de valor";
  const teto = tetoUtil(cupom);
  if (teto == null) return "Limite não informado";
  if (tetoFolgado(cupom)) return 'Desconto sem limite prático';
  return `Economize até ${brl.format(teto)}`;
}


/** "30% de desconto" quando o cupom é percentual; senão o texto cadastrado. */
function percentualTexto(cupom: Pick<Cupom, "tipo" | "valor" | "desconto">) {
  if (cupom.tipo === "%" && cupom.valor) {
    return `${cupom.valor.toLocaleString("pt-BR")}% de desconto`;
  }
  return cupom.desconto ?? "desconto não informado";
}

function descricaoCupom(cupom: Cupom) {
  const validade = cupom.vence ? dataCurta.format(dataDoBanco(cupom.vence)) : "não informada";
  const tetoCadastrado = tetoReal(cupom);
  return `ID ${cupom.id} - Cupom válido no Brasil, até ${validade}, incluindo ambas as datas, para compras de produtos realizadas no site e no aplicativo da plataforma. Válido apenas para os produtos selecionados e enquanto durarem os estoques. O cupom será aplicado automaticamente no carrinho elegível, sem necessidade de ativação pelo usuário. O cupom é aplicável apenas para compras mínimas de produtos selecionados cujo valor seja igual ou superior a ${formatarMoeda(cupom.compra_min)}. O cupom consiste em ${cupom.desconto ?? "desconto não informado"} sobre o valor da compra dos produtos selecionados. Não será aplicado sobre o custo de envio. O cupom é limitado a 1 (um) uso por CPF. ${tetoCadastrado != null ? `Máximo de desconto de ${brl.format(tetoCadastrado)}. ` : ""}Este cupom é de responsabilidade do vendedor dos produtos participantes.`;
}

function mensagemCompartilharCupom(cupom: Cupom, codigo: string, linkLoja: string) {
  const linhas = [
    "Olha o cupom que encontrei 👀",
    `Loja: ${cupom.vendedor}`,
    `Desconto: ${percentualTexto(cupom)}`,
  ];
  const limite = formatarTeto(cupom);
  if (limite === "sem limite de valor") linhas.push("Limite: sem limite de valor");
  else if (limite !== "Limite não informado") linhas.push(`Economia máxima: ${limite}`);
  /* compra_min zero e compra_min ausente sao a mesma coisa para quem le: nao ha
     minimo. Escrever "Compra minima: R$ 0,00" so confunde. */
  if (cupom.compra_min != null && cupom.compra_min > 0) {
    linhas.push(`Compra mínima: ${brl.format(cupom.compra_min)}`);
  }
  if (cupom.vence) linhas.push(`Válido até: ${dataCurta.format(dataDoBanco(cupom.vence))}`);
  linhas.push(
    `Ver produtos da loja: ${linkLoja}`,
    "",
    `No carrinho, use este código: ${codigo}`,
    "Se o carrinho já vier com um cupom da própria loja, remova ele e coloque este no lugar. O desconto é o mesmo e assim o achado fica registrado para mim.",
  );
  return linhas.join("\n");
}

function abrirWhatsApp(texto: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
}



/** Lê a resposta do servidor sem quebrar quando ela não vem em JSON (tempo limite, página de erro). */
async function lerJson(resposta: Response): Promise<Record<string, unknown>> {
  const texto = await resposta.text();
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return { erro: "O servidor demorou demais para responder. Tente novamente em instantes." };
  }
}

/* Sem WhatsApp no site: quem quer o cupom resolve sozinho.
   Todo botao que antes abria a conversa agora leva ao campo de colar o link,
   que e o unico caminho que gera o link de afiliado de verdade. */
/* Por que aqui NAO existe um botao "ver os produtos deste cupom"

   Eu tentei e nao funciona. O gerador de links de afiliado do Mercado Livre
   so preserva URL de PRODUTO. Se voce entrega a ele uma URL de listagem (a
   vitrine do cupom, a pagina da loja), ele aceita, devolve um meli.la, e esse
   link joga a pessoa no perfil social do afiliado com recomendacoes
   aleatorias de varias lojas - nao nos produtos daquele cupom. Testado em
   varios cupons: as vezes cai numa lista vazia, as vezes num feed generico.

   Ou seja: nao ha link de loja que ao mesmo tempo mostre os produtos certos e
   pague comissao. Entao o card nao promete isso. Ele manda a pessoa para o
   unico caminho que comprovadamente funciona: colar o link do produto que ela
   quer, que vira link de afiliado de verdade, com o cupom conferido. */
/* A etiqueta do cupom, com botao de copiar.

   Por que ela importa: o link da vitrine sozinho aplica o desconto no
   carrinho automaticamente, mas a pessoa nao ve de onde ele veio. Com a
   etiqueta ela cola o codigo, ve o valor cair na hora e fica com a certeza
   de que usou o cupom do Weslei. E prova, nao decoracao. */
function EtiquetaDoCupom({ codigo, vendedor }: { codigo: string; vendedor?: string | null }) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    const guardar = () => { setCopiado(true); window.setTimeout(() => setCopiado(false), 1800); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(codigo).then(guardar).catch(() => undefined);
      return;
    }
    // Navegador antigo ou sem permissao: seleciona para a pessoa copiar a mao.
    try {
      const campo = document.createElement("textarea");
      campo.value = codigo;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      document.execCommand("copy");
      document.body.removeChild(campo);
      guardar();
    } catch { /* deixa a pessoa selecionar na mao */ }
  }

  return (
    <div className="mt-3 rounded-md border border-dashed border-ml-blue/50 bg-ml-blue/5 p-2.5">
      <p className="text-[11px] font-semibold text-secondary-ink">Código deste cupom</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-card px-2 py-1 text-xs font-bold tracking-wide text-ml-blue">
          {codigo}
        </code>
        <button
          type="button"
          onClick={copiar}
          aria-label={`Copiar o código ${codigo}`}
          className="shrink-0 rounded border border-ml-blue px-2 py-1 text-[11px] font-bold text-ml-blue"
        >
          {copiado ? "copiado" : "copiar"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-secondary-ink">
        No carrinho, o Mercado Livre aceita <span className="font-bold">um cupom de loja por
        compra</span>. Se ele já tiver aplicado o cupom da própria loja, remova aquele e cole este
        no lugar: o desconto para você é o mesmo, e assim ele fica registrado por aqui. Se o
        carrinho não aceitar a troca, fique com o que já está aplicado, porque o valor final não
        muda{vendedor ? <> em produtos de <span className="font-bold">{vendedor}</span></> : ""}.
      </p>
    </div>
  );
}

function EsperaDoCupom({
  codigoPronto,
  linkPronto,
  somenteCodigo = false,
}: {
  codigoPronto: boolean;
  linkPronto: boolean;
  somenteCodigo?: boolean;
}) {
  const etapas = somenteCodigo
    ? [{ nome: "Gerando etiqueta", pronta: codigoPronto, atual: !codigoPronto }]
    : [
        { nome: "Gerando etiqueta", pronta: codigoPronto, atual: !codigoPronto },
        { nome: "Validando destino", pronta: linkPronto, atual: codigoPronto && !linkPronto },
        { nome: "Pronto para abrir", pronta: codigoPronto && linkPronto, atual: false },
      ];

  return (
    <div
      className="mt-2.5 overflow-hidden rounded-md border border-ml-blue/25 bg-ml-blue/5 p-3"
      role="status"
      aria-live="polite"
      aria-label={codigoPronto ? "Etiqueta pronta, preparando o destino" : "Gerando a etiqueta do cupom"}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-ml-blue">
        <LoaderCircle className="animate-giro-calmo size-4 shrink-0" aria-hidden="true" />
        <span>{codigoPronto ? "Etiqueta pronta. Só mais um instante…" : "Preparando seu cupom…"}</span>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-1.5" aria-hidden="true">
        {etapas.map((etapa, indice) => (
          <div key={etapa.nome} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold",
                etapa.pronta
                  ? "etapa-feita border-success bg-success text-primary-foreground"
                  : etapa.atual
                    ? "etapa-andando border-ml-blue bg-ml-blue text-ml-blue-foreground"
                    : "border-border bg-card text-secondary-ink",
              )}
            >
              {etapa.pronta ? <Check className="size-2.5" /> : indice + 1}
            </span>
            <span className={cn("min-w-0 text-[10px] leading-3", etapa.atual || etapa.pronta ? "font-semibold text-foreground" : "text-secondary-ink")}>
              {etapa.nome}
            </span>
            {indice < etapas.length - 1 && <span className="h-px min-w-2 flex-1 bg-border" />}
          </div>
        ))}
      </div>
      <div className="esqueleto mt-2.5 h-1.5 rounded-full" aria-hidden="true" />
      <p className="mt-2 text-[10px] leading-4 text-secondary-ink">
        Pode permanecer nesta página. Assim que tudo estiver confirmado, o próximo passo aparece automaticamente.
      </p>
    </div>
  );
}


/* Avisa a extensao que existe pedido novo.

   O alarme do Chrome nao roda em menos de 1 minuto, entao sem este aviso quem
   clica num botao do cartao fica ate 60 segundos esperando. O colar-link ja
   usava a ponte e responde em 3 segundos; os botoes do cartao nao usavam, e e
   essa a lentidao que o Weslei estava sentindo. */
function avisarExtensao(id: number) {
  if (typeof window === "undefined") return;
  try {
    window.postMessage({ de: "cupons-afiliado-ml", tipo: "pedido-novo", id }, window.location.origin);
  } catch { /* sem extensao: o alarme cobre */ }
}

/* Cupom sem codigo: a pessoa pede e espera aqui mesmo

   A ordem importa: o site resolve sozinho. Registra o pedido, a extensao gera
   em ate um minuto e o codigo aparece na tela. Se nao voltar a tempo, a pessoa
   tenta de novo aqui mesmo — nao existe contato como plano B. */
function PedirCodigo({ cupom }: { cupom: Cupom }) {
  const [fase, setFase] = useState<"parado" | "pedindo" | "pronto" | "demorou">("parado");
  const [codigo, setCodigo] = useState<string | null>(null);
  const relogios = useRef<number[]>([]);

  useEffect(() => () => { relogios.current.forEach((t) => window.clearTimeout(t)); }, []);

  async function pedir() {
    setFase("pedindo");
    try {
      const { data } = await supabase.rpc("pedir_etiqueta", { p_cupom_id: cupom.id });
      const resposta = String(data ?? "");
      if (resposta.startsWith("#")) { setCodigo(resposta); setFase("pronto"); return; }
      if (resposta !== "pedido") { setFase("demorou"); return; }
      avisarExtensao(cupom.id);
    } catch { setFase("demorou"); return; }

    // Pergunta a cada 4s por 88s. A extensao trabalha de minuto em minuto.
    const limite = Date.now() + 88_000;
    const olhar = async () => {
      try {
        const { data } = await supabase.rpc("consultar_etiqueta", { p_cupom_id: cupom.id });
        if (typeof data === "string" && data.startsWith("#")) { setCodigo(data); setFase("pronto"); return; }
      } catch { /* tenta de novo */ }
      if (Date.now() < limite) relogios.current.push(window.setTimeout(olhar, 4000));
      else setFase("demorou");
    };
    relogios.current.push(window.setTimeout(olhar, 4000));
  }

  if (fase === "pronto" && codigo) return <EtiquetaDoCupom codigo={codigo} vendedor={cupom.vendedor} />;

  return (
    <div className="mt-3 rounded-md border border-dashed border-border bg-muted/40 p-2.5">
      {fase === "pedindo" ? (
        <EsperaDoCupom codigoPronto={false} linkPronto={false} somenteCodigo />
      ) : fase === "demorou" ? (
        <>
          <p className="text-[11px] leading-relaxed text-secondary-ink">
            O código não ficou pronto agora. Tente de novo em instantes — normalmente sai na
            segunda tentativa. O desconto também entra sozinho no carrinho pelo botão acima.
          </p>
          <button
            type="button"
            onClick={() => void pedir()}
            className="mt-2 w-full rounded border border-ml-blue px-2.5 py-1.5 text-[11px] font-bold text-ml-blue transition-colors hover:bg-ml-blue/10"
          >
            Tentar de novo
          </button>
        </>
      ) : (
        <>
          <p className="text-[11px] font-semibold text-secondary-ink">Este cupom ainda não tem código</p>
          <button
            type="button"
            onClick={pedir}
            className="mt-1.5 w-full rounded border border-ml-blue px-2.5 py-1.5 text-[11px] font-bold text-ml-blue transition-colors hover:bg-ml-blue/10"
          >
            Gerar o código deste cupom
          </button>
        </>
      )}
    </div>
  );
}

/* Copia um texto e diz se conseguiu.

   Precisa rodar DENTRO do clique. Fora do gesto da pessoa o navegador bloqueia
   a área de transferência, e o código sairia "copiado" sem ter sido copiado. */
function copiarTexto(texto: string): boolean {
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* cai no plano B */ }
  try {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}

/* Gera (ou recupera) o código do cupom. O site registra o pedido e a extensão
   do Weslei cria o código no Mercado Livre em segundos. */
function useCodigoDoCupom(cupom: Cupom) {
  const [codigo, setCodigo] = useState<string | null>(cupom.codigo_cupom ?? null);
  const [gerando, setGerando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const relogios = useRef<number[]>([]);

  useEffect(() => () => { relogios.current.forEach((t) => window.clearTimeout(t)); }, []);

  const gerar = useCallback(async () => {
    if (codigo || gerando) return;
    setGerando(true);
    setFalhou(false);
    try {
      const { data } = await supabase.rpc("pedir_etiqueta", { p_cupom_id: cupom.id });
      const resposta = String(data ?? "");
      if (resposta.startsWith("#")) { setCodigo(resposta); setGerando(false); return; }
      if (resposta !== "pedido") { setGerando(false); setFalhou(true); return; }

    } catch {
      setGerando(false);
      setFalhou(true);
      return;
    }

    const limite = Date.now() + 88_000;
    const olhar = async () => {
      try {
        const { data } = await supabase.rpc("consultar_etiqueta", { p_cupom_id: cupom.id });
        if (typeof data === "string" && data.startsWith("#")) {
          setCodigo(data);
          setGerando(false);
          return;
        }
      } catch { /* tenta de novo */ }
      if (Date.now() < limite) relogios.current.push(window.setTimeout(olhar, 3000));
      else { setGerando(false); setFalhou(true); }
    };
    relogios.current.push(window.setTimeout(olhar, 3000));
  }, [codigo, gerando, cupom.id]);

  return { codigo, gerando, falhou, gerar };
}

/** ENDEREÇO DA LISTA DE PRODUTOS DA LOJA.
 *
 *  O botão "Ver itens da loja" tem que abrir a prateleira de quem oferece o
 *  cupom. Nunca o perfil do Weslei, nunca o campo de colar link.
 *
 *  A ordem aqui não é preferência de estilo, é confiabilidade medida:
 *
 *  1. link_loja — a página oficial da loja, descoberta pela extensão seguindo o
 *     redirecionamento do próprio Mercado Livre. É a melhor: tem nome, marca e
 *     vitrine da loja.
 *
 *  2. _CustId_<id> montado a partir do link da campanha. O número do vendedor
 *     já vem escrito na origem do cupom, em duas formas:
 *        .../_CustId_2615738264?coupon_campaign_id=...
 *        .../_Container_Queima-de-Estoque-seller-1789666895?coupon_campaign_id=...
 *     Abrir /_CustId_<id> cai na lista de anúncios daquele vendedor, e quando a
 *     loja tem página própria o Mercado Livre redireciona sozinho para ela.
 *
 *  POR QUE NÃO ADIVINHAR O APELIDO DA LOJA: testei em lojas reais do banco.
 *  "Augustusmobiliario" mora em /pagina/augustusmvrc/, e "Sied20240106044007" em
 *  /pagina/k4p5vnd2/ — nada a ver com o nome. Montar /pagina/ a partir do nome do
 *  vendedor acertaria em parte das lojas e, no resto, jogaria o cliente numa
 *  BUSCA por aquele texto, com produtos de outras lojas no meio. O número do
 *  vendedor não erra. */
export function paginaDaLoja(cupom: Cupom): string | null {
  const guardada = (cupom.link_loja ?? "").trim();
  /* Aceita so o formato de vitrine. Se algum dia entrar lixo nessa coluna, o
     botao ignora em vez de levar o cliente para o lugar errado. */
  const ehVitrine = /^https:\/\/(www|lista)\.mercadolivre\.com\.br\/(pagina\/[A-Za-z0-9._%-]{2,60}\/?|_CustId_\d{4,})$/.test(guardada);
  if (guardada && ehVitrine) return guardada;

  const origem = (cupom.link_origem ?? "").trim();
  if (!origem) return null;

  /* _CustId_<numero> e o vendedor de verdade. Abrir esse endereco cai na lista
     de anuncios dele, e quando a loja tem pagina propria o Mercado Livre
     redireciona sozinho. Conferido em 4 lojas, 4 acertos. */
  const vendedor = origem.match(/_CustId_(\d{4,})/i)?.[1] ?? null;
  if (vendedor) return `https://lista.mercadolivre.com.br/_CustId_${vendedor}`;

  /* _Container_...-seller-<numero> NAO carrega o numero do vendedor.

     Eu tinha lido esse numero como se fosse o vendedor, e estava errado. A
     prova esta no banco: a loja Pezzia tem dois cupons, um com seller-1789655247
     e outro com seller-1789657149. Mesma loja, numeros diferentes. Sao ids da
     CAMPANHA, nao do vendedor. Montar /_CustId_ com eles abre pagina vazia,
     "Nao encontramos resultados".

     O endereco certo aqui e o proprio _Container_, que JA e a lista dos produtos
     que aquele cupom cobre. Testado: o container ChaDesc-seller-1789657149 abre
     com 1 resultado, a Chaleira Eletrica Fressa. E exatamente o unico produto
     onde esse cupom vale.

     Mandar o cliente para a loja inteira nesse caso seria pior que inutil:
     prometeria desconto em item que o cupom nao cobre. */
  if (/_Container_/i.test(origem)) {
    /* Sem o parametro de campanha, que nao muda a lista e so suja a URL. */
    return origem.split("?")[0] ?? origem;
  }

  return null;
}

/* O endereço da loja NÃO precisa ser link de afiliado.

   Quem paga a comissão aqui é a etiqueta: o código #WSLMENDES... que a pessoa
   cola no carrinho. Com ele a venda já é atribuída, então o botão pode abrir a
   loja por um endereço público comum do Mercado Livre.

   Isso resolve de vez o pior bug do projeto. Antes o site tentava transformar a
   página da loja em link de afiliado, e o gerador do Mercado Livre não preserva
   endereço de listagem: devolvia um meli.la que jogava o comprador no perfil
   social do Weslei, às vezes numa página de erro (XMEHV37590). Medido hoje em
   três cupons, três vezes o mesmo desfecho.

   Testado agora, sem etiqueta nenhuma na URL:
     lista.mercadolivre.com.br/_CustId_3152110291  ->  152 resultados da loja

   Então: nada de gerar, nada de esperar, nada que possa falhar. O endereço já
   está no banco, veio do próprio hub de cupons, e é só abrir.

   Quando o cupom não tem esse endereço guardado, o botão não promete loja
   nenhuma. Chutar a URL pelo nome de exibição da loja leva a página inexistente
   quando o nome público difere do usado no endereço. */
function useLinkDaLoja(cupom: Cupom) {
  /* CORREÇÃO IMPORTANTE, 22/09 à noite.

     Por uma hora este botão abriu o endereço público da loja, sem etiqueta. A
     ideia era que o código do cupom garantiria a comissão. O checkout provou
     que não:

       "Cupons (1/1 em uso)" — o cupom da própria loja entra sozinho e ocupa a
       única vaga. O código do Weslei, que é a versão dele DO MESMO cupom, é
       recusado com "Ocorreu um erro".

     Ou seja: o cupom da loja compete com o dele. Quando entra sozinho, o
     código não tem como ser usado, e mandar o cliente por um endereço sem
     etiqueta seria entregar a venda de graça.

     Então a atribuição volta a depender do que sempre funcionou: o clique num
     link de afiliado. Só que o gerador do Mercado Livre não preserva qualquer
     listagem — só a campanha _Container_ do próprio cupom. É exatamente essa
     a origem dos links que sobraram no banco, os outros foram apagados.

     Sem link de afiliado guardado, o botão não abre loja nenhuma. É melhor não
     ter botão do que ter um que não paga o Weslei. O caminho nesse caso é
     colar o link do produto, que gera link de afiliado de verdade. */
  const guardado = (cupom.link_afiliado ?? "").trim() || null;
  const origemBruta = (cupom.link_origem ?? "").trim() || null;

  /* O perfil social do Weslei NUNCA serve de destino: é uma vitrine com
     produtos de lojas variadas, e quem clicou quer ESTA loja. Link de afiliado
     gerado a partir de listagem que o Mercado Livre não preserva cai
     exatamente lá, e foi por isso que esses foram apagados do banco. */
  /* O LINK DE AFILIADO NAO SERVE MAIS DE DESTINO DESTE BOTAO.

     O Weslei fotografou o resultado: clicou num cupom de loja e caiu no proprio
     perfil dele, WSLMENDES, com uma chaleira eletrica de R$ 349,90 na tela. Nada
     a ver com a loja do cupom.

     A causa: os 113 links de afiliado guardados no banco sao TODOS encurtados
     (meli.la/xxxx). Encurtado quer dizer opaco: daqui nao da para saber para
     onde ele vai. Quando a geracao falhou, o Mercado Livre devolveu um meli.la
     que aponta para o perfil social, e o filtro de /perfil/ e /social/ passa
     batido porque a palavra nao esta na URL curta.

     Conferido no banco antes de mexer: os 113 cupons com link encurtado tem, sem
     excecao, o numero do vendedor escrito no link da campanha. Ou seja, da para
     montar o endereco real da loja para TODOS eles. Nao se perde nada trocando.

     A comissao continua: ela vem da etiqueta #WSLMENDES... que a pessoa cola no
     carrinho, como o proprio Weslei disse. Endereco publico da loja + etiqueta
     no checkout resolve, e nao tem como cair no perfil dele. */
  const ehPerfil = (u: string | null) => !!u && /\/social\/|\/perfil\//i.test(u);

  /* Endereco de PRODUTO nao e vitrine. /p/MLB..., /up/MLBU..., MLB-123456789 e
     qualquer coisa com item_id levam a um anuncio so, e quem clicou no cupom
     queria a prateleira inteira. Foi a outra metade da reclamacao. */
  const ehProduto = (u: string | null) =>
    !!u && /\/p\/MLB|\/up\/MLB|\/MLB-\d{6,}|item_id/i.test(u);

  /* meli.la esconde o destino. Sem saber para onde vai, nao entra. */
  const ehEncurtado = (u: string | null) => !!u && /meli\.la\//i.test(u);

  const naoServe = (u: string | null) => ehPerfil(u) || ehProduto(u) || ehEncurtado(u);

  const origem = naoServe(origemBruta) ? null : origemBruta;
  const vitrineDaLoja = paginaDaLoja(cupom);
  const destinoBase = vitrineDaLoja || origem || (naoServe(guardado) ? null : guardado);

  /* Origem que o gerador do Mercado Livre preserva. O banco recusa as outras
     em pedir_link, entao nem adianta pedir link novo para elas. */
  const podeGerar = /_Container_/i.test(origem ?? "");

  /* EU TINHA COMPLICADO ISTO.

     Eu vinha escondendo o botao quando nao havia link de afiliado, com medo de
     entregar a venda sem comissao. O raciocinio estava errado, e o Weslei tem
     razao: quando a comissao nao vem pelo link, vem pela ETIQUETA. O codigo do
     cupom e a versao dele do cupom da loja, e e o codigo que carrega a
     atribuicao no checkout.

     Entao o botao sempre leva a pessoa para a loja que oferece o cupom, que e
     o unico destino que faz sentido: link de afiliado quando existe, e a
     propria campanha do cupom quando nao existe. Mandar alguem rolar a pagina
     para colar um link de anuncio que ela ainda nem escolheu era absurdo. */
  const [link, setLink] = useState<string | null>(destinoBase);
  const [gerando, setGerando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const relogios = useRef<number[]>([]);

  useEffect(() => { setLink(destinoBase); }, [destinoBase]);
  useEffect(() => () => { relogios.current.forEach((t) => window.clearTimeout(t)); }, []);

  /* AQUI ESTAVA UMA FUNCAO VAZIA.

     O botao "Usar este cupom" chamava isto quando o cupom nao tinha link
     guardado, e isto nao fazia nada: nenhuma loja abria, nenhum erro aparecia.
     Agora pede a geracao na hora, igual ja acontecia com o codigo do cupom: o
     site registra o pedido, a extensao gera em ate um minuto e o link chega. */
  const gerar = useCallback(async () => {
    if (!podeGerar || gerando || !origem) return;
    setGerando(true);
    setFalhou(false);
    try {
      const { data, error } = await supabase.rpc("pedir_link", { p_url: origem });
      if (error || data == null) { setGerando(false); setFalhou(true); return; }
      const id = Number(data);
      avisarExtensao(id);

      const limite = Date.now() + 88_000;
      const olhar = async () => {
        try {
          const { data: bruto } = await supabase.rpc("consultar_pedido", { p_id: id });
          const linha = (Array.isArray(bruto) ? bruto[0] : bruto) as
            { status?: string; link?: string | null } | null;
          if (linha?.status === "pronto" && linha.link) {
            setLink(linha.link);
            setGerando(false);
            return;
          }
          if (linha?.status === "falhou") { setGerando(false); setFalhou(true); return; }
        } catch { /* tenta de novo */ }
        if (Date.now() < limite) relogios.current.push(window.setTimeout(olhar, 4000));
        else { setGerando(false); setFalhou(true); }
      };
      relogios.current.push(window.setTimeout(olhar, 4000));
    } catch {
      setGerando(false);
      setFalhou(true);
    }
  }, [origem, podeGerar, gerando]);

  return { link, gerando, falhou, gerar, podeGerar };
}

/* "Usar este cupom" faz as três coisas de uma vez: copia o código para a área
   de transferência e abre a loja no Mercado Livre, para a pessoa só colar.

   Por que copiar ANTES de abrir a aba: a cópia só é permitida durante o
   clique. Se a gente abrisse a aba primeiro, ou esperasse qualquer resposta de
   servidor no meio, o navegador cancelaria a cópia e a pessoa chegaria na loja
   sem o código.

   Quando o cupom ainda não tem código, o primeiro clique cria o código (isso
   leva segundos e não cabe dentro do gesto) e o botão então passa a fazer tudo
   de uma vez. O texto embaixo do botão sempre diz o que vai acontecer, para
   ninguém clicar às cegas. */
export function AcaoDoCupom({
  cupom,
  className,
  iconeClassName,
}: {
  cupom: Cupom;
  className?: string;
  iconeClassName?: string;
}) {
  const { codigo, gerando, falhou, gerar } = useCodigoDoCupom(cupom);
  const loja = useLinkDaLoja(cupom);
  const consultado = useConsultado(cupom.id);
  const [copiou, setCopiou] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [redirecionando, setRedirecionando] = useState(false);
  const redirecionamento = useRef<number | null>(null);
  const icone = iconeClassName ?? "size-4 shrink-0";

  useEffect(
    () => () => {
      if (redirecionamento.current) window.clearTimeout(redirecionamento.current);
    },
    [],
  );

  /* Só abre um endereço que a extensão realmente gerou e validou. Montar uma
     vitrine usando o nome exibido da loja leva a páginas inexistentes quando o
     nome público não é o slug usado no endereço. */
  const destino = loja.link;

  const abrir = useCallback(
    (codigoPronto?: string | null) => {
      if (!destino) return;
      if (codigoPronto) setCopiou(copiarTexto(codigoPronto));
      marcarConsultado(cupom.id);
      setRedirecionando(true);
      /* A pequena pausa mantém a confirmação visível e preserva a animação do
         cartão. A navegação na própria aba não é bloqueada pelo navegador e
         também permite que o endereço abra no aplicativo quando disponível. */
      redirecionamento.current = window.setTimeout(() => {
        window.location.assign(destino);
      }, 700);
    },
    [destino, cupom.id],
  );

  /* A LOJA ABRE NA HORA. O CODIGO ALCANCA A PESSOA DEPOIS.

     Este era o funil vazando. O cartao esperava o codigo ficar pronto ANTES de
     abrir a loja: ate 88 segundos parado num botao girando, e no fim das contas
     quase sempre sem codigo, porque so 90 dos 972 cupons tem codigo guardado.
     Quem chega no site clica, espera, desiste. Visita que nao vira nem visita a
     loja nao vira venda nenhuma.

     Trocado: o clique leva a pessoa para a prateleira da loja imediatamente, que
     e o passo que comeca a compra. O codigo continua sendo gerado atras, e quando
     fica pronto aparece no cartao para ela copiar antes de fechar o carrinho -
     e ela leva minutos escolhendo produto, entao chega bem antes do checkout.

     Vale a troca? O codigo carrega a atribuicao, entao esperar por ele parece
     proteger a comissao. Mas esperar estava entregando as duas coisas zeradas:
     sem venda e sem comissao. Loja aberta agora, codigo em seguida, e o unico
     arranjo em que as duas ainda podem acontecer. */
  useEffect(() => {
    if (!esperando || !destino) return;
    setEsperando(false);
    abrir(codigo);
  }, [esperando, destino, codigo, abrir]);

  useEffect(() => {
    if (!compartilhando || gerando || !codigo || !destino) return;
    setCompartilhando(false);
    abrirWhatsApp(mensagemCompartilharCupom(cupom, codigo, destino));
  }, [compartilhando, gerando, codigo, destino, cupom]);

  const jaTem = Boolean(codigo);

  /* SEM LINK DE AFILIADO NAO EXISTE BOTAO.

     Este era o defeito mais visivel do site. 901 dos 975 cupons bons estao sem
     link guardado, e o botao "Usar este cupom" aparecia em todos eles. Clicar
     chamava uma funcao vazia: nada acontecia, nenhuma loja abria, nenhum erro
     era mostrado. Nove em cada dez cartoes tinham um botao morto.

     Sem link, o caminho que funciona de verdade e colar o link do produto: dali
     sai link de afiliado valido e o cupom e conferido naquele anuncio. Entao e
     isso que o cartao oferece, com o texto dizendo a verdade. */
  if (!destino) {
    return (
      <Button
        type="button"
        onClick={irParaColarLink}
        className={className}
        variant="outline"
      >
        <Link2 className={icone} aria-hidden="true" />
        Conferir num produto desta loja
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={() => {
          /* Com codigo pronto: copia e abre, tudo no mesmo clique.
             Sem codigo: abre a loja do mesmo jeito e pede o codigo em paralelo.
             O que NAO acontece mais e a pessoa ficar presa esperando. */
          if (!jaTem) void gerar();
          setEsperando(true);
        }}
        disabled={redirecionando}
        aria-busy={redirecionando}
        className={className}
      >
        {redirecionando ? (
          <LoaderCircle className={cn(icone, "animate-giro-calmo")} aria-hidden="true" />
        ) : consultado ? (
          <Check className={icone} aria-hidden="true" />
        ) : (
          <Link2 className={icone} aria-hidden="true" />
        )}
        {redirecionando
          ? codigo ? "Copiado! Abrindo a loja..." : "Abrindo a loja..."
          : consultado
            ? "Ver os produtos da loja de novo"
            : "Ver os produtos desta loja"}
      </Button>
      {destino && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (codigo) {
              abrirWhatsApp(mensagemCompartilharCupom(cupom, codigo, destino));
              return;
            }
            setCompartilhando(true);
            void gerar();
          }}
          disabled={redirecionando}
          aria-busy={compartilhando && gerando}
          className="mt-2 h-auto min-h-11 w-full whitespace-normal border-ml-blue/40 px-3 py-2 text-sm font-bold text-ml-blue hover:bg-ml-blue/5"
        >
          {compartilhando && gerando ? (
            <LoaderCircle className="animate-giro-calmo size-4" aria-hidden="true" />
          ) : (
            <Share2 className="size-4" aria-hidden="true" />
          )}
          {compartilhando && gerando ? "Preparando para compartilhar…" : "Compartilhar cupom no WhatsApp"}
        </Button>
      )}
      {(gerando || loja.gerando) && (
        <EsperaDoCupom codigoPronto={Boolean(codigo)} linkPronto={Boolean(destino)} />
      )}
      {consultado && !redirecionando && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-success">
          <Check className="size-3 shrink-0" aria-hidden="true" />
          Você já abriu este cupom. Pode abrir quantas vezes quiser.
        </p>
      )}
      <p className="mt-1.5 text-[11px] leading-4 text-secondary-ink" aria-live="polite">
        {gerando || loja.gerando ? (
          codigo
            ? "Seu código já está pronto. Estou localizando a página correta da loja para abrir sem erro."
            : "Estou criando seu código e localizando a página correta da loja."
        ) : redirecionando && codigo ? (
          <>
            <span className="font-bold text-success">Abrindo a loja.</span> O desconto entra
            sozinho no carrinho. O código {codigo} ficou copiado, só para emergência.
          </>
        ) : codigo ? (
          <>
            Abre a loja com o desconto já valendo no carrinho. Você não precisa digitar nada.
          </>
        ) : falhou || loja.falhou ? (
          "Não consegui criar o código agora. Dá para abrir a loja assim mesmo: o desconto entra sozinho no carrinho."
        ) : (
          "Cria o código do cupom, copia para você e abre a loja."
        )}
      </p>
      {/* Aqui existiam MAIS DOIS lugares mostrando o mesmo codigo: um link
          "Copiar o codigo #X" e uma segunda caixa identica a que o card ja
          mostra logo abaixo. Tres copias do mesmo codigo na mesma tela, e o
          cliente sem saber qual valia. Sobra uma so, a caixa de baixo, com o
          botao de copiar. Aqui fica apenas a confirmacao de uma linha, quando
          o proprio botao acima copiou. */}
      {codigo && copiou && (
        <p className="mt-1.5 animate-scale-in text-[11px] font-bold text-success">
          Código copiado.
        </p>
      )}
    </>
  );
}

function irParaColarLink() {
  if (typeof document === "undefined") return;
  document.getElementById("colar-link")?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    const campo = document.getElementById("campo-link-produto");
    if (campo instanceof HTMLTextAreaElement || campo instanceof HTMLInputElement) campo.focus();
  }, 450);
}

function descontoRealEm200(cupom: Cupom) {
  return descontoEm(cupom, 200);
}

/** Quanto este cupom desconta numa compra de X reais. Abaixo da compra mínima
 *  o cupom simplesmente não entra, e dizer isso é mais útil que mostrar um
 *  desconto que a pessoa não vai receber. */
function descontoEm(cupom: Cupom, valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  if (cupom.compra_min != null && valor < cupom.compra_min) return 0;
  const teto = tetoReal(cupom) ?? Number.POSITIVE_INFINITY;
  const bruto = cupom.tipo === "%" ? valor * ((cupom.valor ?? 0) / 100) : (cupom.valor ?? 0);
  return Math.max(0, Math.min(bruto, teto, valor));
}

/** Valor de partida da calculadora.
 *  Nunca um número aleatório: parte da compra mínima do próprio cupom, que é a
 *  primeira quantia em que ele passa a valer. Sem compra mínima, R$ 200, que é
 *  um ticket comum e redondo. */
function valorInicialDaCalculadora(cupom: Cupom): number {
  const min = cupom.compra_min ?? null;
  if (min != null && min > 0) return Math.max(min, 10);
  return 200;
}

async function carregarCupons(): Promise<Cupom[]> {
  const todos: Cupom[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await supabase
      .from("cupons")
      .select(
        "id,vendedor,desconto,tipo,valor,orcamento,vence,busca,compra_min,teto,sem_teto,qualidade,categoria,updated_at,link_afiliado,link_origem,link_loja,codigo_cupom,vitrine_ok,vitrine_motivo",
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
    /* Tenta sem desistir: melhor a lista demorar do que a pessoa ver um erro. */
    retry: 10,
    retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 15_000),
    refetchInterval: (consulta) => (consulta.state.error ? 10_000 : false),
  });
  const cupons = useMemo(() => data ?? [], [data]);

  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  const [vitrine, setVitrine] = useState<"recomendados" | "todos">("recomendados");
  /* Os filtros nascem abertos: esconde-los fez a lista de lojas, categorias e
     faixas de economia sumirem aos olhos de quem chega. */
  const [painelAberto, setPainelAberto] = useState(true);
  const [tipo, setTipo] = useState<"todos" | "%" | "R$">("todos");
  const [descontoMin, setDescontoMin] = useState("");
  const [orcamentoMin, setOrcamentoMin] = useState("");
  const [tetoMin, setTetoMin] = useState("");
  const [compraMax, setCompraMax] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("score");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [lojas, setLojas] = useState<string[]>([]);
  const [faixas, setFaixas] = useState<FaixaEconomia[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaId[]>([]);
  const [sugestao, setSugestao] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cupomAberto, setCupomAberto] = useState<CupomIndexado | null>(null);
  const [agora, setAgora] = useState<number | null>(null);
  const [pedidoIa, setPedidoIa] = useState("");
  const [consultaIa, setConsultaIa] = useState("");
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
    const intervalo = window.setInterval(() => setSugestao((atual) => (atual + 1) % SUGESTOES_IA.length), 4_000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [termo, vitrine, tipo, descontoMin, orcamentoMin, tetoMin, compraMax, ordem, categorias, faixas, lojas]);

  const indexado = useMemo(() => {
    const preparados = cupons.map((c) => ({
      ...c,
      chave: normalizar(c.busca ?? c.vendedor ?? ""),
      dias: diasAte(c.vence),
      score: calcularScore(c, agora),
    }));
    // Remove cupons duplicados (mesma loja + mesmo desconto), ficando com o de melhor score
    const unicos = new Map<string, (typeof preparados)[number]>();
    for (const cupom of preparados) {
      const chaveUnica = `${cupom.chave}|${normalizar(cupom.desconto ?? "")}`;
      const existente = unicos.get(chaveUnica);
      if (!existente || (cupom.score ?? -1) > (existente.score ?? -1)) unicos.set(chaveUnica, cupom);
    }
    return [...unicos.values()];
  }, [cupons, agora]);

  const termos = useMemo(
    () =>
      termo
        .split(",")
        .map((item) => normalizar(item))
        .filter(Boolean),
    [termo],
  );

  /* Um unico lugar decide se um cupom entra na lista.

     Existe para que a CONTAGEM dos filtros use exatamente a mesma regra da
     lista. Antes os numerinhos nos chips eram contados sobre o catalogo
     inteiro: o chip dizia "sem limite (4540)", a pessoa clicava e recebia
     "Nenhum resultado para esses filtros". O numero nao estava errado por
     pouco, estava respondendo a outra pergunta. Passando `ignorar`, o chip
     conta quantos cupons sobrariam se aquele filtro fosse aplicado agora,
     junto com os que ja estao ligados. */
  const passaNosFiltros = useCallback(
    (cupom: CupomIndexado, ignorar?: "faixas" | "etiquetas") => {
      const dMin = Number(descontoMin) || 0;
      const oMin = Number(orcamentoMin) || 0;
      const tMin = Number(tetoMin) || 0;
      const cMax = compraMax === "" ? null : Number(compraMax);
      const buscaAtiva = termos.length > 0 || lojas.length > 0;
      if (lojas.length && !lojas.includes(cupom.vendedor)) return false;
      if (!buscaAtiva && vitrine === "recomendados" && cupom.qualidade !== "bom") return false;
      /* Vitrine vazia: o cupom existe mas nao ha produto participante no ar, o
         link cai numa lista vazia e o codigo nao aplica em nada.

         So esconde quando existe MOTIVO gravado. Veredito sem motivo veio da
         versao da extensao que marcava "vazia" sempre que nao conseguia
         descobrir a URL da vitrine, e isso chegou a esconder 637 dos 978
         cupons bons e 85 dos 86 que ja tinham etiqueta. Nao saber nao e a
         mesma coisa que saber que esta vazia. */
      if (cupom.vitrine_ok === false && cupom.vitrine_motivo != null && !buscaAtiva) return false;
      if (tipo !== "todos" && cupom.tipo !== tipo) return false;
      if (dMin && (cupom.valor ?? 0) < dMin) return false;
      if (oMin && (cupom.orcamento ?? 0) < oMin) return false;
      if (tMin && (tetoReal(cupom) ?? 0) < tMin) return false;
      /* Sem compra minima = minimo zero, e zero cabe em qualquer teto. */
      if (cMax !== null && (cupom.compra_min ?? 0) > cMax) return false;
      if (!lojas.length && termos.length && !termos.some((item) => cupom.chave.includes(item))) return false;
      if (categorias.length && !categorias.includes(cupom.categoria ?? SEM_CATEGORIA)) return false;
      if (ignorar !== "faixas" && faixas.length
        && !FAIXAS.some((faixa) => faixas.includes(faixa.id) && faixa.aceita(cupom))) return false;
      if (ignorar !== "etiquetas" && etiquetas.length
        && !ETIQUETAS.some((etiqueta) => etiquetas.includes(etiqueta.id) && etiqueta.aceita(cupom, agora))) return false;
      return true;
    },
    [termos, lojas, vitrine, tipo, descontoMin, orcamentoMin, tetoMin, compraMax, categorias, faixas, etiquetas, agora],
  );

  const filtrados = useMemo(() => {
    const lista = indexado.filter((cupom) => passaNosFiltros(cupom));

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
  }, [indexado, passaNosFiltros, ordem, agora]);

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
    () => cupomSelecionados.reduce((total, cupom) => total + economiaRealista(cupom), 0),
    [cupomSelecionados],
  );
  const armadilhasDaBusca = useMemo(
    () => (termos.length ? filtrados.filter((cupom) => cupom.qualidade === "armadilha") : []),
    [filtrados, termos.length],
  );

  const categoriasDisponiveis = useMemo(() => {
    const contagens = new Map<string, number>();
    indexado.forEach((cupom) => {
      const nome = cupom.categoria ?? SEM_CATEGORIA;
      contagens.set(nome, (contagens.get(nome) ?? 0) + 1);
    });
    return [...contagens.entries()].sort(([a, qa], [b, qb]) => {
      if (a === SEM_CATEGORIA) return 1;
      if (b === SEM_CATEGORIA) return -1;
      return qb - qa || a.localeCompare(b, "pt-BR");
    });
  }, [indexado]);

  const lojasDisponiveis = useMemo(() => {
    const contagens = new Map<string, number>();
    indexado.forEach((cupom) => contagens.set(cupom.vendedor, (contagens.get(cupom.vendedor) ?? 0) + 1));
    return [...contagens.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [indexado]);

  /* Lojas com mais cupons: viram atalhos visiveis, sem precisar abrir nada. */
  const lojasDestaque = useMemo(
    () => [...lojasDisponiveis].sort(([a, qa], [b, qb]) => qb - qa || a.localeCompare(b, "pt-BR")).slice(0, 14),
    [lojasDisponiveis],
  );

  const lojasFiltradas = useMemo(() => {
    const busca = normalizar(texto);
    const lista = busca ? lojasDisponiveis.filter(([nome]) => normalizar(nome).includes(busca)) : lojasDisponiveis;
    return lista.slice(0, 80);
  }, [lojasDisponiveis, texto]);
  /* Cada numero responde: "se eu ligar este chip agora, quantos cupons sobram?" */
  const contagensFaixa = useMemo(() => {
    const base = indexado.filter((cupom) => passaNosFiltros(cupom, "faixas"));
    return new Map(FAIXAS.map((faixa) => [faixa.id, base.filter((cupom) => faixa.aceita(cupom)).length]));
  }, [indexado, passaNosFiltros]);
  const contagensEtiqueta = useMemo(() => {
    const base = indexado.filter((cupom) => passaNosFiltros(cupom, "etiquetas"));
    return new Map(
      ETIQUETAS.map((etiqueta) => [etiqueta.id, base.filter((cupom) => etiqueta.aceita(cupom, agora)).length]),
    );
  }, [indexado, passaNosFiltros, agora]);
  const filtrosAtivos = Boolean(texto || lojas.length || tipo !== "todos" || descontoMin || orcamentoMin || tetoMin || compraMax || categorias.length || faixas.length || etiquetas.length || vitrine !== "recomendados" || ordem !== "score");

  /* Quantos filtros a pessoa ligou. Vira o numerinho no botao "Filtros", que e
     o que faz ela lembrar que a lista esta cortada — o problema classico de
     esconder filtro atras de um botao. */
  const quantosFiltros =
    (texto ? 1 : 0) + lojas.length + (tipo !== "todos" ? 1 : 0) +
    (descontoMin ? 1 : 0) + (orcamentoMin ? 1 : 0) + (tetoMin ? 1 : 0) +
    (compraMax ? 1 : 0) + categorias.length + faixas.length + etiquetas.length;

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const indicadores = useMemo(() => {
    const vendedores = new Set(indexado.map((cupom) => cupom.vendedor));
    const bons = indexado.filter((cupom) => cupom.qualidade === "bom").length;
    const armadilhas = indexado.filter((cupom) => cupom.qualidade === "armadilha").length;
    const conferidos = bons + armadilhas;
    /* "Tem produto no ar" é a última peneira: de nada adianta o cupom ser bom
       se a loja está sem nenhum item à venda — o código não aplica em nada.
       Só conta quem já foi conferido de verdade (true), nunca quem ainda está
       na fila (null). */
    const comProduto = indexado.filter(
      (cupom) => cupom.qualidade === "bom" && cupom.vitrine_ok === true,
    ).length;
    const vitrineNaFila = indexado.filter(
      (cupom) => cupom.qualidade === "bom" && cupom.vitrine_ok == null,
    ).length;
    return {
      total: indexado.length,
      analisados: cupons.length,
      repetidos: Math.max(0, cupons.length - indexado.length),
      vendedores: vendedores.size,
      bons,
      armadilhas,
      conferidos,
      comProduto,
      vitrineNaFila,
      naFila: Math.max(0, indexado.length - conferidos),
      aproveitamento: conferidos > 0 ? Math.round((bons / conferidos) * 100) : null,
    };
  }, [indexado, cupons]);

  /** Curadoria: o melhor cupom de cada categoria, pela pontuação de oportunidade. */
  const destaques = useMemo(() => {
    const melhores = new Map<string, CupomIndexado>();
    indexado
      .filter((cupom) => cupom.qualidade === "bom" && contagemRegressiva(cupom.vence, agora).urgencia !== "encerrado")
      .forEach((cupom) => {
        const categoria = cupom.categoria ?? SEM_CATEGORIA;
        const atual = melhores.get(categoria);
        if (!atual || (cupom.score ?? -1) > (atual.score ?? -1)) melhores.set(categoria, cupom);
      });
    return [...melhores.entries()]
      .filter(([categoria]) => categoria !== SEM_CATEGORIA)
      .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))
      .slice(0, 6);
  }, [indexado, agora]);


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

  function alternarSelecao(id: number) {
    setSelecionados((atuais) => {
      if (atuais.includes(id)) return atuais.filter((item) => item !== id);
      if (atuais.length >= MAX_COMPARACAO) return atuais;
      return [...atuais, id];
    });
  }

  function alternarLoja(loja: string) {
    setLojas((atuais) => (atuais.includes(loja) ? atuais.filter((item) => item !== loja) : [...atuais, loja]));
  }

  function alternarCategoria(categoria: string) {
    setCategorias((atuais) => atuais.includes(categoria) ? atuais.filter((item) => item !== categoria) : [...atuais, categoria]);
  }

  function alternarFaixa(faixa: FaixaEconomia) {
    setFaixas((atuais) => atuais.includes(faixa) ? atuais.filter((item) => item !== faixa) : [...atuais, faixa]);
  }

  function alternarEtiqueta(id: EtiquetaId) {
    setEtiquetas((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]);
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
    setLojas([]);
    setFaixas([]);
    setEtiquetas([]);
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
      const dados = (await lerJson(resposta)) as { escolhas?: EscolhaIa[]; mensagem?: string; erro?: string };
      if (!resposta.ok || !dados.escolhas || !dados.mensagem) throw new Error(dados.erro ?? "Não foi possível buscar recomendações.");
      setEscolhasIa(dados.escolhas);
      setMensagemIa(dados.mensagem);
      setConsultaIa(pedidoIa.trim());
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
      const dados = (await lerJson(resposta)) as Partial<Comparacao> & { erro?: string };
      if (!resposta.ok || typeof dados.veredito !== "string") throw new Error(dados.erro ?? "Não foi possível comparar os cupons.");
      setComparacao({
        vencedor_id: dados.vencedor_id ?? null,
        veredito: dados.veredito,
        observacoes: dados.observacoes ?? [],
        chamada: dados.chamada ?? "",
        urgencia: dados.urgencia ?? null,
      });
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
      const dados = (await lerJson(resposta)) as { classificados?: number; total?: number; erro?: string };
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
    <div className="min-h-screen fundo-conteudo text-foreground">
      <header className="faixa-conteudo w-full">
        <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="animate-conteudo grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ml-yellow px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-ml-yellow-foreground">
                  <ShieldAlert className="size-3.5" aria-hidden="true" />
                  Curadoria independente
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                  {atualizado ? `Atualizado em ${atualizado}` : "Aguardando a primeira carga de dados"}
                </span>
              </div>

              <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Cupons de Lojas Afiliadas — por{" "}
                <a
                  href="https://www.instagram.com/wslmendes/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-ml-yellow decoration-2 underline-offset-4 hover:opacity-80"
                >
                  @WSLMENDES
                </a>
              </h1>

              <p className="mt-4 max-w-[52ch] text-base font-medium leading-relaxed text-white/90 sm:text-lg">
                Um cupom anuncia 40% e desconta R$ 2. A diferença está no limite, escondido nas
                letras miúdas — e é isso que eu leio, cupom por cupom, antes de publicar qualquer
                coisa aqui.
              </p>
              <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-white/85 sm:text-base">
                {indicadores.conferidos > 0 ? (
                  <>
                    Já conferi {indicadores.conferidos.toLocaleString("pt-BR")} cupons um a um e
                    reprovei {indicadores.armadilhas.toLocaleString("pt-BR")} que descontam pouco
                    demais. Publico o limite real de cada um e gero o seu código na hora.
                  </>
                ) : (
                  <>
                    Confiro cada cupom um a um, reprovo os que descontam pouco demais, publico o
                    limite real de cada um e gero o seu código na hora.
                  </>
                )}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Button
                  onClick={irParaColarLink}
                  className="h-auto min-h-12 bg-ml-yellow px-6 py-3 text-base font-bold text-ml-yellow-foreground shadow-lg shadow-black/10 hover:bg-ml-yellow/90"
                >
                  <Link2 className="size-5" aria-hidden="true" />
                  Colar o link do produto
                </Button>
                <nav aria-label="Conteúdo do site" className="flex flex-wrap gap-2">
                  {[
                    { para: "/categorias" as const, texto: "Categorias" },
                    { para: "/guias" as const, texto: "Guias" },
                    { para: "/sobre" as const, texto: "Sobre" },
                  ].map((item) => (
                    <Link
                      key={item.para}
                      to={item.para}
                      className="inline-flex min-h-12 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                    >
                      {item.texto}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-ml-yellow">
                Meu compromisso com você
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-white/90">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ml-yellow" />
                  Limite real conferido no texto oficial da campanha
                </li>
                <li className="flex items-start gap-2.5">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ml-yellow" />
                  Nenhum número inventado: o que não sei, eu digo que não sei
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ml-yellow" />
                  Mostro também os cupons ruins, para você não cair neles
                </li>
              </ul>
              <p className="mt-4 border-t border-white/20 pt-3 text-xs leading-relaxed text-white/75">
                Aqui você sabe quanto economiza antes de comprar — e o preço é o mesmo para você.
              </p>
            </div>
          </div>
        </div>
      </header>

      <nav aria-label="Categorias" className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-secondary-ink">
              Categorias
            </span>
            {CATEGORIAS.map((item) => {
              const Icone = ICONE_CATEGORIA[item.slug];
              const cor = TOM_CATEGORIA[item.slug] ?? "var(--ml-blue)";
              return (
                <Link
                  key={item.slug}
                  to="/categorias/$slug"
                  params={{ slug: item.slug }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold transition-colors hover:border-ml-blue hover:text-ml-blue"
                >
                  {Icone ? <Icone className="size-4" style={{ color: cor }} aria-hidden="true" /> : null}
                  {item.nome}
                </Link>
              );
            })}
            <Link
              to="/categorias"
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-ml-blue hover:underline"
            >
              Ver todas
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="border-b border-border bg-card" aria-label="Como funciona">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-5">
          <ol className="grid gap-4 text-sm sm:grid-cols-3">
            {[
              { icone: Link2, texto: "Você cola aqui o link do anúncio que quer comprar" },
              { icone: Search, texto: "O site confere na hora se a loja tem cupom de verdade" },
              { icone: ShieldCheck, texto: "Você recebe o link pronto para comprar, sem falar com ninguém" },
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
            Sem custo para você. Recebo comissão do vendedor — não de quem compra.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        <BuscaPorLink />

        <section className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6" aria-label="Assistente de cupons">
          <div className="flex items-center gap-2">
            <WandSparkles className="size-5 text-ml-blue" aria-hidden="true" />
            <h2 className="font-semibold">Encontre uma oportunidade com IA</h2>
          </div>
          <form onSubmit={recomendar} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={pedidoIa}
              onChange={(event) => setPedidoIa(event.target.value)}
              maxLength={500}
              placeholder={`O que você está procurando? Ex: ${SUGESTOES_IA[sugestao % SUGESTOES_IA.length]}`}
              aria-label="O que você está procurando?"
              className="min-h-12 flex-1 rounded-lg border border-border bg-background px-4 outline-none ring-ring/40 transition-colors placeholder:text-muted-foreground placeholder:transition-opacity focus:ring-2"
            />
            <Button disabled={recomendando || pedidoIa.trim().length < 3} className="min-h-12 bg-ml-blue text-ml-blue-foreground hover:bg-ml-blue/90">
              <Sparkles aria-hidden="true" />
              {recomendando ? "Procurando..." : "Encontrar cupons"}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-secondary-ink">Experimente:</span>
            {[0, 1, 2].map((passo) => {
              const texto = SUGESTOES_IA[(sugestao + passo) % SUGESTOES_IA.length]!;
              const atual = passo === 0;
              return (
                <button
                  key={texto}
                  type="button"
                  onClick={() => setPedidoIa(texto)}
                  className={
                    atual
                      ? "animate-sugestao rounded-full border border-ml-blue bg-ml-blue/10 px-3 py-1.5 text-xs font-medium text-ml-blue transition-colors hover:bg-ml-blue/20"
                      : "animate-sugestao rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-ml-blue hover:text-ml-blue"
                  }
                >
                  {texto}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-secondary-ink">A IA escolhe somente entre os cupons recomendados e os filtros ativos.</p>
          {erroIa && <p className="mt-3 rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger" role="alert">{erroIa}</p>}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo dos cupons">
          <Indicador
            titulo="Cupons conferidos"
            valor={indicadores.conferidos.toLocaleString("pt-BR")}
            detalhe={`de ${indicadores.total.toLocaleString("pt-BR")} cupons de ${indicadores.vendedores.toLocaleString("pt-BR")} lojas`}
          />
          <Indicador
            titulo="Valem a pena"
            valor={indicadores.bons.toLocaleString("pt-BR")}
            tom="bom"
            {...(indicadores.aproveitamento != null
              ? { detalhe: `${indicadores.aproveitamento}% dos que eu conferi` }
              : {})}
          />
          <Indicador
            titulo="Armadilhas"
            valor={indicadores.armadilhas.toLocaleString("pt-BR")}
            tom="armadilha"
            detalhe="anunciam muito e descontam pouco"
          />
          {/* "Ainda na fila" era vocabulário interno: dizia respeito ao meu
              sistema, não à compra de quem está lendo. Trocado pelo número que
              importa para a pessoa: quantos cupons são bons E têm produto à
              venda na loja agora. */}
          <Indicador
            titulo="Com produto no ar"
            valor={indicadores.comProduto.toLocaleString("pt-BR")}
            detalhe={
              indicadores.vitrineNaFila > 0
                ? `mais ${indicadores.vitrineNaFila.toLocaleString("pt-BR")} lojas sendo conferidas`
                : "loja conferida: o cupom tem onde ser usado"
            }
          />
        </section>

        {(mensagemIa || escolhidos.length > 0) && (
          <section className="mt-6 rounded-xl border-2 border-ml-blue/30 bg-ml-blue/5 p-4 sm:p-5" aria-label="Resultado da busca com IA">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ml-blue">Busca realizada: “{consultaIa}”</h2>
                <p className="mt-1 text-sm font-medium">
                  {escolhidos.length === 0
                    ? "Nenhum cupom encontrado para essa busca."
                    : escolhidos.length === 1
                      ? "1 cupom encontrado para essa busca."
                      : `${escolhidos.length} cupons encontrados para essa busca.`}
                </p>
                <p className="mt-1 text-sm text-secondary-ink">{mensagemIa}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Fechar resultado da busca" onClick={() => { setEscolhasIa([]); setMensagemIa(""); setConsultaIa(""); }}><X aria-hidden="true" /></Button>
            </div>
            {escolhidos.length > 0 && (
              <>
                <Button onClick={irParaColarLink} size="lg" className="mt-4 h-auto min-h-12 w-full whitespace-normal bg-ml-blue py-3 text-base font-bold text-white hover:bg-ml-blue/90">
                  <Link2 className="size-5" aria-hidden="true" />
                  Escolheu um produto? Cole o link e eu confiro o cupom
                </Button>
                <div className="mt-4 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {escolhidos.map(({ cupom, motivo }) => (
                    <div key={cupom.id} className="flex flex-col gap-2">
                      <p className="rounded-md bg-card px-3 py-2 text-sm font-medium">{motivo}</p>
                      <CupomCard cupom={cupom} agora={agora} abrirCondicoes={setCupomAberto} selecionado={selecionados.includes(cupom.id)} alternarSelecao={alternarSelecao} limiteAtingido={selecionados.length >= MAX_COMPARACAO} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {destaques.length > 0 && (
          <section className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6" aria-label="Melhor cupom de cada categoria">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Curadoria: o melhor cupom de cada categoria</h2>
              <p className="text-xs text-secondary-ink">categoria estimada pelo nome da loja</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {destaques.map(([categoria, cupom]) => (
                <div key={categoria} className="flex min-w-0 flex-col rounded-lg border border-border bg-background p-3">
                  <button
                    type="button"
                    onClick={() => { setCategorias([categoria]); setVitrine("recomendados"); }}
                    className="self-start rounded-full border border-ml-blue px-2.5 py-1 text-[11px] font-semibold text-ml-blue"
                  >
                    {categoria}
                  </button>
                  <p className="mt-2 text-base font-extrabold leading-tight">{percentualTexto(cupom)}</p>
                  <p className="text-xs font-semibold text-success">{economiaCurta(cupom)}</p>
                  <p className="mt-1 min-w-0 break-words text-sm [overflow-wrap:anywhere]">
                    Em produtos de <span className="font-bold">{cupom.vendedor}</span>
                  </p>

                  {/* CONDICOES SEMPRE A VISTA.

                      Estes cartoes mostravam so o desconto e o vendedor. Sem
                      compra minima e sem validade, um "R$ 140 OFF" parece
                      valer para qualquer compra, quando na verdade so entra a
                      partir de R$ 175. Prometer desconto e esconder a regra e
                      exatamente o que este site existe para denunciar, entao a
                      regra anda junto com a promessa, aqui como em todo lugar. */}
                  <dl className="mt-2 space-y-0.5 text-xs text-secondary-ink">
                    <div className="flex justify-between gap-2">
                      <dt>Compra mínima</dt>
                      <dd className="font-semibold text-foreground">
                        {cupom.compra_min != null && cupom.compra_min > 0 ? brl.format(cupom.compra_min) : "não tem"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Validade</dt>
                      <dd className="font-semibold text-foreground">
                        {contagemRegressiva(cupom.vence, agora).texto}
                      </dd>
                    </div>
                  </dl>

                  <AcaoDoCupom
                    cupom={cupom}
                    className="mt-3 h-auto min-h-10 w-full whitespace-normal bg-ml-blue px-3 py-2 text-sm font-bold text-white hover:bg-ml-blue/90"
                  />

                  <button
                    type="button"
                    onClick={() => setCupomAberto(cupom)}
                    className="mt-2 inline-flex items-center gap-1 self-start text-xs font-medium text-secondary-ink underline-offset-2 hover:underline"
                  >
                    <Info className="size-3.5" aria-hidden="true" />
                    Condições do cupom
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* Lojas parceiras a vista: atalho direto, sem abrir gaveta nenhuma. */}
        {lojasDestaque.length > 0 && (
          <section className="mt-8 rounded-xl border border-border bg-card p-5" aria-label="Lojas parceiras">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">Lojas parceiras</h2>
              <p className="text-xs text-secondary-ink">
                {lojasDisponiveis.length.toLocaleString("pt-BR")} lojas com cupom conferido
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {lojasDestaque.map(([loja, quantidade]) => (
                <button
                  key={loja}
                  type="button"
                  aria-pressed={lojas.includes(loja)}
                  onClick={() => alternarLoja(loja)}
                  className={cn(
                    "max-w-full rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    lojas.includes(loja)
                      ? "border-ml-blue bg-ml-blue text-ml-blue-foreground"
                      : "border-border bg-background hover:border-ml-blue",
                  )}
                >
                  <span className="truncate">{loja}</span> ({quantidade})
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPainelAberto(true);
                  document.getElementById("painel-filtros")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="rounded-full border border-ml-blue px-3 py-1.5 text-xs font-bold text-ml-blue"
              >
                Ver todas as lojas
              </button>
              {lojas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLojas([])}
                  className="rounded-full border border-danger px-3 py-1.5 text-xs font-medium text-danger"
                >
                  Limpar lojas
                </button>
              )}
            </div>
          </section>
        )}

        <section className="mt-6" aria-label="Filtros de cupons">
          {/* Barra de controle
              ================
              Antes eram 871px de filtros entre a pessoa e o primeiro cupom: busca
              de loja, lista rolavel, cinco campos numericos, lista de categorias e
              duas fileiras de chips, tudo aberto. Isso e painel de controle, nao
              ajuda para quem so quer um desconto.

              Agora fica visivel so o que um comprador usa de verdade — as abas, a
              contagem, a ordem e os atalhos — e o resto mora na gaveta. A barra
              gruda no topo porque a lista tem quase 9.000px: sem isso, refinar a
              busca obriga a rolar tudo de volta. */}
          <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="flex" role="tablist" aria-label="Qualidade do cupom">
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
                      "h-10 rounded-none border-b-2 px-2 text-sm sm:px-4",
                      vitrine === valor
                        ? "border-ml-blue text-ml-blue"
                        : "border-transparent text-secondary-ink",
                    )}
                  >
                    {rotulo}
                  </Button>
                ))}
              </div>

              <p
                key={filtrados.length}
                aria-live="polite"
                className="animate-contagem rounded px-1.5 py-0.5 text-sm font-semibold"
              >
                {isLoading
                  ? "Carregando..."
                  : filtrados.length === 1
                    ? "1 cupom"
                    : `${filtrados.length.toLocaleString("pt-BR")} cupons`}
              </p>

              <div className="ml-auto flex items-center gap-2">
                <label className="sr-only" htmlFor="ordenar-cupons">Ordenar por</label>
                <select
                  id="ordenar-cupons"
                  value={ordem}
                  onChange={(event) => setOrdem(event.target.value as typeof ordem)}
                  className="h-10 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="score">Melhores oportunidades</option>
                  <option value="desconto">Maior desconto</option>
                  <option value="teto">Maior teto de desconto</option>
                  <option value="orcamento">Maior orçamento</option>
                  <option value="termina">Termina primeiro</option>
                  <option value="vendedor">Vendedor A-Z</option>
                </select>

                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={painelAberto}
                  aria-controls="painel-filtros"
                  onClick={() => setPainelAberto((aberto) => !aberto)}
                  className="h-10 gap-1.5"
                >
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  Filtros
                  {quantosFiltros > 0 && (
                    <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-ml-blue px-1.5 text-xs font-bold text-white">
                      {quantosFiltros}
                    </span>
                  )}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-4 transition-transform duration-300", painelAberto && "rotate-180")}
                  />
                </Button>
              </div>
            </div>

            {/* Atalhos: e o que um comprador de verdade usa. Ficam de fora da
                gaveta, em uma tira que rola de lado no celular. */}
            <div className="-mx-1 mt-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ETIQUETAS.filter((etiqueta) => (contagensEtiqueta.get(etiqueta.id) ?? 0) > 0 || etiquetas.includes(etiqueta.id)).map((etiqueta) => (
                <button
                  key={etiqueta.id}
                  type="button"
                  aria-pressed={etiquetas.includes(etiqueta.id)}
                  onClick={() => alternarEtiqueta(etiqueta.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    etiquetas.includes(etiqueta.id)
                      ? "border-ml-blue bg-ml-blue text-ml-blue-foreground"
                      : etiqueta.id === "cometiqueta"
                        ? "border-success bg-success/10 font-bold text-success hover:bg-success/20"
                        : "border-border bg-card hover:border-ml-blue",
                  )}
                >
                  {etiqueta.rotulo} ({contagensEtiqueta.get(etiqueta.id) ?? 0})
                </button>
              ))}
              {filtrosAtivos && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="shrink-0 rounded-full border border-danger px-3 py-1 text-xs font-medium text-danger"
                >
                  Limpar tudo
                </button>
              )}
            </div>
          </div>

          {/* A gaveta: aberta so quando a pessoa pede */}
          <div id="painel-filtros" className={cn("gaveta", painelAberto && "gaveta-aberta")}>
            <div>
              <div className="pb-1 pt-3">
              <div className="mt-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    inputMode="search"
                    aria-label="Buscar loja"
                    placeholder="Buscar loja e marcar na lista abaixo"
                    className="w-full rounded-lg border border-border bg-card py-3 pl-11 pr-4 text-base outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2"
                  />
                </div>

                {lojas.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {lojas.map((loja) => (
                      <button
                        key={loja}
                        type="button"
                        onClick={() => alternarLoja(loja)}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-ml-blue bg-ml-blue px-3 py-1 text-xs font-medium text-ml-blue-foreground"
                        aria-label={`Remover a loja ${loja} da seleção`}
                      >
                        <span className="truncate">{loja}</span>
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    ))}
                    <button type="button" onClick={() => setLojas([])} className="text-xs font-medium text-secondary-ink underline">
                      Limpar lojas
                    </button>
                  </div>
                )}

                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border bg-card p-1" role="group" aria-label="Lista de lojas">
                  {lojasFiltradas.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-secondary-ink">Nenhuma loja com esse nome.</p>
                  ) : (
                    lojasFiltradas.map(([loja, quantidade]) => (
                      <label
                        key={loja}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={lojas.includes(loja)}
                          onChange={() => alternarLoja(loja)}
                          className="size-4 accent-[var(--ml-blue)]"
                        />
                        <span className="min-w-0 flex-1 truncate">{loja}</span>
                        <span className="shrink-0 text-xs text-secondary-ink">{quantidade}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="mt-1 text-xs text-secondary-ink">Marque uma ou mais lojas para filtrar os cupons.</p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
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
              </div>

              {categoriasDisponiveis.length > 0 && (
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-secondary-ink">Categorias — organizadas pela IA a partir do nome da loja</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={classificando}
                      onClick={classificar}
                      className="h-8 px-2 text-xs text-ml-blue"
                    >
                      <WandSparkles aria-hidden="true" className="size-4" />
                      {classificando ? "Organizando..." : "Organizar categorias com IA"}
                    </Button>
                    {categorias.length > 0 && (
                      <button type="button" onClick={() => setCategorias([])} className="text-xs font-medium text-secondary-ink underline">
                        Limpar categorias
                      </button>
                    )}
                  </div>
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border bg-card p-1" role="group" aria-label="Lista de categorias">
                    {categoriasDisponiveis.map(([categoria, quantidade]) => (
                      <label
                        key={categoria}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={categorias.includes(categoria)}
                          onChange={() => alternarCategoria(categoria)}
                          className="size-4 accent-[var(--ml-blue)]"
                        />
                        <span className="min-w-0 flex-1 truncate">{categoria}</span>
                        <span className="shrink-0 text-xs text-secondary-ink">{quantidade}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-5">
                <p className="text-xs font-semibold text-secondary-ink">Faixa de economia real</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FAIXAS.filter((faixa) => (contagensFaixa.get(faixa.id) ?? 0) > 0 || faixas.includes(faixa.id)).map((faixa) => (
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
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4" aria-label="Cupons encontrados">
          {indicadores.total > 0 && (
            <p className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-secondary-ink">
              Analisei {indicadores.total.toLocaleString("pt-BR")}{" "}
              {indicadores.total === 1 ? "cupom" : "cupons"}.{" "}
              {indicadores.armadilhas === 1
                ? "1 desconta pouco demais para valer a pena."
                : `${indicadores.armadilhas.toLocaleString("pt-BR")} descontam pouco demais para valer a pena.`}{" "}
              {indicadores.bons === 1
                ? "O que passou no teste está aqui embaixo."
                : `Os ${indicadores.bons.toLocaleString("pt-BR")} que passaram no teste estão aqui embaixo.`}
            </p>
          )}
          <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-secondary-ink">
            <p className="font-semibold text-foreground">Como ler o valor do desconto</p>
            <ul className="mt-1 space-y-1">
              <li><strong>Economize até R$ X</strong>: esse é o máximo que o cupom tira da compra. Acima disso o desconto não aumenta.</li>
              <li><strong>Sem limite de valor</strong>: o percentual vale sobre o valor todo da compra.</li>
              <li><strong>Limite não informado</strong>: o cupom não diz o máximo. Eu confirmo antes de gerar para você.</li>
            </ul>
          </div>
          {armadilhasDaBusca.length > 0 && (
            <div className="mb-4 rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger" role="alert">
              <strong>Atenção:</strong>{" "}
              {armadilhasDaBusca.map((cupom, indice) => {
                const limite = tetoUtil(cupom);
                return (
                  <span key={cupom.id}>
                    {indice > 0 ? " · " : ""}
                    {cupom.vendedor}:{" "}
                    {limite != null
                      ? `este cupom desconta no máximo ${brl.format(limite)}.`
                      : "este cupom não informa o limite real de desconto."}{" "}
                    Não recomendo usá-lo como argumento de venda.
                  </span>
                );
              })}
            </div>
          )}
          {error && !cupons.length ? (
            <Aviso
              titulo="Carregando os cupons"
              texto="A conexão falhou e estou tentando de novo sozinho. Deixe esta página aberta: assim que voltar, a lista aparece."
            >
              <Button
                onClick={() => void refetch()}
                className="mt-4 h-auto min-h-11 bg-ml-blue px-4 py-2 font-bold text-white hover:bg-ml-blue/90"
              >
                Tentar agora
              </Button>
            </Aviso>
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              <Button onClick={irParaColarLink} className="mt-4 h-auto min-h-11 bg-ml-blue px-4 py-2 font-bold text-white hover:bg-ml-blue/90">
                <Link2 className="size-5" aria-hidden="true" />
                Colar o link do produto
              </Button>
            </Aviso>
          ) : (
            <>
              <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-ml-blue/40 bg-ml-blue/10 p-4 sm:flex-row sm:items-center">
                <p className="text-sm font-medium">
                  Não achou a loja aqui? Cole o link do anúncio que você quer: eu confiro o cupom
                  daquele vendedor na hora.
                </p>
                <Button onClick={irParaColarLink} className="h-auto min-h-11 shrink-0 bg-ml-blue px-4 py-2 font-bold text-white hover:bg-ml-blue/90">
                  <Link2 className="size-5" aria-hidden="true" />
                  Colar o link do produto
                </Button>
              </div>
              <div key={`${paginaAtual}-${filtrados.length}`} className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visiveis.map((cupom, indice) => (
                  <div
                    key={cupom.id}
                    className="animate-cartao h-full"
                    style={{ animationDelay: `${Math.min(indice, 11) * 35}ms` }}
                  >
                    <CupomCard cupom={cupom} agora={agora} abrirCondicoes={setCupomAberto} selecionado={selecionados.includes(cupom.id)} alternarSelecao={alternarSelecao} limiteAtingido={selecionados.length >= MAX_COMPARACAO} />
                  </div>
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

      <section aria-label="Guias de compra" className="border-y border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-secondary-ink">
                <BookOpen className="size-4 text-ml-blue" aria-hidden="true" />
                Guias de compra
              </p>
              <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">
                Entenda o desconto antes de comprar
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-secondary-ink">
                Textos curtos, com as contas feitas, sobre teto, compra mínima e o que separa um bom cupom de uma armadilha.
              </p>
            </div>
            <Link to="/guias" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ml-blue hover:underline">
              Ver todos os guias
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUIAS.slice(0, 3).map((guia, indice) => (
              <Link
                key={guia.slug}
                to="/guias/$slug"
                params={{ slug: guia.slug }}
                className="cartao-conteudo animate-conteudo group flex flex-col gap-2 p-4"
                style={{ animationDelay: `${indice * 60}ms` }}
              >
                <span className="text-xs font-bold uppercase tracking-wide text-secondary-ink">
                  {guia.tempo}
                </span>
                <span className="text-base font-extrabold leading-snug">{guia.titulo}</span>
                <span className="text-sm text-secondary-ink">{guia.resumo}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-ml-blue">
                  Ler o guia
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {cupomSelecionados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 shadow-modal backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {cupomSelecionados.length === 1 ? "1 cupom marcado" : `${cupomSelecionados.length} cupons marcados`} de até {MAX_COMPARACAO} · economia estimada de até {formatarMoeda(economiaSomada)}
              </p>
              <p className="text-xs text-secondary-ink">
                {cupomSelecionados.length < 2
                  ? "Marque mais 1 cupom para comparar qual rende mais."
                  : cupomSelecionados.length === MAX_COMPARACAO
                    ? "Limite de 3 cupons atingido. Desmarque um para trocar."
                    : "Você pode marcar mais 1 cupom."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>Limpar seleção</Button>
              <Button
                className="h-auto min-h-11 bg-ml-blue px-4 py-2 font-bold text-white shadow-md hover:bg-ml-blue/90"
                disabled={cupomSelecionados.length < 2}
                title={cupomSelecionados.length < 2 ? "Marque 2 ou 3 cupons nos cards para comparar." : undefined}
                onClick={abrirComparador}
              >
                <Sparkles aria-hidden="true" />
                Comparar economia{cupomSelecionados.length < 2 ? " (marque mais 1)" : ""}
              </Button>
              <Button onClick={irParaColarLink} className="h-auto min-h-11 bg-ml-blue px-4 py-2 font-bold text-white hover:bg-ml-blue/90">
                <Link2 className="size-5" aria-hidden="true" />
                Colar o link do produto
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={irParaColarLink}
        aria-label="Ir para o campo de colar o link do produto"
        className={cn(
          "fixed right-4 z-50 flex size-14 items-center justify-center rounded-full bg-ml-blue font-bold text-white shadow-modal transition hover:brightness-95 sm:size-auto sm:gap-2 sm:rounded-full sm:px-5 sm:py-3",
          cupomSelecionados.length > 0 ? "bottom-40" : "bottom-20",
        )}
      >
        <Link2 className="size-7 sm:size-5" aria-hidden="true" />
        <span className="hidden sm:inline">Colar link do produto</span>
      </button>


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

      <footer className="mt-10 border-t border-border py-8">
        <div className="mx-auto grid max-w-[1400px] gap-4 px-4 sm:px-6 lg:px-8 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-bold">Limite real sempre informado</p>
            <p className="mt-1 text-xs text-secondary-ink">Mostro quanto cada cupom desconta de verdade, inclusive quando o desconto é pequeno.</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-bold">Sem custo para você</p>
            <p className="mt-1 text-xs text-secondary-ink">Recebo comissão do vendedor, nunca de quem compra. O preço é o mesmo.</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-bold">Dados vindos dos cupons oficiais</p>
            <p className="mt-1 text-xs text-secondary-ink">Nada é inventado: cada condição vem do texto oficial da campanha do vendedor.</p>
          </div>
        </div>
        <div className="mx-auto mt-6 flex max-w-[1400px] flex-col items-start gap-3 px-4 sm:px-6 lg:px-8 sm:flex-row sm:items-center sm:justify-between">

          <div className="space-y-1">
            <p className="text-xs text-secondary-ink">Fotografia dos cupons, não é tempo real. Cupom é campanha do vendedor e pode acabar antes da validade.</p>
            <AvisoAfiliado />
          </div>
          <div className="text-left sm:text-right">
            <Button type="button" variant="ghost" size="sm" disabled={classificando} onClick={classificar} className="px-2 text-xs text-secondary-ink">
              <WandSparkles aria-hidden="true" />{classificando ? "Classificando lojas..." : "Classificar lojas com IA"}
            </Button>
            {statusClassificacao && <p className="mt-1 text-xs text-secondary-ink" aria-live="polite">{statusClassificacao}</p>}
          </div>
        </div>
      </footer>

      <RodapeInstitucional />
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
  const chaveCupons = cupons.map((cupom) => cupom.id).join(",");
  const [escolhidas, setEscolhidas] = useState<number[]>(() => cupons.map((cupom) => cupom.id));

  useEffect(() => {
    setEscolhidas(chaveCupons ? chaveCupons.split(",").map(Number) : []);
  }, [chaveCupons]);

  const alternarEscolhida = (id: number) =>
    setEscolhidas((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));


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

        {cupons.length > 0 && (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Quais cupons você quer?</p>
            <p className="mt-0.5 text-xs text-secondary-ink">Marque as lojas que te interessam e fale comigo sobre elas.</p>
            <ul className="mt-2 space-y-2">
              {cupons.map((cupom) => {
                const marcada = escolhidas.includes(cupom.id);
                return (
                  <li key={cupom.id} className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex min-w-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-ml-blue"
                        checked={marcada}
                        onChange={() => alternarEscolhida(cupom.id)}
                      />
                      <span className="min-w-0 break-words font-semibold">{cupom.vendedor}</span>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-ml-blue text-ml-blue hover:bg-ml-blue/10"
                      onClick={irParaColarLink}
                    >
                      <Link2 className="size-4" aria-hidden="true" />
                      Colar link
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
            {comparacao.urgencia && (
              <p className="mt-2 rounded-md bg-urgency-soft px-2 py-1 text-sm font-semibold text-urgency-warning">
                {comparacao.urgencia}
              </p>
            )}
            {comparacao.chamada && (
              <p className="mt-2 border-t border-border pt-2 text-sm font-semibold text-success">{comparacao.chamada}</p>
            )}
          </div>
        )}

        <Button onClick={irParaColarLink} className="h-auto min-h-12 w-full whitespace-normal bg-ml-blue py-3 text-base font-bold text-white hover:bg-ml-blue/90">
          <Link2 className="size-5" aria-hidden="true" />
          Colar o link do produto e conferir o cupom
        </Button>
        <p className="text-xs text-secondary-ink">
          Comparação feita com os dados cadastrados de cada cupom. A categoria é estimada pelo nome da loja.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function CupomCard({
  cupom,
  agora,
  abrirCondicoes,
  selecionado,
  alternarSelecao,
  limiteAtingido = false,
  permitirComparar = true,
}: {
  cupom: CupomIndexado;
  agora: number | null;
  abrirCondicoes: (cupom: CupomIndexado) => void;
  selecionado: boolean;
  alternarSelecao: (id: number) => void;
  limiteAtingido?: boolean;
  permitirComparar?: boolean;
}) {
  const armadilha = cupom.qualidade === "armadilha";
  const contagem = contagemRegressiva(cupom.vence, agora);
  const encerrado = contagem.urgencia === "encerrado";
  const urgente = contagem.urgencia === "urgente" || contagem.urgencia === "ultimas";
  const ilimitado = semLimite(cupom);
  const teto = tetoUtil(cupom);
  const em200 = descontoRealEm200(cupom);
  const compraTeto = compraParaAtingirTeto(cupom);
  const folgado = tetoFolgado(cupom);
  const rotuloQualidade = ilimitado
    ? "Sem limite de valor"
    : teto == null
      ? "Limite não informado"
      : armadilha
        ? `Desconta só ${brlCurto.format(teto)}`
        : folgado
          ? "Sem teto na prática"
          : `Desconta até ${brlCurto.format(teto)}`;

  return (
    <article
      className={cn(
        "flex h-full min-h-56 min-w-0 flex-col rounded-lg border bg-card p-5 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-card",
        armadilha ? "border-danger" : "border-border",
        urgente && "border-t-4 border-t-urgency-danger",
        encerrado && "grayscale opacity-55 hover:translate-y-0 hover:shadow-none",
      )}
    >
      <div className="flex min-h-10 min-w-0 items-start justify-between gap-3">
        {permitirComparar ? (
          <label
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-xs font-medium text-secondary-ink",
              limiteAtingido && !selecionado ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            title={limiteAtingido && !selecionado ? `Você já marcou ${MAX_COMPARACAO} cupons para comparar.` : "Marque para comparar (até 3)"}
          >
            <input
              type="checkbox"
              checked={selecionado}
              disabled={limiteAtingido && !selecionado}
              onChange={() => alternarSelecao(cupom.id)}
              className="size-4 accent-[var(--ml-blue)]"
              aria-label={`Selecionar a loja ${cupom.vendedor} para comparar`}
            />
            Comparar
          </label>
        ) : (
          <span className="shrink-0" />
        )}
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

      <div className="mt-5 flex min-w-0 flex-1 flex-col">
        <p className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">{percentualTexto(cupom)}</p>
        {ilimitado ? (
          <p className="mt-1 text-sm text-secondary-ink">
            Vale sobre o valor todo da compra, sem limite.
            {em200 > 0 ? ` Numa compra de R$ 200, você economiza ${brl.format(em200)}.` : ""}
          </p>
        ) : folgado ? (
          <p className="mt-1 text-sm text-secondary-ink">
            <span className="font-semibold text-success">Sem limite prático</span> — o teto só seria
            atingido numa compra muito acima do normal.
            {em200 > 0 ? ` Numa compra de R$ 200, você economiza ${brl.format(em200)}.` : ""}
          </p>
        ) : teto != null ? (
          <p className="mt-1 text-sm text-secondary-ink">
            <span className="font-semibold text-success">Economize até {brl.format(teto)}</span> — acima disso o desconto não aumenta.
            {em200 > 0 ? ` Numa compra de R$ 200, você economiza ${brl.format(em200)}.` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-secondary-ink">O cupom não informa o limite. Eu confirmo o máximo antes de gerar o seu.</p>
        )}
        {cupom.compra_min != null && (
          <p className="mt-1 text-sm font-medium text-foreground">Compra mínima de {formatarMoeda(cupom.compra_min)}</p>
        )}




        <p className="mt-4 min-w-0 break-words text-sm text-secondary-ink [overflow-wrap:anywhere]">
          Em produtos de <span className="font-bold text-foreground">{cupom.vendedor}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex max-w-full items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-secondary-ink">
            <span className="truncate">Categoria: {cupom.categoria ?? "não classificada"}</span>
          </span>
        </div>
        {cupom.categoria && (
          <p className="mt-1 text-[11px] leading-4 text-secondary-ink">categoria estimada pelo nome da loja</p>
        )}

        <AcaoDoCupom
          cupom={cupom}
          className={cn(
            "mt-auto h-auto min-h-11 w-full min-w-0 whitespace-normal px-3 py-2 text-center text-sm font-bold",
            armadilha
              ? "bg-muted text-secondary-ink shadow-none hover:bg-muted/80"
              : "bg-ml-blue text-white hover:bg-ml-blue/90",
          )}
        />
        {!(cupom.vitrine_ok === true && cupom.link_afiliado) && (
          <p className="mt-2 text-[11px] leading-4 text-secondary-ink">
            Procure um produto de <span className="font-semibold">{cupom.vendedor}</span>, cole o
            link aqui e eu confiro o cupom e gero seu link de compra.
          </p>
        )}
        {cupom.codigo_cupom ? (
          <EtiquetaDoCupom codigo={cupom.codigo_cupom} vendedor={cupom.vendedor} />
        ) : (
          <PedirCodigo cupom={cupom} />
        )}
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
        <p className="mt-2 text-[11px]">O link de compra sai na hora, aqui mesmo no site</p>
      </div>
    </article>
  );
}

/* Calculadora do cupom.

   Isto substitui uma tabela que assustava mais do que ajudava. Ela mostrava
   "Teto de desconto: R$ 50.000,00" e "Você só chega nesse teto gastando
   R$ 172.413,79". Os dois números eram verdadeiros e os dois eram inúteis:
   ninguém compra R$ 172 mil, e ver isso faz a pessoa desconfiar do site.
   Mostrava ainda o desconto "numa compra de R$ 200", um valor tirado do nada,
   que não é o produto que ela está olhando.

   A pergunta real de quem chega aqui é uma só: quanto eu pago no final. Então
   a caixa responde isso, com o valor que a própria pessoa digita, já vindo
   preenchido para ela ver a conta antes de mexer em qualquer coisa.

   O teto só é mencionado quando de fato corta o desconto naquele valor. Se não
   corta, falar dele é encher a tela de ruído. */
function CalculadoraDoCupom({ cupom }: { cupom: CupomIndexado }) {
  const [valor, setValor] = useState<number>(() => valorInicialDaCalculadora(cupom));
  const [texto, setTexto] = useState<string>(() =>
    String(valorInicialDaCalculadora(cupom)).replace(".", ","),
  );

  const minimo = cupom.compra_min ?? null;
  const abaixoDoMinimo = minimo != null && valor > 0 && valor < minimo;
  const desconto = descontoEm(cupom, valor);
  const paga = Math.max(0, valor - desconto);

  const teto = tetoReal(cupom);
  const bruto = cupom.tipo === "%" ? valor * ((cupom.valor ?? 0) / 100) : (cupom.valor ?? 0);
  const tetoCortou = teto != null && bruto > teto && !abaixoDoMinimo;

  function digitou(bruta: string) {
    setTexto(bruta);
    const n = Number(bruta.replace(/\./g, "").replace(",", "."));
    setValor(Number.isFinite(n) ? n : 0);
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <label htmlFor="calc-valor" className="text-sm font-semibold">
        Quanto você pretende gastar nesta loja?
      </label>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-secondary-ink">R$</span>
        <input
          id="calc-valor"
          type="text"
          inputMode="decimal"
          value={texto}
          onChange={(e) => digitou(e.target.value)}
          className="w-32 rounded-md border border-border bg-background px-3 py-2 text-base font-bold tabular-nums outline-none focus:border-ml-blue focus:ring-1 focus:ring-ml-blue"
          aria-describedby="calc-resultado"
        />
        <span className="text-xs text-secondary-ink">altere para o seu caso</span>
      </div>

      <div id="calc-resultado" className="mt-3 divide-y divide-border border-t border-border">
        {abaixoDoMinimo ? (
          <p className="pt-3 text-sm leading-relaxed">
            Nesse valor o cupom <span className="font-bold">não entra</span>. Ele começa a valer a
            partir de <span className="font-bold">{brl.format(minimo as number)}</span>.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-sm text-secondary-ink">Desconto do cupom</span>
              <span className="text-sm font-bold text-success">- {brl.format(desconto)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-sm font-semibold">Você paga</span>
              <span className="text-lg font-extrabold tabular-nums">{brl.format(paga)}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs leading-relaxed text-secondary-ink">
        {minimo != null && (
          <p>
            Compra mínima de <span className="font-semibold">{brl.format(minimo)}</span>.
          </p>
        )}
        {tetoCortou && (
          <p>
            Neste valor o desconto bate no limite de{" "}
            <span className="font-semibold">{brl.format(teto as number)}</span> que a loja definiu.
            Comprando mais, o desconto não sobe além disso.
          </p>
        )}
        <p>É uma estimativa pelas regras do cupom. O valor final aparece no carrinho da loja.</p>
      </div>
    </div>
  );
}

export function CondicoesModal({ cupom, fechar }: { cupom: CupomIndexado | null; fechar: () => void }) {
  if (!cupom) return null;

  const compraParaTeto = compraParaAtingirTeto(cupom);
  const texto = descricaoCupom(cupom);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border-border bg-card p-0 text-card-foreground shadow-modal sm:rounded-lg">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold">{cupom.desconto ?? "Condições do cupom"}</DialogTitle>
          <DialogDescription>Condições e limite real do desconto</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 pb-6 sm:px-6">
          <CalculadoraDoCupom cupom={cupom} />
          <Button
            size="lg"
            onClick={() => { fechar(); irParaColarLink(); }}
            className={cn(
              "h-auto min-h-12 w-full whitespace-normal py-3 text-base font-bold",
              cupom.qualidade === "armadilha"
                ? "bg-muted text-secondary-ink shadow-none hover:bg-muted/80"
                : "bg-ml-blue text-white hover:bg-ml-blue/90",
            )}
          >
            <Link2 className="size-5" aria-hidden="true" />
            Usar este cupom
          </Button>
          <p className="-mt-3 text-xs leading-relaxed text-secondary-ink">
            Procure um produto de <span className="font-semibold">{cupom.vendedor}</span>,
            cole o link aqui no site e eu confiro se este cupom pega nele e gero o seu link de compra.
          </p>
          {cupom.codigo_cupom && (
            <div className="-mt-2">
              <EtiquetaDoCupom codigo={cupom.codigo_cupom} vendedor={cupom.vendedor} />
              <p className="mt-2 text-xs leading-relaxed text-secondary-ink">
                No carrinho, o Mercado Livre aceita <span className="font-semibold">um cupom de
                loja por compra</span>. Se ele já tiver aplicado o cupom da própria loja, remova
                aquele e cole este no lugar: o desconto para você é o mesmo, e assim ele fica
                registrado por aqui. Se o carrinho não aceitar a troca, fique com o que já está
                aplicado, porque o valor final não muda.
              </p>
            </div>
          )}
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
      const dados = (await lerJson(resposta)) as { texto?: string; erro?: string };
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
  detalhe,
}: {
  titulo: string;
  valor: string;
  tom?: Qualidade;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-secondary-ink">{titulo}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", tom === "bom" && "text-success", tom === "armadilha" && "text-danger")}>
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-secondary-ink">{detalhe}</p>}
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
