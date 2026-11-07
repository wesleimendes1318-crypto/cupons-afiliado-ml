/* MEUS PREÇOS (Weslei, 28/09, modelo de teste): os produtos que esta pessoa
   acompanha, com o preço de agora, quanto caiu ou subiu desde que começou a
   acompanhar, o menor preço visto e o histórico. Cada botão de compra leva o
   link de afiliado. Atualiza sozinha a cada minuto. */
import { CompararPreco } from "@/components/BotoesCartao";
import { AvisoTelegram } from "@/components/AvisoTelegram";
import { Link } from "@tanstack/react-router";
import { BellRing, LoaderCircle, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ConviteTelegram } from "@/components/ConviteTelegram";
import { supabase } from "@/integrations/supabase/client";
import { idDoNavegador } from "@/lib/navegador";
import { abrirLogin, useConta } from "@/lib/auth-otp";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { AnimacaoAcompanhar } from "@/components/AnimacaoAcompanhar";
import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";
import { GraficoHistoricoPreco } from "@/components/GraficoHistoricoPreco";
import { atalhosDoAlvo, lerReais, vereditoDoPreco } from "@/lib/veredito-preco";


/* Conta por e-mail (04/11): convite para levar os preços a outros aparelhos. */
function AvisoConta() {
  const usuario = useConta();
  if (usuario)
    return (
      <p className="mb-6 rounded-2xl bg-card px-4 py-3 text-sm text-secondary-ink">
        Salvo na sua conta: <strong className="text-foreground">{usuario.email}</strong>
      </p>
    );
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-secondary-ink">
        <strong className="text-foreground">Veja seus preços em qualquer aparelho.</strong> Entre
        com seu e-mail, sem senha.
      </p>
      <button
        type="button"
        onClick={abrirLogin}
        className="shrink-0 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white"
      >
        Entrar com e-mail
      </button>
    </div>
  );
}

export type Ponto = { p: number; em: string };
export type Item = {
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
  avisar_email?: boolean | null;
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

function Cartao({
  i,
  parar,
  logado,
  mudarAlvo,
}: {
  i: Item;
  parar: (id: number) => void;
  logado: boolean;
  mudarAlvo: (id: number, alvo: number | null) => void;
}) {
  const base = i.preco_ao_seguir;
  const dif =
    base != null && i.preco_atual != null ? Math.round((i.preco_atual - base) * 100) / 100 : null;
  const noAlvo = i.preco_alvo != null && i.preco_atual != null && i.preco_atual <= i.preco_alvo;
  const veredito = vereditoDoPreco(i.historico ?? [], i.preco_atual);
  const pagamento =
    i.preco_pix != null && i.preco_atual != null && Math.abs(i.preco_pix - i.preco_atual) < 0.5
      ? `no Pix${i.parcelas ? ` · ou ${brl(i.parcelas.total ?? i.preco_cheio)} em ${i.parcelas.vezes}x${i.parcelas.semJuros ? " sem juros" : ""}` : ""}`
      : null;
  return (
    <article
      className={
        "rounded-3xl border bg-card p-4 " +
        (noAlvo ? "border-success ring-2 ring-success/30" : "border-border")
      }
    >
      <div className="flex gap-3">
        {i.imagem ? (
          <VerDetalhesVitrine
            chave={i.url}
            titulo={i.titulo ?? "Produto acompanhado"}
            imagem={i.imagem}
            preco={i.preco_atual}
            link={i.link}
            urlProduto={i.url}
            className="shrink-0"
            gatilho={
              <img
                src={i.imagem}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="size-16 shrink-0 rounded-md border border-border bg-white object-contain p-1"
              />
            }
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
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-xs font-bold text-white">
              🎉 Chegou no seu preço desejado! ({brl(i.preco_alvo)})
            </p>
          )}
          {i.disponivel === false && (
            <p className="text-xs font-semibold text-amber-700">
              O anúncio parece indisponível agora.
            </p>
          )}
        </div>
      </div>
      {veredito && (
        <p
          className={
            "mt-3 rounded-2xl px-3 py-2 text-xs leading-snug " +
            (veredito.tipo === "menor"
              ? "bg-success/10 font-semibold text-[#248a3d] dark:text-success"
              : veredito.tipo === "media"
                ? "bg-[#f5f5f7] text-foreground dark:bg-white/10"
                : "bg-amber-500/10 text-amber-800 dark:text-amber-300")
          }
        >
          <span className="font-bold">Vale a pena comprar agora? </span>
          {veredito.texto}
        </p>
      )}
      <GraficoHistoricoPreco pontos={i.historico ?? []} alvo={i.preco_alvo} />
      <p className="mt-1 text-[10px] text-secondary-ink">
        Conferido {haQuanto(i.ultima_leitura) ?? "—"}
        {i.proxima_leitura ? ` · próxima conferência ${daquiA(i.proxima_leitura)}` : ""}
        {i.menor_preco != null ? ` · menor preço visto: ${brl(i.menor_preco)}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ehLinkDeAfiliado(i.link) && (
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
        {/* Comparar sempre ao lado do comprar (Weslei, 02/11). */}
        <div className="flex-1">
          <CompararPreco url={i.url} />
        </div>
        <AvisoTelegram monitorId={i.id} />
        <button
          type="button"
          onClick={() => parar(i.id)}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-secondary-ink hover:border-red-400 hover:text-red-700"
        >
          Parar de acompanhar
        </button>
      </div>
      <PrecoAlvo i={i} mudarAlvo={mudarAlvo} />
      {logado && <AvisoEmail i={i} />}
    </article>
  );
}

/* Preço-alvo (04/11): atalhos de um toque sobre o preço de agora ou valor
   livre. O aviso sai pelos canais ligados (site, Telegram, e-mail). */
function PrecoAlvo({
  i,
  mudarAlvo,
}: {
  i: Item;
  mudarAlvo: (id: number, alvo: number | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"parado" | "salvando" | "erro">("parado");
  async function salvar(valor: number | null) {
    const navegador = idDoNavegador();
    if (!navegador) return;
    setEstado("salvando");
    const { data, error } = await supabase.rpc(
      "definir_preco_alvo" as never,
      { p_monitor: i.id, p_navegador: navegador, p_alvo: valor } as never,
    );
    let ok = !error && data === true;
    /* Banco ainda sem a função nova: o acompanhar por link grava o alvo (não tira). */
    if (error && valor != null)
      ok = !(
        await supabase.rpc(
          "acompanhar_por_link" as never,
          { p_url: i.url, p_navegador: navegador, p_alvo: valor } as never,
        )
      ).error;
    if (!ok) {
      setEstado("erro");
      return;
    }
    mudarAlvo(i.id, valor);
    setEstado("parado");
    setAberto(false);
    setTexto("");
  }
  if (!aberto)
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-secondary-ink">
          {i.preco_alvo != null ? (
            <>
              Seu preço-alvo: <strong className="text-[#248a3d]">{brl(i.preco_alvo)}</strong>
            </>
          ) : (
            "Avise-me quando chegar no meu preço."
          )}
        </span>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[#0071e3]/40 px-3 font-semibold text-[#0058b0] hover:bg-[#0071e3]/5"
        >
          <BellRing className="size-3.5" aria-hidden="true" />
          {i.preco_alvo != null ? "Mudar" : "Definir meu preço"}
        </button>
      </div>
    );
  const valor = lerReais(texto);
  return (
    <form
      className="mt-2 rounded-2xl bg-[#f5f5f7] p-2.5 dark:bg-white/10"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor != null) void salvar(valor);
      }}
    >
      <p className="text-xs font-semibold text-foreground">Me avise quando chegar a</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {atalhosDoAlvo(i.preco_atual).map((a) => (
          <button
            key={a.rotulo}
            type="button"
            onClick={() => setTexto(String(a.valor))}
            aria-label={`${a.rotulo}: ${brl(a.valor)}`}
            className={
              "min-h-8 rounded-full px-3 text-xs font-semibold tabular-nums " +
              (valor === a.valor
                ? "bg-[#0071e3] text-white"
                : "bg-white text-[#0058b0] dark:bg-black/30")
            }
          >
            {a.rotulo} · {brl(a.valor)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Preço desejado em reais</span>
          <input
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="R$ valor desejado"
            className="min-h-9 w-full rounded-full border border-border bg-background px-3 text-base sm:text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={valor == null || estado === "salvando"}
          className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[#0071e3] px-4 text-xs font-semibold text-white disabled:opacity-60"
        >
          {estado === "salvando" && (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          )}
          Salvar
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
        {i.preco_alvo != null && (
          <button
            type="button"
            onClick={() => void salvar(null)}
            className="text-secondary-ink underline"
          >
            Tirar preço-alvo
          </button>
        )}
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-secondary-ink underline"
        >
          Cancelar
        </button>
        {estado === "erro" && <span className="text-red-700">Não salvou, tente de novo.</span>}
      </div>
    </form>
  );
}

/* Aviso de queda por e-mail (04/11): só com a conta; o e-mail sai pelo
   gatilho do banco + operacao?tarefa=alertas (src/lib/alertas-email.ts). */
function AvisoEmail({ i }: { i: Item }) {
  const [ligado, setLigado] = useState(Boolean(i.avisar_email));
  const [erro, setErro] = useState(false);
  return (
    <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
      <input
        type="checkbox"
        checked={ligado}
        onChange={async (e) => {
          const v = e.target.checked;
          setLigado(v);
          setErro(false);
          const { data, error } = await supabase.rpc(
            "definir_aviso_email" as never,
            { p_monitor: i.id, p_ligado: v } as never,
          );
          if (error || data !== true) {
            setLigado(!v);
            setErro(true);
          }
        }}
        className="size-4 accent-[#0071e3]"
      />
      Avisar também por e-mail quando o preço cair
      {erro && <span className="text-red-700">(não salvou, tente de novo)</span>}
    </label>
  );
}

/** Tracked prices of this device/account. /painel loads once and shares the
    list between the summary and this tab (ativo=false skips the load). */
export function useMeusPrecos(ativo = true) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    const navegador = idDoNavegador();
    if (!navegador) {
      setItens([]);
      return;
    }
    /* v2 traz avisar_email; sem ela no banco, a de sempre. */
    let { data, error } = await supabase.rpc(
      "meus_precos_v2" as never,
      { p_navegador: navegador } as never,
    );
    if (error)
      ({ data, error } = await supabase.rpc(
        "meus_precos" as never,
        { p_navegador: navegador } as never,
      ));
    if (error) {
      setErro(true);
      return;
    }
    setErro(false);
    setItens((data as unknown as Item[]) ?? []);
  }, []);

  useEffect(() => {
    if (!ativo) return;
    void carregar();
    const t = setInterval(() => void carregar(), 60000);
    const aoVincular = () => void carregar();
    window.addEventListener("conta-vinculada", aoVincular);
    return () => {
      clearInterval(t);
      window.removeEventListener("conta-vinculada", aoVincular);
    };
  }, [ativo, carregar]);

  return { itens, setItens, erro };
}
export type DadosMeusPrecos = ReturnType<typeof useMeusPrecos>;

export function PainelAlertasPreco({ dados }: { dados?: DadosMeusPrecos } = {}) {
  const proprio = useMeusPrecos(!dados);
  const { itens, setItens, erro } = dados ?? proprio;
  const usuario = useConta();

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
    <>
      <AnimacaoAcompanhar compacto className="mb-6" />
      {!dados && <AvisoConta />}
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
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.97] motion-reduce:transition-none"
          >
            Comparar um produto
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {itens.map((i) => (
            <Cartao
              key={i.id}
              i={i}
              parar={parar}
              logado={!!usuario}
              mudarAlvo={(id, alvo) =>
                setItens((l) =>
                  (l ?? []).map((x) => (x.id === id ? { ...x, preco_alvo: alvo } : x)),
                )
              }
            />
          ))}
        </div>
      )}
      {/* Sem produtos ou no fim da lista: os achados do canal também servem. */}
      {itens != null && <ConviteTelegram formato="cartao" origem="meus_precos" />}
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
    </>
  );
}
