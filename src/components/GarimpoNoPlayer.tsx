import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Loader2, ShieldCheck } from "lucide-react";

import { ehLinkDeCompra, urlBuscaAmazon } from "@/lib/afiliado";
import {
  melhorDoMesmo,
  pedirGarimpo,
  verGarimpo,
  type OfertaGarimpo,
  type PedidoGarimpo,
  type ResultadoGarimpo,
} from "@/lib/garimpo-cliente";

/* GARIMPO NO PLAYER (Weslei, 11/10): o mesmo produto procurado na Amazon
   ou na Shopee pela extensão (busca com a sessão + conferência pela foto).
   Mostra o produto de origem com o link de afiliado, o mais barato do
   MESMO produto (conferido pela foto) e, separados, os parecidos (com o que
   muda) e os encontrados só pela busca (sem foto para conferir). Todo botão
   leva o link de afiliado do Weslei (regra nº 1); sem link, sem botão.
   Valor em reais nunca junto de "frete": o frete vai em linha própria. */

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const NOME: Record<PedidoGarimpo["player"], string> = { amazon: "Amazon", shopee: "Shopee" };

type Fase = "parado" | "pedindo" | "aguardando" | "pronto" | "erro";

export function GarimpoNoPlayer({
  pedido,
  auto,
  precoOrigem = null,
  lojaOrigem = null,
  aoTerminar,
}: {
  pedido: PedidoGarimpo;
  /** Começa sozinho (player do link ou campeão); senão espera o toque. */
  auto: boolean;
  /** Preço lido na loja do link (só para link de outra loja). */
  precoOrigem?: number | null;
  lojaOrigem?: string | null;
  /** Resultado pronto (o produto lido no player serve aos outros garimpos). */
  aoTerminar?: ((r: ResultadoGarimpo) => void) | undefined;
}) {
  const [fase, setFase] = useState<Fase>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoGarimpo | null>(null);
  const vez = useRef(0);
  const nome = NOME[pedido.player];
  const chavePedido = `${pedido.player}|${pedido.url}|${pedido.termo}`;

  async function comecar() {
    const minha = ++vez.current;
    setFase("pedindo");
    setErro(null);
    setResultado(null);
    const r = await pedirGarimpo(pedido);
    if (minha !== vez.current) return;
    if ("erro" in r) {
      setErro(r.erro);
      setFase("erro");
      return;
    }
    setFase("aguardando");
    const inicio = Date.now();
    while (minha === vez.current && Date.now() - inicio < 6 * 60_000) {
      await new Promise((ok) => setTimeout(ok, Date.now() - inicio < 60_000 ? 3000 : 5000));
      if (minha !== vez.current) return;
      const e = await verGarimpo(r.id, r.chave, pedido.player);
      if (!e) continue;
      if (e.status === "pronto") {
        setResultado(e.resultado);
        setFase("pronto");
        if (e.resultado) aoTerminar?.(e.resultado);
        return;
      }
      if (e.status === "falhou" || e.parado) break;
    }
    if (minha !== vez.current) return;
    setErro(`A conferência na ${nome} não respondeu agora.`);
    setFase("erro");
  }

  useEffect(() => {
    if (auto) void comecar();
    return () => {
      vez.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, chavePedido]);

  const buscaAmazon = pedido.player === "amazon" ? urlBuscaAmazon(pedido.termo) : null;
  const melhor = melhorDoMesmo(resultado);
  const referencia = pedido.origem === "outro" ? precoOrigem : (resultado?.original.preco ?? null);
  const conferidos = resultado?.ofertas.filter((o) => o.relacao !== "busca") ?? [];
  const daBusca = resultado?.ofertas.filter((o) => o.relacao === "busca") ?? [];

  return (
    <section
      className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
      aria-live="polite"
      data-origem={`garimpo_${pedido.player}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">Na {nome}</h3>
        {resultado && (
          <p className="text-[11px] text-secondary-ink">
            li {resultado.lidas} {resultado.lidas === 1 ? "resultado" : "resultados"}
            {resultado.conferencia === "ok"
              ? ` e conferi ${resultado.conferidas} pela foto`
              : resultado.conferencia === "sem_foto"
                ? " (sem foto do seu produto para conferir)"
                : ""}
          </p>
        )}
      </div>

      {fase === "parado" && (
        <button
          type="button"
          onClick={() => void comecar()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
        >
          Comparar na {nome}
        </button>
      )}

      {(fase === "pedindo" || fase === "aguardando") && (
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-secondary-ink">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Procurando o mesmo produto na {nome}… de 30 segundos a 2 minutos.
        </p>
      )}

      {fase === "erro" && (
        <div className="mt-2 text-sm text-secondary-ink">
          <p>{erro}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void comecar()}
              className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-[#f5f5f7]"
            >
              Tentar de novo
            </button>
            {buscaAmazon && ehLinkDeCompra(buscaAmazon, "amazon") && (
              <a
                href={buscaAmazon}
                target="_blank"
                rel="noopener noreferrer sponsored"
                data-origem="garimpo_amazon_busca"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-[#f5f5f7]"
              >
                Conferir na loja <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}

      {fase === "pronto" && resultado && (
        <div className="mt-3 space-y-3">
          {/* Link de outra loja: o preço visto lá x o melhor achado aqui. */}
          {pedido.origem === "outro" && (
            <div className="grid gap-2 rounded-xl bg-[#f5f5f7] p-3 text-sm dark:bg-white/5 sm:grid-cols-2">
              <p>
                <span className="block text-[11px] text-secondary-ink">
                  Preço visto {lojaOrigem ? `na ${lojaOrigem}` : "na loja do link"}
                </span>
                <strong className="text-base tabular-nums">
                  {precoOrigem != null ? brl(precoOrigem) : "não consegui ler"}
                </strong>
              </p>
              <p>
                <span className="block text-[11px] text-secondary-ink">
                  Melhor opção do mesmo produto na {nome}
                </span>
                <strong className="text-base tabular-nums">
                  {melhor ? brl(melhor.preco) : "não confirmei o mesmo produto"}
                </strong>
                {melhor && precoOrigem != null && Math.abs(precoOrigem - melhor.preco) >= 0.01 && (
                  <span className="block text-[12px] text-secondary-ink">
                    {brl(Math.abs(precoOrigem - melhor.preco))}{" "}
                    {melhor.preco < precoOrigem ? "a menos" : "a mais"} no produto
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Link do próprio player: o produto colado, com o link de afiliado. */}
          {pedido.origem === pedido.player && resultado.original.link && (
            <CartaoOferta
              titulo={resultado.original.titulo ?? "O produto do seu link"}
              imagem={resultado.original.imagem}
              preco={resultado.original.preco}
              link={resultado.original.link}
              selo="O seu link"
              nota={
                resultado.original.selos.includes("Prime")
                  ? "Frete grátis para assinantes Prime"
                  : "Frete: confira no anúncio"
              }
              detalhe={
                melhor &&
                resultado.original.preco != null &&
                melhor.preco < resultado.original.preco
                  ? `Achei o mesmo produto por ${brl(resultado.original.preco - melhor.preco)} a menos no produto (logo abaixo).`
                  : conferidos.some((o) => o.relacao === "mesmo")
                    ? null
                    : resultado.conferencia === "ok"
                      ? `Não achei o mesmo produto mais barato na ${nome} agora.`
                      : null
              }
              destaque={!melhor || (resultado.original.preco ?? Infinity) <= melhor.preco}
            />
          )}

          {conferidos.map((o) => (
            <CartaoOferta
              key={`${o.relacao}-${o.id}`}
              titulo={o.titulo}
              imagem={o.imagem}
              preco={o.preco}
              link={o.link}
              selo={o.relacao === "mesmo" ? "Mesmo produto" : "Parecido"}
              nota={o.notaFrete ?? "Frete: confira no anúncio"}
              detalhe={
                o.relacao === "mesmo"
                  ? referencia != null && Math.abs(referencia - o.preco) >= 0.01
                    ? `${brl(Math.abs(referencia - o.preco))} ${o.preco < referencia ? "a menos" : "a mais"} no produto`
                    : null
                  : `Não é idêntico ao seu.${o.muda ? ` Muda: ${o.muda}` : ""}`
              }
              qualidade={o.relacao === "parecido" ? o.qualidade : null}
              desvantagens={o.relacao === "parecido" ? (o.desvantagens ?? null) : null}
              destaque={melhor?.id === o.id}
            />
          ))}

          {daBusca.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-secondary-ink">
                Encontrados pela busca (não conferi pela foto: confira se é o mesmo produto)
              </p>
              <div className="mt-2 space-y-2">
                {daBusca.map((o) => (
                  <CartaoOferta
                    key={`busca-${o.id}`}
                    titulo={o.titulo}
                    imagem={o.imagem}
                    preco={o.preco}
                    link={o.link}
                    selo="Encontrado pela busca"
                    nota={o.notaFrete ?? "Frete: confira no anúncio"}
                    detalhe={null}
                  />
                ))}
              </div>
            </div>
          )}

          {!resultado.ofertas.length && !resultado.original.link && (
            <p className="text-sm text-secondary-ink">
              {resultado.conferencia === "falhou"
                ? "A conferência pela foto não respondeu agora. Tente de novo em alguns minutos."
                : `Não achei o mesmo produto na ${nome} agora.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function CartaoOferta({
  titulo,
  imagem,
  preco,
  link,
  selo,
  nota,
  detalhe,
  qualidade = null,
  desvantagens = null,
  destaque = false,
}: {
  titulo: string;
  imagem: string | null;
  preco: number | null;
  link: string;
  selo: string;
  nota: string;
  detalhe: string | null;
  qualidade?: string | null;
  desvantagens?: string[] | null;
  destaque?: boolean;
}) {
  const corSelo =
    selo === "Mesmo produto"
      ? "bg-success/10 text-success"
      : selo === "Parecido"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
        : "bg-[#f5f5f7] text-secondary-ink dark:bg-white/10";
  const textoQualidade =
    qualidade === "superior"
      ? "✓ Qualidade superior"
      : qualidade === "equivalente"
        ? "✓ Qualidade equivalente"
        : qualidade === "inferior"
          ? "⚠ Qualidade inferior"
          : qualidade
            ? "? Qualidade não confirmada"
            : null;
  return (
    <article
      className={
        "flex gap-3 rounded-xl border p-3 " +
        (destaque ? "border-success/50 bg-success/5" : "border-border bg-card")
      }
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-white">
        {imagem ? (
          <img
            src={imagem}
            alt=""
            width={80}
            height={80}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-contain p-1"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${corSelo}`}
        >
          {selo === "Mesmo produto" && <Check className="size-3" aria-hidden="true" />}
          {selo}
        </span>
        <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
          {titulo}
        </p>
        {preco != null && (
          <p className="mt-0.5 text-lg font-extrabold tabular-nums text-foreground">{brl(preco)}</p>
        )}
        {detalhe && <p className="text-[12px] leading-snug text-secondary-ink">{detalhe}</p>}
        <p className="text-[11px] text-secondary-ink">{nota}</p>
        {textoQualidade && <p className="text-[11px] text-secondary-ink">{textoQualidade}</p>}
        {desvantagens && desvantagens.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-[11px] text-red-700 dark:text-red-300">
            {desvantagens.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          data-origem="garimpo"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:brightness-95"
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Comprar com segurança
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export type { OfertaGarimpo };
