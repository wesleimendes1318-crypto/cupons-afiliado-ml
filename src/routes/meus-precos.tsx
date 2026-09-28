/* MEUS PREÇOS (Weslei, 28/09, modelo de teste): os produtos que esta pessoa
   acompanha, com o preço de agora, quanto caiu ou subiu desde que começou a
   acompanhar, o menor preço visto e o histórico. Cada botão de compra leva o
   link de afiliado. Atualiza sozinha a cada minuto. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, LoaderCircle, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { supabase } from "@/integrations/supabase/client";
import { idDoNavegador } from "@/lib/navegador";

export const Route = createFileRoute("/meus-precos")({
  component: MeusPrecos,
  head: () => ({
    meta: [
      { title: "Meus preços — Melhor Escolha" },
      {
        name: "description",
        content: "Os produtos que você acompanha: preço de agora, quanto caiu e o histórico.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Ponto = { p: number; em: string };
type Item = {
  id: number;
  titulo: string | null;
  imagem: string | null;
  loja: string | null;
  link: string | null;
  url: string;
  preco_atual: number | null;
  preco_pix: number | null;
  preco_cheio: number | null;
  parcelas: { vezes: number; valor: number | null; total: number | null; semJuros: boolean } | null;
  preco_ao_seguir: number | null;
  preco_alvo: number | null;
  menor_preco: number | null;
  menor_em: string | null;
  disponivel: boolean | null;
  ultima_leitura: string | null;
  proxima_leitura: string | null;
  historico: Ponto[];
};

const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function haQuanto(iso: string | null) {
  if (!iso) return null;
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}
function daquiA(iso: string | null) {
  if (!iso) return null;
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 5) return "em instantes";
  if (min < 60) return `em ${min} min`;
  return `em ${Math.round(min / 60)} h`;
}

/* Linha do histórico: uma série, 2 px, ponto de agora marcado; cada ponto
   mostra preço e data ao passar o mouse. */
function Historico({ pontos }: { pontos: Ponto[] }) {
  const lista = pontos.filter((x) => x.p > 0);
  if (lista.length < 2)
    return (
      <p className="text-[11px] text-secondary-ink">
        O histórico aparece a partir da 2ª conferência.
      </p>
    );
  const L = 280,
    A = 56,
    m = 6;
  const t0 = new Date(lista[0]!.em).getTime();
  const t1 = new Date(lista[lista.length - 1]!.em).getTime();
  const pMin = Math.min(...lista.map((x) => x.p));
  const pMax = Math.max(...lista.map((x) => x.p));
  const x = (em: string) =>
    m + ((new Date(em).getTime() - t0) / Math.max(1, t1 - t0)) * (L - 2 * m);
  const y = (p: number) => m + (1 - (p - pMin) / Math.max(0.01, pMax - pMin)) * (A - 2 * m);
  const d = lista.map((q) => `${x(q.em).toFixed(1)},${y(q.p).toFixed(1)}`).join(" ");
  const ult = lista[lista.length - 1]!;
  return (
    <figure className="mt-2">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="h-14 w-full"
        role="img"
        aria-label={`Histórico de preço: de ${brl(lista[0]!.p)} a ${brl(ult.p)}, menor ${brl(pMin)}`}
      >
        <line
          x1={m}
          x2={L - m}
          y1={y(pMin)}
          y2={y(pMin)}
          className="stroke-border"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        <polyline
          points={d}
          fill="none"
          className="stroke-ml-blue"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(ult.em)}
          cy={y(ult.p)}
          r={4}
          className="fill-ml-blue stroke-card"
          strokeWidth={2}
        />
        {lista.map((q, i) => (
          <circle key={i} cx={x(q.em)} cy={y(q.p)} r={8} fill="transparent">
            <title>{`${brl(q.p)} · ${new Date(q.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="flex justify-between text-[10px] text-secondary-ink">
        <span>
          {new Date(lista[0]!.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </span>
        <span>
          menor: {brl(pMin)} · maior: {brl(pMax)}
        </span>
        <span>agora</span>
      </figcaption>
    </figure>
  );
}

function Cartao({ i, parar }: { i: Item; parar: (id: number) => void }) {
  const base = i.preco_ao_seguir;
  const dif =
    base != null && i.preco_atual != null ? Math.round((i.preco_atual - base) * 100) / 100 : null;
  const noAlvo = i.preco_alvo != null && i.preco_atual != null && i.preco_atual <= i.preco_alvo;
  const pagamento =
    i.preco_pix != null && i.preco_atual != null && Math.abs(i.preco_pix - i.preco_atual) < 0.5
      ? `no Pix${i.parcelas ? ` · ou ${brl(i.parcelas.total ?? i.preco_cheio)} em ${i.parcelas.vezes}x${i.parcelas.semJuros ? " sem juros" : ""}` : ""}`
      : null;
  return (
    <article
      className={
        "rounded-xl border bg-card p-3 " +
        (noAlvo ? "border-success ring-2 ring-success/30" : "border-border")
      }
    >
      <div className="flex gap-3">
        {i.imagem ? (
          <img
            src={i.imagem}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-16 shrink-0 rounded-md border border-border bg-white object-contain p-1"
          />
        ) : (
          <div className="size-16 shrink-0 rounded-md border border-border bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {i.titulo ?? "Produto acompanhado"}
          </p>
          {i.loja && (
            <p className="text-[11px] text-secondary-ink">
              Vendido por <strong className="text-foreground">{i.loja}</strong>
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-foreground">
            <span className="text-lg font-extrabold tabular-nums">{brl(i.preco_atual)}</span>
            {pagamento && <span className="text-[11px] text-secondary-ink">{pagamento}</span>}
          </p>
          {dif != null && Math.abs(dif) >= 0.5 ? (
            <p
              className={
                "flex items-start gap-1 text-xs font-bold " +
                (dif < 0 ? "text-success" : "text-red-700 dark:text-red-400")
              }
            >
              {dif < 0 ? (
                <TrendingDown className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <TrendingUp className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              )}
              {dif < 0 ? `Caiu ${brl(-dif)}` : `Subiu ${brl(dif)}`} desde que você começou a
              acompanhar ({brl(base)})
            </p>
          ) : (
            <p className="text-xs text-secondary-ink">
              Mesmo preço de quando você começou a acompanhar.
            </p>
          )}
          {noAlvo && (
            <p className="mt-1 inline-flex items-center gap-1 rounded bg-success px-2 py-0.5 text-xs font-bold text-white">
              <BellRing className="size-3.5" aria-hidden="true" /> Chegou no seu preço (
              {brl(i.preco_alvo)})
            </p>
          )}
          {!noAlvo && i.preco_alvo != null && (
            <p className="text-[11px] text-secondary-ink">Seu preço: {brl(i.preco_alvo)}</p>
          )}
          {i.disponivel === false && (
            <p className="text-xs font-semibold text-amber-700">
              O anúncio parece indisponível agora.
            </p>
          )}
        </div>
      </div>
      <Historico pontos={i.historico ?? []} />
      <p className="mt-1 text-[10px] text-secondary-ink">
        Conferido {haQuanto(i.ultima_leitura) ?? "—"}
        {i.proxima_leitura ? ` · próxima conferência ${daquiA(i.proxima_leitura)}` : ""}
        {i.menor_preco != null ? ` · menor preço visto: ${brl(i.menor_preco)}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {i.link && (
          <a
            href={i.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-success px-3 py-2 text-sm font-bold text-white hover:brightness-95"
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            Comprar com segurança
          </a>
        )}
        <button
          type="button"
          onClick={() => parar(i.id)}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-secondary-ink hover:border-red-400 hover:text-red-700"
        >
          Parar de acompanhar
        </button>
      </div>
    </article>
  );
}

function MeusPrecos() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    const navegador = idDoNavegador();
    if (!navegador) {
      setItens([]);
      return;
    }
    const { data, error } = await supabase.rpc(
      "meus_precos" as never,
      { p_navegador: navegador } as never,
    );
    if (error) {
      setErro(true);
      return;
    }
    setErro(false);
    setItens((data as unknown as Item[]) ?? []);
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 60000);
    return () => clearInterval(t);
  }, [carregar]);

  async function parar(id: number) {
    const navegador = idDoNavegador();
    if (!navegador) return;
    setItens((l) => (l ?? []).filter((x) => x.id !== id));
    await supabase.rpc(
      "parar_de_acompanhar" as never,
      { p_monitor: id, p_navegador: navegador } as never,
    );
  }

  return (
    <LayoutConteudo
      etiqueta="Teste"
      titulo="Meus preços"
      resumo="Os produtos que você acompanha. Eu confiro o preço de tempos em tempos e mostro aqui quando cai. Esta página atualiza sozinha."
    >
      {itens == null ? (
        <p className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Carregando…
        </p>
      ) : itens.length === 0 ? (
        <div className="text-center">
          <p className="font-semibold text-foreground">Você ainda não acompanha nenhum produto.</p>
          <p className="mt-1">Compare um produto e toque em "Acompanhar preço" no resultado.</p>
          <Link
            to="/"
            className="mt-3 inline-block rounded-md bg-ml-blue px-4 py-2 text-sm font-bold text-white hover:brightness-95"
          >
            Comparar um produto
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {itens.map((i) => (
            <Cartao key={i.id} i={i} parar={parar} />
          ))}
        </div>
      )}
      {erro && (
        <p className="text-xs text-red-700">
          Não deu para atualizar agora; tento de novo em 1 minuto.
        </p>
      )}
      <p className="text-[11px]">
        Os preços são conferidos no anúncio de tempos em tempos (de 3 a 12 horas, conforme o preço
        mexe); o preço na hora da compra pode ser outro. Os acompanhamentos ficam guardados neste
        navegador, sem cadastro. Comprando pelos botões daqui o preço é o mesmo, e eu recebo uma
        comissão do programa de afiliados.
      </p>
    </LayoutConteudo>
  );
}
