import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Loader2, Search, ShieldCheck, Store } from "lucide-react";

import { ResultadosDaBusca } from "@/components/BuscaGuiada";
import { GarimpoNoPlayer } from "@/components/GarimpoNoPlayer";
import { buscarProdutos, type Resposta } from "@/lib/busca-guiada-cliente";
import { nomeParaTela, type AnaliseLink } from "@/lib/analisar-link";
import { ehLinkDeCompra, gerarUrlAfiliadoAmazon } from "@/lib/afiliado";
import {
  determinarCampeaoDoSegmento,
  NOME_PLAYER,
  type Campeao,
  type PlayerAfiliado,
} from "@/lib/campeao-segmento";
import type { PedidoGarimpo, ResultadoGarimpo } from "@/lib/garimpo-cliente";

/* RECONHECIMENTO UNIVERSAL DE LINKS (Weslei, 10/10) + GARIMPO NO PLAYER DE
   ORIGEM E CAMPEÃO DO NICHO (11/10). Link que não é do Mercado Livre nunca
   vira "link inválido":
   - Amazon: o produto exato com o link de afiliado (tag do Weslei) e o
     garimpo do mesmo produto na própria Amazon (extensão, conferência pela
     foto);
   - Shopee: o garimpo na própria Shopee (link de afiliado pelo painel);
   - outra loja (Magalu, KaBuM!, Shein...): o preço visto lá e a busca no
     marketplace afiliado campeão do segmento (src/lib/campeao-segmento.ts):
     Amazon e Shopee pelo garimpo; Mercado Livre pela busca do catálogo, só
     na mesma categoria do produto (11/10: bebedouro pet virava fonte de
     Buda);
   - Amazon/Shopee de um segmento em que o Mercado Livre é o campeão
     (autopeças, linha branca, beleza): a busca no Mercado Livre também
     começa sozinha;
   - os outros players ficam a um toque ("Comparar também em ...");
   - texto sem link: aviso amigável e a busca pelo nome em 1 toque.
   Todo botão de compra leva o link de afiliado do Weslei (regra nº 1). */

export type LinkIdentificadoTela = AnaliseLink & {
  precoOrigem?: number;
  imagemOrigem?: string;
  categoriaOrigem?: string;
  campeao?: Campeao;
};

type Estado = { carregando: boolean; erro: string | null; resposta: Resposta | null };

const VAZIO: Estado = { carregando: false, erro: null, resposta: null };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ORDEM: PlayerAfiliado[] = ["mercadolivre", "amazon", "shopee"];

export function LinkDeOutraLoja({
  analise,
  identificando,
  comparar,
}: {
  analise: LinkIdentificadoTela;
  identificando: boolean;
  comparar: (url: string) => void;
}) {
  const idCampo = useId();
  const [termo, setTermo] = useState(analise.termoIdentificado ?? "");
  const [busca, setBusca] = useState<Estado>(VAZIO);
  const [buscado, setBuscado] = useState<string | null>(null);
  /* Players abertos nesta tela (sozinhos ou pelo toque). */
  const [abertos, setAbertos] = useState<PlayerAfiliado[]>([]);
  /* O produto do link lido no próprio player (foto e preço para conferir
     nos outros). */
  const [lidoNaOrigem, setLidoNaOrigem] = useState<ResultadoGarimpo["original"] | null>(null);
  const automatica = useRef<string | null>(null);

  const origem = analise.origem;
  const nomeTermo = analise.termoIdentificado ?? null;
  /* O servidor diz o campeão; link com nome no endereço não passa por lá,
     então a mesma regra roda aqui. */
  const campeao =
    analise.campeao ??
    (nomeTermo && origem !== "invalido" && origem !== "mercadolivre"
      ? determinarCampeaoDoSegmento({
          titulo: nomeTermo,
          categoria: analise.categoriaOrigem ?? null,
          preco: analise.precoOrigem ?? null,
        })
      : null);
  const termoGarimpo = nomeTermo ?? (origem === "amazon" ? (analise.identificador ?? null) : null);
  /* Busca no Mercado Livre: o nome do link ou, sem ele, o lido no player. */
  const termoMl = nomeTermo ?? lidoNaOrigem?.titulo ?? null;

  /* Onde a busca começa: o próprio player (Amazon/Shopee) ou o campeão. */
  const inicial: PlayerAfiliado | null =
    origem === "amazon"
      ? "amazon"
      : origem === "shopee"
        ? "shopee"
        : origem === "outro_player"
          ? (campeao?.player ?? "mercadolivre")
          : null;
  /* Amazon/Shopee de um segmento em que o Mercado Livre é o campeão de
     verdade (autopeças, linha branca, beleza e moda): a busca no Mercado
     Livre também começa sozinha. Segmento indeterminado fica sob demanda. */
  const mercadoLivreJunto =
    (origem === "amazon" || origem === "shopee") &&
    campeao?.player === "mercadolivre" &&
    campeao.segmento !== "geral";

  useEffect(() => {
    setTermo(analise.termoIdentificado ?? "");
  }, [analise.termoIdentificado]);

  async function buscar(texto: string, modo: "guiada" | "produto") {
    const q = texto.trim();
    if (q.length < 2 || busca.carregando) return;
    setBuscado(q);
    setBusca({ carregando: true, erro: null, resposta: null });
    const r = await buscarProdutos(q, "home", modo);
    setBusca({ carregando: false, erro: r.erro, resposta: r.resposta });
  }

  /* Abre os players do começo, uma vez por link identificado. */
  useEffect(() => {
    if (identificando || !inicial) return;
    const marca = `${analise.urlLimpa}|${termoGarimpo ?? ""}`;
    if (automatica.current === marca) return;
    automatica.current = marca;
    setLidoNaOrigem(null);
    setBusca(VAZIO);
    setBuscado(null);
    const comeco: PlayerAfiliado[] = [];
    if (inicial === "mercadolivre") {
      if (nomeTermo) comeco.push("mercadolivre");
    } else if (termoGarimpo) {
      comeco.push(inicial);
      if (mercadoLivreJunto && nomeTermo) comeco.push("mercadolivre");
    }
    setAbertos(comeco);
    if (comeco.includes("mercadolivre") && nomeTermo) void buscar(nomeTermo, "produto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analise.urlLimpa, termoGarimpo, identificando, inicial]);

  function abrir(p: PlayerAfiliado) {
    setAbertos((a) => (a.includes(p) ? a : [...a, p]));
    if (p === "mercadolivre" && termoMl) void buscar(termoMl, "produto");
  }

  function pedidoPara(player: "amazon" | "shopee"): PedidoGarimpo | null {
    if (!termoGarimpo || !analise.urlLimpa) return null;
    const doPlayer = origem === player;
    return {
      player,
      origem: doPlayer ? player : origem === "amazon" || origem === "shopee" ? origem : "outro",
      url: analise.urlLimpa,
      termo: termoGarimpo,
      idOrigem: doPlayer ? (analise.identificador ?? null) : null,
      loja: analise.nomeLoja ?? null,
      preco: doPlayer ? null : (lidoNaOrigem?.preco ?? analise.precoOrigem ?? null),
      imagem: doPlayer ? null : (lidoNaOrigem?.imagem ?? analise.imagemOrigem ?? null),
    };
  }

  const linkAmazon =
    origem === "amazon" && analise.identificador
      ? gerarUrlAfiliadoAmazon(analise.identificador)
      : null;
  const nome = nomeTermo ? nomeParaTela(nomeTermo) : null;
  const semNome = !identificando && !nome && !(origem === "amazon" && analise.identificador);

  function enviar(e: FormEvent) {
    e.preventDefault();
    void buscar(termo, origem === "invalido" ? "guiada" : "produto");
  }

  const rotuloLoja =
    origem === "invalido" ? null : (analise.nomeLoja ?? "outra loja").replace(/^www\./, "");

  /* Menor preço da busca no Mercado Livre (não conferido pela foto). */
  const menorNoMl = useMemo(() => {
    const precos = (busca.resposta?.resultados ?? [])
      .map((r) => r.preco)
      .filter((p): p is number => typeof p === "number" && p > 0);
    return precos.length ? Math.min(...precos) : null;
  }, [busca.resposta]);

  const outros = ORDEM.filter((p) => !abertos.includes(p) && inicial != null);

  return (
    <div
      className="mt-4 rounded-2xl border border-border bg-[#f5f5f7] p-4 dark:bg-white/5 sm:p-5"
      data-origem={`link_${origem}`}
      aria-live="polite"
    >
      {origem === "invalido" ? (
        <p className="text-sm font-medium text-foreground">
          Não encontrei um link aqui. Cole o endereço do anúncio (de qualquer loja) ou escreva o
          nome do produto.
        </p>
      ) : (
        <>
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-secondary-ink">
            <Store className="size-3.5" aria-hidden="true" />
            Loja do link: {rotuloLoja}
          </p>
          {identificando ? (
            <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-secondary-ink">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Identificando o produto…
            </p>
          ) : nome ? (
            <p className="mt-1 text-base font-bold leading-snug text-foreground sm:text-lg">
              Produto identificado: <span className="font-extrabold">{nome}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm font-semibold text-foreground">
              Não consegui ler o nome do produto neste link.
            </p>
          )}
          {origem === "outro_player" && !identificando && analise.precoOrigem != null && (
            <p className="mt-1 text-sm text-foreground">
              Preço visto {rotuloLoja ? `na ${rotuloLoja}` : "na loja do link"}:{" "}
              <strong className="tabular-nums">{brl(analise.precoOrigem)}</strong>
            </p>
          )}
          {origem === "outro_player" && !identificando && nome && campeao && (
            <p className="mt-1 text-[13px] text-secondary-ink">{campeao.frase}</p>
          )}
        </>
      )}

      {/* Amazon: o produto exato, com a tag de afiliado, desde já. */}
      {linkAmazon && ehLinkDeCompra(linkAmazon, "amazon") && (
        <div className="mt-3 max-w-xs">
          <a
            href={linkAmazon}
            target="_blank"
            rel="noopener noreferrer sponsored"
            data-origem="link_amazon_colado"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-success px-3 py-2.5 text-[13px] font-bold text-white transition-all duration-200 ease-out hover:brightness-95 motion-safe:hover:-translate-y-px"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Comprar com segurança</span>
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </a>
          <p className="mt-1 text-[11px] text-secondary-ink">
            Este é o produto do link que você colou. Confira o preço e o frete no anúncio.
          </p>
        </div>
      )}

      {/* Garimpo na Amazon/Shopee: o player do link (ou o campeão) primeiro. */}
      {abertos
        .filter((p): p is "amazon" | "shopee" => p === "amazon" || p === "shopee")
        .map((p) => {
          const pedido = pedidoPara(p);
          return pedido ? (
            <GarimpoNoPlayer
              key={p}
              pedido={pedido}
              auto
              precoOrigem={origem === "outro_player" ? (analise.precoOrigem ?? null) : null}
              lojaOrigem={origem === "outro_player" ? (rotuloLoja ?? null) : null}
              aoTerminar={p === origem ? (r) => setLidoNaOrigem(r.original) : undefined}
            />
          ) : null;
        })}

      {/* Mercado Livre: a busca do mesmo produto no catálogo. */}
      {abertos.includes("mercadolivre") && termoMl && origem !== "invalido" && (
        <div className="mt-4">
          <p className="text-sm font-bold text-foreground">No Mercado Livre</p>
          <p className="mt-0.5 text-sm text-secondary-ink">
            {busca.carregando
              ? "Buscando o melhor preço para você no Mercado Livre…"
              : "Busquei o mesmo produto nas lojas do Mercado Livre, só na mesma categoria. Toque em “Comparar preço” no que for igual ao seu."}
          </p>
          {!busca.carregando && menorNoMl != null && (
            <p className="mt-1 text-[13px] text-foreground">
              Menor preço achado na busca:{" "}
              <strong className="tabular-nums">{brl(menorNoMl)}</strong>
              {origem === "outro_player" &&
                analise.precoOrigem != null &&
                Math.abs(analise.precoOrigem - menorNoMl) >= 0.01 && (
                  <span className="text-secondary-ink">
                    {" "}
                    ({brl(Math.abs(analise.precoOrigem - menorNoMl))}{" "}
                    {menorNoMl < analise.precoOrigem ? "a menos" : "a mais"} no produto que o visto
                    na loja do link; confira se é o mesmo produto)
                  </span>
                )}
            </p>
          )}
        </div>
      )}

      {/* Texto solto: a busca pelo nome é sob demanda. */}
      {origem === "invalido" && nome && !buscado && (
        <div className="mt-3">
          <p className="text-sm text-secondary-ink">Quer que eu procure pelo nome?</p>
          <button
            type="button"
            onClick={() => void buscar(nomeTermo ?? "", "guiada")}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            <Search className="size-4" aria-hidden="true" />
            Buscar “{(nome ?? "").slice(0, 40)}”
          </button>
        </div>
      )}

      {/* Os outros players: sob demanda, um toque cada. */}
      {!identificando && termoGarimpo && outros.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-secondary-ink">
            Quer comparar também {outros.length > 1 ? "nas outras lojas" : "na outra loja"}?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outros.map((p) =>
              p === "mercadolivre" && !termoMl ? null : (
                <button
                  key={p}
                  type="button"
                  onClick={() => abrir(p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#0071e3] px-4 py-2 text-sm font-bold text-[#0071e3] transition hover:bg-[#0071e3]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                >
                  <Search className="size-4" aria-hidden="true" />
                  Comparar também {p === "mercadolivre" ? "no" : "na"} {NOME_PLAYER[p]}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Sem nome no link: a pessoa escreve. */}
      {semNome && (
        <form onSubmit={enviar} className="mt-3 flex max-w-xl gap-2" role="search">
          <label htmlFor={idCampo} className="sr-only">
            Qual é o produto?
          </label>
          <input
            id={idCampo}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            maxLength={160}
            placeholder="Qual é o produto? Ex.: Echo Dot 5ª geração"
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm text-foreground placeholder:text-[#86868b] focus:outline-none focus-visible:border-[#0071e3] focus-visible:ring-4 focus-visible:ring-[#0071e3]/20"
          />
          <button
            type="submit"
            disabled={busca.carregando || termo.trim().length < 2}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            <Search className="size-4" aria-hidden="true" />
            Buscar
          </button>
        </form>
      )}

      {(busca.carregando || busca.erro || busca.resposta) && (
        <ResultadosDaBusca
          compacto
          carregando={busca.carregando}
          erro={busca.erro}
          resposta={busca.resposta}
          comparar={comparar}
          semResultado="Não achei este produto com anúncio ativo nas lojas do Mercado Livre agora, na mesma categoria. Tente escrever o nome de outro jeito."
        />
      )}
    </div>
  );
}
