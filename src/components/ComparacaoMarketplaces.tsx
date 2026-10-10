/* MESMA ANÁLISE EM CADA MARKETPLACE E COMPARAÇÃO FINAL (Weslei, 09/10:
   "deve fazer a mesma analise em cada player e por fim comparar os 3
   players"). Abaixo da análise do Mercado Livre:
   1. "Na Amazon" e "Na Shopee": o que cada uma leu e conferiu pela foto,
      o mesmo produto (do mais barato) e os parecidos (com o que muda,
      qualidade e desvantagens), frete em linha própria e a diferença
      contra o anúncio colado;
   2. "Comparação final": uma linha por marketplace com a melhor oferta do
      mesmo produto (Mercado Livre = a recomendação da tela). Disputa o
      "Mais barato" só quem tem custo confirmado (src/lib/
      comparacao-marketplaces.ts); Prime é só para assinantes.
   Botão sempre "Comprar com segurança" com o link de afiliado do próprio
   marketplace; o nome do marketplace só no selo. Sem preço capturado na
   Amazon: "Conferir na Amazon" (busca com a tag). Quem busca é a extensão
   pela sessão logada; aqui o site só lê o resultado. */
import { useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

import { ehLinkDeCompra, urlBuscaAmazon } from "@/lib/afiliado";
import type { LojaExterna } from "@/lib/coletor-multiloja";
import {
  decidirEntreMarketplaces,
  diferencaContraColado,
  linhaDoFrete,
  melhorDoMarketplace,
  NOME_DO_JOGADOR,
  ofertaExterna,
  seloDaQualidade,
  type Jogador,
  type OfertaDoJogador,
} from "@/lib/comparacao-marketplaces";
import { limparResultado, type RespostaMultiloja } from "@/lib/multiloja-resultado";
import { precoMuitoAbaixo } from "@/lib/preco-suspeito";
import { termoDeBuscaExterna } from "@/lib/termo-busca-externa";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Estado = "aguardando" | "pronto" | "inativo";

export type ColadoParaComparar = {
  titulo: string | null;
  preco: number | null;
  /* Produto + frete quando o frete do colado é conhecido; senão null. */
  totalConfirmado: number | null;
};

/* Pergunta à rota enquanto a extensão compara (busca, conferência pela foto
   e links levam de 30 s a alguns minutos). */
function useMultiloja(pedidoId: number | null) {
  const [r, setR] = useState<{ estado: Estado; dados: RespostaMultiloja | null }>({
    estado: "aguardando",
    dados: null,
  });
  useEffect(() => {
    if (pedidoId == null) {
      setR({ estado: "inativo", dados: null });
      return;
    }
    setR({ estado: "aguardando", dados: null });
    let vivo = true;
    let tentativas = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const pedir = async () => {
      tentativas += 1;
      try {
        const resp = await fetch("/api/public/multiloja", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pedido: pedidoId }),
        });
        const j = (await resp.json().catch(() => null)) as
          (RespostaMultiloja & { aguardar?: boolean }) | null;
        if (!vivo) return;
        /* 1º minuto a cada 5 s; depois a cada 15 s, até a rota parar de
           pedir espera (ela desiste 4 min depois do pedido). */
        if (j?.aguardar && tentativas < 30) {
          espera = setTimeout(() => void pedir(), tentativas < 12 ? 5_000 : 15_000);
          return;
        }
        if (!j?.ativo) {
          setR({ estado: "inativo", dados: null });
          return;
        }
        setR({ estado: "pronto", dados: limparResultado(j) });
      } catch {
        if (vivo) setR({ estado: "inativo", dados: null });
      }
    };
    void pedir();
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
  }, [pedidoId]);
  return r;
}

function SeloMarketplace({ jogador }: { jogador: Jogador }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-border bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-ink dark:bg-white/10">
      {NOME_DO_JOGADOR[jogador]}
    </span>
  );
}

function SeloPrime() {
  return (
    <span className="rounded-full bg-[#e8f1fd] px-2 py-0.5 text-[10px] font-bold text-[#0058b0]">
      Prime
    </span>
  );
}

function BotaoComprar({ link, origem }: { link: string; origem: string }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-origem={origem}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-success px-3 py-1.5 text-[11px] font-bold text-white hover:brightness-95"
    >
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      Comprar com segurança
    </a>
  );
}

/* "Conferir na Amazon": busca com a tag, quando não há preço capturado. */
function ConferirNaAmazon({ titulo }: { titulo: string | null }) {
  const link = titulo ? urlBuscaAmazon(termoDeBuscaExterna(titulo)) : null;
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-origem="multiloja_amazon_busca"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted"
    >
      <Search className="size-3.5" aria-hidden="true" />
      Conferir na Amazon
    </a>
  );
}

function LinhaOferta({
  l,
  i,
  colado,
  precosDoMesmo,
}: {
  l: LojaExterna;
  i: number;
  colado: ColadoParaComparar;
  precosDoMesmo: number[];
}) {
  const o = ofertaExterna(l);
  const diferenca = diferencaContraColado(o, colado);
  const suspeito = l.relacao === "mesmo" && precoMuitoAbaixo(l.preco, precosDoMesmo);
  const qualidade = l.relacao === "parecido" ? seloDaQualidade(l.qualidade) : null;
  return (
    <li
      className={
        "grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:grid-cols-[56px_minmax(0,1fr)_auto] " +
        (i % 2 ? "bg-muted/40" : "bg-card")
      }
    >
      <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-white">
        {l.imagem && (
          <img
            src={l.imagem}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          {o.prime && <SeloPrime />}
          <span
            className={
              "rounded-full px-2 py-0.5 text-[10px] font-bold " +
              (l.relacao === "mesmo"
                ? "bg-success/15 text-success"
                : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200")
            }
          >
            {l.relacao === "mesmo" ? "Mesmo produto" : "Parecido"}
          </span>
          {l.relacao === "parecido" && l.mesmaFoto && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-secondary-ink">
              Mesma foto do anúncio colado
            </span>
          )}
          {qualidade && (
            <span
              className={
                "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                (qualidade.nivel === "inferior"
                  ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                  : qualidade.nivel === "incerta"
                    ? "bg-muted text-secondary-ink"
                    : "bg-success/15 text-success")
              }
              title={l.qualidadeMotivo ?? undefined}
            >
              {qualidade.texto}
            </span>
          )}
        </span>
        <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-snug">
          {l.titulo}
        </span>
        {l.loja && (
          <span className="block text-[11px] text-secondary-ink">Vendido por {l.loja}</span>
        )}
        {l.relacao === "parecido" && (
          <span className="block break-words text-[11px] text-amber-900 dark:text-amber-200">
            Não é idêntico ao anúncio que você colou.{l.muda ? ` Muda: ${l.muda}` : ""}
          </span>
        )}
        {l.relacao === "parecido" && l.desvantagens && l.desvantagens.length > 0 && (
          <span className="mt-1 block rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <strong>Desvantagens em relação ao seu:</strong> {l.desvantagens.join("; ")}
          </span>
        )}
        {suspeito && (
          <span className="mt-1 block text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            Preço muito abaixo das outras lojas: confira o vendedor antes de comprar.
          </span>
        )}
      </span>
      {/* Celular: preço e frete à esquerda; o botão desce de linha quando
          não cabe (nada de texto quebrando palavra por palavra). */}
      <span className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:col-span-1 sm:flex-col sm:flex-nowrap sm:items-end sm:justify-start sm:gap-1 sm:text-right">
        <span className="flex min-w-[9rem] flex-1 flex-col sm:flex-none sm:items-end">
          <strong className="text-sm tabular-nums">{brl(l.preco)}</strong>
          <span className="text-[11px] text-secondary-ink">{linhaDoFrete(o)}</span>
          {diferenca && <span className="text-[11px] text-secondary-ink">{diferenca}</span>}
        </span>
        {o.link && <BotaoComprar link={o.link} origem={`multiloja_${l.marketplace}`} />}
      </span>
    </li>
  );
}

/* A análise de um marketplace: o que leu, o mesmo produto e os parecidos. */
function SecaoDoMarketplace({
  mk,
  estado,
  dados,
  colado,
  precosDoMesmo,
}: {
  mk: "amazon" | "shopee";
  estado: Estado;
  dados: RespostaMultiloja | null;
  colado: ColadoParaComparar;
  precosDoMesmo: number[];
}) {
  const lojas = (dados?.lojas ?? []).filter((l) => l.marketplace === mk);
  const mesmos = lojas.filter((l) => l.relacao === "mesmo");
  const parecidos = lojas.filter((l) => l.relacao === "parecido");
  const resumo = dados?.resumo?.[mk];
  /* Sem consulta e sem nada para mostrar, a seção não aparece (a linha da
     comparação final diz o que houve). */
  if (estado !== "aguardando" && !lojas.length && !resumo) return null;
  const nome = mk === "amazon" ? "Na Amazon" : "Na Shopee";
  return (
    <div className="mt-4" data-origem={`multiloja_${mk}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-sm font-bold">{nome}</p>
        {resumo && (
          <span className="text-[11px] text-secondary-ink">
            {resumo.lidas
              ? `Li ${resumo.lidas} ${resumo.lidas === 1 ? "resultado" : "resultados"}` +
                (resumo.conferidas
                  ? ` e conferi ${resumo.conferidas} pela foto, descrição e características`
                  : "")
              : "Nenhum resultado lido nesta busca"}
          </span>
        )}
      </div>
      {estado === "aguardando" && !lojas.length ? (
        <p className="mt-1 animate-pulse text-xs text-secondary-ink">Conferindo o mesmo produto…</p>
      ) : (
        <>
          {mesmos.length > 0 && (
            <>
              <p className="mt-1.5 text-xs font-semibold">Mesmo produto ({mesmos.length})</p>
              <ul className="mt-1 overflow-hidden rounded-2xl border border-border">
                {mesmos.map((l, i) => (
                  <LinhaOferta
                    key={`${l.marketplace}:${l.id}`}
                    l={l}
                    i={i}
                    colado={colado}
                    precosDoMesmo={precosDoMesmo}
                  />
                ))}
              </ul>
            </>
          )}
          {!mesmos.length && (
            <p className="mt-1 text-xs text-secondary-ink">
              Não achei o mesmo produto
              {resumo?.conferidas === 1
                ? " no único conferido pela foto"
                : resumo?.conferidas
                  ? ` entre os ${resumo.conferidas} conferidos pela foto`
                  : ""}
              .
            </p>
          )}
          {parecidos.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold">
                Parecidos ({parecidos.length}) · não é o mesmo produto
              </p>
              <ul className="mt-1 overflow-hidden rounded-2xl border border-border">
                {parecidos.map((l, i) => (
                  <LinhaOferta
                    key={`${l.marketplace}:${l.id}`}
                    l={l}
                    i={i}
                    colado={colado}
                    precosDoMesmo={precosDoMesmo}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function LinhaFinal({
  jogador,
  oferta,
  i,
  vencedor,
  menorNoProduto,
  estado,
  consultado,
  incompleto,
  colado,
}: {
  jogador: Jogador;
  oferta: OfertaDoJogador | null;
  i: number;
  vencedor: boolean;
  menorNoProduto: boolean;
  estado: Estado;
  consultado: boolean;
  incompleto: boolean;
  colado: ColadoParaComparar;
}) {
  const diferenca = oferta ? diferencaContraColado(oferta, colado) : null;
  const semOferta =
    jogador === "mercadolivre"
      ? "Sem preço lido"
      : estado === "aguardando"
        ? "Conferindo…"
        : incompleto
          ? "Não deu para conferir pela foto agora"
          : consultado
            ? "Não achei o mesmo produto conferido pela foto"
            : "Não consultada nesta comparação";
  return (
    <li
      className={
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 " +
        (vencedor ? "bg-success/10" : i % 2 ? "bg-muted/40" : "bg-card")
      }
    >
      <span className="min-w-[10rem] flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <SeloMarketplace jogador={jogador} />
          {oferta?.prime && <SeloPrime />}
          {oferta?.oficial && (
            <span className="rounded-full bg-[#e8f1fd] px-2 py-0.5 text-[10px] font-bold text-[#0058b0]">
              Loja oficial
            </span>
          )}
          {vencedor && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">
              <span className="animate-fogo inline-block" aria-hidden="true">
                🔥
              </span>
              Mais barato entre os 3
            </span>
          )}
          {menorNoProduto && (
            <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Menor preço no produto
            </span>
          )}
        </span>
        {oferta ? (
          <>
            {oferta.loja && (
              <span className="mt-1 block text-[11px] text-secondary-ink">
                Vendido por {oferta.loja}
              </span>
            )}
            <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <strong className="text-sm tabular-nums">{brl(oferta.preco)}</strong>
              {diferenca && <span className="text-[11px] text-secondary-ink">{diferenca}</span>}
            </span>
            <span className="block text-[11px] text-secondary-ink">{linhaDoFrete(oferta)}</span>
          </>
        ) : (
          <span
            className={
              "mt-1 block text-[11px] text-secondary-ink" +
              (estado === "aguardando" && jogador !== "mercadolivre" ? " animate-pulse" : "")
            }
          >
            {semOferta}
          </span>
        )}
      </span>
      <span className="ml-auto flex justify-end">
        {oferta?.link ? (
          <BotaoComprar link={oferta.link} origem={`comparacao_final_${jogador}`} />
        ) : jogador === "amazon" && estado !== "aguardando" ? (
          <ConferirNaAmazon titulo={colado.titulo} />
        ) : null}
      </span>
    </li>
  );
}

export function ComparacaoMarketplaces({
  pedidoId,
  colado,
  melhorMl,
  precosMl,
}: {
  pedidoId: number | null;
  colado: ColadoParaComparar;
  /* A recomendação do Mercado Livre na tela (mesmo produto). */
  melhorMl: OfertaDoJogador | null;
  /* Preços do mesmo produto no Mercado Livre (aviso de preço muito abaixo). */
  precosMl: number[];
}) {
  const { estado, dados } = useMultiloja(pedidoId);
  if (pedidoId == null) return null;
  const lojas = dados?.lojas ?? [];
  const amazon = melhorDoMarketplace(lojas, "amazon");
  const shopee = melhorDoMarketplace(lojas, "shopee");
  const ml =
    melhorMl && melhorMl.link && !ehLinkDeCompra(melhorMl.link, "mercadolivre")
      ? { ...melhorMl, link: null }
      : melhorMl;
  const decisao = decidirEntreMarketplaces([ml, amazon, shopee]);
  const precosDoMesmo = [
    ...precosMl,
    ...lojas.filter((l) => l.relacao === "mesmo").map((l) => l.preco),
  ];
  const consultado = (mk: "amazon" | "shopee") =>
    Boolean(dados?.resumo?.[mk]) || lojas.some((l) => l.marketplace === mk);
  /* Ordem da tabela: a da decisão, e quem não tem oferta no fim. */
  const ordem: Jogador[] = [
    ...decisao.ofertas.map((o) => o.jogador),
    ...(["mercadolivre", "amazon", "shopee"] as Jogador[]).filter(
      (j) => !decisao.ofertas.some((o) => o.jogador === j),
    ),
  ];
  const doJogador = (j: Jogador) => decisao.ofertas.find((o) => o.jogador === j) ?? null;
  const v = decisao.vencedor;
  const m = decisao.menorNoProduto;
  return (
    <section aria-label="Amazon, Shopee e comparação final" className="mt-2">
      <SecaoDoMarketplace
        mk="amazon"
        estado={estado}
        dados={dados}
        colado={colado}
        precosDoMesmo={precosDoMesmo}
      />
      <SecaoDoMarketplace
        mk="shopee"
        estado={estado}
        dados={dados}
        colado={colado}
        precosDoMesmo={precosDoMesmo}
      />

      <div
        className="mt-5 rounded-3xl border border-border bg-card p-3"
        data-origem="comparacao_final"
      >
        <p className="text-sm font-bold">Comparação final: os 3 marketplaces</p>
        <p className="text-[11px] text-secondary-ink">
          A melhor oferta do mesmo produto em cada um. Só disputa o mais barato quem tem o custo
          confirmado.
        </p>
        {v && (
          <div className="mt-2 rounded-2xl border border-success/30 bg-success/5 p-3 text-xs leading-relaxed">
            <p>
              <strong>Melhor escolha: {NOME_DO_JOGADOR[v.jogador]}</strong>
              {v.loja ? `, vendido por ${v.loja}` : ""} — <strong>{brl(v.preco)}</strong>
              {v.ehColado ? " (o anúncio que você colou)" : ""}.
            </p>
            <p className="text-secondary-ink">{linhaDoFrete(v)}.</p>
          </div>
        )}
        {m && (
          <div className="mt-2 rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <p>
              <strong>Menor preço no produto: {NOME_DO_JOGADOR[m.jogador]}</strong>
              {v ? `, ${brl(v.preco - m.preco)} a menos no produto` : ""}.
            </p>
            <p>{linhaDoFrete(m)}.</p>
            <p>
              {m.prime
                ? "Sem custo de entrega só para assinantes Prime: confira antes de comprar."
                : "O frete não foi confirmado: confira antes de comprar."}
            </p>
          </div>
        )}
        <ul className="mt-2 overflow-hidden rounded-2xl border border-border">
          {ordem.map((j, i) => (
            <LinhaFinal
              key={j}
              jogador={j}
              oferta={doJogador(j)}
              i={i}
              vencedor={decisao.ofertas.length >= 2 && v?.jogador === j}
              menorNoProduto={m?.jogador === j}
              estado={estado}
              consultado={j === "mercadolivre" ? true : consultado(j)}
              incompleto={j !== "mercadolivre" && dados?.incompleto === true}
              colado={colado}
            />
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-secondary-ink">
          Preços de quando comparei. Links de afiliado dos programas do Mercado Livre, da Amazon e
          da Shopee. Frete grátis do Prime vale só para assinantes.
        </p>
      </div>
    </section>
  );
}
