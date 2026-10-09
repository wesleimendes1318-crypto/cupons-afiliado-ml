/* BuscaPorLink — cole o link do anúncio, receba o link de afiliado do Weslei
   ============================================================================
   Por que existe um vai e vem em vez de uma chamada direta:

   O site NÃO consegue gerar link de afiliado do Mercado Livre. Isso exige a
   sessão logada do afiliado E que o POST saia de dentro de uma página do
   próprio mercadolivre.com.br (eles validam a origem). Nem o navegador do
   visitante nem o servidor conseguem fazer isso.

   Então: o site registra o pedido no banco (pedir_link), a extensão de
   navegador do Weslei pega esse pedido, resolve vendedor/preço/cupom e gera o
   link, devolve para o banco, e aqui a gente consulta até ficar pronto
   (consultar_pedido).

   Regra inegociável: em nenhuma hipótese mostramos a URL original como botão
   de compra. Mostrar a URL crua faria o Weslei perder a comissão. Se o link
   não sair, a pessoa tenta de novo em alguns minutos — nunca compra por fora.

   Não há WhatsApp aqui de propósito: o visitante resolve tudo sozinho, sem
   depender de o Weslei estar online para responder.
*/

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AcompanharPreco } from "@/components/AcompanharPreco";
import { ComoFunciona } from "@/components/ComoFunciona";
import {
  BadgeCheck,
  History,
  Link2,
  LoaderCircle,
  Package,
  Send,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  medidaDoTitulo,
  notaDeAlternativa,
  podeSerAlternativa,
  rotuloDaUnidade,
  type CustoBeneficio,
  type Medida,
} from "@/lib/alternativa";
import { SeloCep, useCepDestino } from "@/components/CepDestino";
import { AvisosDoPrazo, FiltroPrazo, usePrazos } from "@/components/FiltroPrazo";
import { aplicarPrazo } from "@/lib/prazo-entrega";
import { textoDoPagamento } from "@/lib/pagamento";
import { diferencasParaCliente, resumoParaCliente } from "@/lib/diferencas";
import { compararFichas, linhasLadoALado, mudaCompleta } from "@/lib/ficha";
import { roboAtivo } from "@/lib/robo";
import { registrarInteracaoVisitante } from "@/lib/perfil-visitante";
import {
  qualidadeAceita,
  qualidadeDoParecido,
  desvantagensDoParecido,
  textoDaQualidade,
  type Qualidade,
} from "@/lib/qualidade";
import { ConviteTelegram } from "@/components/ConviteTelegram";
import { analiseSoComAfiliado, ehLinkDeAfiliado, soAfiliado } from "@/lib/afiliado";
/* Ritmo da consulta: rapido no comeco, calmo depois.

   Com a ponte avisando a extensao na hora do pedido, a resposta costuma chegar
   nos primeiros segundos. Perguntar de 3 em 3 segundos o tempo todo faria o
   resultado ficar pronto no banco e a tela so mostrar dois ou tres segundos
   depois - espera inventada, do pior tipo. Entao: 1,2s nas primeiras voltas,
   3s dai em diante, para nao martelar o banco numa espera longa. */
const RITMO_RAPIDO_MS = 1200;
const VOLTAS_RAPIDAS = 15;
const RITMO_CALMO_MS = 3000;
/* A busca em outras lojas e os links de cada uma levam mais tempo. */
const LIMITE_MS = 240000;
/* Depois disso a espera deixou de ser normal. Nao desiste: troca o texto por um
   aviso honesto e da uma saida util para a pessoa nao abandonar a pagina. */
const AVISO_MS = 45000;
/* Segunda volta da extensão (regra do Weslei: enquanto não achar opção mais
   barata ou não tiver a análise completa, não desapontar o cliente). O
   resultado aparece em até 1 minuto e a tela continua se atualizando até a
   comparação terminar. A extensão fecha a análise em até 2 novas tentativas;
   isto é só a rede de segurança. */
const COMPLETAR_MS = 180000;

type Cupom = {
  /* id do cupom no banco. Com ele o site pede o código na hora, mesmo quando o
     cupom não estava na lista já conferida da home. */
  id?: number | null;
  titulo: string | null;
  vence: string | null;
  teto: number | null;
  minimo: number | null;
  economia: number | null;
  bloqueado: boolean | null;
};

function mensagemProduto({
  titulo,
  vendedor,
  cupom,
  codigo,
  link,
}: {
  titulo: string | null | undefined;
  vendedor: string | null | undefined;
  cupom: Cupom | null | undefined;
  codigo: string;
  link: string;
}) {
  /* Mesmo tom amigável da Melhor opção (Weslei, 02/10): emojis padrão e o
     dado só quando existe — nunca inventar desconto, limite ou validade. */
  const linhas = ["🎟️ *Achei um cupom pra essa compra!*"];
  linhas.push("");
  if (titulo) linhas.push(`✨ *${titulo}*`);
  if (vendedor) linhas.push(`🏪 Vendido por ${vendedor}`);
  if (cupom?.titulo) linhas.push(`🏷️ Cupom: *${cupom.titulo}*`);
  if (cupom?.teto != null) linhas.push(`💸 Economia de até *${brl(cupom.teto)}*`);
  else if (cupom) linhas.push("💸 Desconto sem limite de valor");
  if (cupom?.minimo != null) linhas.push(`🧾 Vale em compras a partir de ${brl(cupom.minimo)}`);
  if (cupom?.vence) linhas.push(`⏰ Válido até ${dataBR(cupom.vence)}`);
  linhas.push("");
  linhas.push("🛒 *Como usar:* copie o código e cole no carrinho");
  linhas.push(`📋 *${codigo}*`);
  linhas.push("");
  linhas.push("👉 *Compra segura por aqui:*");
  linhas.push(link);
  return linhas.join("\n");
}

/* Mensagem de WhatsApp da MELHOR opção, sempre com o link de afiliado.
   Curta, com o que faz a pessoa clicar: produto, preço, quanto economiza e o
   link. Sem código técnico, sem texto de site. */
/* Mensagem do WhatsApp: a ECONOMIA na primeira linha (é o que faz a pessoa
   abrir), sem nome de loja e sem promessa de cupom. Termina convidando quem
   recebe a comparar também. */
function mensagemMelhorOpcao({
  titulo,
  preco,
  precoOriginal,
  economia,
  comparadas,
  freteGratis,
  link,
}: {
  titulo: string | null | undefined;
  preco: number | null | undefined;
  precoOriginal: number | null | undefined;
  economia: number | null | undefined;
  comparadas: number;
  freteGratis?: boolean | null | undefined;
  link: string;
}) {
  const nome = semEntidades(titulo);
  const linhas: string[] = [];

  /* Tom de amigo indicando uma oportunidade real (Weslei, 02/10), com
     emojis padrão e espaçamento limpo; o link é sempre o de afiliado. */
  if (economia != null && economia >= 0.5) {
    linhas.push("🔥 *Olha só o desconto que achei pro mesmo produto!*");
    linhas.push("");
    if (nome) linhas.push(`✨ *${nome}*`);
    linhas.push("");
    linhas.push(
      freteGratis === false
        ? `💸 Economia de *${brl(economia)} a menos no produto* (frete à parte)`
        : `💸 Economia de *${brl(economia)} a menos*!`,
    );
    if (preco != null) {
      const dePor = precoOriginal != null ? `De ~${brl(precoOriginal)}~ por ` : "";
      linhas.push(`💰 ${dePor}*${brl(preco)}*`);
    }
    if (freteGratis === true) linhas.push("🚚 Frete grátis incluso");
  } else {
    linhas.push("👀 *Dá uma olhada nessa oferta que conferi!*");
    linhas.push("");
    if (nome) linhas.push(`✨ *${nome}*`);
    linhas.push("");
    if (preco != null) {
      const lojasTexto =
        comparadas > 0 ? ` · Melhor opção entre ${comparadas + 1} lojas pesquisadas` : "";
      linhas.push(`🏷️ *${brl(preco)}*${lojasTexto}`);
    }
    if (freteGratis === true) linhas.push("🚚 Frete grátis incluso");
  }

  linhas.push("");
  linhas.push("🛒 *Garanta o seu com compra segura por aqui:*");
  linhas.push(`👉 ${link}`);
  linhas.push("");
  linhas.push("💡 *Dica:* Compare qualquer produto antes de comprar em melhorescolha.io");

  return linhas.join("\n");
}

/* Motivos técnicos vêm da extensão e do servidor e citam o marketplace pelo
   nome. Na tela do cliente o site não exibe marca de terceiro. */
/* Título lido da página pode vir com entidade HTML (D&#x27;água). */
function semEntidades(t: string | null | undefined): string | null {
  if (!t) return t ?? null;
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function semMarca(t: string | null | undefined) {
  return String(t ?? "")
    .replace(/\bdo Mercado Livre\b/gi, "da loja")
    .replace(/\bno Mercado Livre\b/gi, "na loja")
    .replace(/\bo Mercado Livre\b/gi, "a loja")
    .replace(/Mercado ?Livre/gi, "loja");
}

function compartilharWhatsApp(texto: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
}

/* Telegram (05/10): o link de afiliado vai no campo url; o texto é o mesmo
   da mensagem do WhatsApp, sem repetir o link. */
function compartilharTelegram(texto: string, url: string) {
  const semLink = texto
    .split(url)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(semLink)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

/* Compartilhar a indicação: WhatsApp e Telegram, sempre com o link de
   afiliado (meli.la). */
function BotoesCompartilhar({ texto, link }: { texto: string; link: string }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => compartilharWhatsApp(texto)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-[#25D366] py-2 text-sm font-semibold text-[#128C7E] transition-colors hover:bg-[#25D366]/10"
      >
        <Share2 className="size-4" aria-hidden="true" />
        WhatsApp
      </button>
      <button
        type="button"
        onClick={() => compartilharTelegram(texto, link)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-[#229ED9] py-2 text-sm font-semibold text-[#1c7fb0] transition-colors hover:bg-[#229ED9]/10"
      >
        <Send className="size-4" aria-hidden="true" />
        Telegram
      </button>
    </div>
  );
}

/* A mesma coisa que a pessoa quer comprar, vendida por OUTRA loja que tem
   cupom. Só chega aqui quando é o mesmo produto de catálogo do Mercado Livre,
   nunca um parecido, e só quando sai mais barato que o anúncio colado. */
/* Características, destaques e descrição lidos na página de um anúncio. */
type Detalhes = {
  caracteristicas?: Array<{ nome: string; valor: string }> | null;
  destaques?: string[] | null;
  descricao?: string | null;
};

/* Preço cheio, no Pix e parcelado, lidos no evento do próprio anúncio
   (Weslei, 28/09: "cuidado com o valor à vista e parcelado"). */
type Precos = {
  cheio: number | null;
  pix: number | null;
  parcelas?: {
    vezes: number;
    valor: number | null;
    total: number | null;
    semJuros: boolean;
  } | null;
};

type OutraLoja = {
  /* Detalhes lidos na página do anúncio desta loja (28/09). */
  detalhes?: Detalhes | null;
  precos?: Precos | null;
  freteGratis?: boolean | null;
  /* Custo do frete para o CEP do cliente (02/10), quando simulado. */
  custoFrete?: number | null;
  /* Loja oficial da marca (Weslei, 27/09: a mais barata do agasalho era a
     loja oficial da adidas). Selo na tabela e na recomendação. */
  lojaOficial?: boolean | null;
  mercadoLider?: "platinum" | "gold" | "silver" | null;
  /* Outro anúncio da mesma loja do link colado, mais barato. */
  mesmaLoja?: boolean | null;
  cupomId?: number | null;
  /* Quanto a troca economiza de fato, ja comparando preco final com preco
     final. Vem da extensao, que e quem conhece os dois lados. */
  ganho?: number | null;
  finalAtual?: number | null;
  /* Veio da busca por título em vez da página de catálogo. */
  achadoNaBusca?: boolean | null;
  /* O link de afiliado abre a MESMA página de catálogo do anúncio colado (o
     gerador do Mercado Livre devolve um link só por ficha). A pessoa escolhe
     a loja em "Outras opções de compra". */
  mesmaPagina?: boolean | null;
  /* O programa de afiliados recusou este anúncio (erro 111): o link é o da
     ficha do produto. Fica na tabela, mas não vira recomendação. */
  semAfiliado?: boolean | null;
  /* Foto do anúncio desta loja e se a IA conferiu foto e descrição. */
  imagem?: string | null;
  verificadoIA?: boolean | null;
  vendedor: string | null;
  preco: number | null;
  economia: number | null;
  minimo: number | null;
  teto: number | null;
  final: number | null;
  cupomTitulo: string | null;
  vence: string | null;
  link: string | null;
  /* Endereço do anúncio: sem link pronto, o botão gera o link no clique. */
  url?: string | null;
  codigo: string | null;
  /* 'mais_barata': o preço final lá é menor. 'tem_cupom': a loja do anúncio
     não tem cupom e esta tem, sem sair mais cara. */
  motivo?: "mais_barata" | "tem_cupom" | null;
};

type Analise = {
  titulo: string | null;
  preco: number | null;
  vendedor: string | null;
  temCupom: boolean;
  cupom: Cupom | null;
  outraLoja: OutraLoja | null;
  /* Até duas lojas com o mesmo produto, a de menor preço final primeiro.
     outraLoja é a primeira desta lista (fica para pedidos antigos). */
  outrasLojas?: OutraLoja[] | null;
  /* true quando a busca por outra loja com cupom chegou a acontecer. Serve
     para separar "não procurei" de "procurei e não achou". */
  procurouOutra?: boolean | null;
  /* Em uma frase, por que a troca de loja não rolou. Só aparece quando a busca
     aconteceu e não achou nada. */
  motivoOutra?: string | null;
  /* Por que a busca por outra loja NÃO aconteceu. Fila cheia, busca do Mercado
     Livre fora do ar. Sem isto o site calava e o cliente achava que tinha sido
     comparado. */
  motivoNaoProcurou?: string | null;
  /* false quando a extensão não conseguiu sequer LER o anúncio. Sem isto o
     site tratava falha de leitura como "esta loja não tem cupom", que é dizer
     ao cliente uma coisa que não foi verificada. */
  lojaLida?: boolean | null;
  diagnostico?: string | null;
  /* Gravado quando existia oferta melhor mas o link de afiliado não saiu. */
  outraFalhou?: string | null;
  /* Preenchido quando o produto foi lido mas o link de afiliado não saiu. */
  linkFalhou?: string | null;
  /* Todas as outras lojas vistas com o mesmo produto, inclusive as mais
     caras. Só exibição: a pessoa vê que comparei e quanto pagaria a mais. */
  referencias?: Referencia[] | null;
  /* NAO e o mesmo produto: alternativas que a IA viu servir (mesmo tipo e
     compatibilidade), com o que muda. Sempre separadas e com aviso. */
  parecidos?: Array<{
    titulo: string | null;
    imagem?: string | null;
    preco: number;
    diferenca?: number | null;
    muda?: string | null;
    /* Mesma foto do anúncio colado (mesma sessão de fotos): o mais parecido. */
    mesmaFoto?: boolean | null;
    /* 0-100: quanto se parece com o anúncio colado (conferência pela foto). */
    semelhanca?: number | null;
    lojaOficial?: boolean | null;
    /* Achado na busca com o filtro "Lojas oficiais" (_Loja_all): é loja oficial. */
    daBuscaOficial?: boolean | null;
    /* Sugerido na própria página do anúncio colado (03/10). */
    sugerido?: boolean | null;
    /* O que tem A MAIS que o anúncio colado (conjunto completo, kit maior). */
    vantagem?: string | null;
    /* Qualidade x o colado, pela conferência (05/10): superior | equivalente
       | inferior | incerta, com o dado que sustenta. */
    qualidade?: string | null;
    qualidadeMotivo?: string | null;
    desvantagens?: string[] | null;
    /* Loja que vende (sempre que lida) e selo MercadoLíder dela. */
    vendedor?: string | null;
    mercadoLider?: "platinum" | "gold" | "silver" | null;
    link?: string | null;
    url?: string | null;
    semAfiliado?: boolean | null;
    freteGratis?: boolean | null;
    custoFrete?: number | null;
    detalhes?: Detalhes | null;
    precos?: Precos | null;
    /* Código do anúncio (MLB...): chave da avaliação do cliente. */
    item?: string | null;
  }> | null;
  /* Aviso que a página do anúncio mostra (ex.: "indisponível"). */
  aviso?: string | null;
  /* completa: achou loja mais barata, ou a busca e a conferência pela foto
     terminaram. final: false = a extensão ainda está refazendo a comparação
     (segunda volta); a tela continua se atualizando. */
  completa?: boolean | null;
  final?: boolean | null;
  voltas?: number | null;
  /* true = os links de afiliado das outras linhas ainda estão sendo gerados
     (a tela continua se atualizando). */
  linksPendentes?: boolean | null;
  /* Frete do anúncio colado: true grátis, false pago, null não sei. */
  freteGratis?: boolean | null;
  /* Categoria do anúncio colado (breadcrumb), lida na página. */
  categoria?: string | null;
  /* CEP do cliente (02/10): com ele, o frete de cada loja foi simulado para
     esse CEP pela API oficial; custoFrete = do anúncio colado. */
  cepDestino?: string | null;
  custoFrete?: number | null;
  lojaOficial?: boolean | null;
  precos?: Precos | null;
  /* Características, destaques e descrição lidos no anúncio (27/09). */
  detalhes?: {
    caracteristicas?: Array<{ nome: string; valor: string }> | null;
    destaques?: string[] | null;
    descricao?: string | null;
  } | null;
  /* Foto do anúncio colado e o que a busca em outras lojas leu. */
  imagem?: string | null;
  buscaFora?: {
    vistos?: number | null;
    leitura?: {
      comPreco?: number | null;
      parecidos?: number | null;
      ia?: {
        conferidos?: number | null;
        iguais?: number | null;
        indisponivel?: boolean | null;
        /* O proprio anuncio colado se contradiz (foto x texto), 28/09. */
        alertaOriginal?: string | null;
      } | null;
    } | null;
  } | null;
};

type Referencia = {
  vendedor: string | null;
  preco: number | null;
  final: number | null;
  /* final lá menos final aqui: positivo = lá sai mais caro. */
  diferenca: number | null;
  cupom: string | null;
  /* Endereço do anúncio desta loja. O link de afiliado só é gerado se o
     cliente pedir ("Ver na loja"). */
  url?: string | null;
  imagem?: string | null;
  /* Link de afiliado desta loja, gerado em lote pela extensão. */
  link?: string | null;
  /* Recusado pelo programa de afiliados (erro 111): link da ficha. */
  semAfiliado?: boolean | null;
  freteGratis?: boolean | null;
  custoFrete?: number | null;
  mesmaLoja?: boolean | null;
  lojaOficial?: boolean | null;
  mercadoLider?: "platinum" | "gold" | "silver" | null;
  detalhes?: Detalhes | null;
  precos?: Precos | null;
};

type Pedido = {
  status: "pendente" | "processando" | "pronto" | "falhou";
  link: string | null;
  codigo: string | null;
  erro: string | null;
  analise: Analise | null;
  /* Quando a comparação foi feita. Toda pesquisa fica registrada, sem prazo
     (Weslei, 27/09); a tela diz há quanto tempo foi. */
  comparado_em?: string | null;
};

type Fase = "parado" | "enviando" | "na-fila" | "outras-lojas" | "lendo" | "pronto" | "offline";

const brl = (n: number | null | undefined) =>
  n == null ? null : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* O cupom chega com o titulo que o proprio Mercado Livre escreve: "15% OFF"
   ou "R$ 30 OFF". Lendo esse titulo eu consigo dizer quanto o desconto vale
   exatamente na compra minima. Se o titulo nao disser nem percentual nem
   valor, o site mostra so o quanto falta e nao inventa numero nenhum. */
const numeroBR = (bruto: string) => {
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function descontoNaCompraMinima(
  titulo: string | null | undefined,
  minimo: number,
  teto: number | null,
) {
  if (!titulo) return null;
  let desconto: number | null = null;

  const emPorcento = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/.exec(titulo);
  if (emPorcento?.[1]) {
    const pct = numeroBR(emPorcento[1]);
    if (pct == null || pct <= 0 || pct > 100) return null;
    desconto = (minimo * pct) / 100;
  } else {
    const emReais = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/.exec(titulo);
    if (!emReais?.[1]) return null;
    const valor = numeroBR(emReais[1]);
    if (valor == null || valor <= 0) return null;
    desconto = valor;
  }

  if (teto != null) desconto = Math.min(desconto, teto);
  // Um desconto maior que a propria compra minima seria leitura errada do titulo.
  if (desconto <= 0 || desconto > minimo) return null;
  return desconto;
}

const dataBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : null;
};

const ehLinkML = (u: string) =>
  /^https?:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(\/|$)/i.test(
    u.trim(),
  );

/* URL que aponta direto para um anúncio ou produto de catálogo. */
const ehProdutoML = (u: string) => /\/p\/MLB\d+/i.test(u) || /\/MLB-?\d+/i.test(u);

/* Encurtado do próprio Mercado Livre: precisa de um salto a mais para virar
   endereço de produto, e costuma carregar a etiqueta de quem compartilhou. */
const ehCurtoML = (u: string) =>
  /^https?:\/\/(meli\.la|(www\.)?mercadolivre\.com\.br\/sec)\//i.test(u);

/* Parâmetros que dizem QUAL oferta a pessoa estava vendo. Valem manter: é o
   anúncio daquele vendedor específico dentro da página de catálogo.
   Todo o resto é rastreamento de quem compartilhou (matt_tool, matt_word, ua,
   sid, action, tracking_id) e vai fora. Manter matt_word seria pior que
   inútil: seria entregar a venda com a etiqueta de outro afiliado. */
const PARAMS_UTEIS = new Set(["pdp_filters", "wid", "variation", "quantity"]);

function limparLinkML(bruto: string): string {
  try {
    const u = new URL(bruto);
    /* Em link /up/MLBU... o anúncio escolhido vem na âncora (wid=MLB...).
       Ele vira pdp_filters=item_id:MLB..., a forma do próprio Mercado Livre,
       para a comparação saber qual loja o cliente estava vendo. */
    /* Link de afiliado que abre o PERFIL (/social/<apelido>?...&ref=...): o
       produto está no "ref". Sem ele o link cai na lista do perfil (26/09:
       "a conferência está pausada" com o link do próprio Weslei). */
    if (/\/social\//i.test(u.pathname)) {
      u.hash = "";
      return u.toString();
    }
    const wid = /[#&]wid=(MLB\d{6,})/i.exec(u.hash)?.[1];
    u.hash = "";
    if (wid && !/item_id/i.test(u.search))
      u.searchParams.set("pdp_filters", `item_id:${wid.toUpperCase()}`);
    for (const chave of [...u.searchParams.keys()]) {
      if (!PARAMS_UTEIS.has(chave)) u.searchParams.delete(chave);
    }
    return u.toString();
  } catch {
    // Sem parse possível: pelo menos tira a âncora de rastreio.
    return bruto.split("#")[0] ?? bruto;
  }
}

/* Escolhe O link certo de um texto colado.

   O texto que o aplicativo do Mercado Livre gera ao compartilhar traz DOIS
   endereços do mesmo produto: o encurtado (meli.la) e o completo. Pegar o
   primeiro, como eu fazia, pegava o encurtado — que exige um salto a mais e
   carrega a etiqueta de quem compartilhou.

   Então a escolha é por qualidade, não por ordem:
     1. endereço de produto ou de catálogo, que é direto e sem ambiguidade;
     2. encurtado do Mercado Livre, se não houver nada melhor;
     3. qualquer endereço do Mercado Livre.

   Também resolve a sujeira antiga: mesma URL emendada duas vezes sem espaço,
   texto em volta, quebra de linha no meio. */
function melhorLinkML(texto: string): string | null {
  const limpo = String(texto || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpo) return null;

  const candidatos: string[] = [];
  for (const bruto of limpo.match(/https?:\/\/[^\s"'<>]+/gi) || []) {
    // Duas URLs coladas sem espaco: corta na segunda ocorrencia de "http".
    const corte = bruto.slice(8).search(/https?:\/\//i);
    const candidato = corte >= 0 ? bruto.slice(0, corte + 8) : bruto;
    if (ehLinkML(candidato)) candidatos.push(candidato);
  }
  if (!candidatos.length) return null;

  const escolhido = candidatos.find(ehProdutoML) ?? candidatos.find(ehCurtoML) ?? candidatos[0];

  return escolhido ? limparLinkML(escolhido) : null;
}

/* As tres etapas sao de verdade:
     enviando  - o site esta registrando o pedido
     na-fila   - registrado, esperando a extensao pegar
     lendo     - a extensao pegou (status 'processando' no banco) e esta
                 lendo o anuncio, procurando o cupom e gerando o link
   Nada aqui e temporizador fingindo progresso. */
const ETAPAS: Array<{ id: Fase; rotulo: string }> = [
  { id: "enviando", rotulo: "Enviando o link" },
  { id: "na-fila", rotulo: "Lendo o anúncio" },
  /* Etapa real: a extensão avisa (analise.etapa) quando começa a procurar o
     mesmo produto em outras lojas. É a parte mais demorada, e o cliente
     espera melhor sabendo que ela existe. */
  { id: "outras-lojas", rotulo: "Procurando o mesmo produto em lojas mais baratas" },
  { id: "lendo", rotulo: "Gerando seus links de compra" },
];

/* ---------------------------------------------- celular, app ou computador

   O botão de compra fala com a pessoa de acordo com onde ela está:
     celular     - o link do Mercado Livre abre o APP direto no produto;
     app-interno - navegador de dentro do Instagram/Facebook/TikTok, que não
                   abre outros apps: a pessoa precisa sair para o navegador;
     computador  - abre o anúncio no site, numa aba nova.
   Decidido só no navegador (depois de montar), nunca no servidor. */
type Dispositivo = "celular" | "app-interno" | "computador";

function useDispositivo(): Dispositivo {
  const [d, setD] = useState<Dispositivo>("computador");
  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\//i.test(ua)) setD("app-interno");
    else if (
      /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
    )
      setD("celular");
    else setD("computador");
  }, []);
  return d;
}

function textoDoBotao(d: Dispositivo, base: string) {
  return d === "celular" ? `${base} pelo app` : base;
}

function AvisoDoBotao({ d }: { d: Dispositivo }) {
  const texto =
    d === "celular"
      ? "Abre no app oficial, com pagamento protegido."
      : d === "app-interno"
        ? 'Se abrir aqui dentro, toque nos três pontinhos e em "Abrir no navegador".'
        : "Abre no site oficial, com pagamento protegido.";
  return <p className="mt-1 text-center text-[11px] text-secondary-ink">{texto}</p>;
}

/* HISTÓRICO NO APARELHO: as últimas comparações ficam só no navegador de quem
   usa (nada vai para o servidor). Serve para voltar e comprar depois. */
type ItemHistorico = {
  url: string;
  titulo: string;
  imagem: string | null;
  melhor: number | null;
  economia: number | null;
  quando: number;
};
const CHAVE_HISTORICO = "me_historico_v1";
function lerHistorico(): ItemHistorico[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE_HISTORICO);
    const lista = bruto ? (JSON.parse(bruto) as ItemHistorico[]) : [];
    return Array.isArray(lista) ? lista.slice(0, 5) : [];
  } catch {
    return [];
  }
}
function gravarHistorico(lista: ItemHistorico[]) {
  try {
    window.localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(0, 5)));
  } catch {
    /* navegador sem armazenamento: segue sem histórico */
  }
}
function itemDoHistorico(urlColada: string, a: Analise): ItemHistorico | null {
  if (!a.titulo) return null;
  const candidatos = [
    a.preco,
    ...(a.outrasLojas ?? []).filter((o) => o.freteGratis !== false).map((o) => o.final),
  ].filter((n): n is number => typeof n === "number");
  const melhor = candidatos.length ? Math.min(...candidatos) : null;
  return {
    url: urlColada,
    titulo: semEntidades(a.titulo) ?? a.titulo,
    imagem: a.imagem ?? null,
    melhor,
    economia:
      a.preco != null && melhor != null && a.preco - melhor >= 0.5 ? a.preco - melhor : null,
    quando: Date.now(),
  };
}

function Historico({
  lista,
  comparar,
  limpar,
}: {
  lista: ItemHistorico[];
  comparar: (url: string) => void;
  limpar: () => void;
}) {
  if (!lista.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <History className="size-4 text-ml-blue" aria-hidden="true" />
        <p className="text-sm font-bold">Suas últimas comparações</p>
        <button
          type="button"
          onClick={limpar}
          className="ml-auto text-[11px] font-semibold text-secondary-ink hover:underline"
        >
          limpar
        </button>
      </div>
      <p className="text-[11px] text-secondary-ink">Ficam só neste aparelho.</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {lista.map((h) => (
          <li key={h.url} className="flex items-center gap-2 rounded-md border border-border p-1.5">
            <Foto src={h.imagem} className="size-10 shrink-0 rounded" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-medium">{h.titulo}</p>
              <p className="text-[11px] tabular-nums text-secondary-ink">
                {h.melhor != null && (
                  <span className="font-bold text-foreground">{brl(h.melhor)}</span>
                )}
                {h.economia != null && (
                  <span className="font-bold text-success"> · {brl(h.economia)} a menos</span>
                )}
                <span>
                  {" · "}
                  {new Date(h.quando).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => comparar(h.url)}
              className="shrink-0 rounded border border-ml-blue px-2 py-1 text-[11px] font-bold text-ml-blue hover:bg-ml-blue/5"
            >
              <span className="sm:hidden">Ver se caiu</span>
              <span className="hidden sm:inline">Verificar se o preço caiu</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* CONTINUAR DE ONDE PAROU (05/10): as últimas comparações do aparelho em
   atalhos logo abaixo do campo, com a caixa parada. Um toque compara de novo. */
function ContinuarDeOndeParou({
  lista,
  comparar,
  limpar,
}: {
  lista: ItemHistorico[];
  comparar: (url: string) => void;
  limpar: () => void;
}) {
  if (!lista.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-secondary-ink">
      <span className="inline-flex items-center gap-1 font-medium">
        <History className="size-3.5" aria-hidden="true" />
        Continuar de onde parou:
      </span>
      {lista.slice(0, 4).map((h) => (
        <button
          key={h.url}
          type="button"
          onClick={() => comparar(h.url)}
          title="Comparar de novo com o preço de agora"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 font-medium text-foreground transition-colors hover:border-ml-blue hover:bg-muted"
        >
          <span className="max-w-[140px] truncate">{h.titulo}</span>
          {h.economia != null && (
            <span className="shrink-0 font-semibold tabular-nums text-success">
              {brl(h.economia)} a menos
            </span>
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={limpar}
        className="text-[11px] font-semibold text-secondary-ink hover:underline"
      >
        limpar
      </button>
    </div>
  );
}

/* O que a comparação apontou como melhor saiu com frete grátis? (perfil de
   interesse: só conta o que foi confirmado, nunca "não sei"). */
function melhorComFreteGratis(a: Analise): boolean {
  const gratis = (a.outrasLojas ?? []).filter(
    (o) => o.freteGratis === true && typeof o.final === "number" && !o.semAfiliado,
  );
  const melhor = gratis.length ? Math.min(...gratis.map((o) => o.final as number)) : null;
  if (melhor != null && (a.preco == null || melhor <= a.preco - 0.5)) return true;
  return a.freteGratis === true;
}

export default function BuscaPorLink({
  aoMudarEstado,
}: {
  /* Avisa a página se a caixa está parada (sem comparação na tela): a home
     só mostra o convite do Telegram de baixo nesse caso. */
  aoMudarEstado?: (parada: boolean) => void;
} = {}) {
  const [url, setUrl] = useState("");
  const [fase, setFase] = useState<Fase>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [demorando, setDemorando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [inicio, setInicio] = useState(() => Date.now());
  const [estimativa, setEstimativa] = useState<Estimativa>(null);
  const [completando, setCompletando] = useState(false);
  const [historico, setHistorico] = useState<ItemHistorico[]>([]);
  useEffect(() => setHistorico(lerHistorico()), []);
  /* CEP do cliente (02/10): região pelo IP, trocável; vai no pedido. */
  const { regiao, trocar: trocarCep, pedirLocalizacao } = useCepDestino(true);
  const cepRef = useRef<string | null>(null);
  useEffect(() => {
    cepRef.current = regiao?.cep ?? null;
  }, [regiao]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Pedido que a tela está acompanhando. A espera pela segunda volta dura
     minutos: uma consulta velha nunca pode sobrescrever um link novo colado. */
  const atual = useRef<number | null>(null);
  /* Link (limpo) do pedido acompanhado, para o histórico. */
  const urlDoPedido = useRef<string | null>(null);
  const perfilRegistrado = useRef<string | null>(null);

  const limparTimers = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (prazo.current) clearTimeout(prazo.current);
    if (aviso.current) clearTimeout(aviso.current);
    timer.current = null;
    prazo.current = null;
    aviso.current = null;
  }, []);

  useEffect(() => limparTimers, [limparTimers]);

  const buscar = useCallback(
    /* nova: "Atualizar comparação" — compara de novo mesmo com resultado
       recente (Weslei, 27/09: o botão fica sempre). */
    async (bruta: string, nova = false) => {
      const alvo = bruta.trim();
      if (!alvo) return;

      limparTimers();
      atual.current = null;
      setErro(null);
      setPedido(null);
      setCopiado(null);
      setDemorando(false);
      setMotivo(null);
      setCompletando(false);

      const limpo = melhorLinkML(alvo);
      urlDoPedido.current = limpo;
      if (!limpo) {
        setFase("parado");
        setErro("Esse link não é de um anúncio válido. Cole o endereço do produto.");
        return;
      }

      setFase("enviando");
      setInicio(Date.now());
      void (async () => {
        try {
          const { data } = await supabase.rpc("tempo_estimado" as never);
          const l = (Array.isArray(data) ? data[0] : data) as {
            segundos?: number | null;
            amostras?: number;
          } | null;
          setEstimativa(l?.segundos ? { segundos: l.segundos, amostras: l.amostras ?? 0 } : null);
        } catch {
          setEstimativa(null);
        }
      })();

      /* Extensão desligada: o pedido ficaria na fila sem ninguém atender e o
         cliente esperaria à toa. Diz na hora. */
      if (!(await roboAtivo())) {
        setFase("offline");
        setMotivo(null);
        setErro(null);
        return;
      }

      /* Número + chave aleatória do pedido (27/09): o resultado só é lido
         com a chave, não com o número sequencial. */
      const cepAtual = cepRef.current;
      const { data: pedidoNovo, error } = await supabase.rpc(
        "pedir_comparacao" as never,
        (cepAtual
          ? { p_url: limpo, p_nova: nova, p_cep: cepAtual }
          : { p_url: limpo, p_nova: nova }) as never,
      );
      const id = (pedidoNovo as { id?: number } | null)?.id ?? null;
      const chave = (pedidoNovo as { chave?: string } | null)?.chave ?? null;

      if (error || id == null || !chave) {
        limparTimers();
        setFase("offline");
        setErro(
          /link invalido/i.test(error?.message ?? "")
            ? "Esse link não é de um anúncio válido. Cole o endereço do produto."
            : /fila cheia/i.test(error?.message ?? "")
              ? "Muitas comparações ao mesmo tempo agora. Em 1 minuto a fila libera."
              : null,
        );
        return;
      }

      atual.current = id;
      setFase("na-fila");
      /* Cutuca a extensao na hora. Sem isso o pedido espera o alarme do Chrome,
         que nao roda em menos de 1 minuto: era esse o tempo morto da espera. */
      try {
        window.postMessage(
          { de: "cupons-afiliado-ml", tipo: "pedido-novo", id },
          window.location.origin,
        );
      } catch {
        /* sem extensao: o alarme cobre */
      }

      let voltas = 0;
      let parou = false;
      let prontoEm: number | null = null;
      let ultimoVisto = "";

      const consultar = async () => {
        if (atual.current !== id) return;
        const { data } = await supabase.rpc(
          "ver_pedido" as never,
          { p_id: id, p_chave: chave } as never,
        );
        if (atual.current !== id) return;
        // O tipo gerado do RPC devolve status como string solta; aqui a gente
        // sabe o formato porque a funcao no banco e nossa.
        const bruto = Array.isArray(data) ? data[0] : data;
        const cru = bruto ? (bruto as unknown as Pedido) : null;
        /* Só link de afiliado (meli.la) chega à tela; o resto vira o botão que
           gera o link no clique. */
        const linha = cru
          ? { ...cru, link: soAfiliado(cru.link), analise: analiseSoComAfiliado(cru.analise) }
          : null;

        if (linha?.status === "processando") {
          const etapa = (linha.analise as { etapa?: string } | null)?.etapa;
          if (etapa === "outras_lojas") setFase("outras-lojas");
          else if (etapa === "links") setFase("lendo");
          else setFase("na-fila");
        }

        /* Pronto com análise mas sem link: a comparação aparece e o botão gera
           o link de afiliado no clique (regra: sempre devolver o link). */
        if (linha?.status === "pronto" && (linha.link || linha.analise)) {
          limparTimers();
          /* Só troca a tela quando a análise mudou (a segunda volta grava de
             novo o pedido). */
          const visto = JSON.stringify([linha.link, linha.analise]);
          if (visto !== ultimoVisto) {
            ultimoVisto = visto;
            setPedido(linha);
          }
          setFase("pronto");
          prontoEm ??= Date.now();
          /* Comparação ainda em andamento: o cliente já vê produto, preço e o
             link, e a tela continua se atualizando até a análise completar. */
          const dentroDoPrazo = Date.now() - prontoEm < COMPLETAR_MS;
          const aindaComparando = linha.analise?.final === false && dentroDoPrazo;
          /* Links da tabela chegando logo depois do resultado: continua
             consultando, sem mostrar "ainda procurando". */
          const esperandoLinks = linha.analise?.linksPendentes === true && dentroDoPrazo;
          setCompletando(aindaComparando);
          if (!aindaComparando && !esperandoLinks) {
            parou = true;
            return;
          }
          timer.current = setTimeout(consultar, RITMO_CALMO_MS);
          return;
        }
        if (linha?.status === "falhou") {
          parou = true;
          limparTimers();
          /* Guarda o motivo real. Sem isso a pessoa (e o Weslei) so via "fora
             do ar" e nao dava para saber se era sessao caida, link errado ou
             erro nosso. */
          setMotivo(
            linha.erro ??
              (linha.analise as { diagnostico?: string | null } | null)?.diagnostico ??
              null,
          );
          setFase("offline");
          return;
        }

        if (!parou) {
          voltas += 1;
          timer.current = setTimeout(
            consultar,
            voltas < VOLTAS_RAPIDAS ? RITMO_RAPIDO_MS : RITMO_CALMO_MS,
          );
        }
      };

      aviso.current = setTimeout(() => setDemorando(true), AVISO_MS);
      prazo.current = setTimeout(() => {
        parou = true;
        limparTimers();
        setFase((f) => (f === "pronto" ? f : "offline"));
      }, LIMITE_MS);
      consultar();
    },
    [limparTimers],
  );

  /* A vitrine pede "comparar de novo" um produto: coloca o link na caixa,
     rola até ela e compara. */
  useEffect(() => {
    const ouvir = (e: Event) => {
      const alvo = (e as CustomEvent<string>).detail;
      if (typeof alvo !== "string" || !alvo) return;
      setUrl(alvo);
      document.getElementById("colar-link")?.scrollIntoView({ behavior: "smooth", block: "start" });
      void buscar(alvo);
    };
    window.addEventListener("comparar-link", ouvir);
    return () => window.removeEventListener("comparar-link", ouvir);
  }, [buscar]);

  /* Link no endereço (?link=..., 02/10): o bot do Telegram manda o cliente
     para cá e a comparação abre sozinha (a mesma de menos de 1 h volta na
     hora, sem novo pedido). */
  useEffect(() => {
    let alvo: string | null = null;
    try {
      /* Compartilhado pelo app instalado (share_target, 05/10): o app do
         Mercado Livre manda o endereço solto no texto ("Olha isto:
         https://meli.la/..."); vale o primeiro endereço do Mercado Livre em
         link, texto ou título. */
      const q = new URLSearchParams(window.location.search);
      const re =
        /https?:\/\/(?:[a-z0-9-]+\.)*(?:mercadolivre\.com\.br|mercadolibre\.com|meli\.la)\/[^\s<>"']+/i;
      for (const v of [q.get("link"), q.get("text"), q.get("title")]) {
        const m = v ? re.exec(v) : null;
        if (m) {
          alvo = m[0];
          break;
        }
      }
    } catch {
      alvo = null;
    }
    if (
      !alvo ||
      !/^https?:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)\//i.test(alvo)
    )
      return;
    setUrl(alvo);
    document.getElementById("colar-link")?.scrollIntoView({ behavior: "smooth", block: "start" });
    void buscar(alvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copiar = (texto: string, marca: string) => {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(marca);
        setTimeout(() => setCopiado(null), 1600);
      })
      .catch(() => undefined);
  };

  /* Guarda o resultado no histórico do aparelho (atualiza quando a segunda
     volta muda a análise). */
  useEffect(() => {
    const alvo = urlDoPedido.current;
    if (fase !== "pronto" || !pedido?.analise || !alvo) return;
    const item = itemDoHistorico(alvo, pedido.analise);
    if (!item) return;
    /* Perfil de interesse (só com consentimento de análise): uma vez por
       pedido, mesmo que a segunda volta atualize a análise. */
    const marca = `${atual.current ?? ""}|${alvo}`;
    if (perfilRegistrado.current !== marca) {
      perfilRegistrado.current = marca;
      registrarInteracaoVisitante({
        titulo: item.titulo,
        preco: item.melhor ?? pedido.analise.preco,
        categoria: pedido.analise.categoria ?? null,
        freteGratisEscolhido: melhorComFreteGratis(pedido.analise),
      });
    }
    setHistorico((h) => {
      const nova = [item, ...h.filter((x) => x.url !== alvo)].slice(0, 5);
      gravarHistorico(nova);
      return nova;
    });
  }, [fase, pedido]);

  const carregando =
    fase === "enviando" || fase === "na-fila" || fase === "outras-lojas" || fase === "lendo";
  const parada = fase === "parado" && !pedido;
  useEffect(() => {
    aoMudarEstado?.(parada);
  }, [parada, aoMudarEstado]);

  return (
    <section
      id="colar-link"
      data-origem="resultado"
      data-pedido={fase === "pronto" && atual.current != null ? String(atual.current) : undefined}
      className={
        "mx-auto rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] transition-[max-width] sm:p-5 " +
        /* Com resultado, usa a largura da tela (Weslei, 28/09: "aproveite
           melhor o espaço"); sem resultado, a caixa do link fica enxuta. */
        (fase === "pronto" && pedido ? "max-w-3xl lg:max-w-6xl" : "max-w-3xl")
      }
    >
      <div className="mb-1 flex items-center gap-2">
        <Link2 aria-hidden="true" className="size-5 text-[#7547E8]" />
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">Cole o link do produto</h2>
      </div>
      <p className="mb-2 text-xs text-secondary-ink">
        Procuro o mesmo produto em outras lojas dentro do Mercado Livre e mostro onde sai mais
        barato.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          id="campo-link-produto"
          rows={1}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={pedirLocalizacao}
          onPaste={(e) => {
            const colado = e.clipboardData.getData("text");
            if (colado && colado.trim().length > 20) {
              setUrl(colado);
              setTimeout(() => buscar(colado), 0);
            }
          }}
          placeholder="Cole aqui o link do anúncio do produto"
          aria-label="Link do anúncio do produto"
          className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-border bg-[#f5f5f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#7547E8] focus:bg-background focus:ring-2 focus:ring-[#7547E8]/30 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={() => buscar(url)}
          disabled={carregando || !url.trim()}
          className="min-h-11 shrink-0 rounded-xl bg-ml-yellow px-5 py-2.5 text-sm font-bold text-[#21134A] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:self-start sm:text-base"
        >
          {carregando ? "Comparando..." : "Comparar preços"}
        </button>
      </div>
      <SeloCep regiao={regiao} trocar={trocarCep} />
      {fase === "parado" && !pedido && (
        <ContinuarDeOndeParou
          lista={historico}
          comparar={(alvo) => {
            setUrl(alvo);
            void buscar(alvo);
          }}
          limpar={() => {
            gravarHistorico([]);
            setHistorico([]);
          }}
        />
      )}

      {erro && <p className="mt-3 text-sm font-medium text-danger">{erro}</p>}

      {/* Como funciona (vídeo de 28 s): só com a caixa parada, antes de comparar. */}
      {fase === "parado" && !pedido && <ComoFunciona />}

      {carregando && (
        <Espera fase={fase} demorando={demorando} inicio={inicio} estimativa={estimativa} />
      )}

      {fase === "pronto" && pedido && (
        <IdadeDaComparacao
          em={pedido.comparado_em ?? null}
          atualizar={() => void buscar(url, true)}
        />
      )}
      {fase === "pronto" && pedido && (
        <Resultado
          pedido={pedido}
          copiar={copiar}
          copiado={copiado}
          urlColada={melhorLinkML(url) ?? null}
          completando={completando}
          pedidoId={atual.current}
          cepTela={regiao && !regiao.padrao ? regiao.cep : null}
        />
      )}

      {/* Convite do Telegram só depois do resultado pronto (nunca carregando). */}
      {fase === "pronto" && pedido && !completando && (
        <ConviteTelegram formato="cartao" origem="resultado" className="mt-6" />
      )}

      {fase === "offline" && !erro && <Offline tentar={() => buscar(url)} motivo={motivo} />}

      {/* Com a caixa parada as últimas comparações já aparecem em atalhos acima. */}
      {!carregando && !(fase === "parado" && !pedido) && (
        <Historico
          lista={historico.filter((h) => !(fase === "pronto" && h.url === urlDoPedido.current))}
          comparar={(alvo) => {
            setUrl(alvo);
            void buscar(alvo);
          }}
          limpar={() => {
            gravarHistorico([]);
            setHistorico([]);
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- espera

   Tres coisas trabalham juntas para a espera parecer curta:

   1. As etapas sao o estado REAL do pedido no banco. Quando a extensao pega o
      pedido, o status vira 'processando' e a terceira etapa acende sozinha.
      Nao existe barra andando ate 90% por conta propria — isso engana uma vez
      e depois a pessoa aprende que o site mente.
   2. O esqueleto tem a forma exata do resultado. O olho ja sabe onde o preco e
      o botao vao aparecer, entao a troca do esqueleto pela resposta parece
      instantanea.
   3. O brilho atravessando o esqueleto mostra atividade sem prometer prazo.
*/

/* Tempo REAL das últimas consultas (percentil 75, calculado no banco pela
   função tempo_estimado). Sem medição suficiente, não há previsão: mostra só
   quanto tempo já passou. Nunca um número inventado. */
type Estimativa = { segundos: number; amostras: number } | null;

function Relogio({ inicio, estimativa }: { inicio: number; estimativa: Estimativa }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const passou = Math.max(0, Math.round((agora - inicio) / 1000));
  const fmt = (n: number) =>
    n >= 60 ? `${Math.floor(n / 60)}min ${String(n % 60).padStart(2, "0")}s` : `${n}s`;
  if (!estimativa) {
    return (
      <p className="mb-2 text-center text-xs tabular-nums text-secondary-ink">
        Comparando há {fmt(passou)}
      </p>
    );
  }
  const falta = estimativa.segundos - passou;
  const pct = Math.min(100, Math.round((passou / estimativa.segundos) * 100));
  return (
    <div className="mb-3">
      <p className="text-center text-sm font-semibold tabular-nums">
        {falta > 0 ? <>Pronto em até {fmt(falta)}</> : <>Quase lá… já são {fmt(passou)}</>}
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-ml-blue transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-center text-[11px] text-secondary-ink">
        {falta > 0
          ? `Previsão pelo tempo real das últimas ${estimativa.amostras} consultas.`
          : `Passou do tempo usual (${fmt(estimativa.segundos)}). Continuo comparando.`}
      </p>
    </div>
  );
}

function Espera({
  fase,
  demorando,
  inicio,
  estimativa,
}: {
  fase: Fase;
  demorando: boolean;
  inicio: number;
  estimativa: Estimativa;
}) {
  const atual = ETAPAS.findIndex((e) => e.id === fase);

  return (
    <div className="mt-4" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        {atual >= 0 ? ETAPAS[atual]?.rotulo : "Conferindo"}
      </p>

      <div className="mb-3 flex items-center gap-2 rounded-md bg-ml-blue/5 px-3 py-2 text-sm font-semibold text-ml-blue">
        <LoaderCircle className="animate-giro-calmo size-4 shrink-0" aria-hidden="true" />
        <span>{atual >= 0 ? ETAPAS[atual]?.rotulo : "Conferindo seu produto"}</span>
      </div>

      <Relogio inicio={inicio} estimativa={estimativa} />

      <ol className="mb-3 space-y-2">
        {ETAPAS.map((etapa, i) => {
          const feita = atual > i;
          const andando = atual === i;
          return (
            <li key={etapa.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 " +
                  (feita
                    ? "etapa-feita border-success bg-success text-white"
                    : andando
                      ? "etapa-andando border-ml-blue"
                      : "border-border")
                }
              >
                {feita ? (
                  <svg viewBox="0 0 20 20" fill="none" className="size-3" aria-hidden="true">
                    <path
                      d="M4 10.5 8 14.5 16 6"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    className={"size-1.5 rounded-full " + (andando ? "bg-ml-blue" : "bg-border")}
                  />
                )}
              </span>
              <span
                className={
                  feita
                    ? "text-secondary-ink"
                    : andando
                      ? "font-semibold text-foreground"
                      : "text-secondary-ink/60"
                }
              >
                {etapa.rotulo}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Esqueleto com a forma do resultado: titulo, preco, vendedor, caixa do
          cupom e botao de comprar. */}
      <div className="rounded-lg border border-border p-4">
        <div className="esqueleto h-4 w-4/5 rounded" />
        <div className="esqueleto mt-2 h-4 w-2/5 rounded" />
        <div className="esqueleto mt-3 h-7 w-1/3 rounded" />
        <div className="esqueleto mt-2 h-3 w-1/2 rounded" />
        <div className="esqueleto mt-4 h-20 w-full rounded-md" />
        <div className="esqueleto mt-4 h-11 w-full rounded-md" />
      </div>

      {demorando && !estimativa ? (
        <p className="mt-2 text-center text-xs leading-relaxed text-secondary-ink">
          Está demorando mais que o normal, mas eu continuo tentando. Deixe a página aberta: o
          resultado aparece aqui sozinho.
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-secondary-ink">
          Pode deixar esta página aberta. O resultado aparece aqui mesmo.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------- codigo do cupom na hora

   O cupom pode existir entre os milhares da conta do Weslei sem nunca ter
   passado pela lista conferida da home. Quando o anúncio colado cai numa loja
   assim, o site pede o código aqui mesmo: a extensão cria em segundos e o
   botão então copia o código e abre o produto pelo link de afiliado.

   A cópia acontece dentro do clique sempre que dá; quando o código chega
   depois da espera, o site copia assim mesmo e avisa o que foi copiado, para
   ninguém chegar na loja de mãos vazias. */

function copiarAgora(texto: string): boolean {
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* plano B */
  }
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

function CodigoNaHora({
  cupomId,
  destino,
  titulo,
  vendedor,
  cupom,
}: {
  cupomId: number;
  destino: string;
  titulo: string | null | undefined;
  vendedor: string | null | undefined;
  cupom: Cupom | null | undefined;
}) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [fase, setFase] = useState<"parado" | "gerando" | "falhou">("parado");
  const [copiou, setCopiou] = useState(false);
  const [redirecionando, setRedirecionando] = useState(false);
  const relogios = useRef<number[]>([]);
  const redirecionamento = useRef<number | null>(null);
  const acao = useRef<"abrir" | "compartilhar">("abrir");

  useEffect(
    () => () => {
      relogios.current.forEach((t) => window.clearTimeout(t));
      if (redirecionamento.current) window.clearTimeout(redirecionamento.current);
    },
    [],
  );

  /* Loja com código JÁ gerado: aparece pronto para copiar, sem clique e sem
     pedir geração nova (só leitura). Pode ser o código de outro cupom válido
     da mesma loja; nesse caso o desconto dele aparece junto. */
  const [outroCupom, setOutroCupom] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.rpc(
          "etiqueta_da_loja" as never,
          { p_cupom_id: cupomId } as never,
        );
        const e = data as {
          codigo?: string;
          desconto?: string | null;
          mesmo_cupom?: boolean;
        } | null;
        if (vivo && e?.codigo && e.codigo.startsWith("#")) {
          setCodigo(e.codigo);
          if (!e.mesmo_cupom && e.desconto) setOutroCupom(e.desconto);
        }
      } catch {
        /* sem código pronto: fica o botão de sempre */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cupomId]);

  const abrir = useCallback(() => {
    setRedirecionando(true);
    redirecionamento.current = window.setTimeout(() => window.location.assign(destino), 700);
  }, [destino]);

  async function pedir(proximaAcao: "abrir" | "compartilhar" = "abrir") {
    acao.current = proximaAcao;
    setFase("gerando");
    try {
      const { data } = await supabase.rpc("pedir_etiqueta", { p_cupom_id: cupomId });
      const resposta = String(data ?? "");
      if (resposta.startsWith("#")) {
        pronto(resposta);
        return;
      }
      if (resposta !== "pedido") {
        setFase("falhou");
        return;
      }
      try {
        window.postMessage(
          { de: "cupons-afiliado-ml", tipo: "pedido-novo", id: cupomId },
          window.location.origin,
        );
      } catch {
        /* sem extensao: o alarme de 1 minuto cobre */
      }
    } catch {
      setFase("falhou");
      return;
    }

    const limite = Date.now() + 88_000;
    const olhar = async () => {
      try {
        const { data } = await supabase.rpc("consultar_etiqueta", { p_cupom_id: cupomId });
        if (typeof data === "string" && data.startsWith("#")) {
          pronto(data);
          return;
        }
      } catch {
        /* tenta de novo */
      }
      if (Date.now() < limite) relogios.current.push(window.setTimeout(olhar, 3000));
      else {
        setFase("falhou");
      }
    };
    relogios.current.push(window.setTimeout(olhar, 3000));
  }

  /* O código chega segundos depois do clique, e aí o navegador já não deixa
     copiar nem abrir aba sozinho. Então ele aparece com o botão "Copiar e
     abrir o produto", que é um clique novo da pessoa e funciona sempre. */
  function pronto(valor: string) {
    setCodigo(valor);
    setFase("parado");
  }

  if (codigo) {
    return (
      <div className="mt-3 animate-scale-in rounded-md border-2 border-success/50 bg-success/10 p-3">
        <p className="text-sm font-bold text-success">
          {redirecionando
            ? `Código ${codigo} copiado. Abrindo o produto...`
            : copiou
              ? `Código ${codigo} copiado.`
              : `Código da loja: ${codigo}`}
        </p>
        {outroCupom && (
          <p className="mt-0.5 text-xs text-secondary-ink">
            Este código é do cupom de {outroCupom} da mesma loja.
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded bg-card px-2 py-1.5 text-base font-bold tracking-wide">
            {codigo}
          </code>
          <button
            type="button"
            onClick={() => setCopiou(copiarAgora(codigo))}
            className="shrink-0 rounded border border-success px-3 py-1.5 text-xs font-bold text-success"
          >
            {copiou ? "copiado" : "copiar"}
          </button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-secondary-ink">
          Cole no carrinho da loja para o desconto entrar.
        </p>
        <button
          type="button"
          onClick={() => {
            setCopiou(copiarAgora(codigo));
            abrir();
          }}
          disabled={redirecionando}
          className="mt-2 w-full rounded-md bg-success py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95"
        >
          {redirecionando ? "Copiado! Abrindo o produto..." : "Copiar e abrir o produto"}
        </button>
        <button
          type="button"
          onClick={() =>
            compartilharWhatsApp(
              mensagemProduto({ titulo, vendedor, cupom, codigo, link: destino }),
            )
          }
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-success px-3 py-2 text-sm font-bold text-success transition-colors hover:bg-success/10"
        >
          <Share2 className="size-4" aria-hidden="true" />
          Compartilhar cupom no WhatsApp
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void pedir("abrir")}
        disabled={fase === "gerando"}
        className="w-full rounded-md bg-success py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95 disabled:opacity-70"
      >
        {fase === "gerando" ? (
          <span className="flex items-center justify-center gap-2">
            <LoaderCircle className="animate-giro-calmo size-4 shrink-0" aria-hidden="true" />
            Criando seu código…
          </span>
        ) : (
          "Usar este cupom"
        )}
      </button>
      <button
        type="button"
        onClick={() => void pedir("compartilhar")}
        disabled={fase === "gerando"}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-success px-3 py-2 text-sm font-bold text-success transition-colors hover:bg-success/10 disabled:opacity-60"
      >
        {fase === "gerando" && acao.current === "compartilhar" ? (
          <LoaderCircle className="animate-giro-calmo size-4" aria-hidden="true" />
        ) : (
          <Share2 className="size-4" aria-hidden="true" />
        )}
        {fase === "gerando" && acao.current === "compartilhar"
          ? "Preparando para compartilhar…"
          : "Compartilhar cupom no WhatsApp"}
      </button>
      {fase === "gerando" && (
        <div
          className="mt-2.5 overflow-hidden rounded-md border border-success/25 bg-success/10 p-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-success">
            <span
              className="etapa-andando size-2 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
            Gerando e validando sua etiqueta
          </div>
          <div className="esqueleto mt-2.5 h-1.5 rounded-full" aria-hidden="true" />
          <p className="mt-2 text-[11px] leading-4 text-secondary-ink">
            Assim que estiver pronta, aparece o botão para copiar o código e abrir o produto.
          </p>
        </div>
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-secondary-ink" aria-live="polite">
        {fase === "gerando"
          ? "Assim que ficar pronto, aparece o botão para copiar e abrir o produto."
          : fase === "falhou"
            ? "O código do cupom não está disponível agora. O botão de compra continua valendo, pelo preço da loja."
            : "Cria o código do cupom da loja, copia para você e abre o produto."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- resultado */

/* Foto do produto: sempre aparece alguma coisa. Endereço do Mercado Livre é
   normalizado para a versão padrão (sem o nome do produto no fim, que às vezes
   falha); se mesmo assim não carregar, fica um ícone no lugar. */
function fotoML(u: string | null | undefined): string | null {
  if (!u) return null;
  const m = /(\d{5,}-M[A-Z]{2}\d+_\d+)-[A-Z]{1,2}\b/.exec(u);
  return m ? `https://http2.mlstatic.com/D_NQ_NP_${m[1]}-O.webp` : u;
}

function Foto({ src, className }: { src: string | null | undefined; className: string }) {
  const [tentativa, setTentativa] = useState(0);
  const lista = [fotoML(src), src].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  const atual = lista[tentativa];
  if (!atual) {
    return (
      <span
        className={`${className} flex items-center justify-center bg-muted text-secondary-ink`}
        aria-hidden="true"
      >
        <Package className="size-1/2" />
      </span>
    );
  }
  return (
    <img
      src={atual}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setTentativa((t) => t + 1)}
      className={`${className} bg-white object-contain`}
    />
  );
}

/* Há quanto tempo foi comparado, SEMPRE com o botão que compara de novo
   (Weslei, 27/09). Passada 1 hora, o texto pede para atualizar antes de
   comprar (preço e estoque mudam); passado 1 dia, em destaque. */
function IdadeDaComparacao({ em, atualizar }: { em: string | null; atualizar: () => void }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const quando = em ? new Date(em).getTime() : Number.NaN;
  /* Sem a data (resposta antiga): mostra "agora" e o botão do mesmo jeito. */
  const min = Number.isFinite(quando) ? Math.max(0, Math.round((agora - quando) / 60_000)) : 0;
  const texto =
    min < 1
      ? "agora"
      : min < 60
        ? `há ${min} min`
        : min < 60 * 24
          ? `há ${Math.round(min / 60)} h`
          : `há ${Math.round(min / 1440)} ${Math.round(min / 1440) === 1 ? "dia" : "dias"}`;
  const velho = min >= 60 * 24;
  return (
    <div
      className={
        "mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm " +
        (velho ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-border bg-muted/50")
      }
    >
      <span>
        <span className="font-semibold">Comparado {texto}.</span>{" "}
        {velho
          ? "Preço e estoque provavelmente mudaram: atualize antes de comprar."
          : min >= 60
            ? "Os preços podem ter mudado desde então."
            : ""}
      </span>
      <button
        type="button"
        onClick={atualizar}
        className="shrink-0 rounded-md bg-ml-blue px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
      >
        Atualizar comparação
      </button>
    </div>
  );
}

function Resultado({
  pedido,
  copiar,
  copiado,
  urlColada,
  completando = false,
  pedidoId = null,
  cepTela = null,
}: {
  pedidoId?: number | null;
  pedido: Pedido;
  copiar: (t: string, m: string) => void;
  copiado: string | null;
  urlColada: string | null;
  completando?: boolean;
  cepTela?: string | null;
}) {
  /* "Receber até" (06/10): com data escolhida, a tela inteira (Melhor opção,
     tabela, Melhor alternativa e Parecidos) usa só o que chega a tempo. */
  const [limitePrazo, setLimitePrazo] = useState<string | null>(null);
  const cepPrazo = cepTela ?? pedido.analise?.cepDestino ?? null;
  const { prazos, carregando: carregandoPrazo } = usePrazos(
    pedidoId,
    cepPrazo,
    limitePrazo != null,
  );
  const filtroPrazo = useMemo(
    () =>
      limitePrazo && prazos && pedido.analise
        ? aplicarPrazo(pedido.analise, prazos, limitePrazo)
        : null,
    [limitePrazo, prazos, pedido.analise],
  );
  const a = filtroPrazo?.algumAtende ? filtroPrazo.analise : pedido.analise;
  const link = pedido.link ?? "";
  const dispositivo = useDispositivo();

  /* A loja do anúncio não tem cupom que preste, mas outra loja vende o MESMO
     produto de catálogo com cupom valendo para este preço. Nesse caso a troca
     vira a recomendação principal: é ela que põe dinheiro no bolso da pessoa.
     O anúncio original continua disponível, só que como segunda opção. */
  /* Loja sem nome e sem foto não aparece: não dá para o cliente conferir
     (26/09, Tomate W12: "Outra loja" R$ 124,99 sem conferência pela foto). */
  const alternativas: OutraLoja[] = (
    a?.outrasLojas && a.outrasLojas.length ? a.outrasLojas : a?.outraLoja ? [a.outraLoja] : []
  ).filter((o) => Boolean(o.vendedor) || Boolean(o.imagem));
  /* A troca vira a recomendação principal quando a melhor alternativa sai mais
     barata, ou quando a loja do anúncio não tem cupom e a outra tem. */
  /* UMA recomendação só, e ela é a mesma linha que leva o selo "Mais barato"
     na tabela (Weslei, 26/09: a tabela marcava uma loja e a recomendação
     outra). Candidatas: todas as lojas do mesmo produto, da busca e da tabela,
     com frete grátis (ou sem informação), com link ou endereço para gerar o
     link, e pelo menos R$ 0,50 abaixo do anúncio colado. */
  const precoColado = a?.preco ?? null;
  const nomesAlt = new Set(alternativas.map((o) => (o.vendedor ?? "").toLowerCase()));
  const refsBase = (a?.referencias ?? []).filter(
    (r) => r.final != null && !nomesAlt.has((r.vendedor ?? "").toLowerCase()),
  );
  /* Anúncio que o programa de afiliados recusa ("URL not allowed", erro 111)
     só tem o link da ficha do produto, igual ao do anúncio colado, e ele abre
     na oferta principal (Advocate, 26/09). A loja fica na tabela com esse
     link e o aviso de escolher a loja em "Outras opções de compra", mas NÃO
     vira recomendação: todo botão leva o link de afiliado do Weslei e a
     recomendação é a mais barata com link próprio (Weslei, 26/09). */
  /* Economia sempre contra o preço do anúncio colado que a tela mostra (até
     a 1.106.0 a da API podia vir de outro preço: Advocate, R$ 25 em vez de
     R$ 2,91). */
  const ganhoReal = (final: number | null | undefined, ganho?: number | null) =>
    precoColado != null && final != null
      ? Math.round((precoColado - final) * 100) / 100
      : (ganho ?? null);
  const destinoDaLoja = (lk: string | null | undefined, semAfiliado?: boolean | null) => {
    const l = lk || (semAfiliado ? link || null : null);
    return { link: l, mesmaPagina: Boolean(semAfiliado || (l && l === link)) };
  };
  /* Total que o cliente paga: produto + frete para o CEP (quando simulado).
     Frete pago sem valor: null (não dá para afirmar o total). */
  const totalDaLoja = (o: {
    final?: number | null;
    freteGratis?: boolean | null;
    custoFrete?: number | null;
  }) =>
    o.final == null
      ? null
      : o.freteGratis === false
        ? o.custoFrete != null && o.custoFrete > 0
          ? Math.round((o.final + o.custoFrete) * 100) / 100
          : null
        : o.final;
  const totalColado =
    precoColado == null
      ? null
      : a?.freteGratis === false && a?.custoFrete != null && a.custoFrete > 0
        ? Math.round((precoColado + a.custoFrete) * 100) / 100
        : precoColado;
  const candidatas = [
    ...alternativas.map((o, i) => ({
      o: {
        ...o,
        ganho: ganhoReal(o.final, o.ganho),
        finalAtual: precoColado ?? o.finalAtual ?? null,
        ...destinoDaLoja(o.link, o.semAfiliado || o.mesmaPagina),
      },
      chave: `alt-${i}`,
    })),
    ...refsBase.map((r, i) => ({
      chave: `ref-${i}`,
      o: {
        vendedor: r.vendedor,
        preco: r.preco,
        final: r.final,
        ganho:
          precoColado != null && r.final != null
            ? Math.round((precoColado - r.final) * 100) / 100
            : null,
        finalAtual: precoColado,
        ...destinoDaLoja(r.link, r.semAfiliado),
        url: r.url ?? null,
        imagem: r.imagem ?? null,
        freteGratis: r.freteGratis ?? null,
        custoFrete: r.custoFrete ?? null,
        mesmaLoja: r.mesmaLoja ?? null,
        lojaOficial: r.lojaOficial ?? null,
        verificadoIA: true,
        achadoNaBusca: true,
        motivo: "mais_barata",
      } as OutraLoja,
    })),
  ]
    /* MELHOR ESCOLHA PELO TOTAL (Weslei, 02/10: "use a melhor escolha para o
       cliente"): com o frete para o CEP conhecido, compara produto + frete
       (geladeira: R$ 4.699,99 + R$ 33 = R$ 4.732,99 contra R$ 5.051,58 com
       frete grátis). Frete pago SEM valor conhecido continua fora. */
    .map((c) => {
      const t = totalDaLoja(c.o);
      return t != null && totalColado != null
        ? { ...c, o: { ...c.o, ganho: Math.round((totalColado - t) * 100) / 100 } }
        : c;
    })
    .filter(
      (c) =>
        c.o.final != null &&
        totalDaLoja(c.o) != null &&
        !c.o.mesmaPagina &&
        Boolean(c.o.link || c.o.url) &&
        (totalColado == null
          ? (c.o.ganho ?? 0) > 0
          : (totalDaLoja(c.o) as number) <= totalColado - 0.5),
    )
    /* Mesmo total (diferença menor que R$ 0,50): a loja oficial vem primeiro. */
    .sort((x, y) => {
      const d = (totalDaLoja(x.o) ?? 0) - (totalDaLoja(y.o) ?? 0);
      if (Math.abs(d) >= 0.5) return d;
      return (y.o.lojaOficial === true ? 1 : 0) - (x.o.lojaOficial === true ? 1 : 0) || d;
    });
  const recomendada = candidatas[0] ?? null;
  const trocar = recomendada != null;

  /* MELHOR ALTERNATIVA (Weslei, 28/09: conjunto Woven da loja oficial adidas,
     R$ 83 abaixo do anúncio colado, "a opção de melhor benefício para o
     cliente"). Não é o mesmo produto, então nunca vai para a tabela nem é
     chamado de igual: aparece em destaque, com o que muda, quando é MAIS
     BARATO que o melhor preço do mesmo produto, muito parecido (semelhança
     >= 85 ou a mesma foto) e sem frete pago. */
  const precoDoMesmo = (recomendada ? totalDaLoja(recomendada.o) : null) ?? totalColado ?? null;
  /* Mais barato porque vem MENOS (28/09: "Kit 10 cabides" x 30, "1un" x 3
     pipetas) ou serve para outra coisa não é alternativa: fica em Parecidos.
     Mesma lista da função muda_nao_e_alternativa do banco (vitrine). */
  /* Quantidade diferente vale pelo custo por unidade (Weslei, 28/09: "pode
     haver variação em quantidade, mas precisa analisar a semelhança e
     custo-benefício"); com 5 pontos a menos, para a mesma quantidade vir
     na frente quando o resto empata. */
  /* Parecido que o programa de afiliados recusou (semAfiliado) não aparece
     (pedido 525, 30/09: o de R$ 749 mostrava "R$ 205,00 a menos", mas o botão
     abria o anúncio colado de R$ 954). Sem link próprio, o preço dele não
     é alcançável pelo botão; nunca endereço sem afiliado. */
  /* O que muda vem também das FICHAS (02/10, pedido 550: "pode indicar outra
     capacidade" era Modelo BRE68AK, 477 L): a lista, a Melhor alternativa e o
     "Me ajude a escolher" usam o mesmo texto (mudaCompleta). */
  const parecidosComLink = (a?.parecidos ?? [])
    .filter((p) => p.semAfiliado !== true)
    .map((p) => ({ ...p, muda: mudaCompleta(p.muda, a?.detalhes, p.detalhes) }));
  const baseAlt = { preco: precoDoMesmo, titulo: a?.titulo };
  const notaAlt = (p: NonNullable<Analise["parecidos"]>[number]) =>
    notaDeAlternativa(p, a?.titulo) - (podeSerAlternativa(p, baseAlt).cb ? 5 : 0);
  const alternativa =
    precoDoMesmo == null
      ? null
      : ([...parecidosComLink]
          .filter(
            (p) =>
              p.freteGratis !== false &&
              /* Recomendação só com link de afiliado pronto ou gerado no clique. */
              (ehLinkDeAfiliado(p.link) || Boolean(p.url)) &&
              ((p.semelhanca ?? 0) >= 85 || p.mesmaFoto === true) &&
              podeSerAlternativa(p, baseAlt).ok &&
              /* Premissa (Weslei, 05/10): qualidade equivalente ou superior. */
              qualidadeAceita(qualidadeDoParecido(p, { titulo: a?.titulo, detalhes: a?.detalhes })),
          )
          .sort((x, y) => notaAlt(y) - notaAlt(x) || x.preco - y.preco)[0] ?? null);
  /* Parecido com a MESMA foto do anúncio colado: sinal de que a foto do
     anúncio mostra outro produto. */
  /* Variantes da mesma linha (armazenamento, cor, tamanho, voltagem) usam a
     MESMA foto oficial: não é sinal de foto trocada (28/09, iPhone 256 GB x
     1 TB). O aviso fica para diferença de produto (modelo, tecido...). */
  const soVariante = (m: string | null | undefined) =>
    /armazenamento|capacidade|mem[oó]ria|\b\d+\s?(gb|tb)\b|\bcor\b|tamanho|voltagem/i.test(m ?? "");
  const fotoDeOutro =
    (a?.parecidos ?? []).find(
      (p) => p.mesmaFoto === true && (p.semelhanca ?? 0) >= 90 && !soVariante(p.muda),
    ) ?? null;
  /* MENOR DIFERENÇA PRIMEIRO (Weslei, 28/09: "menor diferença sempre acima
     do mais gritante"; iPhone: a mesma versão em outra cor, +R$ 31, ficava
     abaixo das de 1 TB e 2 TB, +R$ 3-4 mil, por terem a mesma foto). Muito
     parecidos (semelhança >= 85) na frente; dentro de cada grupo, a menor
     diferença de preço para o anúncio colado. */
  /* Weslei, 28/09: "o foco está no mais semelhante com custo reduzido".
     1) muito parecidos (semelhança >= 85) na frente; 2) dentro deles, os MAIS
     BARATOS que o colado primeiro, do mais semelhante (nota: semelhança +
     título) para o menos; 3) depois os mais caros, da menor diferença de
     preço para a maior. */
  const ordenarParecidos = (lista: NonNullable<Analise["parecidos"]>) => {
    const base = a?.preco ?? 0;
    return [...lista].sort((x, y) => {
      const gx = (x.semelhanca ?? (x.mesmaFoto ? 90 : 0)) >= 85 ? 0 : 1;
      const gy = (y.semelhanca ?? (y.mesmaFoto ? 90 : 0)) >= 85 ? 0 : 1;
      if (gx !== gy) return gx - gy;
      const bx = x.preco < base ? 0 : 1;
      const by = y.preco < base ? 0 : 1;
      if (bx !== by) return bx - by;
      if (bx === 0) {
        const d = notaDeAlternativa(y, a?.titulo) - notaDeAlternativa(x, a?.titulo);
        if (Math.abs(d) >= 0.5) return d;
      }
      return Math.abs(x.preco - base) - Math.abs(y.preco - base);
    });
  };
  const parecidosSemAlternativa = ordenarParecidos(
    alternativa ? parecidosComLink.filter((p) => p !== alternativa) : parecidosComLink,
  );

  /* Quando a leitura falha, o "link" devolvido e o proprio endereco colado, e
     nao um link de afiliado gerado. Prometer comissao ali seria falso, e se a
     pessoa tiver colado o link de afiliado de outra pessoa a venda vai para
     ela. Nesse caso o botao nao aparece. */
  /* Leu o produto (título) ou tem link de afiliado: mostra o resultado. Só
     esconde quando nada foi lido (link de outra pessoa não vira botão). */
  const leituraFalhou = !(a?.lojaLida === true || !!a?.vendedor || !!a?.titulo || !!pedido.link);

  /* Sem link de afiliado nao existe botao de compra, mesmo que a leitura do
     produto tenha dado certo. Comprar por um endereco sem etiqueta entrega a
     venda de graca, e a frase sobre comissao viraria mentira. */
  const semLink = !link || !!a?.linkFalhou;

  /* Comparei e a loja do anúncio já é a melhor: ela vira o cartão principal
     ("Melhor opção"), com o botão do link, e as outras lojas aparecem abaixo
     em vermelho, com quanto sairia a mais em cada uma. */
  const nomesAlternativas = new Set(alternativas.map((o) => (o.vendedor ?? "").toLowerCase()));
  const referencias = (a?.referencias ?? []).filter(
    (r) => r.final != null && !nomesAlternativas.has((r.vendedor ?? "").toLowerCase()),
  );
  /* Regra do Weslei: SEMPRE existe uma "Melhor opção". Sem loja mais barata,
     é o próprio anúncio colado, com o link de afiliado dele. */
  const estaEAMelhor = !leituraFalhou && !trocar;

  /* Tabela de todas as lojas. Fica AO LADO do resultado (tela larga) ou logo
     abaixo do produto (celular): o cliente vê tudo sem rolar (Weslei, 25/09). */
  const linhasTodas: LinhaLoja[] = [
    ...(a?.preco != null
      ? [
          {
            chave: "colado",
            nome: a?.vendedor ?? "Anúncio colado",
            imagem: a?.imagem,
            final: a.preco,
            diferenca: 0,
            link: semLink ? null : link,
            url: semLink ? urlColada : null,
            colado: true,
            freteGratis: a?.freteGratis ?? null,
            custoFrete: a?.custoFrete ?? null,
            lojaOficial: a?.lojaOficial ?? null,
            detalhes: a?.detalhes ?? null,
            precos: a?.precos ?? null,
          },
        ]
      : []),
    ...alternativas.map((o, i) => ({
      chave: `alt-${i}`,
      nome: o.vendedor ?? "Outra loja",
      imagem: o.imagem,
      final: o.final,
      diferenca: (() => {
        const g = ganhoReal(o.final, o.ganho);
        return g != null ? -g : null;
      })(),
      freteGratis: o.freteGratis ?? null,
      custoFrete: o.custoFrete ?? null,
      mesmaLoja: o.mesmaLoja ?? null,
      lojaOficial: o.lojaOficial ?? null,
      mercadoLider: o.mercadoLider ?? null,
      detalhes: o.detalhes ?? a?.detalhes ?? null,
      detalhesDoColado: !o.detalhes,
      precos: o.precos ?? null,
      ...destinoDaLoja(o.link, o.semAfiliado || o.mesmaPagina),
      url: null,
    })),
    ...referencias.map((r, i) => ({
      chave: `ref-${i}`,
      nome: r.vendedor ?? "Outra loja",
      imagem: r.imagem,
      final: r.final,
      diferenca: r.diferenca,
      freteGratis: r.freteGratis ?? null,
      custoFrete: r.custoFrete ?? null,
      mesmaLoja: r.mesmaLoja ?? null,
      lojaOficial: r.lojaOficial ?? null,
      mercadoLider: r.mercadoLider ?? null,
      detalhes: r.detalhes ?? a?.detalhes ?? null,
      detalhesDoColado: !r.detalhes,
      precos: r.precos ?? null,
      ...destinoDaLoja(r.link, r.semAfiliado),
      url: r.url ?? null,
    })),
  ];
  /* Loja recusada pelo programa (semAfiliado/mesmaPagina) sai da tabela
     (02/10, geladeira: "CGDCHEABF36260 R$ 2.345" com o aviso "escolha em
     Outras opções", mas o link da ficha abre o perfil com só a Magalu de
     R$ 5.051). Preço que o botão não entrega não aparece. */
  const linhasLojas = linhasTodas.filter((l) => l.colado || !l.mesmaPagina);
  /* Tudo o que a comparação achou, para comparar lado a lado ou pedir ajuda
     para escolher (28/09). Só entra o que tem link de compra. */
  const opcoesEscolha: OpcaoEscolha[] = [
    ...linhasLojas.map((l) => ({
      chave: l.chave,
      tipo: (l.colado ? "colado" : "mesmo") as OpcaoEscolha["tipo"],
      titulo: a?.titulo ?? null,
      loja: l.colado ? (a?.vendedor ?? null) : l.nome,
      preco: l.final as number,
      imagem: l.imagem,
      freteGratis: l.freteGratis ?? null,
      custoFrete: l.custoFrete ?? null,
      lojaOficial: l.lojaOficial === true,
      link: l.link,
      url: l.url,
      detalhes: l.detalhes ?? null,
      detalhesDoColado: l.detalhesDoColado === true,
      muda: null,
      vantagem: null,
    })),
    ...parecidosComLink.slice(0, 8).map((p, i) => ({
      chave: `par-${i}`,
      tipo: "parecido" as const,
      titulo: p.titulo,
      loja: p.vendedor ?? null,
      preco: p.preco,
      imagem: p.imagem,
      freteGratis: p.freteGratis ?? null,
      custoFrete: p.custoFrete ?? null,
      lojaOficial: p.lojaOficial === true || p.daBuscaOficial === true,
      link: p.link ?? null,
      url: p.url ?? null,
      detalhes: p.detalhes ?? null,
      muda: p.muda ?? null,
      vantagem: p.vantagem ?? null,
    })),
  ].filter((o) => o.preco != null && Boolean(o.link || o.url));
  const mostraTabela =
    (a?.procurouOutra === true || alternativas.length > 0) &&
    !leituraFalhou &&
    linhasLojas.length >= 2;
  /* Com data limite e o anúncio colado fora do prazo: a loja do MESMO
     produto mais barata (pelo total) que chega a tempo, mesmo sendo mais
     cara que o colado (o cliente pediu a data). Só com link de afiliado. */
  const paraReceber =
    limitePrazo && filtroPrazo?.algumAtende && !filtroPrazo.coladoAtende && !recomendada
      ? (linhasLojas
          .filter((l) => !l.colado && ehLinkDeAfiliado(l.link))
          .map((l) => ({
            nome: l.nome,
            preco: l.final as number,
            freteGratis: l.freteGratis ?? null,
            custoFrete: l.custoFrete ?? null,
            total: totalDaLoja(l),
            link: l.link as string,
          }))
          .filter((x) => x.total != null)
          .sort((x, y) => (x.total as number) - (y.total as number))[0] ?? null)
      : null;
  /* Coluna da direita: lojas comparadas e/ou parecidos. */
  const temColuna = mostraTabela || (!leituraFalhou && parecidosComLink.length > 0);

  const coladoResumo: ColadoResumo = {
    titulo: a?.titulo ?? null,
    imagem: a?.imagem ?? null,
    preco: a?.preco ?? null,
    vendedor: a?.vendedor ?? null,
    freteGratis: a?.freteGratis ?? null,
    custoFrete: a?.custoFrete ?? null,
    detalhes: a?.detalhes ?? null,
  };
  /* Barra fixa do celular: a mesma recomendação da tela, só com link de
     afiliado (sem link pronto, a barra fica sem botão). */
  const barra = recomendada
    ? {
        link: recomendada.o.link && !recomendada.o.semAfiliado ? recomendada.o.link : null,
        preco: recomendada.o.final,
        freteGratis: recomendada.o.freteGratis ?? null,
        custoFrete: recomendada.o.custoFrete ?? null,
      }
    : estaEAMelhor
      ? {
          link: semLink ? null : link,
          preco: a?.preco ?? null,
          freteGratis: a?.freteGratis ?? null,
          custoFrete: a?.custoFrete ?? null,
        }
      : null;

  return (
    <div
      className={
        "relative mt-3 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]" +
        (temColuna ? " sm:grid sm:grid-cols-2 sm:grid-rows-[auto_auto_1fr] sm:gap-x-5" : "")
      }
    >
      {barra && (
        <BarraFixa
          imagem={a?.imagem ?? null}
          titulo={semEntidades(a?.titulo) ?? null}
          link={barra.link}
          preco={barra.preco}
          freteGratis={barra.freteGratis}
          custoFrete={barra.custoFrete}
        />
      )}
      <div className="flex items-start gap-3 sm:col-start-1 sm:row-start-1">
        <Foto src={a?.imagem} className="size-16 shrink-0 rounded-2xl border border-border/70" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-sm font-medium leading-snug">
            {semEntidades(a?.titulo) ?? "Produto do link que você colou"}
          </p>
          {a?.aviso && (
            <p className="mt-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
              O anúncio informa: {a.aviso}
            </p>
          )}
          {a?.buscaFora?.leitura?.ia?.alertaOriginal ? (
            <p className="mt-1 rounded border border-amber-400/70 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Atenção: neste anúncio a foto e o texto não batem.</strong>{" "}
              {a.buscaFora.leitura.ia.alertaOriginal} Confirme com o vendedor qual produto ele envia
              antes de comprar.
            </p>
          ) : fotoDeOutro ? (
            /* A foto do anúncio colado é a mesma de OUTRO produto (conferida
               foto com foto): o cliente precisa saber antes de comprar (28/09,
               agasalho da SHOPMASP com a foto do conjunto Woven). */
            <p className="mt-1 rounded border border-amber-400/70 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Atenção:</strong> a foto deste anúncio é a mesma de outro produto (
              {semEntidades(fotoDeOutro.titulo)}
              {fotoDeOutro.muda ? `; muda: ${fotoDeOutro.muda}` : ""}). Confirme com o vendedor qual
              produto ele envia antes de comprar.
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-secondary-ink">
            {a?.preco != null && (
              <span className="text-base font-bold tabular-nums text-foreground">
                {brl(a.preco)}
              </span>
            )}
            {textoDoPagamento(a?.preco, a?.precos) && (
              <span className="font-medium"> {textoDoPagamento(a?.preco, a?.precos)}</span>
            )}
            {a?.temCupom && <span> · sem o cupom</span>}
            {a?.vendedor && <span> · {a.vendedor}</span>}
            {a?.lojaOficial === true && <SeloLojaOficial className="ml-1.5 inline-flex" />}
          </p>
          <DetalhesDoProduto detalhes={a?.detalhes} />
        </div>
      </div>

      <div className="sm:col-start-1 sm:row-start-2">
        {!leituraFalhou && pedidoId != null && (
          <FiltroPrazo
            limite={limitePrazo}
            mudar={setLimitePrazo}
            cep={cepPrazo}
            carregando={carregandoPrazo}
          />
        )}
        {limitePrazo && filtroPrazo && (
          <AvisosDoPrazo
            limite={limitePrazo}
            r={filtroPrazo}
            melhorNoPrazo={
              recomendada
                ? {
                    nome: recomendada.o.vendedor ?? "outra loja",
                    total: totalDaLoja(recomendada.o),
                  }
                : filtroPrazo.coladoAtende
                  ? { nome: "o anúncio que você colou", total: totalColado }
                  : paraReceber
                    ? { nome: paraReceber.nome, total: paraReceber.total }
                    : null
            }
            paraReceber={paraReceber}
          />
        )}
        {/* Só a melhor em destaque; todas as outras lojas estão na tabela. */}
        {(recomendada ? [recomendada.o] : []).map((oferta, i) => (
          <OutraLojaComCupom
            key={`${oferta.vendedor ?? "loja"}-${i}`}
            oferta={oferta}
            dispositivo={dispositivo}
            vendedorAqui={a?.vendedor ?? null}
            cupomAqui={a?.temCupom ? (a?.cupom?.titulo ?? null) : null}
            precoAqui={a?.preco ?? null}
            titulo={a?.titulo ?? null}
            principal={trocar && i === 0}
            semAnimacao={alternativa != null}
            compacto={i > 0}
            lojaAquiTemCupom={a?.temCupom === true}
          />
        ))}

        {/* O anúncio colado, com o link de afiliado, está sempre na tabela de lojas. */}
        {estaEAMelhor && !(filtroPrazo?.algumAtende && !filtroPrazo.coladoAtende) && (
          <MelhorOpcao
            vendedor={a?.vendedor ?? null}
            preco={a?.preco ?? null}
            link={semLink ? null : link}
            urlColada={urlColada}
            comparou={a?.procurouOutra === true}
            completando={completando}
            dispositivo={dispositivo}
            temCupom={a?.temCupom === true}
            /* -1: pedido de versão antiga, sem a lista de lojas. */
            comparadas={a?.referencias ? referencias.length : -1}
            olhados={a?.buscaFora?.leitura?.comPreco ?? null}
            conferidosIA={a?.buscaFora?.leitura?.ia?.conferidos ?? null}
            iaIndisponivel={a?.buscaFora?.leitura?.ia?.indisponivel === true}
            semAnimacao={alternativa != null}
            precos={a?.precos ?? null}
          />
        )}
      </div>

      {temColuna && (
        <div className="sm:col-start-2 sm:row-span-3 sm:row-start-1">
          {/* Melhor alternativa no topo da coluna, acima da tabela e dos Parecidos
              (Weslei, 03/10). */}
          {alternativa && !leituraFalhou && (
            <MelhorAlternativa
              p={alternativa}
              precoBase={precoDoMesmo}
              cb={podeSerAlternativa(alternativa, baseAlt).cb}
              dispositivo={dispositivo}
              tituloColado={a?.titulo ?? null}
              detalhesColado={a?.detalhes ?? null}
              colado={coladoResumo}
              pedidoId={pedidoId}
            />
          )}
          {mostraTabela && (
            <TodasAsLojas
              linhas={linhasLojas}
              melhorChave={recomendada?.chave ?? (a?.preco != null ? "colado" : null)}
              cep={a?.cepDestino ?? null}
            />
          )}
          <Parecidos
            lista={parecidosSemAlternativa}
            tituloColado={a?.titulo}
            precoColado={a?.preco}
            detalhesColado={a?.detalhes ?? null}
            colado={coladoResumo}
            pedidoId={pedidoId}
          />
        </div>
      )}

      <div className="sm:col-start-1 sm:row-start-3">
        {!leituraFalhou && pedidoId != null && !semLink && (
          <AcompanharPreco pedidoId={pedidoId} preco={a?.preco ?? null} />
        )}

        {!leituraFalhou && (
          <CompareEEscolha
            key={pedidoId ?? "sem-pedido"}
            opcoes={opcoesEscolha}
            padrao={
              recomendada?.chave ??
              (alternativa ? `par-${parecidosComLink.indexOf(alternativa)}` : null)
            }
            pedidoId={pedidoId}
            dispositivo={dispositivo}
          />
        )}

        {a?.temCupom === true && <CondicoesDoCupom analise={a} />}

        {/* Cenário 1A sem alternativa: a loja do anúncio tem cupom e eu comparei.
          Dizer isso é o que dá confiança para comprar aqui. */}
        {a?.temCupom === true && alternativas.length === 0 && (
          <p className="mt-2 text-xs leading-relaxed text-secondary-ink">
            {a.procurouOutra === true && !completando
              ? "Comparei com as outras lojas que vendem este produto: esta, com o cupom, é a opção mais barata hoje."
              : null}
          </p>
        )}

        {/* Sem link pronto: a "Melhor opção" e a tabela trazem o botão que gera o
          link de afiliado no clique. */}

        {a?.temCupom && a.cupom?.id != null && !trocar && (
          <CodigoNaHora
            cupomId={a.cupom.id}
            destino={link}
            titulo={a.titulo}
            vendedor={a.vendedor}
            cupom={a.cupom}
          />
        )}

        {/* Achei loja mais barata, mas a pessoa pode preferir a loja que ela
          colou. Se essa loja tem cupom, o meu cupom continua disponível para
          ela, com o valor que fica com o desconto. */}
        {a?.temCupom && a.cupom?.id != null && trocar && !leituraFalhou && !semLink && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm font-bold">
              Prefere comprar {a.vendedor ? `na ${a.vendedor}` : "na loja do anúncio"}? A loja tem
              cupom
              {a.cupom.titulo ? ` de ${a.cupom.titulo}` : ""}.
            </p>
            {alternativas[0]?.finalAtual != null && a.preco != null && (
              <p className="mt-1 text-xs tabular-nums text-secondary-ink">
                Com o cupom, lá sai por {brl(alternativas[0].finalAtual)} (de {brl(a.preco)}).
              </p>
            )}
            <CodigoNaHora
              cupomId={a.cupom.id}
              destino={link}
              titulo={a.titulo}
              vendedor={a.vendedor}
              cupom={a.cupom}
            />
          </div>
        )}

        {!leituraFalhou && !semLink && !estaEAMelhor && !trocar && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={
              trocar
                ? "mt-3 block w-full rounded-md border border-ml-blue py-2 text-center text-sm font-bold text-ml-blue transition-colors hover:bg-ml-blue/5"
                : "mt-3 block w-full rounded-md bg-ml-blue py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
            }
          >
            {trocar
              ? "Prefiro o anúncio que colei"
              : textoDoBotao(dispositivo, "Comprar com segurança")}
          </a>
        )}
        {!leituraFalhou && !semLink && !trocar && !estaEAMelhor && <AvisoDoBotao d={dispositivo} />}

        {!leituraFalhou &&
          !semLink &&
          (() => {
            const melhor = recomendada ? recomendada.o : null;
            const destino = melhor?.link ?? link;
            const texto = mensagemMelhorOpcao({
              titulo: a?.titulo,
              preco: melhor ? melhor.final : a?.preco,
              precoOriginal: melhor ? a?.preco : null,
              economia: melhor ? melhor.ganho : null,
              comparadas: a?.referencias ? referencias.length : 0,
              freteGratis: melhor ? melhor.freteGratis : a?.freteGratis,
              link: destino,
            });
            return <BotoesCompartilhar texto={texto} link={destino} />;
          })()}

        {pedido.codigo && (
          <details className="mt-2 text-xs text-secondary-ink">
            <summary className="cursor-pointer select-none">
              O link não abriu no aplicativo?
            </summary>
            <p className="mt-1 leading-relaxed">Busque este código no aplicativo. Não é cupom.</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-card px-2 py-1.5 text-sm font-bold tracking-wide">
                {pedido.codigo}
              </code>
              <button
                type="button"
                onClick={() => copiar(pedido.codigo as string, "codigo")}
                className="shrink-0 rounded border border-ml-blue px-3 py-1.5 text-xs font-bold text-ml-blue"
              >
                {copiado === "codigo" ? "copiado" : "copiar"}
              </button>
            </div>
          </details>
        )}

        {/* Sem leitura nao existe botao, e sem botao esta promessa nao pode ser
          feita: seria prometer comissao sobre um link que nao foi gerado. */}
        {/* Uma linha só: quase ninguém lê parágrafo (observado pelo Weslei, 24/09). */}
        {!leituraFalhou && !semLink && (
          <p className="mt-2 text-center text-[11px] text-secondary-ink">
            Comprando pelos botões daqui o preço é o mesmo, e eu recebo uma pequena comissão do
            programa de afiliados. Obrigado!
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------- a loja do anúncio é a melhor */

function MelhorOpcao({
  vendedor,
  preco,
  link,
  dispositivo,
  temCupom,
  comparadas,
  olhados,
  conferidosIA,
  iaIndisponivel,
  urlColada,
  comparou = true,
  completando = false,
  semAnimacao = false,
  precos = null,
}: {
  semAnimacao?: boolean;
  vendedor: string | null;
  preco: number | null;
  /* Pix x parcelado do anúncio (02/10): "no Pix · ou R$ X em Nx". */
  precos?: Precos | null;
  link: string | null;
  urlColada?: string | null;
  comparou?: boolean;
  completando?: boolean;
  dispositivo: Dispositivo;
  temCupom: boolean;
  comparadas: number;
  olhados?: number | null;
  conferidosIA?: number | null;
  iaIndisponivel?: boolean;
}) {
  /* Nenhuma loja igual: diz quanto foi olhado, para ninguém achar que não
     procurei. Só números medidos no pedido; sem número, frase genérica. */
  const semIguais = iaIndisponivel
    ? `Olhei${olhados ? ` ${olhados}` : ""} anúncios parecidos: nenhum confirmado pela foto como este mesmo produto.`
    : olhados != null && olhados > 0
      ? `Olhei ${olhados} anúncios parecidos${conferidosIA ? ` e conferi ${conferidosIA} pela foto` : ""}: nenhum era este mesmo produto mais barato.`
      : "Não encontrei este mesmo produto mais barato em outra loja.";
  return (
    <div className="mt-3 rounded-lg border border-success/50 bg-success/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-success px-1.5 py-0.5 text-[11px] font-bold text-white">
          <Fogo /> Melhor opção
        </span>
        <span className="text-sm font-semibold">{vendedor ?? "Loja do anúncio"}</span>
        <span className="ml-auto text-base font-bold tabular-nums">
          {preco != null ? (
            brl(preco)
          ) : (
            <span className="text-xs font-normal">preço no anúncio</span>
          )}
          <FormaDePagamento preco={preco} precos={precos} className="text-right" />
        </span>
      </div>
      {completando ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ml-blue">
          <LoaderCircle className="animate-giro-calmo size-3.5 shrink-0" aria-hidden="true" />
          Ainda procurando preço menor em outras lojas. A tela atualiza sozinha.
        </p>
      ) : (
        <p className="mt-1 text-xs text-success">
          {!comparou
            ? "Produto conferido, com compra segura pelo botão abaixo."
            : comparadas > 0
              ? `Comparei com ${comparadas} ${comparadas === 1 ? "outra loja" : "outras lojas"}: esta é a mais barata${temCupom ? ", com o cupom" : ""}.`
              : comparadas === 0
                ? semIguais
                : `Comparei com as outras lojas: esta é a mais barata${temCupom ? ", com o cupom" : ""}.`}
        </p>
      )}
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={
            (semAnimacao ? "" : "animate-botao-destaque ") +
            "mt-2 block w-full rounded-md bg-success py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
          }
        >
          <ShieldCheck className="mr-1.5 inline size-4 align-[-3px]" aria-hidden="true" />
          {textoDoBotao(dispositivo, "Comprar com segurança")}
        </a>
      ) : urlColada ? (
        <div className="mt-2">
          <VerNaLoja url={urlColada} grande />
        </div>
      ) : null}
      <AvisoDoBotao d={dispositivo} />
    </div>
  );
}

/* "Ver na loja": o link de afiliado da loja só é criado quando o cliente pede,
   para ele conferir o preço lá com os próprios olhos. Nada é gerado sem clique. */
export function VerNaLoja({ url, grande = false }: { url: string; grande?: boolean }) {
  const [estado, setEstado] = useState<"parado" | "gerando" | "falhou">("parado");
  const [link, setLink] = useState<string | null>(null);

  async function gerar() {
    setEstado("gerando");
    try {
      /* Endereço do ANÚNCIO da loja, não da ficha de catálogo: assim cada loja
         ganha o seu próprio link de afiliado (medido em 25/09). */
      const item =
        /item_id(?:%3A|:)(MLB)-?(\d{6,})/i.exec(url) ??
        /(?<!\/p)\/(MLB)-?(\d{9,})(?:[-_/?#]|$)/i.exec(url);
      const alvo = item ? `https://produto.mercadolivre.com.br/MLB-${item[2]}` : url;
      const { data: pedidoNovo, error } = await supabase.rpc(
        "pedir_link_da_loja" as never,
        { p_url: alvo } as never,
      );
      const id = (pedidoNovo as { id?: number } | null)?.id ?? null;
      const chave = (pedidoNovo as { chave?: string } | null)?.chave ?? null;
      if (error || id == null || !chave) throw new Error("falhou");
      try {
        window.postMessage(
          { de: "cupons-afiliado-ml", tipo: "pedido-novo", id },
          window.location.origin,
        );
      } catch {
        /* sem extensão: o alarme cobre */
      }
      for (let volta = 0; volta < 45; volta++) {
        await new Promise((ok) => setTimeout(ok, volta < 10 ? 1200 : 2500));
        const { data } = await supabase.rpc(
          "ver_pedido" as never,
          { p_id: Number(id), p_chave: chave } as never,
        );
        const linha = (Array.isArray(data) ? data[0] : data) as {
          status?: string;
          link?: string | null;
        } | null;
        if (linha?.status === "pronto" && ehLinkDeAfiliado(linha.link)) {
          setLink(linha.link);
          return;
        }
        if (linha?.status === "falhou") break;
      }
      setEstado("falhou");
    } catch {
      setEstado("falhou");
    }
  }

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={
          grande
            ? "block w-full rounded-md bg-success py-2.5 text-center text-sm font-bold text-white hover:brightness-95"
            : "inline-block rounded bg-ml-blue px-2 py-1 text-[11px] font-bold text-white"
        }
      >
        {grande ? "Comprar com segurança ↗" : "Abrir ↗"}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void gerar()}
      disabled={estado === "gerando"}
      className={
        grande
          ? "block w-full rounded-md bg-success py-2.5 text-center text-sm font-bold text-white hover:brightness-95 disabled:opacity-60"
          : "inline-block rounded border border-ml-blue px-2 py-1 text-[11px] font-bold text-ml-blue disabled:opacity-60"
      }
    >
      {estado === "gerando"
        ? grande
          ? "Gerando seu link…"
          : "Gerando…"
        : estado === "falhou"
          ? "Tentar de novo"
          : grande
            ? "Comprar com segurança"
            : "Abrir"}
    </button>
  );
}

/* Outras lojas com o mesmo produto que NÃO compensam: em vermelho, com quanto
   sairia a mais. Mostrar isto é o que prova ao cliente que comparei. */
/* TODAS as lojas comparadas numa tabela zebrada (regra do Weslei): o
   anúncio colado, as mais baratas e as mais caras, cada uma com foto, preço,
   diferença e um botão que abre o anúncio com o link de afiliado dele. As
   lojas que já têm link pronto abrem direto; as outras geram o link no clique. */
type LinhaLoja = {
  chave: string;
  nome: string;
  imagem: string | null | undefined;
  final: number | null;
  diferenca: number | null;
  link: string | null;
  url: string | null;
  colado?: boolean;
  /* true frete grátis, false frete pago, null/undefined não sei. */
  freteGratis?: boolean | null;
  /* Quanto custa o frete para o CEP do cliente (02/10), quando simulado. */
  custoFrete?: number | null;
  mesmaLoja?: boolean | null;
  lojaOficial?: boolean | null;
  mercadoLider?: "platinum" | "gold" | "silver" | null;
  /* Link abre a página geral do produto: escolher a loja em "Outras opções". */
  mesmaPagina?: boolean | null;
  /* Detalhes da página desta loja; sem eles, a ficha do anúncio colado
     (é o mesmo produto) com o aviso de onde veio. */
  detalhes?: Detalhes | null;
  detalhesDoColado?: boolean;
  precos?: Precos | null;
};

/* DETALHES DO PRODUTO (Weslei, 27/09): características, destaques e
   descrição do anúncio, fechados num botão para não poluir a tela. */
/* Como o preço mostrado se paga: "no Pix" e o parcelado, quando o anúncio
   informa. Sem a informação, nada é afirmado. */
function FormaDePagamento({
  preco,
  precos,
  className = "",
}: {
  preco: number | null | undefined;
  precos: Precos | null | undefined;
  className?: string;
}) {
  const t = textoDoPagamento(preco, precos);
  if (!t) return null;
  return (
    <span className={"block text-[10px] font-medium text-secondary-ink " + className}>{t}</span>
  );
}

function temDetalhes(d: Detalhes | null | undefined): d is Detalhes {
  return Boolean(
    d &&
    ((d.caracteristicas?.length ?? 0) > 0 || (d.destaques?.length ?? 0) > 0 || d.descricao?.trim()),
  );
}

function DetalhesDoProduto({
  detalhes,
  nota = "Informações copiadas do anúncio colado.",
  rotulo = "detalhes do produto",
  destacar = [],
}: {
  detalhes: Detalhes | null | undefined;
  nota?: string;
  rotulo?: string;
  destacar?: string[];
}) {
  const [aberto, setAberto] = useState(false);
  if (!temDetalhes(detalhes)) return null;
  return (
    <div className="mt-1.5">
      <BotaoDetalhes aberto={aberto} alternar={() => setAberto((x) => !x)} rotulo={rotulo} />
      {aberto && <PainelDetalhes detalhes={detalhes} nota={nota} destacar={destacar} />}
    </div>
  );
}

function BotaoDetalhes({
  aberto,
  alternar,
  rotulo = "detalhes do produto",
  pequeno = false,
}: {
  aberto: boolean;
  alternar: () => void;
  rotulo?: string;
  pequeno?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={alternar}
      aria-expanded={aberto}
      className={
        "inline-flex items-center gap-1 text-left font-bold text-ml-blue hover:underline " +
        (pequeno ? "mt-0.5 text-[10px]" : "text-xs")
      }
    >
      {aberto ? `Fechar ${rotulo}` : `Ver ${rotulo}`}
      <span aria-hidden="true">{aberto ? "▴" : "▾"}</span>
    </button>
  );
}

function PainelDetalhes({
  detalhes,
  nota,
  destacar = [],
}: {
  detalhes: Detalhes;
  nota: string;
  /* Características diferentes do anúncio colado (ficha x ficha), em amarelo. */
  destacar?: string[];
}) {
  const [descricaoToda, setDescricaoToda] = useState(false);
  const carac = detalhes.caracteristicas ?? [];
  const dest = detalhes.destaques ?? [];
  const descricao = detalhes.descricao?.trim() || "";
  const longa = descricao.length > 280;
  return (
    <div className="mt-1.5 space-y-2 rounded-md border border-border bg-card p-2 text-left text-xs font-normal">
      {dest.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4">
          {dest.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {carac.length > 0 && (
        <table className="w-full border-collapse">
          <tbody>
            {carac.map((c, i) => (
              <tr
                key={i}
                className={
                  destacar.includes(c.nome)
                    ? "bg-amber-100 dark:bg-amber-900/40"
                    : i % 2
                      ? "bg-muted/40"
                      : ""
                }
              >
                <th className="w-2/5 px-1.5 py-0.5 text-left align-top font-semibold text-secondary-ink">
                  {c.nome}
                </th>
                <td className="px-1.5 py-0.5 align-top [overflow-wrap:anywhere]">{c.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {descricao && (
        <div>
          <p className="font-semibold">Descrição do anúncio</p>
          <p className="mt-0.5 whitespace-pre-line leading-snug text-secondary-ink">
            {longa && !descricaoToda ? descricao.slice(0, 280).trimEnd() + "…" : descricao}
          </p>
          {longa && (
            <button
              type="button"
              onClick={() => setDescricaoToda((x) => !x)}
              className="mt-0.5 font-bold text-ml-blue hover:underline"
            >
              {descricaoToda ? "Mostrar menos" : "Ler descrição completa"}
            </button>
          )}
        </div>
      )}
      <p className="text-[10px] text-secondary-ink">{nota}</p>
    </div>
  );
}

/* Cartão da MELHOR ALTERNATIVA: não é o mesmo produto (diz o que muda), mas é
   mais barato, muito parecido e sem frete pago. Leva o foguinho e o botão
   animado: é a opção de maior benefício para o cliente (Weslei, 28/09). */
function MelhorAlternativa({
  p,
  precoBase,
  cb = null,
  dispositivo,
  tituloColado = null,
  detalhesColado = null,
  colado = null,
  pedidoId = null,
}: {
  tituloColado?: string | null;
  detalhesColado?: Detalhes | null;
  colado?: ColadoResumo | null;
  pedidoId?: number | null;
  cb?: CustoBeneficio | null;
  p: NonNullable<Analise["parecidos"]>[number];
  precoBase: number | null;
  dispositivo: Dispositivo;
}) {
  /* Economia contra o ANÚNCIO COLADO, só no produto (Weslei, 03/10: "a
     diferença é comparada com o original", ajuste global; antes era contra
     o total da melhor loja e misturava o frete: R$ 19,44 em vez de
     R$ 687,58). precoBase fica só como reserva. */
  /* CUSTO REAL (Weslei, 03/10: "o preço do frete deve ser descontado, para
     o cliente ter o custo real"): com o frete conhecido, compara produto +
     frete dos dois lados (mesma conta de totalDaLoja/totalDaOpcao). */
  const tColado = colado ? custoFinal(colado.preco, colado.freteGratis, colado.custoFrete) : null;
  const tAlt = custoFinal(p.preco, p.freteGratis ?? null, p.custoFrete ?? null);
  const comFrete =
    tColado != null &&
    tAlt != null &&
    ((colado?.freteGratis === false && (colado?.custoFrete ?? 0) > 0) ||
      (p.freteGratis === false && (p.custoFrete ?? 0) > 0));
  const base = comFrete ? tColado : (colado?.preco ?? precoBase);
  const menos =
    base != null ? Math.round((base - (comFrete ? (tAlt as number) : p.preco)) * 100) / 100 : null;
  const textoDoColado = [
    tituloColado ?? "",
    ...(detalhesColado?.caracteristicas ?? []).map((c) => c.valor),
  ].join(" ");
  /* Por que vale a pena (Weslei, 28/09): só o que foi conferido aparece. */
  const motivos: string[] = [];
  if (p.vantagem) motivos.push(`Mais completo: ${p.vantagem}`);
  else if (/\b(adicional|inclus[oa]|acompanha|brinde|a mais)\b/i.test(p.muda ?? ""))
    motivos.push("Mais completo");
  if (cb)
    motivos.push(
      `Custo-benefício: ${brl(cb.unitOutro)} ${rotuloDaUnidade(cb.tipo)} (você colou ${brl(cb.unitColado)})`,
    );
  if (p.freteGratis === true) motivos.push("Frete grátis");
  if (p.mesmaFoto) motivos.push("Mesma foto do anúncio que você colou");
  else if ((p.semelhanca ?? 0) >= 95) motivos.push(`${p.semelhanca}% parecido`);
  const oficial = p.lojaOficial === true || p.daBuscaOficial === true;
  if (oficial) motivos.push("Loja oficial da marca");
  /* MAIS INTUITIVO (Weslei, 03/10): o cartão se lê de cima para baixo: o que
     é, quanto economiza, o produto, por que vale, o que muda e o botão. */
  return (
    <div className="mt-3 rounded-3xl border border-success/30 bg-card p-4 shadow-[var(--shadow-card)] first:sm:mt-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-xs font-bold text-white">
          <Fogo /> Melhor alternativa
        </span>
        <span className="text-xs text-secondary-ink">Parecido com o seu, por menos</span>
      </div>

      {menos != null && menos >= 0.5 && (
        <p className="mt-3 leading-tight">
          <span className="text-2xl font-bold tracking-tight text-success tabular-nums">
            {brl(menos)} a menos
          </span>
          <span className="block text-xs text-secondary-ink">
            {comFrete
              ? "no custo final, já com o frete dos dois, comparado ao anúncio que você colou"
              : "no produto, comparado ao anúncio que você colou"}
          </span>
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
        <Foto src={p.imagem} className="size-16 shrink-0 rounded-xl bg-card object-contain" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">
            {semEntidades(p.titulo)}
          </p>
          {p.vendedor && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-secondary-ink">
              <span>
                Vendido por <strong className="text-foreground">{p.vendedor}</strong>
              </span>
              {oficial && <SeloLojaOficial className="inline-flex" />}
              <SeloLider nivel={p.mercadoLider} className="inline-flex" />
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <span className="text-lg font-bold text-foreground">{brl(p.preco)}</span>
          </p>
          <FormaDePagamento preco={p.preco} precos={p.precos} className="text-[11px]" />
        </div>
      </div>

      {motivos.length > 0 && (
        <ul className="mt-3 grid gap-1 text-[13px]">
          {motivos.map((m) => (
            <li key={m} className="flex items-start gap-1.5">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success/15 text-[10px] font-bold text-success"
              >
                ✓
              </span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      )}

      {p.muda || p.qualidade ? (
        <OQueMuda
          muda={p.muda}
          tituloColado={textoDoColado}
          detalhesColado={detalhesColado}
          detalhesOutro={p.detalhes}
          titulo="Não é idêntico ao anúncio que você colou. O que muda para você:"
          qualidade={qualidadeDoParecido(p, { titulo: textoDoColado, detalhes: detalhesColado })}
          desvantagens={desvantagensDoParecido(p, {
            titulo: textoDoColado,
            detalhes: detalhesColado,
          })}
        />
      ) : (
        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Não é idêntico ao anúncio que você colou.
        </p>
      )}
      {pedidoId != null && p.item && <AvaliarIndicacao pedidoId={pedidoId} item={p.item} />}

      {p.link ? (
        <a
          href={p.link}
          target="_blank"
          rel="noopener noreferrer"
          className="animate-botao-destaque mt-3 block w-full rounded-full bg-success py-3 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
        >
          <ShieldCheck className="mr-1.5 inline size-4 align-[-3px]" aria-hidden="true" />
          {textoDoBotao(dispositivo, `Comprar com segurança por ${brl(p.preco)}`).replace(
            " pelo app",
            " no app",
          )}
        </a>
      ) : p.url ? (
        <div className="mt-3">
          <VerNaLoja url={p.url} grande />
        </div>
      ) : null}

      {colado && (
        <div className="text-center">
          <CompararComOSeu colado={colado} outro={p} />
        </div>
      )}
      <div className="mt-2 text-center">
        <DetalhesDoProduto
          detalhes={p.detalhes}
          rotulo="características"
          destacar={compararFichas(detalhesColado, p.detalhes).diferentes}
          nota={notaDaLoja(p.vendedor, detalhesColado, p.detalhes)}
        />
      </div>
    </div>
  );
}

/* BARRA FIXA NO CELULAR (Weslei, 03/10: estilo Apple Store): ao rolar pelo
   resultado, uma barra translúcida no topo com a foto, o nome curto, o melhor
   preço (frete em linha própria) e o botão em pílula com o link de afiliado.
   Some quando o resultado sai da tela. */
function BarraFixa({
  imagem,
  titulo,
  link,
  preco,
  freteGratis,
  custoFrete,
}: {
  imagem: string | null;
  titulo: string | null;
  link: string | null;
  preco: number | null;
  freteGratis: boolean | null;
  custoFrete: number | null;
}) {
  const marco = useRef<HTMLSpanElement | null>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const caixa = marco.current?.parentElement?.getBoundingClientRect();
      setVisivel(Boolean(caixa && caixa.top < -120 && caixa.bottom > 160));
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    medir();
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);
  const frete =
    freteGratis === true
      ? "Frete grátis"
      : custoFrete != null && custoFrete > 0
        ? `Frete ${brl(custoFrete)}`
        : freteGratis === false
          ? "Sem frete grátis"
          : null;
  return (
    <>
      <span ref={marco} aria-hidden="true" className="absolute left-0 top-0 h-px w-px" />
      <div
        className={
          "fixed inset-x-0 top-0 z-40 border-b border-black/5 bg-white/75 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-all duration-300 dark:border-white/10 dark:bg-black/60 sm:hidden " +
          (visivel
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0")
        }
        aria-hidden={!visivel}
      >
        <div className="flex items-center gap-2.5 px-4 py-2">
          <Foto src={imagem} className="size-9 shrink-0 rounded-xl bg-muted object-contain" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight">
              {titulo ?? "Produto"}
            </p>
            {preco != null && (
              <p className="text-[11px] text-secondary-ink">
                Melhor preço <strong className="text-foreground tabular-nums">{brl(preco)}</strong>
              </p>
            )}
            {frete && <p className="text-[11px] text-secondary-ink">{frete}</p>}
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={visivel ? 0 : -1}
              className="inline-flex max-w-[52%] shrink-0 items-center gap-1 rounded-full bg-ml-blue px-3 py-1.5 text-center text-[12px] font-semibold leading-tight text-white active:scale-95"
            >
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Comprar com segurança</span>
            </a>
          )}
        </div>
      </div>
    </>
  );
}

/* Foguinho em movimento da melhor escolha (Weslei, 27/09). */
function Fogo() {
  return (
    <span className="animate-fogo" aria-hidden="true">
      🔥
    </span>
  );
}

/* Selo MercadoLíder da loja (lido na página do próprio anúncio). */
function SeloLider({
  nivel,
  className = "",
}: {
  nivel: string | null | undefined;
  className?: string;
}) {
  if (!nivel) return null;
  const nome =
    nivel === "platinum"
      ? "MercadoLíder Platinum"
      : nivel === "gold"
        ? "MercadoLíder Gold"
        : "MercadoLíder";
  return (
    <span
      className={
        "items-center gap-0.5 text-[10px] font-bold leading-tight text-success " + className
      }
    >
      <BadgeCheck className="inline size-3 align-[-2px]" aria-hidden="true" /> {nome}
    </span>
  );
}

/* Selo de loja oficial da marca, lido na página do anúncio ou na lista
   oficial de ofertas (official_store_id). */
function SeloLojaOficial({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "items-center gap-0.5 text-[10px] font-bold leading-tight text-ml-blue " + className
      }
    >
      <BadgeCheck className="inline size-3 align-[-2px]" aria-hidden="true" /> Loja oficial
    </span>
  );
}

function notaDaLoja(
  vendedor: string | null | undefined,
  colado: Detalhes | null | undefined,
  outro: Detalhes | null | undefined,
) {
  const base = `Informações copiadas do anúncio${vendedor ? ` de ${vendedor}` : " desta loja"}.`;
  return compararFichas(colado, outro).diferentes.length
    ? `${base} Em amarelo, o que é diferente do seu.`
    : base;
}

/* COMPARAR COM O SEU (Weslei, 03/10: "dê opção de comparar cada produto
   encontrado com o original, com a inteligência de resumir para o uso do
   cliente"): lado a lado o seu x este (preço, frete em linha própria, loja e
   as características que os dois informam, em amarelo o que muda) e um
   resumo em linguagem de quem compra. */
type ColadoResumo = {
  titulo: string | null;
  imagem: string | null;
  preco: number | null;
  vendedor: string | null;
  freteGratis: boolean | null;
  custoFrete: number | null;
  detalhes: Detalhes | null;
};

/** Produto + frete conhecido (mesma conta de totalDaOpcao): frete grátis
 *  ou não informado = só o produto; pago sem valor = não dá para saber. */
function custoFinal(
  preco: number | null | undefined,
  gratis: boolean | null | undefined,
  custo: number | null | undefined,
): number | null {
  if (preco == null) return null;
  if (gratis !== false) return preco;
  return custo != null && custo > 0 ? Math.round((preco + custo) * 100) / 100 : null;
}

function textoFrete(gratis: boolean | null | undefined, custo: number | null | undefined) {
  if (gratis === true) return "Frete grátis";
  if (custo != null && custo > 0) return `Frete ${brl(custo) ?? ""}`;
  if (gratis === false) return "Sem frete grátis";
  return "Não informado";
}

function CompararComOSeu({
  colado,
  outro,
}: {
  colado: ColadoResumo;
  outro: NonNullable<Analise["parecidos"]>[number];
}) {
  const [aberto, setAberto] = useState(false);
  const textoDoColado = [
    colado.titulo ?? "",
    ...(colado.detalhes?.caracteristicas ?? []).map((c) => c.valor),
  ].join(" ");
  const linhas = diferencasParaCliente(outro.muda, textoDoColado, colado.detalhes);
  const diferenca =
    outro.diferenca ??
    (colado.preco != null ? Math.round((outro.preco - colado.preco) * 100) / 100 : null);
  const resumo = resumoParaCliente({
    diferenca,
    freteGratis: outro.freteGratis ?? null,
    custoFrete: outro.custoFrete ?? null,
    linhas,
  });
  const ficha = linhasLadoALado(colado.detalhes, outro.detalhes);
  const linha = (rotulo: string, seu: string, este: string, muda: boolean) => (
    <tr key={rotulo} className={muda ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
      <th className="w-1/4 px-2 py-1.5 text-left align-top font-medium text-secondary-ink">
        {rotulo}
      </th>
      <td className="px-2 py-1.5 align-top [overflow-wrap:anywhere]">{seu}</td>
      <td className="px-2 py-1.5 align-top font-semibold [overflow-wrap:anywhere]">{este}</td>
    </tr>
  );
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        aria-expanded={aberto}
        className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/70"
      >
        {aberto ? "Fechar comparação" : "Comparar com o seu"}
        <span aria-hidden="true">{aberto ? "▴" : "▾"}</span>
      </button>
      {aberto && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-border/70 bg-card text-xs">
          <p className="bg-success/10 px-3 py-2 leading-snug text-foreground">
            <strong>Em resumo:</strong> {resumo}
          </p>
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="text-[11px] text-secondary-ink">
                <th className="w-1/4 px-2 py-1.5" />
                <th className="px-2 py-1.5 text-left font-semibold">O seu</th>
                <th className="px-2 py-1.5 text-left font-semibold">Este</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {linha(
                "Preço",
                (colado.preco != null ? brl(colado.preco) : null) ?? "—",
                brl(outro.preco) ?? "—",
                colado.preco != null && Math.abs(outro.preco - colado.preco) >= 0.5,
              )}
              {linha(
                "Frete",
                textoFrete(colado.freteGratis, colado.custoFrete),
                textoFrete(outro.freteGratis, outro.custoFrete),
                textoFrete(colado.freteGratis, colado.custoFrete) !==
                  textoFrete(outro.freteGratis, outro.custoFrete),
              )}
              {(() => {
                const a = custoFinal(colado.preco, colado.freteGratis, colado.custoFrete);
                const b = custoFinal(
                  outro.preco,
                  outro.freteGratis ?? null,
                  outro.custoFrete ?? null,
                );
                const temFrete =
                  (colado.freteGratis === false && (colado.custoFrete ?? 0) > 0) ||
                  (outro.freteGratis === false && (outro.custoFrete ?? 0) > 0);
                return temFrete
                  ? linha(
                      "Custo final",
                      a != null ? (brl(a) ?? "—") : "—",
                      b != null ? (brl(b) ?? "—") : "—",
                      a != null && b != null && Math.abs(a - b) >= 0.5,
                    )
                  : null;
              })()}
              {linha("Loja", colado.vendedor ?? "—", outro.vendedor ?? "—", false)}
              {ficha.map((l) => linha(l.nome, l.seu, l.este, !l.igual))}
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-[10px] text-secondary-ink">
            Pelas informações dos dois anúncios. Em amarelo, o que é diferente.
          </p>
        </div>
      )}
    </div>
  );
}

/* O QUE MUDA PARA VOCÊ (Weslei, 02/10: "indicar como muda para o cliente,
   não somente a diferença técnica"). Cada linha: o campo, o seu (anúncio
   colado) → este, e o que isso significa na compra. */
type LinhaMuda = {
  campo: string | null;
  seu: string | null;
  este: string | null;
  significa: string | null;
  texto?: string;
};

function OQueMuda({
  muda,
  tituloColado,
  detalhesColado = null,
  detalhesOutro = null,
  extras = [],
  titulo = "O que muda para você",
  qualidade = null,
  desvantagens = [],
}: {
  muda: string | null | undefined;
  tituloColado: string | null | undefined;
  detalhesColado?: Detalhes | null;
  detalhesOutro?: Detalhes | null | undefined;
  extras?: LinhaMuda[];
  titulo?: string;
  qualidade?: Qualidade | null;
  desvantagens?: string[];
}) {
  const linhas: LinhaMuda[] = [
    ...diferencasParaCliente(muda, tituloColado, detalhesColado),
    ...extras,
  ];
  /* O que as duas fichas confirmam igual (marca, capacidade, voltagem...),
     sem repetir campo que está na lista do que muda. */
  const mudam = new Set(linhas.map((l) => (l.campo ?? "").toLowerCase()));
  const iguais = compararFichas(detalhesColado, detalhesOutro).iguais.filter(
    (i) => !mudam.has(i.campo.toLowerCase()),
  );
  if (!linhas.length && !qualidade && !desvantagens.length) return null;
  return (
    <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-bold">{titulo}</p>
      {qualidade && (
        /* Premissa (05/10): qualidade vem antes do preço na decisão. */
        <p
          className={
            "mt-1 font-semibold leading-snug " +
            (qualidade.nivel === "inferior"
              ? "text-danger"
              : qualidade.nivel === "incerta"
                ? "text-amber-800 dark:text-amber-200"
                : "text-success")
          }
        >
          <span aria-hidden="true">
            {qualidade.nivel === "inferior" ? "⚠ " : qualidade.nivel === "incerta" ? "? " : "✓ "}
          </span>
          {textoDaQualidade(qualidade)}
        </p>
      )}
      {desvantagens.length > 0 && (
        /* Desvantagens (Weslei, 05/10): o que este tem pior ou a menos que o seu. */
        <div className="mt-1.5 rounded bg-red-50 px-2 py-1.5 text-red-900 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-semibold">Desvantagens em relação ao seu:</p>
          <ul className="mt-0.5 space-y-0.5">
            {desvantagens.map((d, k) => (
              <li key={k} className="leading-snug">
                <span aria-hidden="true">✗ </span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
      {linhas.length > 0 && (
        <ul className="mt-1 divide-y divide-amber-200/70 dark:divide-amber-800/50">
          {linhas.map((l, k) => (
            <li key={k} className="py-1 first:pt-0 last:pb-0">
              {l.campo && (l.seu || l.este) ? (
                <p className="flex flex-wrap items-baseline gap-x-1.5 leading-snug">
                  <span className="font-semibold">{l.campo}:</span>
                  {l.seu && (
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="text-amber-800/80 dark:text-amber-200/70">o seu</span>{" "}
                      <strong>{l.seu}</strong>
                    </span>
                  )}
                  {l.este && (
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {l.seu && <span aria-hidden="true">→ </span>}
                      <span className="text-amber-800/80 dark:text-amber-200/70">este</span>{" "}
                      <strong>{l.este}</strong>
                    </span>
                  )}
                </p>
              ) : (
                <p className="leading-snug">
                  <span className="font-semibold">{l.texto ?? l.campo}</span>
                </p>
              )}
              {l.significa && (
                <p className="mt-0.5 leading-snug text-amber-900/90 dark:text-amber-200/90">
                  <span aria-hidden="true">↳ </span>
                  {l.significa}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {iguais.length > 0 && (
        <p className="mt-1.5 border-t border-amber-200/70 pt-1.5 leading-snug text-success dark:border-amber-800/50">
          <span aria-hidden="true">✓ </span>
          <strong>Igual ao seu:</strong>{" "}
          {iguais.map((i) => `${i.campo.toLowerCase()} ${i.valor}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

/* Parecidos: NAO e o mesmo produto (regra: parecido nunca aparece como
   igual). Tabela separada, âmbar (atenção), com o que muda em cada um. */
/* PREÇO POR UNIDADE: com quantidade diferente (kit de 30 x kit de 20, 500 ml
   x 1 L) o preço do anúncio engana; o que compara é o preço por unidade, por
   litro ou por kg. Só aparece quando os dois títulos trazem a medida. */
function precoPorMedida(preco: number, m: Medida) {
  if (m.tipo === "ml") return `${brl((preco / m.qtd) * 1000)} por litro`;
  if (m.tipo === "g") return `${brl((preco / m.qtd) * 1000)} por kg`;
  return `${brl(preco / m.qtd)} por unidade`;
}

function Parecidos({
  lista,
  tituloColado,
  precoColado,
  detalhesColado = null,
  colado = null,
  pedidoId = null,
}: {
  lista: Analise["parecidos"];
  tituloColado?: string | null | undefined;
  precoColado?: number | null | undefined;
  detalhesColado?: Detalhes | null;
  colado?: ColadoResumo | null;
  pedidoId?: number | null;
}) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  /* CARROSSEL NO CELULAR (Weslei, 03/10: estilo Apple): cartão ativo, para
     o seletor de fotos e o indicador em pílula. */
  const trilho = useRef<HTMLUListElement | null>(null);
  const [ativo, setAtivo] = useState(0);
  if (!lista || !lista.length) return null;
  /* ASSERTIVO (Weslei, 28/09: "as comparações e recomendações devem ser
     assertivas em relação ao que foi buscado"): na frente só o que é muito
     parecido (semelhança >= 85 ou mesma foto); o resto fica recolhido. Sem
     nenhum muito parecido, mostra todos (nunca lista vazia). */
  /* Sugestão da página do anúncio mais barata que o colado também fica à
     vista (Weslei, 03/10: M-Vave R$ 339,69 x Akai R$ 568). */
  const perto = (p: NonNullable<Analise["parecidos"]>[number]) =>
    (p.semelhanca ?? (p.mesmaFoto ? 90 : 0)) >= 85 ||
    (p.sugerido === true && precoColado != null && p.preco < precoColado);
  const escondidos = lista.some(perto) ? lista.filter((p) => !perto(p)).length : 0;
  const mColado = medidaDoTitulo(tituloColado);
  /* Título e ficha do colado: decidem qual lado de "A x B" é o seu. */
  const textoDoColado = [
    tituloColado ?? "",
    ...(detalhesColado?.caracteristicas ?? []).map((c) => c.valor),
  ].join(" ");
  /* Só mostra por unidade quando algum parecido tem quantidade diferente. */
  const medidas = lista.map((p) => medidaDoTitulo(p.titulo));
  const comparaMedida =
    mColado != null &&
    precoColado != null &&
    medidas.some((m) => m && m.tipo === mColado.tipo && m.qtd !== mColado.qtd);
  const visiveis = lista
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => verTodos || escondidos === 0 || perto(p));
  const irPara = (k: number) => {
    const li = trilho.current?.children[k] as HTMLElement | undefined;
    li?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };
  const aoRolar = () => {
    const el = trilho.current;
    const primeiro = el?.children[0] as HTMLElement | undefined;
    if (!el || !primeiro) return;
    const passo = primeiro.offsetWidth + 12;
    setAtivo(Math.min(visiveis.length - 1, Math.max(0, Math.round(el.scrollLeft / passo))));
  };
  return (
    <div className="mt-3 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] first:sm:mt-0">
      <p className="text-lg font-semibold tracking-tight">
        Parecidos{" "}
        <span className="text-secondary-ink">
          ({escondidos && !verTodos ? lista.length - escondidos : lista.length})
        </span>
      </p>
      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
        Não é o mesmo produto: veja o que muda antes de comprar.
      </p>
      {/* Seletor em círculos (celular): a foto de cada parecido leva ao cartão. */}
      {visiveis.length > 1 && (
        <div className="-mx-1 mt-2 flex gap-2.5 overflow-x-auto p-1.5 sm:hidden" role="tablist">
          {visiveis.map(({ p }, k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={ativo === k}
              aria-label={`Ver ${semEntidades(p.titulo) ?? "parecido"}`}
              onClick={() => irPara(k)}
              className={
                "size-11 shrink-0 overflow-hidden rounded-full bg-muted ring-offset-2 ring-offset-card transition " +
                (ativo === k ? "ring-2 ring-ml-blue" : "ring-1 ring-border")
              }
            >
              <Foto src={p.imagem} className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
      <ul
        ref={trilho}
        onScroll={aoRolar}
        className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:block sm:space-y-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {visiveis.map(({ p, i }) => {
          const m = medidas[i];
          const porMedida =
            comparaMedida && m && mColado && m.tipo === mColado.tipo
              ? precoPorMedida(p.preco, m)
              : null;
          return (
            <li
              key={i}
              className="w-[86%] shrink-0 snap-center rounded-3xl border border-border/70 bg-card p-3.5 sm:w-auto"
            >
              {/* Foto em destaque no celular (cartão estilo Apple). */}
              <div className="mb-3 flex justify-center rounded-2xl bg-muted/50 p-3 sm:hidden">
                <Foto src={p.imagem} className="h-36 w-36 rounded-xl object-contain" />
              </div>
              {/* Cabeçalho: foto, título e quem vende. */}
              <div className="flex items-start gap-2.5">
                <Foto
                  src={p.imagem}
                  className="hidden size-14 shrink-0 rounded-xl border border-border sm:block"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">
                    {semEntidades(p.titulo)}
                  </p>
                  {p.vendedor && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-secondary-ink">
                      <span>
                        Vendido por <strong className="text-foreground">{p.vendedor}</strong>
                      </span>
                      {(p.lojaOficial === true || p.daBuscaOficial === true) && (
                        <SeloLojaOficial className="inline-flex" />
                      )}
                      <SeloLider nivel={p.mercadoLider} className="inline-flex" />
                    </p>
                  )}
                  {(p.mesmaFoto ||
                    (p.semelhanca ?? 0) >= 85 ||
                    p.sugerido === true ||
                    (p.diferenca != null && p.diferenca <= -0.5)) && (
                    <p className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold">
                      {p.diferenca != null && p.diferenca <= -0.5 && (
                        <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-success">
                          Mais barato que o seu
                        </span>
                      )}
                      {p.sugerido === true && (
                        <span className="rounded-full bg-ml-blue/10 px-1.5 py-0.5 text-ml-blue">
                          Sugerido na página do anúncio
                        </span>
                      )}
                      {(p.semelhanca ?? 0) >= 85 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-secondary-ink">
                          {p.semelhanca}% parecido
                        </span>
                      )}
                      {p.mesmaFoto && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-secondary-ink">
                          Mesma foto do anúncio colado
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Preço: o valor, a forma de pagamento e a diferença. */}
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border pt-2 tabular-nums">
                <span className="text-lg font-bold leading-none">{brl(p.preco)}</span>
                {p.diferenca != null && (
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                      (Math.abs(p.diferenca) < 0.5
                        ? "bg-muted text-secondary-ink"
                        : p.diferenca < 0
                          ? "bg-success/15 text-success"
                          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400")
                    }
                  >
                    {Math.abs(p.diferenca) < 0.5
                      ? "Mesmo preço no produto"
                      : p.diferenca < 0
                        ? `${brl(-p.diferenca)} a menos no produto`
                        : `${brl(p.diferenca)} a mais no produto`}
                  </span>
                )}
                <FormaDePagamento
                  preco={p.preco}
                  precos={p.precos}
                  className="basis-full text-[11px] text-secondary-ink"
                />
              </div>

              <OQueMuda
                muda={p.muda}
                tituloColado={textoDoColado}
                detalhesColado={detalhesColado}
                detalhesOutro={p.detalhes}
                qualidade={qualidadeDoParecido(p, {
                  titulo: textoDoColado,
                  detalhes: detalhesColado,
                })}
                desvantagens={desvantagensDoParecido(p, {
                  titulo: textoDoColado,
                  detalhes: detalhesColado,
                })}
                extras={[
                  ...(porMedida && m && mColado && m.qtd !== mColado.qtd && precoColado != null
                    ? [
                        {
                          campo: `Preço ${rotuloDaUnidade(mColado.tipo)}`,
                          seu: precoPorMedida(precoColado, mColado).replace(/ por .*/, ""),
                          este: porMedida.replace(/ por .*/, ""),
                          significa: `Cada ${
                            mColado.tipo === "ml"
                              ? "litro"
                              : mColado.tipo === "g"
                                ? "kg"
                                : "unidade"
                          } sai mais ${p.preco / m.qtd < precoColado / mColado.qtd ? "barat" : "car"}${
                            mColado.tipo === "un" ? "a" : "o"
                          }.`,
                        },
                      ]
                    : []),
                  ...(p.freteGratis === false
                    ? [
                        {
                          campo: "Frete",
                          seu: null,
                          este:
                            p.custoFrete != null && p.custoFrete > 0
                              ? brl(p.custoFrete)
                              : "sem frete grátis",
                          significa: "O frete é pago à parte.",
                        },
                      ]
                    : []),
                ]}
              />
              {pedidoId != null && p.item && <AvaliarIndicacao pedidoId={pedidoId} item={p.item} />}

              {/* Rodapé: detalhes à esquerda, compra à direita. */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                {temDetalhes(p.detalhes) ? (
                  <BotaoDetalhes
                    aberto={aberto === i}
                    alternar={() => setAberto((x) => (x === i ? null : i))}
                    rotulo="características"
                  />
                ) : (
                  <span />
                )}
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-ml-blue px-3 py-1.5 text-xs font-bold text-ml-blue hover:bg-ml-blue/5"
                  >
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Comprar com segurança
                  </a>
                ) : p.url ? (
                  <VerNaLoja url={p.url} />
                ) : null}
              </div>
              {colado && <CompararComOSeu colado={colado} outro={p} />}
              {aberto === i && temDetalhes(p.detalhes) && (
                <PainelDetalhes
                  detalhes={p.detalhes}
                  destacar={compararFichas(detalhesColado, p.detalhes).diferentes}
                  nota={notaDaLoja(p.vendedor, detalhesColado, p.detalhes)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {/* Indicador em pílula (celular), estilo Apple Highlights. */}
      {visiveis.length > 1 && (
        <div className="mt-3 flex justify-center sm:hidden" aria-hidden="true">
          <div className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-2 backdrop-blur-md">
            {visiveis.map((_, k) => (
              <span
                key={k}
                className={
                  "h-1.5 rounded-full transition-all duration-300 " +
                  (ativo === k ? "w-6 bg-foreground/70" : "w-1.5 bg-foreground/25")
                }
              />
            ))}
          </div>
        </div>
      )}
      {escondidos > 0 && (
        <button
          type="button"
          onClick={() => {
            setAtivo(0);
            trilho.current?.scrollTo({ left: 0 });
            setVerTodos((x) => !x);
          }}
          aria-expanded={verTodos}
          className="mt-1.5 text-[11px] font-bold text-ml-blue hover:underline"
        >
          {verTodos
            ? "Mostrar só os mais parecidos"
            : `Ver ${escondidos} menos ${escondidos === 1 ? "parecido" : "parecidos"}`}
        </button>
      )}
    </div>
  );
}

function TodasAsLojas({
  linhas,
  melhorChave,
  cep,
}: {
  linhas: LinhaLoja[];
  melhorChave?: string | null;
  /* CEP para o qual o frete foi simulado (02/10). */
  cep?: string | null;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (linhas.length < 2) return null;
  const ordem = [...linhas].sort((a, b) => (a.final ?? 1e12) - (b.final ?? 1e12));
  /* Psicologia das cores (Weslei, 25/09): verde = a mais barata (ganho,
     seguro); vermelho = quanto se paga A MAIS em cada outra loja (perda);
     o anúncio colado, quando não é o mais barato, fica em âmbar (atenção). */
  /* FRETE (Weslei, 25/09): loja com frete pago não leva o selo "Mais
     barato" — o frete pode deixá-la mais cara que as outras. O selo vai para
     a mais barata com frete grátis (ou sem informação de frete). */
  /* O selo vai na MESMA linha da recomendação (melhorChave). */
  const idxRecomendada = melhorChave ? ordem.findIndex((l) => l.chave === melhorChave) : -1;
  const melhorIdx =
    idxRecomendada >= 0
      ? idxRecomendada
      : Math.max(
          0,
          ordem.findIndex((l) => l.freteGratis !== false && (l.colado || !l.mesmaPagina)),
        );
  const menor = ordem[melhorIdx]?.final ?? null;
  /* Loja mais barata que só abre pela página do produto (recusada pelo
     programa, erro 111) não leva o selo: a linha recomendada vira "Melhor
     opção" em vez de "Mais barato", para o selo não mentir. */
  const haMaisBarata = ordem
    .slice(0, melhorIdx)
    .some((l) => l.final != null && menor != null && l.final <= menor - 0.5);
  /* Preço muito abaixo do resto (02/10, geladeira de ~R$ 5.000 por R$ 2.345 e
     R$ 3.400, sem frete grátis): olhar de especialista avisa antes da compra. */
  const finais = ordem.map((l) => l.final).filter((v): v is number => v != null);
  const mediana =
    finais.length >= 3 ? [...finais].sort((x, y) => x - y)[Math.floor(finais.length / 2)] : null;
  const muitoAbaixo = (l: LinhaLoja) =>
    !l.colado && mediana != null && l.final != null && l.final < mediana * 0.7;
  return (
    <div className="mt-3 first:sm:mt-0">
      <p className="text-sm font-bold">
        Todas as lojas comparadas ({ordem.length})
        {cep && <span className="font-normal text-secondary-ink"> · frete para {cep}</span>}
      </p>
      <table className="mt-1.5 w-full table-fixed border-collapse overflow-hidden rounded-md border border-border text-sm">
        <thead>
          <tr className="bg-muted/70 text-left text-xs text-secondary-ink">
            <th className="px-2 py-1.5 font-semibold">Loja</th>
            <th className="w-[38%] px-2 py-1.5 text-right font-semibold">Preço</th>
            <th className="w-[5.5rem] px-1 py-1.5" />
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {ordem.map((l, i) => (
            <Fragment key={l.chave}>
              <tr
                className={
                  i === melhorIdx && menor != null
                    ? "border-l-4 border-l-success bg-success/15"
                    : l.colado
                      ? "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30"
                      : i % 2
                        ? "border-l-4 border-l-transparent bg-muted/40"
                        : "border-l-4 border-l-transparent bg-card"
                }
              >
                <td className="px-2 py-1">
                  <span className="flex items-center gap-2">
                    <Foto src={l.imagem} className="size-8 shrink-0 rounded" />
                    <span className="min-w-0 text-xs font-medium leading-tight [overflow-wrap:anywhere]">
                      {l.colado ? "Anúncio colado" : l.nome}
                      {l.lojaOficial === true && <SeloLojaOficial className="block" />}
                      {!l.colado && <SeloLider nivel={l.mercadoLider} className="block" />}
                      {l.mesmaPagina && !l.colado && (
                        <span className="block text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          Na página, escolha esta loja em "Outras opções de compra"
                        </span>
                      )}
                      {l.mesmaLoja && (
                        <span className="block text-[10px] font-semibold text-ml-blue">
                          Mesma loja, outro anúncio
                        </span>
                      )}
                      {l.freteGratis === true && (
                        <span className="block text-[10px] font-semibold text-success">
                          Frete grátis
                        </span>
                      )}
                      {l.freteGratis === false && (
                        <span className="block text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          {l.custoFrete != null && l.custoFrete > 0
                            ? `Frete ${brl(l.custoFrete)}`
                            : "Sem frete grátis"}
                        </span>
                      )}
                      {muitoAbaixo(l) && (
                        <span className="block text-[10px] font-semibold text-red-700 dark:text-red-400">
                          Preço muito abaixo das outras lojas: confira o vendedor antes de comprar
                        </span>
                      )}
                      {temDetalhes(l.detalhes) && (
                        <BotaoDetalhes
                          aberto={aberta === l.chave}
                          alternar={() => setAberta((x) => (x === l.chave ? null : l.chave))}
                          rotulo="detalhes"
                          pequeno
                        />
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-1 text-right">
                  <span
                    className={
                      "block font-bold " +
                      (i === melhorIdx ? "text-base text-success" : "text-foreground")
                    }
                  >
                    {brl(l.final)}
                  </span>
                  <FormaDePagamento preco={l.final} precos={l.precos} />
                  {(() => {
                    const extra = menor != null && l.final != null ? l.final - menor : null;
                    if (i === melhorIdx)
                      return (
                        <span className="mt-0.5 inline-block rounded bg-success px-1.5 py-0.5 text-[10px] font-bold text-white">
                          <Fogo />{" "}
                          {(haMaisBarata ? "Melhor opção" : "Mais barato") +
                            (l.colado ? " · você colou" : "")}
                        </span>
                      );
                    /* FRETE SEMPRE EM LINHA PRÓPRIA (02/10, pedido 563: "R$ 2.706,58 a
                       menos + frete" parecia frete de R$ 2 mil; o frete era R$ 1,00).
                       Nunca juntar valor em reais com "frete" na mesma expressão. */
                    const linhaFrete =
                      l.freteGratis === false ? (
                        <span className="block text-[10px] font-normal text-secondary-ink">
                          {l.custoFrete != null && l.custoFrete > 0
                            ? `(frete de ${brl(l.custoFrete)} à parte)`
                            : "(frete à parte)"}
                        </span>
                      ) : null;
                    const voceColou = l.colado ? (
                      <span className="block text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        você colou
                      </span>
                    ) : null;
                    if (extra != null && extra <= -0.5)
                      return (
                        <span className="block leading-tight">
                          <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            {brl(-extra)} a menos no produto
                          </span>
                          {linhaFrete}
                          {voceColou}
                        </span>
                      );
                    return (
                      <span className="block leading-tight">
                        <span
                          className={
                            "block text-[11px] font-bold " +
                            (extra != null && extra >= 0.5
                              ? "text-red-700 dark:text-red-400"
                              : "text-secondary-ink")
                          }
                        >
                          {extra != null && extra >= 0.5
                            ? `+${brl(extra)} a mais no produto`
                            : "mesmo preço no produto"}
                        </span>
                        {linhaFrete}
                        {voceColou}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-2 py-1 text-right">
                  {l.link ? (
                    <a
                      href={l.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        i === melhorIdx && menor != null
                          ? "animate-botao-destaque inline-block whitespace-nowrap rounded bg-success px-2 py-1 text-[11px] font-bold text-white hover:brightness-95"
                          : "inline-block rounded border border-ml-blue px-2 py-1 text-[11px] font-bold text-ml-blue hover:bg-ml-blue/5"
                      }
                    >
                      {i === melhorIdx && menor != null ? (
                        <>
                          <ShieldCheck
                            className="mr-0.5 inline size-3 align-[-2px]"
                            aria-hidden="true"
                          />
                          Comprar
                        </>
                      ) : (
                        "Abrir"
                      )}
                    </a>
                  ) : l.url ? (
                    <VerNaLoja url={l.url} />
                  ) : null}
                </td>
              </tr>
              {aberta === l.chave && temDetalhes(l.detalhes) && (
                <tr className="bg-card">
                  <td colSpan={3} className="px-2 pb-2">
                    <PainelDetalhes
                      detalhes={l.detalhes}
                      nota={
                        l.colado
                          ? "Informações copiadas do anúncio colado."
                          : l.detalhesDoColado
                            ? "Mesmo produto: ficha lida no anúncio colado. Confira os detalhes da loja na página."
                            : `Informações copiadas do anúncio de ${l.nome}.`
                      }
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-secondary-ink">
        Preço de quando comparei. Todos os botões abrem com compra protegida.
      </p>
    </div>
  );
}

/* ------------------------------------------------ mesmo produto, outra loja

   Esta é a parte que faz o site valer o clique: o produto é o MESMO, o que
   muda é a loja e o cupom. O Mercado Livre trata isso como um só produto de
   catálogo, com vários vendedores, então não há risco de mandar a pessoa para
   um item parecido.

   Só aparece quando o preço final com cupom fica abaixo do anúncio colado.
   Se não economiza, não vale pedir para a pessoa trocar de loja.
*/

function OutraLojaComCupom({
  oferta,
  dispositivo,
  vendedorAqui,
  cupomAqui,
  precoAqui,
  titulo,
  principal,
  semAnimacao = false,
  compacto,
  lojaAquiTemCupom,
}: {
  semAnimacao?: boolean;
  oferta: OutraLoja;
  dispositivo: Dispositivo;
  vendedorAqui: string | null;
  cupomAqui?: string | null;
  precoAqui: number | null;
  titulo?: string | null;
  principal?: boolean;
  compacto?: boolean;
  lojaAquiTemCupom?: boolean;
}) {
  /* A extensao ja comparou preco final contra preco final e mandou o ganho.
     O calculo local fica so como reserva para pedidos antigos. */
  const diferenca =
    oferta.ganho != null
      ? oferta.ganho
      : precoAqui != null && oferta.final != null
        ? precoAqui - oferta.final
        : null;

  /* Alternativa pode ser mais barata SEM cupom nenhum. Foi o caso do Kit Wella:
     a loja do link tinha cupom de 15% e ainda assim saia mais cara. Dizer
     "com cupom" ali seria mentira. */
  const temCupomLa = Boolean(oferta.cupomTitulo);
  /* Frete pago com valor conhecido para o CEP (02/10): a economia já conta
     o frete, e o card mostra o frete e o total em linha própria. */
  const freteConhecido =
    oferta.freteGratis === false && oferta.custoFrete != null && oferta.custoFrete > 0;
  /* Preço final de cada lado (com o cupom de cada um, quando existe). */
  const atual = oferta.finalAtual ?? precoAqui;
  const descontoAqui =
    precoAqui != null && atual != null ? Math.round((precoAqui - atual) * 100) / 100 : 0;
  const pct =
    diferenca != null && diferenca > 0 && atual != null && atual > 0
      ? Math.round((diferenca / atual) * 100)
      : null;

  /* Segunda e terceira lojas mais baratas: uma linha só, com foto, preço,
     quanto economiza e o botão. A tabela completa fica para a melhor. */
  if (compacto) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-2">
        <Foto src={oferta.imagem} className="size-12 shrink-0 rounded" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{oferta.vendedor ?? "Outra loja"}</p>
          <p className="text-xs tabular-nums text-secondary-ink">
            <span className="text-sm font-bold text-success">{brl(oferta.final)}</span>
            {diferenca != null && diferenca > 0 ? ` · ${brl(diferenca)} a menos` : ""}
            {oferta.verificadoIA ? " · ✓ mesmo produto conferido" : ""}
          </p>
        </div>
        {oferta.link ? (
          <a
            href={oferta.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md bg-success px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
          >
            Comprar seguro
          </a>
        ) : oferta.url ? (
          <VerNaLoja url={oferta.url} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-success/50 bg-success/10 p-3">
      {principal && (
        <p className="mb-1 inline-block rounded bg-success px-2 py-0.5 text-xs font-bold text-white">
          <Fogo /> Minha recomendação
        </p>
      )}
      <p className="text-sm font-bold text-success">
        {temCupomLa && !lojaAquiTemCupom
          ? `Achei o mesmo produto${oferta.vendedor ? ` na loja ${oferta.vendedor}` : " em outra loja"} com cupom!`
          : temCupomLa
            ? "Achei o mesmo produto mais barato em outra loja, e lá também tem cupom"
            : !lojaAquiTemCupom && diferenca != null && diferenca > 0
              ? oferta.mesmaLoja
                ? `A mesma loja vende este produto por ${brl(diferenca)} a menos em outro anúncio`
                : `${oferta.vendedor ?? "Outra loja"} vende o mesmo produto por ${brl(diferenca)} a menos${freteConhecido ? ", já com o frete" : ""}`
              : "Achei o mesmo produto mais barato em outra loja"}
      </p>
      {freteConhecido && oferta.final != null && (
        <p className="mt-0.5 text-xs text-secondary-ink">
          {`Produto ${brl(oferta.final)} · frete para seu CEP ${brl(oferta.custoFrete as number)} · total ${brl(oferta.final + (oferta.custoFrete as number))}`}
        </p>
      )}
      {oferta.lojaOficial === true && (
        <p className="mt-0.5 text-xs font-semibold text-ml-blue">
          <BadgeCheck className="inline size-3.5 align-[-3px]" aria-hidden="true" /> Vendido pela
          loja oficial{oferta.vendedor ? ` ${oferta.vendedor}` : ""}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Foto src={oferta.imagem} className="size-14 shrink-0 rounded" />
        {oferta.verificadoIA && (
          <span className="rounded bg-card px-2 py-1 text-xs font-semibold text-success">
            ✓ Mesmo produto: foto e anúncio conferidos
          </span>
        )}
      </div>

      {/* Tabela zebrada, uma coluna por loja, e a conta da economia escrita
          por extenso. Antes o topo mostrava o preço SEM cupom (R$ 428,90) e a
          comparação usava o preço COM cupom (R$ 364,57) sem dizer isso, e a
          conta não fechava para quem lia (24/09).
          No celular fica escondida: a tabela de lojas logo acima já mostra os
          mesmos preços, e o botão de compra precisa aparecer sem rolar. */}
      <div className="mt-3 hidden overflow-hidden rounded-md border border-success/30 bg-card text-sm sm:block">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-muted/60 text-xs">
              <th className="w-[34%] px-2 py-1.5 text-left font-semibold text-secondary-ink"></th>
              <th className="px-2 py-1.5 text-right font-semibold text-secondary-ink break-words">
                Anúncio colado
                {vendedorAqui ? <span className="block font-normal">{vendedorAqui}</span> : null}
              </th>
              <th className="px-2 py-1.5 text-right font-bold text-success break-words">
                {oferta.vendedor ?? "Outra loja"}
                <span className="block font-normal">mais barata</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="bg-card">
              <td className="px-2 py-1.5 text-secondary-ink">Preço</td>
              <td className="px-2 py-1.5 text-right">{brl(precoAqui)}</td>
              <td className="px-2 py-1.5 text-right">{brl(oferta.preco)}</td>
            </tr>
            {(descontoAqui > 0 || temCupomLa) && (
              <tr className="bg-muted/40">
                <td className="px-2 py-1.5 text-secondary-ink">Cupom</td>
                <td className="px-2 py-1.5 text-right">
                  {descontoAqui > 0 ? (
                    <>
                      −{brl(descontoAqui)}
                      {cupomAqui ? (
                        <span className="block text-xs text-secondary-ink">{cupomAqui}</span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {temCupomLa && oferta.economia ? (
                    <>
                      −{brl(oferta.economia)}
                      <span className="block text-xs text-secondary-ink">{oferta.cupomTitulo}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            )}
            <tr className="bg-card font-bold">
              <td className="px-2 py-1.5">Você paga</td>
              <td className="px-2 py-1.5 text-right text-secondary-ink">{brl(atual)}</td>
              <td className="px-2 py-1.5 text-right text-base text-success">{brl(oferta.final)}</td>
            </tr>
          </tbody>
        </table>
        {diferenca != null && diferenca > 0 && (
          <div className="border-t border-success/30 bg-success/15 px-3 py-2">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-bold text-success">Você economiza</span>
              <span className="text-base font-extrabold tabular-nums text-success">
                {brl(diferenca)}
              </span>
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-secondary-ink">
              {brl(atual)} − {brl(oferta.final)} = {brl(diferenca)}
              {pct != null ? ` (${pct}% a menos)` : ""}
            </p>
          </div>
        )}
      </div>
      {(oferta.minimo != null || oferta.vence) && (
        <dl className="mt-2 divide-y divide-success/20 text-sm">
          {oferta.minimo != null && (
            <Linha rotulo="Compra mínima do cupom" valor={brl(oferta.minimo)} />
          )}
          {oferta.vence && <Linha rotulo="Cupom vale até" valor={dataBR(oferta.vence)} />}
        </dl>
      )}

      {oferta.motivo === "tem_cupom" && (diferenca == null || diferenca <= 0) && (
        <p className="mt-2 rounded-md bg-card px-3 py-2 text-sm font-bold">
          Mesmo preço final{oferta.finalAtual != null ? <> ({brl(oferta.final)})</> : null}, mas lá
          o desconto vem de cupom, então você vê o valor cair no carrinho.
        </p>
      )}

      {oferta.link ? (
        <a
          href={oferta.link}
          target="_blank"
          rel="noopener noreferrer"
          className={
            (principal && !semAnimacao ? "animate-botao-destaque " : "") +
            "mt-2 block w-full rounded-md bg-success py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
          }
        >
          {/* Regra do Weslei: nunca o nome da loja no botão; texto de compra segura. */}
          <ShieldCheck className="mr-1.5 inline size-4 align-[-3px]" aria-hidden="true" />
          {textoDoBotao(dispositivo, `Comprar com segurança por ${brl(oferta.final)}`).replace(
            " pelo app",
            " no app",
          )}
        </a>
      ) : oferta.url ? (
        <div className="mt-2">
          <VerNaLoja url={oferta.url} grande />
        </div>
      ) : null}
      {oferta.mesmaPagina ? (
        <p className="mt-1.5 rounded-md bg-card px-3 py-2 text-xs leading-relaxed">
          <span className="font-semibold">Importante:</span> o link abre a página deste produto. Se
          a loja em destaque não for a{" "}
          <span className="font-semibold">{oferta.vendedor ?? "mais barata"}</span>, toque em{" "}
          <span className="font-semibold">"Outras opções de compra"</span> e escolha{" "}
          {oferta.vendedor ?? "essa loja"} por {brl(oferta.preco)}.
        </p>
      ) : (
        principal && <AvisoDoBotao d={dispositivo} />
      )}

      {oferta.cupomId != null && oferta.link && (
        <CodigoNaHora
          cupomId={oferta.cupomId}
          destino={oferta.link}
          titulo={titulo}
          vendedor={oferta.vendedor}
          cupom={{
            id: oferta.cupomId,
            titulo: oferta.cupomTitulo,
            vence: oferta.vence,
            teto: oferta.teto,
            minimo: oferta.minimo,
            economia: oferta.economia,
            bloqueado: false,
          }}
        />
      )}

      {!oferta.verificadoIA && (
        <p className="mt-1.5 text-[11px] text-secondary-ink">
          {oferta.achadoNaBusca
            ? "Confira a descrição antes de comprar."
            : "Mesmo produto, na mesma página de catálogo."}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------ condições do cupom

   As condições aparecem SEMPRE, com ou sem cupom. É o motivo do site existir.
   Cada linha só é renderizada quando o dado existe de verdade — nada de
   calcular teto quando não há teto, que é a contradição do modal antigo.
*/

function CondicoesDoCupom({ analise }: { analise: Analise | null | undefined }) {
  const c = analise?.cupom ?? null;

  if (!c) {
    const achouOutra = !!analise?.outraLoja || (analise?.outrasLojas?.length ?? 0) > 0;
    const procurou = analise?.procurouOutra === true;

    /* Leitura falhou: o site NAO SABE se tem cupom. Dizer "esta loja nao tem
       cupom" aqui seria afirmar o que ninguem conferiu, e foi exatamente o que
       aconteceu com um link curto meli.la que a extensao nao conseguiu abrir. */
    /* Regra honesta: so da para afirmar que ESTA loja nao tem cupom quando a
       loja foi identificada. Se nao sei de quem e o anuncio, nao sei nada
       sobre o cupom dela. `lojaLida` vem null em registros antigos e quando a
       analise nem chegou a acontecer, e null nao e permissao para afirmar. */
    const identificouLoja = analise?.lojaLida === true || !!analise?.vendedor;
    const naoConferiu = !identificouLoja;

    /* Link que abre perfil em vez de produto. Acontece com alguns links curtos
       de compartilhamento. Nao e erro do site nem da loja, e o link aponta para
       outro lugar, entao a instrucao tem que ser essa e nao "tente de novo". */
    const ehPerfil = /perfil/i.test(analise?.diagnostico ?? "");

    /* O Mercado Livre pediu verificacao de seguranca na sessao do servidor.
       Nao e culpa do cliente nem da loja, e insistir so piora. A pessoa nao
       precisa entender captcha: precisa saber que nao e com ela e que o
       caminho de comprar continua aberto pelo proprio Mercado Livre. */
    const ehCaptcha = /seguran|captcha/i.test(
      (analise?.diagnostico ?? "") + " " + (analise?.linkFalhou ?? ""),
    );

    if (naoConferiu) {
      return (
        <div className="mt-3 rounded-md border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="text-sm font-semibold">
            {ehCaptcha
              ? "Estou fazendo uma verificação de segurança."
              : ehPerfil
                ? "Esse link abre um perfil, não um produto."
                : "Não consegui abrir este anúncio agora."}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            {ehCaptcha
              ? "Não é nada com você nem com a loja: o site da loja pediu uma confirmação de segurança do meu lado e eu prefiro esperar a insistir. Volte daqui a pouco. Se for comprar agora, pode ir direto pelo app da loja, sem problema nenhum."
              : ehPerfil
                ? "Ele leva a uma página com vários produtos, então não dá para saber qual você quer nem de que loja. Abra o anúncio do produto e cole o endereço dele aqui."
                : "Não vou dizer que a loja não tem cupom, porque eu não cheguei a conferir. Tente de novo em instantes, ou cole o endereço completo do anúncio em vez do link curto de compartilhamento."}
          </p>
          {analise?.diagnostico && (
            <p className="mt-1.5 text-xs text-secondary-ink/80">
              Detalhe técnico: {semMarca(analise.diagnostico)}.
            </p>
          )}
        </div>
      );
    }

    /* Achei loja melhor: a comparação acima já diz tudo. Caixa só ocupava
       espaço (pedido do Weslei: tela menor, texto curto). */
    if (achouOutra) return null;

    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
        <p className="text-sm font-semibold">Hoje essa loja não tem cupom.</p>
        {achouOutra ? null : (
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            {procurou
              ? "Procurei este mesmo produto em outras lojas e nenhuma sai mais barato hoje. "
              : "Não cheguei a comparar com outras lojas desta vez. "}
          </p>
        )}
        {!achouOutra && procurou && analise?.motivoOutra && (
          <p className="mt-1.5 text-xs text-secondary-ink/80">
            Motivo: {semMarca(analise.motivoOutra)}.
          </p>
        )}
        {!procurou && analise?.motivoNaoProcurou && (
          <p className="mt-1.5 text-xs text-secondary-ink/80">
            Por que não comparei: {semMarca(analise.motivoNaoProcurou)}.
          </p>
        )}
      </div>
    );
  }

  if (c.bloqueado && c.minimo != null) {
    const preco = analise?.preco ?? null;
    const falta = preco != null && c.minimo > preco ? c.minimo - preco : null;

    // Desconto exato na compra minima, respeitando o teto do cupom.
    const descontoNoMinimo = descontoNaCompraMinima(c.titulo, c.minimo, c.teto);
    const pagariaNoMinimo = descontoNoMinimo != null ? c.minimo - descontoNoMinimo : null;

    return (
      <div className="mt-3 rounded-md border border-urgency-warning bg-urgency-soft p-3">
        <p className="text-sm font-bold text-urgency-warning">Falta pouco para o cupom valer</p>
        <p className="mt-1 text-sm leading-relaxed">
          O cupom de {c.titulo} desta loja só entra a partir de {brl(c.minimo)}
          {preco != null ? `, e este produto está ${brl(preco)}` : ""}.
        </p>

        {falta != null && (
          <p className="mt-2 rounded-md bg-card px-3 py-2 text-sm font-bold">
            Adicione mais {brl(falta)} para garantir o cupom e o desconto.
          </p>
        )}

        {descontoNoMinimo != null && pagariaNoMinimo != null && (
          <p className="mt-2 text-xs leading-relaxed text-secondary-ink">
            Chegando em {brl(c.minimo)}, o desconto é de {brl(descontoNoMinimo)} e você paga{" "}
            {brl(pagariaNoMinimo)} levando mais produto. Pode somar outros itens da mesma loja para
            fechar esse valor.
          </p>
        )}

        {descontoNoMinimo == null && (
          <p className="mt-2 text-xs leading-relaxed text-secondary-ink">
            Pode somar outros itens da mesma loja até chegar em {brl(c.minimo)} e o cupom entra.
          </p>
        )}
      </div>
    );
  }

  const valeAPena = analise?.temCupom === true;

  return (
    <div
      className={
        "mt-3 rounded-md p-3 " +
        (valeAPena ? "border border-success/40 bg-success/10" : "border border-border bg-muted/50")
      }
    >
      <p className={"text-sm font-bold " + (valeAPena ? "text-success" : "text-foreground")}>
        {valeAPena
          ? `Cupom de ${c.titulo}${c.economia != null ? ` — cerca de ${brl(c.economia)} de desconto` : ""}`
          : c.economia != null
            ? `Cupom de ${c.titulo}: neste produto dá ${brl(c.economia)} de desconto.`
            : `Cupom de ${c.titulo} nesta loja.`}
      </p>

      <dl className="mt-2 divide-y divide-border text-sm">
        <Linha rotulo="Desconto do cupom" valor={c.titulo} />
        <Linha
          rotulo="Limite de desconto"
          valor={c.teto == null ? "sem limite de valor" : brl(c.teto)}
          destaque={c.teto == null}
        />
        {c.economia != null && (
          <Linha rotulo="Desconto neste produto" valor={brl(c.economia)} destaque />
        )}
        {c.minimo != null && <Linha rotulo="Compra mínima" valor={brl(c.minimo)} />}
        {c.vence && <Linha rotulo="Válido até" valor={dataBR(c.vence)} />}
      </dl>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string | null;
  destaque?: boolean;
}) {
  if (!valor) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-secondary-ink">{rotulo}</dt>
      <dd className={"text-right font-bold " + (destaque ? "text-ml-blue" : "")}>{valor}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ offline

   Nunca oferecer a URL original como botão de compra: a pessoa compraria e o
   Weslei não receberia nada. Sem WhatsApp: o caminho é tentar de novo.
*/

function Offline({ tentar, motivo }: { tentar: () => void; motivo?: string | null }) {
  /* Link que abre um perfil (lista de produtos), não um produto: não é
     pausa, é o link. Diz o que fazer (26/09). */
  if (motivo && /perfil|nao abre um anuncio/i.test(motivo)) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium">Esse link abre uma lista de produtos, não um produto.</p>
        <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
          Abra o produto que você quer, toque em compartilhar e cole aqui o link da página dele.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
      <p className="text-sm font-medium">A conferência de links está pausada neste momento.</p>
      <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
        Não sei dizer quando volta, então prefiro não te deixar esperando. Enquanto isso, procure a
        loja pelo nome na busca logo abaixo: os limites e condições de cada cupom continuam aí.
      </p>
      {motivo && (
        <p className="mt-2 rounded border border-border bg-card px-2 py-1 text-xs text-secondary-ink/80">
          Detalhe técnico: {semMarca(motivo)}
        </p>
      )}
      <button
        type="button"
        onClick={tentar}
        className="mt-3 w-full rounded-md bg-ml-blue py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
      >
        Tentar de novo
      </button>
    </div>
  );
}

/* ------------------------------------------------ comparar e escolher
   Weslei, 28/09: detalhes de TODOS os produtos encontrados e a opção de
   comparar lado a lado ou pedir ajuda para decidir a melhor escolha (valor,
   características, vantagens e diferenças contra o anúncio colado). Todo
   botão de compra leva o link de afiliado; sem link pronto, o botão gera o
   link no clique (VerNaLoja). */

type OpcaoEscolha = {
  chave: string;
  tipo: "colado" | "mesmo" | "parecido";
  titulo: string | null;
  loja: string | null;
  preco: number;
  imagem: string | null | undefined;
  freteGratis: boolean | null;
  /* Frete para o CEP do cliente, quando simulado (02/10). */
  custoFrete?: number | null;
  lojaOficial: boolean;
  link: string | null;
  url: string | null;
  detalhes: Detalhes | null;
  detalhesDoColado?: boolean;
  muda: string | null;
  vantagem: string | null;
};

type RespostaAjuda = {
  escolha: {
    tipo: "colado" | "mesmo" | "parecido";
    titulo: string;
    loja: string | null;
    preco: number;
    freteGratis: boolean | null;
    lojaOficial: boolean;
    muda: string | null;
    link: string;
  };
  resumo: string;
  pontos: {
    n: number;
    titulo: string;
    loja: string | null;
    preco: number;
    aFavor: string;
    contra: string;
  }[];
};

function rotuloDaOpcao(o: OpcaoEscolha) {
  const quem = o.tipo === "colado" ? "Anúncio colado" : (o.loja ?? "Outra loja");
  return `${quem} · ${brl(o.preco)}${o.tipo === "parecido" ? " · parecido" : ""}`;
}

function textoDoFrete(f: boolean | null, custo?: number | null) {
  if (f === true) return "Frete grátis";
  if (f === false && custo != null && custo > 0) return `Frete ${brl(custo)}`;
  if (f === false) return "Frete pago";
  return "Não informado";
}

function CompareEEscolha({
  opcoes,
  pedidoId,
  dispositivo,
  padrao = null,
}: {
  padrao?: string | null;
  opcoes: OpcaoEscolha[];
  pedidoId: number | null;
  dispositivo: Dispositivo;
}) {
  const [modo, setModo] = useState<"nenhum" | "comparar" | "ajuda">("nenhum");
  if (opcoes.length < 2) return null;
  return (
    <section
      aria-label="Compare e escolha"
      className="mt-3 rounded-lg border border-ml-blue/30 bg-ml-blue/5 p-3"
    >
      <p className="text-sm font-bold">Ficou em dúvida?</p>
      <p className="text-xs leading-snug text-secondary-ink">
        Compare lado a lado ou receba uma análise da melhor escolha pelo preço, frete,
        características, vantagens e diferenças.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModo((m) => (m === "comparar" ? "nenhum" : "comparar"))}
          aria-expanded={modo === "comparar"}
          className={
            "rounded-md border px-2 py-2 text-xs font-bold transition-colors " +
            (modo === "comparar"
              ? "border-ml-blue bg-ml-blue text-white"
              : "border-ml-blue bg-card text-ml-blue hover:bg-ml-blue/5")
          }
        >
          Comparar lado a lado
        </button>
        {pedidoId != null && (
          <button
            type="button"
            onClick={() => setModo((m) => (m === "ajuda" ? "nenhum" : "ajuda"))}
            aria-expanded={modo === "ajuda"}
            className={
              "rounded-md border px-2 py-2 text-xs font-bold transition-colors " +
              (modo === "ajuda"
                ? "border-success bg-success text-white"
                : "border-success bg-card text-success hover:bg-success/5")
            }
          >
            Me ajude a escolher
          </button>
        )}
      </div>
      {modo === "comparar" && <LadoALado opcoes={opcoes} padrao={padrao} />}
      {modo === "ajuda" && pedidoId != null && (
        <AjudaParaEscolher pedidoId={pedidoId} dispositivo={dispositivo} />
      )}
    </section>
  );
}

function SeletorOpcao({
  opcoes,
  valor,
  mudar,
  nome,
}: {
  opcoes: OpcaoEscolha[];
  valor: string;
  mudar: (v: string) => void;
  nome: string;
}) {
  return (
    <select
      aria-label={nome}
      value={valor}
      onChange={(e) => mudar(e.target.value)}
      className="w-full min-w-0 rounded border border-border bg-card px-1 py-1 text-[11px] font-semibold"
    >
      {opcoes.map((o) => (
        <option key={o.chave} value={o.chave}>
          {rotuloDaOpcao(o)}
        </option>
      ))}
    </select>
  );
}

function LinhaLadoALado({
  nome,
  a,
  b,
  difere = false,
}: {
  nome: string;
  a: React.ReactNode;
  b: React.ReactNode;
  difere?: boolean;
}) {
  return (
    <tr className="border-t border-border align-top">
      <th className="px-1.5 py-1 text-left text-[11px] font-semibold text-secondary-ink">{nome}</th>
      <td
        className={
          "px-1.5 py-1 text-[11px] [overflow-wrap:anywhere] " +
          (difere ? "bg-amber-50 dark:bg-amber-950/30" : "")
        }
      >
        {a}
      </td>
      <td
        className={
          "px-1.5 py-1 text-[11px] [overflow-wrap:anywhere] " +
          (difere ? "bg-amber-50 dark:bg-amber-950/30" : "")
        }
      >
        {b}
      </td>
    </tr>
  );
}

function ProdutoDaOpcao({ o }: { o: OpcaoEscolha }) {
  return o.tipo === "parecido" ? (
    <span className="text-amber-800 dark:text-amber-300">
      Parecido{o.muda ? `: muda ${o.muda}` : ""}
    </span>
  ) : o.tipo === "colado" ? (
    <span>O que você colou</span>
  ) : (
    <span className="text-success">Mesmo produto</span>
  );
}

function ComprarOpcao({ o }: { o: OpcaoEscolha }) {
  return o.link ? (
    <a
      href={o.link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 rounded bg-success px-2 py-1 text-[11px] font-bold text-white hover:brightness-95"
    >
      <ShieldCheck className="size-3" aria-hidden="true" />
      Comprar
    </a>
  ) : o.url ? (
    <VerNaLoja url={o.url} />
  ) : null;
}

function LadoALado({ opcoes, padrao }: { opcoes: OpcaoEscolha[]; padrao?: string | null }) {
  const colado = opcoes.find((o) => o.tipo === "colado") ?? opcoes[0]!;
  const outras = opcoes.filter((o) => o !== colado);
  /* Abre comparando com a recomendação (ou a Melhor alternativa); sem ela,
     com a outra opção mais barata. */
  const maisBarata =
    outras.find((o) => o.chave === padrao) ??
    [...outras].sort((x, y) => x.preco - y.preco)[0] ??
    opcoes[1]!;
  const [chaveA, setChaveA] = useState(colado.chave);
  const [chaveB, setChaveB] = useState(maisBarata.chave);
  const A = opcoes.find((o) => o.chave === chaveA) ?? colado;
  const B = opcoes.find((o) => o.chave === chaveB) ?? maisBarata;

  /* Características dos dois, pelo nome; em amarelo o que difere. */
  const mapa = (d: Detalhes | null) =>
    new Map((d?.caracteristicas ?? []).map((c) => [c.nome.toLowerCase(), c] as const));
  const ca = mapa(A.detalhes);
  const cb = mapa(B.detalhes);
  const nomes = [...new Set([...ca.keys(), ...cb.keys()])].slice(0, 18);
  const norm = (v: string | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const barato = A.preco === B.preco ? null : A.preco < B.preco ? "A" : "B";

  const fichaDoColado = (A.detalhesDoColado || B.detalhesDoColado) && nomes.length > 0;

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-card">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[26%]" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="bg-muted/60">
            <th className="px-1.5 py-1.5 text-left text-[11px] font-semibold">Comparar</th>
            <th className="px-1 py-1.5">
              <SeletorOpcao
                opcoes={opcoes}
                valor={A.chave}
                mudar={setChaveA}
                nome="Primeira opção"
              />
            </th>
            <th className="px-1 py-1.5">
              <SeletorOpcao
                opcoes={opcoes}
                valor={B.chave}
                mudar={setChaveB}
                nome="Segunda opção"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <LinhaLadoALado
            nome="Produto"
            a={
              <span className="flex items-start gap-1.5">
                <Foto src={A.imagem} className="size-9 shrink-0 rounded" />
                <span className="line-clamp-3">{semEntidades(A.titulo)}</span>
              </span>
            }
            b={
              <span className="flex items-start gap-1.5">
                <Foto src={B.imagem} className="size-9 shrink-0 rounded" />
                <span className="line-clamp-3">{semEntidades(B.titulo)}</span>
              </span>
            }
          />
          <LinhaLadoALado
            nome="Preço"
            a={
              <strong className={"text-sm " + (barato === "A" ? "text-success" : "")}>
                {brl(A.preco)}
              </strong>
            }
            b={
              <strong className={"text-sm " + (barato === "B" ? "text-success" : "")}>
                {brl(B.preco)}
              </strong>
            }
            difere={barato != null}
          />
          <LinhaLadoALado
            nome="Frete"
            a={textoDoFrete(A.freteGratis, A.custoFrete)}
            b={textoDoFrete(B.freteGratis, B.custoFrete)}
            difere={A.freteGratis !== B.freteGratis}
          />
          <LinhaLadoALado
            nome="Loja"
            a={
              <>
                {A.loja ?? "—"}
                {A.lojaOficial && <SeloLojaOficial className="flex" />}
              </>
            }
            b={
              <>
                {B.loja ?? "—"}
                {B.lojaOficial && <SeloLojaOficial className="flex" />}
              </>
            }
          />
          <LinhaLadoALado
            nome="É o mesmo?"
            a={<ProdutoDaOpcao o={A} />}
            b={<ProdutoDaOpcao o={B} />}
            difere={A.tipo === "parecido" || B.tipo === "parecido"}
          />
          {(A.vantagem || B.vantagem) && (
            <LinhaLadoALado nome="Tem a mais" a={A.vantagem ?? "—"} b={B.vantagem ?? "—"} difere />
          )}
          {nomes.map((n) => {
            const x = ca.get(n);
            const y = cb.get(n);
            return (
              <LinhaLadoALado
                key={n}
                nome={(x ?? y)!.nome}
                a={x?.valor ?? "—"}
                b={y?.valor ?? "—"}
                difere={Boolean(x && y && norm(x.valor) !== norm(y.valor))}
              />
            );
          })}
          <tr className="border-t border-border">
            <td className="px-1.5 py-1.5" />
            <td className="px-1.5 py-1.5">
              <ComprarOpcao o={A} />
            </td>
            <td className="px-1.5 py-1.5">
              <ComprarOpcao o={B} />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-border px-2 py-1 text-[10px] text-secondary-ink">
        {nomes.length
          ? "Em amarelo, o que muda entre os dois."
          : "Sem ficha técnica lida nestes anúncios: confira os detalhes na página antes de comprar."}
        {fichaDoColado ? " Lojas do mesmo produto usam a ficha lida no anúncio colado." : ""}
      </p>
    </div>
  );
}

function AjudaParaEscolher({
  pedidoId,
  dispositivo,
}: {
  pedidoId: number;
  dispositivo: Dispositivo;
}) {
  const [estado, setEstado] = useState<"carregando" | "erro" | RespostaAjuda>("carregando");
  useEffect(() => {
    let vivo = true;
    setEstado("carregando");
    void fetch("/api/public/ajudar-escolher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido: pedidoId }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as RespostaAjuda | null;
        if (!vivo) return;
        setEstado(r.ok && j?.escolha?.link ? j : "erro");
      })
      .catch(() => vivo && setEstado("erro"));
    return () => {
      vivo = false;
    };
  }, [pedidoId]);

  if (estado === "carregando")
    return (
      <p
        className="mt-2 flex items-center gap-2 rounded-md bg-card p-2 text-xs text-secondary-ink"
        role="status"
      >
        <LoaderCircle className="size-4 animate-spin text-success" aria-hidden="true" />
        Pesando preço, frete, características e diferenças…
      </p>
    );
  if (estado === "erro")
    return (
      <p className="mt-2 rounded-md bg-card p-2 text-xs text-secondary-ink" role="status">
        A análise não ficou pronta agora. A melhor opção desta comparação é a que está em destaque
        acima, com o link de compra.
      </p>
    );
  const e = estado.escolha;
  return (
    <div className="mt-2 rounded-md border-2 border-success/60 bg-card p-2.5" role="status">
      <p className="inline-block rounded bg-success px-2 py-0.5 text-[11px] font-bold text-white">
        <Fogo /> Melhor escolha para você
      </p>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug">
        {semEntidades(e.titulo)}
      </p>
      <p className="text-xs text-secondary-ink">
        {e.loja && (
          <>
            Vendido por <strong className="text-foreground">{e.loja}</strong>
          </>
        )}
        {e.lojaOficial && <SeloLojaOficial className="ml-1.5 inline-flex" />}
        {e.freteGratis === true && (
          <span className="ml-1.5 font-semibold text-success">Frete grátis</span>
        )}
      </p>
      <p className="mt-0.5 text-base font-bold tabular-nums text-success">{brl(e.preco)}</p>
      <p className="mt-1 text-xs leading-snug">{estado.resumo}</p>
      {e.tipo === "parecido" && (
        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Não é idêntico ao anúncio que você colou.</strong>
          {e.muda ? ` Muda: ${e.muda}.` : ""}
        </p>
      )}
      {estado.pontos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {estado.pontos.map((p) => (
            <li key={p.n} className="rounded bg-muted/40 px-2 py-1 text-[11px] leading-snug">
              <span className="font-semibold">
                {p.loja ?? "Loja"} · {brl(p.preco)}
              </span>
              {p.aFavor && <span className="block text-success">✓ {p.aFavor}</span>}
              {p.contra && (
                <span className="block text-red-700 dark:text-red-400">✗ {p.contra}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <a
        href={e.link}
        target="_blank"
        rel="noopener noreferrer"
        className="animate-botao-destaque mt-2 block w-full rounded-md bg-success py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
      >
        <ShieldCheck className="mr-1.5 inline size-4 align-[-3px]" aria-hidden="true" />
        {textoDoBotao(dispositivo, `Comprar com segurança por ${brl(e.preco)}`).replace(
          " pelo app",
          " no app",
        )}
      </a>
      <p className="mt-1 text-[10px] text-secondary-ink">
        Análise feita com os preços e as informações desta comparação.
      </p>
    </div>
  );
}

/* APRENDER COM O CLIENTE (Weslei, 05/10: "aprender e melhorar"): "Faz
   sentido?" em cada parecido. "Não é equivalente" tira a indicação das
   próximas recomendações (avaliar_indicacao no banco); "Sim" só conta no
   relatório. Sem identificação de quem respondeu. */
function AvaliarIndicacao({ pedidoId, item }: { pedidoId: number; item: string }) {
  const [estado, setEstado] = useState<"parado" | "enviando" | "feito">("parado");
  async function enviar(util: boolean) {
    setEstado("enviando");
    try {
      await supabase.rpc(
        "avaliar_indicacao" as never,
        { p_pedido: pedidoId, p_item: item, p_util: util } as never,
      );
    } catch {
      /* só aprendizado: a tela segue igual */
    }
    setEstado("feito");
  }
  if (estado === "feito")
    return (
      <p className="mt-2 text-[11px] text-secondary-ink">
        Obrigado! Sua resposta melhora as próximas comparações.
      </p>
    );
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-secondary-ink">
      <span>Esta indicação faz sentido para você?</span>
      <button
        type="button"
        disabled={estado === "enviando"}
        onClick={() => void enviar(true)}
        className="rounded-full border border-border px-2 py-0.5 font-semibold hover:bg-muted disabled:opacity-60"
      >
        👍 Sim
      </button>
      <button
        type="button"
        disabled={estado === "enviando"}
        onClick={() => void enviar(false)}
        className="rounded-full border border-border px-2 py-0.5 font-semibold hover:bg-muted disabled:opacity-60"
      >
        👎 Não é equivalente
      </button>
    </div>
  );
}
