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

import { useCallback, useEffect, useRef, useState } from "react";
import { History, LoaderCircle, Package, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roboAtivo } from "@/lib/robo";
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
  const linhas = ["Olha o cupom que encontrei 👀"];
  if (titulo) linhas.push(`Produto: ${titulo}`);
  if (vendedor) linhas.push(`Loja: ${vendedor}`);
  if (cupom?.titulo) linhas.push(`Desconto: ${cupom.titulo}`);
  if (cupom?.teto != null) linhas.push(`Economia máxima: ${brl(cupom.teto)}`);
  else if (cupom) linhas.push("Limite: sem limite de valor");
  if (cupom?.minimo != null) linhas.push(`Compra mínima: ${brl(cupom.minimo)}`);
  if (cupom?.vence) linhas.push(`Válido até: ${dataBR(cupom.vence)}`);
  linhas.push(`Etiqueta: ${codigo}`, `Link afiliado do produto: ${link}`);
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
  if (economia != null && economia >= 0.5) {
    linhas.push(`💸 Achei o mesmo produto *${brl(economia)} mais barato*!`);
    if (nome) linhas.push(`🛒 ${nome}`);
    if (preco != null)
      linhas.push(
        `💰 ${precoOriginal != null ? `De ~${brl(precoOriginal)}~ por ` : ""}*${brl(preco)}*` +
          (freteGratis === true ? " · frete grátis" : ""),
      );
  } else {
    linhas.push(nome ? `✅ Conferi o preço de *${nome}*` : "✅ Conferi o preço deste produto");
    if (preco != null)
      linhas.push(
        `💰 *${brl(preco)}*` +
          (comparadas > 0 ? ` · a melhor opção entre ${comparadas + 1} lojas` : "") +
          (freteGratis === true ? " · frete grátis" : ""),
      );
  }
  linhas.push("", `👉 Compre com segurança: ${link}`);
  linhas.push("", "🔎 Compare qualquer produto em melhorescolha.io");
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

/* A mesma coisa que a pessoa quer comprar, vendida por OUTRA loja que tem
   cupom. Só chega aqui quando é o mesmo produto de catálogo do Mercado Livre,
   nunca um parecido, e só quando sai mais barato que o anúncio colado. */
type OutraLoja = {
  freteGratis?: boolean | null;
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
  link: string;
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
    link?: string | null;
    url?: string | null;
    freteGratis?: boolean | null;
  }> | null;
  /* Aviso que a página do anúncio mostra (ex.: "indisponível"). */
  aviso?: string | null;
  /* completa: achou loja mais barata, ou a busca e a conferência pela foto
     terminaram. final: false = a extensão ainda está refazendo a comparação
     (segunda volta); a tela continua se atualizando. */
  completa?: boolean | null;
  final?: boolean | null;
  voltas?: number | null;
  /* Frete do anúncio colado: true grátis, false pago, null não sei. */
  freteGratis?: boolean | null;
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
  freteGratis?: boolean | null;
};

type Pedido = {
  status: "pendente" | "processando" | "pronto" | "falhou";
  link: string | null;
  codigo: string | null;
  erro: string | null;
  analise: Analise | null;
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
    return Array.isArray(lista) ? lista.slice(0, 6) : [];
  } catch {
    return [];
  }
}
function gravarHistorico(lista: ItemHistorico[]) {
  try {
    window.localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(0, 6)));
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
              Ver de novo
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BuscaPorLink() {
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

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Pedido que a tela está acompanhando. A espera pela segunda volta dura
     minutos: uma consulta velha nunca pode sobrescrever um link novo colado. */
  const atual = useRef<number | null>(null);
  /* Link (limpo) do pedido acompanhado, para o histórico. */
  const urlDoPedido = useRef<string | null>(null);

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
    async (bruta: string) => {
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

      const { data: id, error } = await supabase.rpc("pedir_link", { p_url: limpo });

      if (error || id == null) {
        limparTimers();
        setFase("offline");
        setErro(
          /link invalido/i.test(error?.message ?? "")
            ? "Esse link não é de um anúncio válido. Cole o endereço do produto."
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
        const { data } = await supabase.rpc("consultar_pedido", { p_id: id });
        if (atual.current !== id) return;
        // O tipo gerado do RPC devolve status como string solta; aqui a gente
        // sabe o formato porque a funcao no banco e nossa.
        const bruto = Array.isArray(data) ? data[0] : data;
        const linha = bruto ? (bruto as unknown as Pedido) : null;

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
          const aindaComparando =
            linha.analise?.final === false && Date.now() - prontoEm < COMPLETAR_MS;
          setCompletando(aindaComparando);
          if (!aindaComparando) {
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
          setMotivo(linha.erro ?? null);
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
    setHistorico((h) => {
      const nova = [item, ...h.filter((x) => x.url !== alvo)].slice(0, 6);
      gravarHistorico(nova);
      return nova;
    });
  }, [fase, pedido]);

  const carregando =
    fase === "enviando" || fase === "na-fila" || fase === "outras-lojas" || fase === "lendo";

  return (
    <section
      id="colar-link"
      className="mx-auto max-w-3xl rounded-xl border-2 border-ml-blue/30 bg-ml-blue/5 p-3 sm:p-4"
    >
      <div className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">
          🔗
        </span>
        <h2 className="font-semibold">Cole o link do produto</h2>
      </div>
      <p className="mb-2 text-xs text-secondary-ink">
        Procuro o mesmo produto em outras lojas e mostro onde sai mais barato.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          id="campo-link-produto"
          rows={1}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={(e) => {
            const colado = e.clipboardData.getData("text");
            if (colado && colado.trim().length > 20) {
              setUrl(colado);
              setTimeout(() => buscar(colado), 0);
            }
          }}
          placeholder="Cole aqui o link do anúncio do produto"
          aria-label="Link do anúncio do produto"
          className="min-h-10 min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ml-blue focus:ring-1 focus:ring-ml-blue"
        />
        <button
          type="button"
          onClick={() => buscar(url)}
          disabled={carregando || !url.trim()}
          className="shrink-0 rounded-md bg-ml-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start"
        >
          {carregando ? "Comparando..." : "Comparar preços"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-danger">{erro}</p>}

      {carregando && (
        <Espera fase={fase} demorando={demorando} inicio={inicio} estimativa={estimativa} />
      )}

      {fase === "pronto" && pedido && (
        <Resultado
          pedido={pedido}
          copiar={copiar}
          copiado={copiado}
          urlColada={melhorLinkML(url) ?? null}
          completando={completando}
        />
      )}

      {fase === "offline" && !erro && <Offline tentar={() => buscar(url)} motivo={motivo} />}

      {!carregando && (
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

function Resultado({
  pedido,
  copiar,
  copiado,
  urlColada,
  completando = false,
}: {
  pedido: Pedido;
  copiar: (t: string, m: string) => void;
  copiado: string | null;
  urlColada: string | null;
  completando?: boolean;
}) {
  const a = pedido.analise;
  const link = pedido.link ?? "";
  const dispositivo = useDispositivo();

  /* A loja do anúncio não tem cupom que preste, mas outra loja vende o MESMO
     produto de catálogo com cupom valendo para este preço. Nesse caso a troca
     vira a recomendação principal: é ela que põe dinheiro no bolso da pessoa.
     O anúncio original continua disponível, só que como segunda opção. */
  const alternativas: OutraLoja[] =
    a?.outrasLojas && a.outrasLojas.length ? a.outrasLojas : a?.outraLoja ? [a.outraLoja] : [];
  /* A troca vira a recomendação principal quando a melhor alternativa sai mais
     barata, ou quando a loja do anúncio não tem cupom e a outra tem. */
  const trocar =
    alternativas.length > 0 && (a?.temCupom !== true || (alternativas[0]?.ganho ?? 0) > 0);

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
  const linhasLojas: LinhaLoja[] = [
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
          },
        ]
      : []),
    ...alternativas.map((o, i) => ({
      chave: `alt-${i}`,
      nome: o.vendedor ?? "Outra loja",
      imagem: o.imagem,
      final: o.final,
      diferenca: o.ganho != null ? -o.ganho : null,
      freteGratis: o.freteGratis ?? null,
      link: o.link,
      url: null,
    })),
    ...referencias.map((r, i) => ({
      chave: `ref-${i}`,
      nome: r.vendedor ?? "Outra loja",
      imagem: r.imagem,
      final: r.final,
      diferenca: r.diferenca,
      freteGratis: r.freteGratis ?? null,
      link: r.link ?? null,
      url: r.url ?? null,
    })),
  ];
  const mostraTabela =
    (a?.procurouOutra === true || alternativas.length > 0) &&
    !leituraFalhou &&
    linhasLojas.length >= 2;
  /* Coluna da direita: lojas comparadas e/ou parecidos. */
  const temColuna = mostraTabela || (!leituraFalhou && (a?.parecidos?.length ?? 0) > 0);

  return (
    <div
      className={
        "mt-3 rounded-lg border border-border bg-card p-3" +
        (temColuna ? " sm:grid sm:grid-cols-2 sm:gap-x-4" : "")
      }
    >
      <div className="flex items-start gap-3 sm:col-start-1 sm:row-start-1">
        <Foto src={a?.imagem} className="size-16 shrink-0 rounded-md border border-border" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-sm font-medium leading-snug">
            {semEntidades(a?.titulo) ?? "Produto do link que você colou"}
          </p>
          {a?.aviso && (
            <p className="mt-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
              O anúncio informa: {a.aviso}
            </p>
          )}
          <p className="mt-0.5 text-xs text-secondary-ink">
            {a?.preco != null && (
              <span className="text-base font-bold tabular-nums text-foreground">
                {brl(a.preco)}
              </span>
            )}
            {a?.temCupom && <span> · sem o cupom</span>}
            {a?.vendedor && <span> · {a.vendedor}</span>}
          </p>
        </div>
      </div>

      {temColuna && (
        <div className="sm:col-start-2 sm:row-span-2 sm:row-start-1">
          {mostraTabela && <TodasAsLojas linhas={linhasLojas} />}
          <Parecidos lista={a?.parecidos} tituloColado={a?.titulo} precoColado={a?.preco} />
        </div>
      )}

      <div className="sm:col-start-1 sm:row-start-2">
        {/* Só a melhor em destaque; todas as outras lojas estão na tabela. */}
        {alternativas.slice(0, 1).map((oferta, i) => (
          <OutraLojaComCupom
            key={`${oferta.vendedor ?? "loja"}-${i}`}
            oferta={oferta}
            dispositivo={dispositivo}
            vendedorAqui={a?.vendedor ?? null}
            cupomAqui={a?.temCupom ? (a?.cupom?.titulo ?? null) : null}
            precoAqui={a?.preco ?? null}
            titulo={a?.titulo ?? null}
            principal={trocar && i === 0}
            compacto={i > 0}
            lojaAquiTemCupom={a?.temCupom === true}
          />
        ))}

        {/* O anúncio colado, com o link de afiliado, está sempre na tabela de lojas. */}
        {estaEAMelhor && (
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
            const melhor = trocar ? alternativas[0] : null;
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
            return (
              <button
                type="button"
                onClick={() => compartilharWhatsApp(texto)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-[#25D366] py-2 text-sm font-semibold text-[#128C7E] transition-colors hover:bg-[#25D366]/10"
              >
                <Share2 className="size-4" aria-hidden="true" />
                Compartilhar no WhatsApp
              </button>
            );
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
            Comprando pelos botões daqui o preço é o mesmo, e eu recebo uma pequena comissão da
            loja. Obrigado!
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
}: {
  vendedor: string | null;
  preco: number | null;
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
          Melhor opção
        </span>
        <span className="text-sm font-semibold">{vendedor ?? "Loja do anúncio"}</span>
        <span className="ml-auto text-base font-bold tabular-nums">
          {preco != null ? (
            brl(preco)
          ) : (
            <span className="text-xs font-normal">preço no anúncio</span>
          )}
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
          className="mt-2 block w-full rounded-md bg-success py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
        >
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
function VerNaLoja({ url, grande = false }: { url: string; grande?: boolean }) {
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
      const { data: id, error } = await supabase.rpc(
        "pedir_link_loja" as never,
        { p_url: alvo } as never,
      );
      if (error || id == null) throw new Error("falhou");
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
        const { data } = await supabase.rpc("consultar_pedido", { p_id: Number(id) });
        const linha = (Array.isArray(data) ? data[0] : data) as {
          status?: string;
          link?: string | null;
        } | null;
        if (linha?.status === "pronto" && linha.link) {
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
};

/* Parecidos: NAO e o mesmo produto (regra: parecido nunca aparece como
   igual). Tabela separada, âmbar (atenção), com o que muda em cada um. */
/* PREÇO POR UNIDADE: com quantidade diferente (kit de 30 x kit de 20, 500 ml
   x 1 L) o preço do anúncio engana; o que compara é o preço por unidade, por
   litro ou por kg. Só aparece quando os dois títulos trazem a medida. */
type Medida = { qtd: number; tipo: "un" | "ml" | "g" };
function medidaDoTitulo(titulo: string | null | undefined): Medida | null {
  const t = semEntidades(titulo)?.toLowerCase() ?? "";
  if (!t) return null;
  const num = (x: string) => Number(x.replace(",", "."));
  const kit =
    /\b(?:kit|c\/|com)\s*(\d{1,4})\b/.exec(t) ??
    /\b(\d{1,4})\s*(?:unidades|unid\.?|un\.?|pe[cç]as|p[cç]s|pares)\b/.exec(t);
  const vezes = kit ? num(kit[1] ?? "1") : 1;
  const vol = /\b(\d+(?:[.,]\d+)?)\s*(ml|l|litros?)\b/.exec(t);
  if (vol) {
    const v = num(vol[1] ?? "0") * (vol[2] === "ml" ? 1 : 1000);
    return v > 0 ? { qtd: v * vezes, tipo: "ml" } : null;
  }
  const peso = /\b(\d+(?:[.,]\d+)?)\s*(g|kg|gramas?)\b/.exec(t);
  if (peso) {
    const g = num(peso[1] ?? "0") * (peso[2] === "kg" ? 1000 : 1);
    return g > 0 ? { qtd: g * vezes, tipo: "g" } : null;
  }
  return kit && vezes > 1 ? { qtd: vezes, tipo: "un" } : null;
}
function precoPorMedida(preco: number, m: Medida) {
  if (m.tipo === "ml") return `${brl((preco / m.qtd) * 1000)} por litro`;
  if (m.tipo === "g") return `${brl((preco / m.qtd) * 1000)} por kg`;
  return `${brl(preco / m.qtd)} por unidade`;
}

function Parecidos({
  lista,
  tituloColado,
  precoColado,
}: {
  lista: Analise["parecidos"];
  tituloColado?: string | null | undefined;
  precoColado?: number | null | undefined;
}) {
  if (!lista || !lista.length) return null;
  const mColado = medidaDoTitulo(tituloColado);
  /* Só mostra por unidade quando algum parecido tem quantidade diferente. */
  const medidas = lista.map((p) => medidaDoTitulo(p.titulo));
  const comparaMedida =
    mColado != null &&
    precoColado != null &&
    medidas.some((m) => m && m.tipo === mColado.tipo && m.qtd !== mColado.qtd);
  return (
    <div className="mt-3 rounded-md border border-amber-400/70 bg-amber-50/60 p-2 first:sm:mt-0 dark:bg-amber-950/20">
      <p className="text-sm font-bold">Parecidos ({lista.length})</p>
      <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
        Não é o mesmo produto: veja o que muda antes de comprar.
      </p>
      {comparaMedida && mColado && precoColado != null && (
        <p className="mt-0.5 text-[11px] text-secondary-ink">
          Você colou: <strong>{precoPorMedida(precoColado, mColado)}</strong>
        </p>
      )}
      <ul className="mt-1.5 space-y-1.5">
        {lista.map((p, i) => {
          const m = medidas[i];
          const porMedida =
            comparaMedida && m && mColado && m.tipo === mColado.tipo
              ? precoPorMedida(p.preco, m)
              : null;
          return (
            <li key={i} className="flex items-start gap-2 rounded bg-card p-1.5">
              <Foto src={p.imagem} className="size-10 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-tight">
                  {semEntidades(p.titulo)}
                </p>
                {p.freteGratis === false && (
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Frete pago (valor no carrinho)
                  </p>
                )}
                {p.muda && (
                  <p className="mt-0.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300">
                    Muda: {p.muda}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <span className="block text-sm font-bold">{brl(p.preco)}</span>
                {porMedida && (
                  <span className="block text-[10px] text-secondary-ink">{porMedida}</span>
                )}
                {p.diferenca != null && Math.abs(p.diferenca) >= 0.5 && (
                  <span
                    className={
                      "block text-[11px] font-bold " +
                      (p.diferenca < 0 ? "text-success" : "text-red-700 dark:text-red-400")
                    }
                  >
                    {p.diferenca < 0 ? `${brl(-p.diferenca)} a menos` : `+${brl(p.diferenca)}`}
                  </span>
                )}
                <span className="mt-1 block">
                  {p.link ? (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded border border-ml-blue px-2 py-1 text-[11px] font-bold text-ml-blue hover:bg-ml-blue/5"
                    >
                      Abrir
                    </a>
                  ) : p.url ? (
                    <VerNaLoja url={p.url} />
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TodasAsLojas({ linhas }: { linhas: LinhaLoja[] }) {
  if (linhas.length < 2) return null;
  const ordem = [...linhas].sort((a, b) => (a.final ?? 1e12) - (b.final ?? 1e12));
  /* Psicologia das cores (Weslei, 25/09): verde = a mais barata (ganho,
     seguro); vermelho = quanto se paga A MAIS em cada outra loja (perda);
     o anúncio colado, quando não é o mais barato, fica em âmbar (atenção). */
  /* FRETE (Weslei, 25/09): loja com frete pago não leva o selo "Mais
     barato" — o frete pode deixá-la mais cara que as outras. O selo vai para
     a mais barata com frete grátis (ou sem informação de frete). */
  const melhorIdx = Math.max(
    0,
    ordem.findIndex((l) => l.freteGratis !== false),
  );
  const menor = ordem[melhorIdx]?.final ?? null;
  return (
    <div className="mt-3 sm:mt-0">
      <p className="text-sm font-bold">Todas as lojas comparadas ({ordem.length})</p>
      <table className="mt-1.5 w-full table-fixed border-collapse overflow-hidden rounded-md border border-border text-sm">
        <thead>
          <tr className="bg-muted/70 text-left text-xs text-secondary-ink">
            <th className="px-2 py-1.5 font-semibold">Loja</th>
            <th className="w-[38%] px-2 py-1.5 text-right font-semibold">Preço</th>
            <th className="w-16 px-1 py-1.5" />
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {ordem.map((l, i) => (
            <tr
              key={l.chave}
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
                    {l.freteGratis === true && (
                      <span className="block text-[10px] font-semibold text-success">
                        Frete grátis
                      </span>
                    )}
                    {l.freteGratis === false && (
                      <span className="block text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Frete pago (valor no carrinho)
                      </span>
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
                {(() => {
                  const extra = menor != null && l.final != null ? l.final - menor : null;
                  if (i === melhorIdx)
                    return (
                      <span className="mt-0.5 inline-block rounded bg-success px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {l.colado ? "Mais barato · você colou" : "Mais barato"}
                      </span>
                    );
                  if (l.freteGratis === false && extra != null && extra < 0.5)
                    return (
                      <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        + frete pago
                        {l.colado ? " · você colou" : ""}
                      </span>
                    );
                  return (
                    <span className="block text-[11px] font-bold text-red-700 dark:text-red-400">
                      {extra != null && extra >= 0.5 ? `+${brl(extra)} a mais` : "mesmo preço"}
                      {l.freteGratis === false ? " + frete" : ""}
                      {l.colado ? " · você colou" : ""}
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
                    className="inline-block rounded border border-ml-blue px-2 py-1 text-[11px] font-bold text-ml-blue hover:bg-ml-blue/5"
                  >
                    Abrir
                  </a>
                ) : l.url ? (
                  <VerNaLoja url={l.url} />
                ) : null}
              </td>
            </tr>
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
  compacto,
  lojaAquiTemCupom,
}: {
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
            {oferta.verificadoIA ? " · ✓ conferido pela foto" : ""}
          </p>
        </div>
        <a
          href={oferta.link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-success px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
        >
          Comprar seguro
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-success/50 bg-success/10 p-3">
      {principal && (
        <p className="mb-1 inline-block rounded bg-success px-2 py-0.5 text-xs font-bold text-white">
          Minha recomendação
        </p>
      )}
      <p className="text-sm font-bold text-success">
        {temCupomLa && !lojaAquiTemCupom
          ? `Achei o mesmo produto${oferta.vendedor ? ` na loja ${oferta.vendedor}` : " em outra loja"} com cupom!`
          : temCupomLa
            ? "Achei o mesmo produto mais barato em outra loja, e lá também tem cupom"
            : !lojaAquiTemCupom && diferenca != null && diferenca > 0
              ? `${oferta.vendedor ?? "Outra loja"} vende o mesmo produto por ${brl(diferenca)} a menos`
              : "Achei o mesmo produto mais barato em outra loja"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Foto src={oferta.imagem} className="size-14 shrink-0 rounded" />
        {oferta.verificadoIA && (
          <span className="rounded bg-card px-2 py-1 text-xs font-semibold text-success">
            ✓ Mesmo produto: foto e título conferidos
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

      <a
        href={oferta.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block w-full rounded-md bg-success py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
      >
        {/* Regra do Weslei: nunca o nome da loja no botão; texto de compra segura. */}
        {textoDoBotao(dispositivo, `Comprar com segurança por ${brl(oferta.final)}`).replace(
          " pelo app",
          " no app",
        )}
      </a>
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

      {oferta.cupomId != null && (
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
