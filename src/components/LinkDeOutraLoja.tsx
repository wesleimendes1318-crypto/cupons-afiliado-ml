import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Loader2, Search, ShieldCheck, Store } from "lucide-react";

import { ResultadosDaBusca } from "@/components/BuscaGuiada";
import { buscarProdutos, type Resposta } from "@/lib/busca-guiada-cliente";
import { nomeParaTela, type AnaliseLink } from "@/lib/analisar-link";
import { ehLinkDeCompra, gerarUrlAfiliadoAmazon } from "@/lib/afiliado";

/* RECONHECIMENTO UNIVERSAL DE LINKS (Weslei, 10/10). Link que não é do
   Mercado Livre nunca vira "link inválido":
   - outra loja (Magalu, KaBuM!, Shein...): "Produto identificado" e a busca
     do mesmo produto no Mercado Livre já começa (botões só com meli.la);
   - Amazon: o produto exato com o link de afiliado (tag do Weslei) e a busca
     no Mercado Livre em 1 toque (sob demanda, como na comparação dos 3);
   - Shopee: o nome e a busca no Mercado Livre em 1 toque (o link de
     afiliado da Shopee só sai pela extensão);
   - texto sem link: aviso amigável e a busca pelo nome em 1 toque.
   Sem nome no link, a pessoa escreve o produto. */

type Estado = { carregando: boolean; erro: string | null; resposta: Resposta | null };

const VAZIO: Estado = { carregando: false, erro: null, resposta: null };

export function LinkDeOutraLoja({
  analise,
  identificando,
  comparar,
}: {
  analise: AnaliseLink;
  identificando: boolean;
  comparar: (url: string) => void;
}) {
  const idCampo = useId();
  const [termo, setTermo] = useState(analise.termoIdentificado ?? "");
  const [busca, setBusca] = useState<Estado>(VAZIO);
  const [buscado, setBuscado] = useState<string | null>(null);
  const automatica = useRef<string | null>(null);

  useEffect(() => {
    setTermo(analise.termoIdentificado ?? "");
  }, [analise.termoIdentificado]);

  async function buscar(texto: string) {
    const q = texto.trim();
    if (q.length < 2 || busca.carregando) return;
    setBuscado(q);
    setBusca({ carregando: true, erro: null, resposta: null });
    const r = await buscarProdutos(q, "home");
    setBusca({ carregando: false, erro: r.erro, resposta: r.resposta });
  }

  /* Loja sem afiliado: a busca no Mercado Livre começa sozinha. */
  useEffect(() => {
    const t = analise.termoIdentificado;
    if (analise.origem !== "outro_player" || identificando || !t) return;
    const marca = `${analise.urlLimpa}|${t}`;
    if (automatica.current === marca) return;
    automatica.current = marca;
    void buscar(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analise.origem, analise.urlLimpa, analise.termoIdentificado, identificando]);

  const linkAmazon =
    analise.origem === "amazon" && analise.identificador
      ? gerarUrlAfiliadoAmazon(analise.identificador)
      : null;
  const nome = analise.termoIdentificado ? nomeParaTela(analise.termoIdentificado) : null;
  const semNome = !identificando && !nome;

  function enviar(e: FormEvent) {
    e.preventDefault();
    void buscar(termo);
  }

  const rotuloLoja =
    analise.origem === "invalido" ? null : (analise.nomeLoja ?? "outra loja").replace(/^www\./, "");

  return (
    <div
      className="mt-4 rounded-2xl border border-border bg-[#f5f5f7] p-4 dark:bg-white/5 sm:p-5"
      data-origem={`link_${analise.origem}`}
      aria-live="polite"
    >
      {analise.origem === "invalido" ? (
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
        </>
      )}

      {/* Amazon: o produto exato, com a tag de afiliado. */}
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

      {analise.origem === "outro_player" && nome && (
        <p className="mt-2 text-sm text-secondary-ink">
          {busca.carregando
            ? "Buscando o melhor preço para você no Mercado Livre…"
            : "Busquei o mesmo produto nas lojas do Mercado Livre. Toque em “Comparar preço” no que for igual ao seu."}
        </p>
      )}

      {/* Amazon, Shopee e texto solto: a busca no Mercado Livre é sob demanda. */}
      {(analise.origem === "amazon" ||
        analise.origem === "shopee" ||
        analise.origem === "invalido") &&
        nome &&
        !buscado && (
          <div className="mt-3">
            <p className="text-sm text-secondary-ink">
              {analise.origem === "invalido"
                ? "Quer que eu procure pelo nome?"
                : "Quer ver se sai mais barato nas lojas do Mercado Livre?"}
            </p>
            <button
              type="button"
              onClick={() => void buscar(analise.termoIdentificado ?? "")}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
            >
              <Search className="size-4" aria-hidden="true" />
              {analise.origem === "invalido"
                ? `Buscar “${nome.slice(0, 40)}”`
                : "Buscar o mesmo produto"}
            </button>
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
          semResultado="Não achei este produto com anúncio ativo nas lojas do Mercado Livre agora. Tente escrever o nome de outro jeito."
        />
      )}
    </div>
  );
}
