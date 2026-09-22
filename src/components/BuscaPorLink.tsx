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
import { supabase } from "@/integrations/supabase/client";
/* Ritmo da consulta: rapido no comeco, calmo depois.

   Com a ponte avisando a extensao na hora do pedido, a resposta costuma chegar
   nos primeiros segundos. Perguntar de 3 em 3 segundos o tempo todo faria o
   resultado ficar pronto no banco e a tela so mostrar dois ou tres segundos
   depois - espera inventada, do pior tipo. Entao: 1,2s nas primeiras voltas,
   3s dai em diante, para nao martelar o banco numa espera longa. */
const RITMO_RAPIDO_MS = 1200;
const VOLTAS_RAPIDAS = 15;
const RITMO_CALMO_MS = 3000;
const LIMITE_MS = 90000;
/* Depois disso a espera deixou de ser normal. Nao desiste: troca o texto por um
   aviso honesto e da uma saida util para a pessoa nao abandonar a pagina. */
const AVISO_MS = 25000;

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

/* A mesma coisa que a pessoa quer comprar, vendida por OUTRA loja que tem
   cupom. Só chega aqui quando é o mesmo produto de catálogo do Mercado Livre,
   nunca um parecido, e só quando sai mais barato que o anúncio colado. */
type OutraLoja = {
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
};

type Analise = {
  titulo: string | null;
  preco: number | null;
  vendedor: string | null;
  temCupom: boolean;
  cupom: Cupom | null;
  outraLoja: OutraLoja | null;
  /* true quando a busca por outra loja com cupom chegou a acontecer. Serve
     para separar "não procurei" de "procurei e não achou". */
  procurouOutra?: boolean | null;
  /* Em uma frase, por que a troca de loja não rolou. Só aparece quando a busca
     aconteceu e não achou nada. */
  motivoOutra?: string | null;
};

type Pedido = {
  status: "pendente" | "processando" | "pronto" | "falhou";
  link: string | null;
  codigo: string | null;
  erro: string | null;
  analise: Analise | null;
};

type Fase = "parado" | "enviando" | "na-fila" | "lendo" | "pronto" | "offline";

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
    u.hash = "";
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
  { id: "na-fila", rotulo: "Procurando o cupom da loja" },
  { id: "lendo", rotulo: "Gerando seu link de compra" },
];

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

        if (linha?.status === "processando") setFase("lendo");

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

  const carregando = fase === "enviando" || fase === "na-fila" || fase === "lendo";

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

function CodigoNaHora({ cupomId, destino }: { cupomId: number; destino: string }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [fase, setFase] = useState<"parado" | "gerando" | "falhou">("parado");
  const [copiou, setCopiou] = useState(false);
  const relogios = useRef<number[]>([]);
  /* A aba precisa nascer dentro do clique: aberta depois da resposta do
     servidor, o navegador entende como janela automática e bloqueia. */
  const abaRef = useRef<Window | null>(null);

  useEffect(() => () => { relogios.current.forEach((t) => window.clearTimeout(t)); }, []);

  const reservarAba = useCallback(() => {
    if (abaRef.current && !abaRef.current.closed) return;
    const aba = window.open("", "_blank");
    if (!aba) return;
    try {
      aba.opener = null;
      aba.document.write(
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
          "<title>Abrindo a loja...</title></head>" +
          '<body style="font-family:system-ui;padding:24px;color:#333">' +
          "<p>Gerando seu código. Esta aba abre sozinha em instantes.</p>" +
          "</body></html>",
      );
      aba.document.close();
    } catch { /* algumas versões bloqueiam o write; a aba segue válida */ }
    abaRef.current = aba;
  }, []);

  const fecharReserva = useCallback(() => {
    const aba = abaRef.current;
    abaRef.current = null;
    try { if (aba && !aba.closed) aba.close(); } catch { /* ja fechada */ }
  }, []);

  const abrir = useCallback(() => {
    const reservada = abaRef.current;
    if (reservada && !reservada.closed) {
      reservada.location.replace(destino);
      reservada.focus?.();
      abaRef.current = null;
      return;
    }
    window.open(destino, "_blank", "noopener,noreferrer");
  }, [destino]);

  async function pedir() {
    reservarAba();
    setFase("gerando");
    try {
      const { data } = await supabase.rpc("pedir_etiqueta", { p_cupom_id: cupomId });
      const resposta = String(data ?? "");
      if (resposta.startsWith("#")) { pronto(resposta); return; }
      if (resposta !== "pedido") { fecharReserva(); setFase("falhou"); return; }
    } catch {
      fecharReserva();
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
      else { fecharReserva(); setFase("falhou"); }
    };
    relogios.current.push(window.setTimeout(olhar, 3000));
  }

  function pronto(valor: string) {
    setCodigo(valor);
    setFase("parado");
    setCopiou(copiarAgora(valor));
    abrir();
  }

  if (codigo) {
    return (
      <div className="mt-3 rounded-md border-2 border-success/50 bg-success/10 p-3">
        <p className="text-sm font-bold text-success">
          {copiou ? `Código ${codigo} copiado.` : `Seu código é ${codigo}.`}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-secondary-ink">
          Cole no carrinho da loja para o desconto entrar.
        </p>
        <button
          type="button"
          onClick={() => { setCopiou(copiarAgora(codigo)); abrir(); }}
          className="mt-2 w-full rounded-md bg-success py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95"
        >
          Copiar de novo e abrir o produto
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={pedir}
        disabled={fase === "gerando"}
        className="w-full rounded-md bg-success py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95 disabled:opacity-70"
      >
        {fase === "gerando" ? "Criando seu código..." : "Usar este cupom"}
      </button>
      <p className="mt-1.5 text-xs leading-relaxed text-secondary-ink" aria-live="polite">
        {fase === "gerando"
          ? "Assim que ficar pronto eu copio o código para você e abro o produto."
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

  /* A loja do anúncio não tem cupom que preste, mas outra loja vende o MESMO
     produto de catálogo com cupom valendo para este preço. Nesse caso a troca
     vira a recomendação principal: é ela que põe dinheiro no bolso da pessoa.
     O anúncio original continua disponível, só que como segunda opção. */
  const trocar = a?.temCupom !== true && !!a?.outraLoja;

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      {a?.titulo && (
        <p className="break-words text-sm font-medium">{a.titulo}</p>
      )}
      {a?.preco != null && (
        <p className="mt-1 text-2xl font-bold tabular-nums">{brl(a.preco)}</p>
      )}
      {a?.vendedor && <p className="mt-1 text-xs text-secondary-ink">Vendido por {a.vendedor}</p>}

      {a?.outraLoja && (
        <OutraLojaComCupom oferta={a.outraLoja} precoAqui={a.preco} principal={trocar} />
      )}

      <CondicoesDoCupom analise={a} />

      {a?.temCupom && a.cupom?.id != null && !trocar && (
        <CodigoNaHora cupomId={a.cupom.id} destino={link} />
      )}


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
        {trocar ? "Comprar mesmo assim na loja do anúncio" : "Comprar agora"}
      </a>


      {pedido.codigo && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
          <p className="text-xs leading-relaxed text-secondary-ink">
            Se o link não abrir no aplicativo, cole este código na busca da loja:
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

      <p className="mt-4 text-xs leading-relaxed text-secondary-ink">
        <span className="font-semibold text-foreground">Compre por este botão.</span> É a mesma loja
        oficial do anúncio, mesmo preço, mesma segurança, mesma garantia. A diferença é que por aqui o
        vendedor me paga uma comissão, e não sai um centavo a mais do seu bolso.
      </p>
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
  precoAqui,
  principal,
}: {
  oferta: OutraLoja;
  precoAqui: number | null;
  principal?: boolean;
}) {
  const diferenca =
    precoAqui != null && oferta.final != null ? precoAqui - oferta.final : null;

  return (
    <div className="mt-3 rounded-lg border-2 border-success/50 bg-success/10 p-3">
      {principal && (
        <p className="mb-1 inline-block rounded bg-success px-2 py-0.5 text-xs font-bold text-white">
          Minha recomendação
        </p>
      )}
      <p className="text-sm font-bold text-success">
        {principal
          ? "A loja do anúncio não tem cupom, mas achei o mesmo produto em uma loja que tem"
          : "Este mesmo produto está mais barato em outra loja, com cupom"}
      </p>


      <dl className="mt-2 divide-y divide-success/20 text-sm">
        {oferta.vendedor && <Linha rotulo="Loja" valor={oferta.vendedor} />}
        <Linha rotulo="Preço lá" valor={brl(oferta.preco)} />
        {oferta.cupomTitulo && <Linha rotulo="Cupom" valor={oferta.cupomTitulo} />}
        {oferta.economia != null && (
          <Linha rotulo="Desconto do cupom" valor={brl(oferta.economia)} />
        )}
        {oferta.final != null && (
          <Linha rotulo="Você paga" valor={brl(oferta.final)} destaque />
        )}
        {oferta.minimo != null && (
          <Linha rotulo="Compra mínima" valor={brl(oferta.minimo)} />
        )}
        {oferta.vence && <Linha rotulo="Cupom vale até" valor={dataBR(oferta.vence)} />}
      </dl>

      {diferenca != null && diferenca > 0 && (
        <p className="mt-2 rounded-md bg-card px-3 py-2 text-sm font-bold">
          São {brl(diferenca)} a menos que o anúncio que você colou.
        </p>
      )}

      <a
        href={oferta.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full rounded-md bg-success py-3 text-center text-base font-bold text-white transition-colors hover:brightness-95"
      >
        Comprar na loja com cupom
      </a>

      <p className="mt-2 text-xs leading-relaxed text-secondary-ink">
        É o mesmo produto, na mesma página de catálogo, só que
        no anúncio desta loja. O desconto do cupom aparece no carrinho.
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
    const achouOutra = !!analise?.outraLoja;
    const procurou = analise?.procurouOutra === true;

    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
        <p className="text-sm font-semibold">Hoje essa loja não tem cupom.</p>
        {achouOutra ? (
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            Por isso procurei o mesmo produto em outras lojas e a opção com cupom está logo acima.
            Se preferir ficar com a loja do anúncio, o botão abaixo continua valendo: mesmo preço da
            loja, e a comissão que eu recebo é paga pelo vendedor.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
            {procurou
              ? "Procurei as outras lojas que vendem exatamente este mesmo produto e nenhuma tem cupom que compense hoje. Prefiro te dizer isso a inventar um desconto que não existe. "
              : "Prefiro te dizer isso a inventar um desconto que não existe. "}
            O botão de comprar aqui embaixo continua valendo a pena para nós dois: o preço é o mesmo
            da loja, e por ele eu recebo uma comissão paga pelo vendedor. Não sai um centavo
            a mais do seu bolso e me ajuda a manter o site de pé.
          </p>
        )}
        {!achouOutra && procurou && analise?.motivoOutra && (
          <p className="mt-1.5 text-xs text-secondary-ink/80">Motivo: {analise.motivoOutra}.</p>
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
      <p className="text-sm font-medium">A geração automática está fora do ar neste momento.</p>
      <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
        Isso costuma durar poucos minutos. Seu link continua aí no campo: é só tentar de novo.
        Enquanto isso, você pode procurar a loja pelo nome na busca logo abaixo.
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
