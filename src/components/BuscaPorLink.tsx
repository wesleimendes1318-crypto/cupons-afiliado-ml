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
import { LoaderCircle, Share2 } from "lucide-react";
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
const LIMITE_MS = 150000;
/* Depois disso a espera deixou de ser normal. Nao desiste: troca o texto por um
   aviso honesto e da uma saida util para a pessoa nao abandonar a pagina. */
const AVISO_MS = 45000;

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

function compartilharWhatsApp(texto: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
}

/* A mesma coisa que a pessoa quer comprar, vendida por OUTRA loja que tem
   cupom. Só chega aqui quando é o mesmo produto de catálogo do Mercado Livre,
   nunca um parecido, e só quando sai mais barato que o anúncio colado. */
type OutraLoja = {
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
  /^https?:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(\/|$)/i.test(u.trim());

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
    if (wid && !/item_id/i.test(u.search)) u.searchParams.set("pdp_filters", `item_id:${wid.toUpperCase()}`);
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
  const limpo = String(texto || "").replace(/\s+/g, " ").trim();
  if (!limpo) return null;

  const candidatos: string[] = [];
  for (const bruto of limpo.match(/https?:\/\/[^\s"'<>]+/gi) || []) {
    // Duas URLs coladas sem espaco: corta na segunda ocorrencia de "http".
    const corte = bruto.slice(8).search(/https?:\/\//i);
    const candidato = corte >= 0 ? bruto.slice(0, corte + 8) : bruto;
    if (ehLinkML(candidato)) candidatos.push(candidato);
  }
  if (!candidatos.length) return null;

  const escolhido =
    candidatos.find(ehProdutoML) ?? candidatos.find(ehCurtoML) ?? candidatos[0];

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
  { id: "na-fila", rotulo: "Procurando cupom da loja" },
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
    else if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) setD("celular");
    else setD("computador");
  }, []);
  return d;
}

function textoDoBotao(d: Dispositivo, base: string) {
  return d === "celular" ? `${base} no app do Mercado Livre` : `${base} no Mercado Livre`;
}

function AvisoDoBotao({ d }: { d: Dispositivo }) {
  const texto =
    d === "celular"
      ? "Toque no botão e o app do Mercado Livre abre direto no produto, já na sua conta. É só finalizar a compra por lá."
      : d === "app-interno"
        ? "Você está no navegador de dentro de outro app. Se o Mercado Livre abrir aqui dentro, toque nos três pontinhos e em \"Abrir no navegador\" para ir ao app e finalizar a compra."
        : "Abre o anúncio numa aba nova, no site do Mercado Livre. Se você já está logado neste navegador, é só finalizar a compra.";
  return <p className="mt-1.5 text-center text-xs leading-relaxed text-secondary-ink">{texto}</p>;
}

export default function BuscaPorLink() {
  const [url, setUrl] = useState("");
  const [fase, setFase] = useState<Fase>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [demorando, setDemorando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aviso = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setErro(null);
      setPedido(null);
      setCopiado(null);
      setDemorando(false);
      setMotivo(null);

      const limpo = melhorLinkML(alvo);
      if (!limpo) {
        setFase("parado");
        setErro("Esse link não é de um anúncio válido. Cole o endereço do produto.");
        return;
      }

      setFase("enviando");

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

      setFase("na-fila");
      /* Cutuca a extensao na hora. Sem isso o pedido espera o alarme do Chrome,
         que nao roda em menos de 1 minuto: era esse o tempo morto da espera. */
      try {
        window.postMessage({ de: "cupons-afiliado-ml", tipo: "pedido-novo", id }, window.location.origin);
      } catch { /* sem extensao: o alarme cobre */ }

      let voltas = 0;
      let parou = false;

      const consultar = async () => {
        const { data } = await supabase.rpc("consultar_pedido", { p_id: id });
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

        if (linha?.status === "pronto" && linha.link) {
          parou = true;
          limparTimers();
          setPedido(linha);
          setFase("pronto");
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

  const copiar = (texto: string, marca: string) => {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(marca);
        setTimeout(() => setCopiado(null), 1600);
      })
      .catch(() => undefined);
  };

  const carregando = fase === "enviando" || fase === "na-fila" || fase === "outras-lojas" || fase === "lendo";

  return (
    <section id="colar-link" className="rounded-xl border-2 border-ml-blue/30 bg-ml-blue/5 p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">🔗</span>
        <h2 className="font-semibold">Já sabe o produto? Cole o link</h2>
      </div>
      <p className="mb-3 text-xs text-secondary-ink">
        Eu confiro se a loja tem cupom de verdade, com o limite real de desconto, e devolvo o link
        pronto para comprar.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          id="campo-link-produto"
          rows={2}
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
          className="min-w-0 flex-1 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ml-blue focus:ring-1 focus:ring-ml-blue"
        />
        <button
          type="button"
          onClick={() => buscar(url)}
          disabled={carregando || !url.trim()}
          className="shrink-0 rounded-md bg-ml-blue px-5 py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start"
        >
          {carregando ? "Conferindo..." : "Conferir cupom"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-danger">{erro}</p>}

      {carregando && <Espera fase={fase} demorando={demorando} />}

      {fase === "pronto" && pedido?.link && (
        <Resultado pedido={pedido} copiar={copiar} copiado={copiado} />
      )}

      {fase === "offline" && !erro && <Offline tentar={() => buscar(url)} motivo={motivo} />}
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

function Espera({ fase, demorando }: { fase: Fase; demorando: boolean }) {
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
                    className={
                      "size-1.5 rounded-full " + (andando ? "bg-ml-blue" : "bg-border")
                    }
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

      {demorando ? (
        <p className="mt-2 text-center text-xs leading-relaxed text-secondary-ink">
          Está demorando mais que o normal, mas eu continuo tentando. Deixe a página
          aberta: o resultado aparece aqui sozinho.
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
  } catch { /* plano B */ }
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

  useEffect(() => () => {
    relogios.current.forEach((t) => window.clearTimeout(t));
    if (redirecionamento.current) window.clearTimeout(redirecionamento.current);
  }, []);

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
      if (resposta.startsWith("#")) { pronto(resposta); return; }
      if (resposta !== "pedido") { setFase("falhou"); return; }
      try {
        window.postMessage({ de: "cupons-afiliado-ml", tipo: "pedido-novo", id: cupomId }, window.location.origin);
      } catch { /* sem extensao: o alarme de 1 minuto cobre */ }
    } catch {
      setFase("falhou");
      return;
    }

    const limite = Date.now() + 88_000;
    const olhar = async () => {
      try {
        const { data } = await supabase.rpc("consultar_etiqueta", { p_cupom_id: cupomId });
        if (typeof data === "string" && data.startsWith("#")) { pronto(data); return; }
      } catch { /* tenta de novo */ }
      if (Date.now() < limite) relogios.current.push(window.setTimeout(olhar, 3000));
      else { setFase("falhou"); }
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
              : `Seu código é ${codigo}.`}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-secondary-ink">
          Cole no carrinho da loja para o desconto entrar.
        </p>
        <button
          type="button"
          onClick={() => { setCopiou(copiarAgora(codigo)); abrir(); }}
          disabled={redirecionando}
          className="mt-2 w-full rounded-md bg-success py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95"
        >
          {redirecionando ? "Copiado! Abrindo o produto..." : "Copiar e abrir o produto"}
        </button>
        <button
          type="button"
          onClick={() => compartilharWhatsApp(mensagemProduto({ titulo, vendedor, cupom, codigo, link: destino }))}
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
        ) : "Usar este cupom"}
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
        <div className="mt-2.5 overflow-hidden rounded-md border border-success/25 bg-success/10 p-3" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-xs font-bold text-success">
            <span className="etapa-andando size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
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
            ? "Não consegui criar o código agora. O botão de comprar continua valendo: o desconto do cupom entra no carrinho."
            : "Cria o código deste cupom, copia para você e abre o produto na loja."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- resultado */

function Resultado({
  pedido,
  copiar,
  copiado,
}: {
  pedido: Pedido;
  copiar: (t: string, m: string) => void;
  copiado: string | null;
}) {
  const a = pedido.analise;
  const link = pedido.link as string;
  const dispositivo = useDispositivo();

  /* A loja do anúncio não tem cupom que preste, mas outra loja vende o MESMO
     produto de catálogo com cupom valendo para este preço. Nesse caso a troca
     vira a recomendação principal: é ela que põe dinheiro no bolso da pessoa.
     O anúncio original continua disponível, só que como segunda opção. */
  const alternativas: OutraLoja[] =
    a?.outrasLojas && a.outrasLojas.length ? a.outrasLojas : a?.outraLoja ? [a.outraLoja] : [];
  /* A troca vira a recomendação principal quando a melhor alternativa sai mais
     barata, ou quando a loja do anúncio não tem cupom e a outra tem. */
  const trocar = alternativas.length > 0 && (a?.temCupom !== true || (alternativas[0]?.ganho ?? 0) > 0);

  /* Quando a leitura falha, o "link" devolvido e o proprio endereco colado, e
     nao um link de afiliado gerado. Prometer comissao ali seria falso, e se a
     pessoa tiver colado o link de afiliado de outra pessoa a venda vai para
     ela. Nesse caso o botao nao aparece. */
  const leituraFalhou = !(a?.lojaLida === true || !!a?.vendedor);

  /* Sem link de afiliado nao existe botao de compra, mesmo que a leitura do
     produto tenha dado certo. Comprar por um endereco sem etiqueta entrega a
     venda de graca, e a frase sobre comissao viraria mentira. */
  const semLink = !link || !!a?.linkFalhou;

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      {a?.titulo && (
        <p className="break-words text-sm font-medium">{a.titulo}</p>
      )}
      {a?.preco != null && (
        <p className="mt-1 text-2xl font-bold tabular-nums">{brl(a.preco)}</p>
      )}
      {a?.vendedor && <p className="mt-1 text-xs text-secondary-ink">Vendido por {a.vendedor}</p>}

      {alternativas.map((oferta, i) => (
        <OutraLojaComCupom
          key={`${oferta.vendedor ?? "loja"}-${i}`}
          oferta={oferta}
          dispositivo={dispositivo}
          vendedorAqui={a?.vendedor ?? null}
          precoAqui={a?.preco ?? null}
          titulo={a?.titulo ?? null}
          principal={trocar && i === 0}
          lojaAquiTemCupom={a?.temCupom === true}
        />
      ))}

      <CondicoesDoCupom analise={a} />

      {/* Cenário 1A sem alternativa: a loja do anúncio tem cupom e eu comparei.
          Dizer isso é o que dá confiança para comprar aqui. */}
      {a?.temCupom === true && alternativas.length === 0 && (
        <p className="mt-2 text-xs leading-relaxed text-secondary-ink">
          {a.procurouOutra === true
            ? "Comparei com as outras lojas que vendem este produto: esta, com o cupom, é a opção mais barata hoje."
            : a.motivoNaoProcurou
              ? `Desta vez não comparei com outras lojas (${a.motivoNaoProcurou}).`
              : null}
        </p>
      )}

      {!leituraFalhou && semLink && (
        <div className="mt-3 rounded-md border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="text-sm font-semibold">Consegui conferir, mas o link de compra não saiu.</p>
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            As condições acima são reais. O que faltou foi gerar o link, e sem ele eu não coloco
            botão de compra aqui: seria mandar você comprar por um caminho que não me credita nada.
            Tente de novo em instantes.
          </p>
        </div>
      )}

      {a?.temCupom && a.cupom?.id != null && !trocar && (
        <CodigoNaHora cupomId={a.cupom.id} destino={link} titulo={a.titulo} vendedor={a.vendedor} cupom={a.cupom} />
      )}


      {!leituraFalhou && !semLink && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={
            trocar
              ? "mt-4 block w-full rounded-md border-2 border-ml-blue py-2.5 text-center text-sm font-bold text-ml-blue transition-colors hover:bg-ml-blue/5"
              : "mt-4 block w-full rounded-md bg-ml-blue py-3 text-center text-base font-bold text-white transition-colors hover:brightness-95"
          }
        >
          {trocar ? "Comprar mesmo assim na loja do anúncio" : textoDoBotao(dispositivo, "Comprar agora")}
        </a>
      )}
      {!leituraFalhou && !semLink && !trocar && <AvisoDoBotao d={dispositivo} />}


      {pedido.codigo && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
          <p className="text-xs leading-relaxed text-secondary-ink">
            Código de busca do anúncio. Não é o cupom: serve só para achar este
            produto caso o link não abra no aplicativo.
          </p>
          <div className="mt-2 flex items-center gap-2">
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
        </div>
      )}

      {/* Sem leitura nao existe botao, e sem botao esta promessa nao pode ser
          feita: seria prometer comissao sobre um link que nao foi gerado. */}
      {!leituraFalhou && !semLink && (
        <p className="mt-4 text-xs leading-relaxed text-secondary-ink">
          <span className="font-semibold text-foreground">Compre por este botão.</span> É a mesma loja
          oficial do anúncio, mesmo preço, mesma segurança, mesma garantia. A diferença é que por aqui o
          vendedor me paga uma comissão, e não sai um centavo a mais do seu bolso.
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-secondary-ink/80">
        Sou o Weslei. Estou desempregado e essa comissão tem sido minha fonte de renda. Se este site
        te ajudou, usar meu link já é uma forma de retribuir. Pode colar outro link aqui em cima
        quantas vezes quiser, a qualquer hora.
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
  precoAqui,
  titulo,
  principal,
  lojaAquiTemCupom,
}: {
  oferta: OutraLoja;
  dispositivo: Dispositivo;
  vendedorAqui: string | null;
  precoAqui: number | null;
  titulo?: string | null;
  principal?: boolean;
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
  const pct =
    diferenca != null && diferenca > 0 && atual != null && atual > 0
      ? Math.round((diferenca / atual) * 100)
      : null;

  return (
    <div className="mt-3 rounded-lg border-2 border-success/50 bg-success/10 p-3">
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
              ? `Nenhum cupom para esta loja hoje, mas ${oferta.vendedor ?? "outra loja"} vende o mesmo produto por ${brl(diferenca)} a menos`
              : "Achei o mesmo produto mais barato em outra loja"}
      </p>


      {/* Lado a lado: o que a pessoa colou, a mesma coisa na outra loja e a
          diferença. Cada valor aparece uma vez só. */}
      <div className="mt-3 overflow-hidden rounded-md border border-success/30 bg-card text-sm">
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <span className="min-w-0 text-secondary-ink">
            Anúncio que você colou{vendedorAqui ? <span className="block text-xs">{vendedorAqui}</span> : null}
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-secondary-ink line-through decoration-1">
            {brl(atual)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-success/20 px-3 py-2">
          <span className="min-w-0">
            Mesmo produto {oferta.vendedor ? <>na <span className="font-semibold">{oferta.vendedor}</span></> : "em outra loja"}
            {temCupomLa && oferta.economia != null && oferta.economia > 0 ? (
              <span className="block text-xs text-secondary-ink">
                {brl(oferta.preco)} − cupom {oferta.cupomTitulo} ({brl(oferta.economia)})
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-base font-bold tabular-nums">{brl(oferta.final)}</span>
        </div>
        {diferenca != null && diferenca > 0 && (
          <div className="flex items-baseline justify-between gap-3 bg-success/15 px-3 py-2.5">
            <span className="font-bold text-success">Você economiza</span>
            <span className="shrink-0 text-lg font-extrabold tabular-nums text-success">
              {brl(diferenca)}
              {pct != null && <span className="ml-1 text-xs font-bold">({pct}% a menos)</span>}
            </span>
          </div>
        )}
      </div>
      {(oferta.minimo != null || oferta.vence) && (
        <dl className="mt-2 divide-y divide-success/20 text-sm">
          {oferta.minimo != null && <Linha rotulo="Compra mínima do cupom" valor={brl(oferta.minimo)} />}
          {oferta.vence && <Linha rotulo="Cupom vale até" valor={dataBR(oferta.vence)} />}
        </dl>
      )}

      {oferta.motivo === "tem_cupom" && (diferenca == null || diferenca <= 0) && (
        <p className="mt-2 rounded-md bg-card px-3 py-2 text-sm font-bold">
          Mesmo preço final{oferta.finalAtual != null ? <> ({brl(oferta.final)})</> : null}, mas lá o
          desconto vem de cupom, então você vê o valor cair no carrinho.
        </p>
      )}


      <a
        href={oferta.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full rounded-md bg-success py-3 text-center text-base font-bold text-white transition-colors hover:brightness-95"
      >
        {oferta.vendedor
          ? textoDoBotao(dispositivo, `Comprar na ${oferta.vendedor} por ${brl(oferta.final)}`).replace(" no app do Mercado Livre", " no app")
          : textoDoBotao(dispositivo, temCupomLa ? "Comprar na loja com cupom" : "Comprar mais barato")}
      </a>
      {oferta.mesmaPagina ? (
        <p className="mt-1.5 rounded-md bg-card px-3 py-2 text-xs leading-relaxed">
          <span className="font-semibold">Importante:</span> o link abre a página deste produto no Mercado
          Livre. Se a loja em destaque não for a{" "}
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

      <p className="mt-2 text-xs leading-relaxed text-secondary-ink">
        {oferta.achadoNaBusca
          ? "Achei este anúncio procurando o produto na busca do Mercado Livre. O título bate com o que você colou, mas confira a descrição antes de comprar: fora do catálogo, quem escreve o anúncio é o vendedor."
          : "É o mesmo produto, na mesma página de catálogo do Mercado Livre, só que no anúncio desta loja."}
        {temCupomLa ? " O desconto do cupom aparece no carrinho." : " Aqui a economia vem do preço, não de cupom."}
      </p>
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
              ? "Estou fazendo uma verificação com o Mercado Livre."
              : ehPerfil
                ? "Esse link abre um perfil, não um produto."
                : "Não consegui abrir este anúncio agora."}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            {ehCaptcha
              ? "Não é nada com você nem com a loja: o Mercado Livre pediu uma confirmação de segurança do meu lado e eu prefiro esperar a insistir. Volte daqui a pouco. Se for comprar agora, pode ir direto pelo Mercado Livre, sem problema nenhum."
              : ehPerfil
                ? "Ele leva a uma página com vários produtos, então não dá para saber qual você quer nem de que loja. Abra o anúncio do produto no Mercado Livre e cole o endereço dele aqui."
                : "Não vou dizer que a loja não tem cupom, porque eu não cheguei a conferir. Tente de novo em instantes, ou cole o endereço completo do anúncio em vez do link curto de compartilhamento."}
          </p>
          {analise?.diagnostico && (
            <p className="mt-1.5 text-xs text-secondary-ink/80">Detalhe técnico: {analise.diagnostico}.</p>
          )}
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
        <p className="text-sm font-semibold">Hoje essa loja não tem cupom.</p>
        {achouOutra ? (
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            Por isso procurei o mesmo produto em outras lojas, e a melhor opção está logo acima.
            Se preferir ficar com a loja do anúncio, o botão abaixo continua valendo: mesmo preço da
            loja, e a comissão que eu recebo é paga pelo vendedor.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            {procurou
              ? "Procurei as outras lojas que vendem exatamente este mesmo produto e nenhuma tem cupom nem preço que compense hoje. Prefiro te dizer isso a inventar um desconto que não existe. "
              : "Não cheguei a comparar com outras lojas desta vez. Prefiro te dizer isso a deixar você achar que comparei. "}
            O botão de comprar aqui embaixo continua valendo a pena para nós dois: o preço é o mesmo
            da loja, e por ele eu recebo uma comissão paga pelo vendedor. Não sai um centavo
            a mais do seu bolso e me ajuda a manter o site de pé.
          </p>
        )}
        {!achouOutra && procurou && analise?.motivoOutra && (
          <p className="mt-1.5 text-xs text-secondary-ink/80">Motivo: {analise.motivoOutra}.</p>
        )}
        {!procurou && analise?.motivoNaoProcurou && (
          <p className="mt-1.5 text-xs text-secondary-ink/80">
            Por que não comparei: {analise.motivoNaoProcurou}.
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
    const pagariaNoMinimo =
      descontoNoMinimo != null ? c.minimo - descontoNoMinimo : null;

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
        (valeAPena
          ? "border border-success/40 bg-success/10"
          : "border border-border bg-muted/50")
      }
    >
      <p
        className={
          "text-sm font-bold " + (valeAPena ? "text-success" : "text-foreground")
        }
      >
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
      <dd className={"text-right font-bold " + (destaque ? "text-ml-blue" : "")}>
        {valor}
      </dd>
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
          Detalhe técnico: {motivo}
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
