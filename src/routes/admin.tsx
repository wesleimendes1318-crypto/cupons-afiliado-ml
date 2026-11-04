/* PAINEL DO FUNDADOR (Weslei, 04/11). Fora de menus, rodapé e sitemap.
   A página não guarda nada de sigiloso: os números só saem de
   painel_fundador(), que confere no banco se é a conta mestre confirmada.
   Quem não é volta para a raiz com um aviso neutro. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  Download,
  LoaderCircle,
  MousePointerClick,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LoginEmailOtp } from "@/components/LoginEmailOtp";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { abrirLogin } from "@/lib/auth-otp";
import { perguntarAoCopiloto, type MensagemCopiloto } from "@/lib/copiloto-admin";
import {
  baixarDossie,
  buscasDoDia,
  carregarPainel,
  cliquesDoDia,
  reais,
  resumo,
  type ComandoSinc,
  type Painel,
} from "@/lib/painel-fundador";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: Admin,
  head: () => ({
    meta: [{ title: "Melhor Escolha" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

const AZUL = "#0071e3";
const VERDE = "#34c759";
const CORES = { ml: AZUL, amazon: "#ff9500", shopee: "#ee4d2d" };
const AGUARDANDO = "Aguardando sincronização";

const inteiro = (n: number) => n.toLocaleString("pt-BR");
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1).replace(".", ",")}%`);
const quando = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const ha = (iso: string | null | undefined) => {
  if (!iso) return null;
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s)) return null;
  if (s < 90) return `${s} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
};

function Admin() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<"conferindo" | "entrar" | "negado" | "pronto">("conferindo");
  const [dias, setDias] = useState(30);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async (n: number) => {
    setCarregando(true);
    const p = await carregarPainel(n);
    setCarregando(false);
    if (!p) return setEstado("negado");
    setPainel(p);
    setEstado("pronto");
  }, []);

  useEffect(() => {
    const conferir = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setEstado("entrar");
        abrirLogin();
        return;
      }
      void carregar(dias);
    };
    void conferir();
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_IN") void conferir();
      if (evento === "SIGNED_OUT") setEstado("entrar");
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (estado !== "negado") return;
    const t = setTimeout(() => void navigate({ to: "/" }), 1600);
    return () => clearTimeout(t);
  }, [estado, navigate]);

  if (estado === "conferindo" || (estado === "pronto" && !painel))
    return (
      <Tela>
        <LoaderCircle
          className="mx-auto mt-32 size-6 animate-spin text-[#0071e3]"
          aria-label="Carregando"
        />
      </Tela>
    );

  if (estado === "entrar")
    return (
      <Tela>
        <div className="mx-auto mt-32 max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm animate-cartao">
          <p className="text-sm text-[#6e6e73]">Entre com sua conta para continuar.</p>
          <button
            type="button"
            onClick={abrirLogin}
            className="mt-4 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Entrar
          </button>
        </div>
        <LoginEmailOtp />
      </Tela>
    );

  if (estado === "negado")
    return (
      <Tela>
        <p
          role="status"
          className="mx-auto mt-32 max-w-sm rounded-3xl bg-white p-6 text-center text-sm text-[#6e6e73] shadow-sm animate-cartao"
        >
          Esta página não está disponível. Voltando para o início…
        </p>
      </Tela>
    );

  const p = painel!;
  const r = resumo(p);
  const serie = p.serie.map((d) => ({
    dia: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7),
    buscas: buscasDoDia(d),
    cliques: cliquesDoDia(d),
  }));
  const pizza = [
    { nome: "Mercado Livre", valor: r.cliques.ml, cor: CORES.ml },
    { nome: "Amazon", valor: r.cliques.amazon, cor: CORES.amazon },
    { nome: "Shopee", valor: r.cliques.shopee, cor: CORES.shopee },
  ];
  const funil = [
    { etapa: "Visitou", valor: r.visitas },
    { etapa: "Buscou", valor: r.buscas },
    { etapa: "Comparou lojas", valor: r.comparacoes },
    { etapa: "Clicou no link seguro", valor: r.totalCliques },
  ];
  const topoFunil = Math.max(1, ...funil.map((f) => f.valor));
  const maxCat = Math.max(1, ...p.categorias.map((c) => c.buscas));
  const vistoHa = ha(p.saude.extensao_visto_em);
  const extensaoViva =
    vistoHa != null && Date.now() - new Date(p.saude.extensao_visto_em!).getTime() < 10 * 60_000;

  return (
    <Tela>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <header className="flex flex-col gap-4 animate-conteudo sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">
              Painel do fundador
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
              Visão geral
            </h1>
            <p className="mt-1 text-sm text-[#6e6e73]">
              {p.de.split("-").reverse().join("/")} a {p.ate.split("-").reverse().join("/")} ·
              atualizado {quando(p.gerado_em)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex rounded-full bg-white p-1 shadow-sm"
              role="group"
              aria-label="Período"
            >
              {[7, 30, 90].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={dias === n}
                  onClick={() => {
                    setDias(n);
                    void carregar(n);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${dias === n ? "bg-[#1d1d1f] text-white" : "text-[#6e6e73] hover:text-[#1d1d1f]"}`}
                >
                  {n} dias
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void carregar(dias)}
              className="grid size-9 place-items-center rounded-full bg-white text-[#1d1d1f] shadow-sm transition active:scale-95"
              aria-label="Atualizar"
            >
              <RefreshCw className={`size-4 ${carregando ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => baixarDossie(p)}
              className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0077ed] active:scale-[0.98]"
            >
              <Download className="size-4" /> Baixar Dossiê Estratégico (.md)
            </button>
            <CopilotoAdmin />
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi atraso={0} icone={<Wallet className="size-4" />} titulo="Comissão estimada do mês">
            {r.comissaoMes == null ? (
              <p className="text-lg font-semibold text-[#6e6e73]">{AGUARDANDO}</p>
            ) : (
              <>
                <p className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
                  {reais(r.comissaoMes)}
                </p>
                <p
                  className={`mt-1 text-xs font-semibold ${r.variacaoSemana == null ? "text-[#6e6e73]" : r.variacaoSemana >= 0 ? "text-[#34c759]" : "text-[#ff3b30]"}`}
                >
                  {r.variacaoSemana == null
                    ? "Sem semana anterior para comparar"
                    : `${r.variacaoSemana >= 0 ? "+" : ""}${pct(r.variacaoSemana)} vs semana anterior`}
                </p>
              </>
            )}
            <p className="mt-1 text-[11px] text-[#86868b]">
              Última leitura dos portais: {quando(r.ultimaLeitura)}
            </p>
          </Kpi>
          <Kpi
            atraso={60}
            icone={<MousePointerClick className="size-4" />}
            titulo="Cliques em links de afiliado"
          >
            <p className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
              {inteiro(r.totalCliques)}
            </p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              ML {inteiro(r.cliques.ml)} · Amazon {inteiro(r.cliques.amazon)} · Shopee{" "}
              {inteiro(r.cliques.shopee)}
            </p>
          </Kpi>
          <Kpi atraso={120} icone={<Target className="size-4" />} titulo="Taxa de decisão">
            <p className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
              {pct(r.taxaDecisao)}
            </p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              {inteiro(r.totalCliques)} cliques em {inteiro(r.buscas)} buscas
            </p>
          </Kpi>
          <Kpi atraso={180} icone={<Bell className="size-4" />} titulo="Meus preços">
            <p className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
              {inteiro(p.monitorados)}
            </p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              produtos monitorados · {inteiro(r.alertasDisparados)} alertas disparados
            </p>
          </Kpi>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Cartao
            titulo="Evolução diária"
            sub="Buscas x cliques em links de afiliado"
            className="lg:col-span-2"
            atraso={220}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gBuscas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AZUL} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCliques" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={VERDE} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={VERDE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e5e5ea" />
                  <XAxis
                    dataKey="dia"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#86868b" }}
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#86868b" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: "none",
                      boxShadow: "0 8px 30px rgba(0,0,0,.12)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="buscas"
                    name="Buscas"
                    stroke={AZUL}
                    strokeWidth={2.5}
                    fill="url(#gBuscas)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cliques"
                    name="Cliques"
                    stroke={VERDE}
                    strokeWidth={2.5}
                    fill="url(#gCliques)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Cartao>

          <Cartao titulo="Marketplaces" sub="Cliques em links de afiliado" atraso={280}>
            {r.totalCliques === 0 ? (
              <Vazio>Nenhum clique medido no período.</Vazio>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pizza}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {pizza.map((f) => (
                        <Cell key={f.nome} fill={f.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: "none",
                        boxShadow: "0 8px 30px rgba(0,0,0,.12)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="mt-2 space-y-1.5 text-sm">
              {pizza.map((f) => (
                <li key={f.nome} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#1d1d1f]">
                    <span className="size-2.5 rounded-full" style={{ background: f.cor }} />{" "}
                    {f.nome}
                  </span>
                  <span className="font-semibold tabular-nums">{inteiro(f.valor)}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Cartao
            titulo="Funil do comparador"
            sub="Visitou → buscou → comparou → clicou"
            atraso={320}
          >
            <ul className="space-y-3">
              {funil.map((f, i) => (
                <li key={f.etapa}>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#1d1d1f]">{f.etapa}</span>
                    <span className="font-semibold tabular-nums">
                      {inteiro(f.valor)}
                      {i > 0 && funil[i - 1]!.valor > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-[#86868b]">
                          {pct((f.valor / funil[i - 1]!.valor) * 100)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[#f5f5f7]">
                    <div
                      className="h-2 rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${Math.max(2, (f.valor / topoFunil) * 100)}%`,
                        background: i === 3 ? VERDE : AZUL,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-snug text-[#86868b]">
              Visitas, buscas por texto e cliques contam só quem aceitou a medição de análise;
              buscas por link contam todas.
            </p>
          </Cartao>

          <Cartao titulo="Categorias mais buscadas" sub="Produtos colados no período" atraso={360}>
            {!p.categorias.length ? (
              <Vazio>Sem buscas no período.</Vazio>
            ) : (
              <ul className="space-y-2.5">
                {p.categorias.map((c) => (
                  <li key={c.nome}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-[#1d1d1f]">{c.nome}</span>
                      <span className="font-semibold tabular-nums">{inteiro(c.buscas)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#f5f5f7]">
                      <div
                        className="h-1.5 rounded-full bg-[#0071e3]"
                        style={{ width: `${(c.buscas / maxCat) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao
            titulo="Termos com mais intenção"
            sub="Buscados nos anúncios pelo nome"
            atraso={400}
          >
            {!p.termos.length ? (
              <Vazio>Sem termos no período.</Vazio>
            ) : (
              <div className="flex flex-wrap gap-2">
                {p.termos.map((t) => (
                  <span
                    key={t.termo}
                    className="rounded-full bg-[#f5f5f7] px-3 py-1.5 text-xs text-[#1d1d1f]"
                  >
                    {t.termo} <b className="tabular-nums">{t.vezes}</b>
                  </span>
                ))}
              </div>
            )}
          </Cartao>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Cartao
            titulo="Espelho de afiliado"
            sub="Lido dos seus painéis de afiliado"
            className="lg:col-span-2"
            atraso={440}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["mercadolivre", "amazon", "shopee"] as const).map((m) => {
                const vs = p.vendas.filter((v) => v.marketplace === m);
                const com = vs.some((v) => v.comissao_centavos != null)
                  ? vs.reduce((t, v) => t + (v.comissao_centavos ?? 0), 0)
                  : null;
                const ped = vs.some((v) => v.pedidos != null)
                  ? vs.reduce((t, v) => t + (v.pedidos ?? 0), 0)
                  : null;
                return (
                  <div key={m} className="rounded-2xl bg-[#f5f5f7] p-4">
                    <p className="text-xs font-semibold text-[#6e6e73]">
                      {m === "mercadolivre"
                        ? "Mercado Livre"
                        : m === "amazon"
                          ? "Amazon"
                          : "Shopee"}
                    </p>
                    {com == null && ped == null ? (
                      <p className="mt-2 text-sm font-semibold text-[#6e6e73]">{AGUARDANDO}</p>
                    ) : (
                      <>
                        <p className="mt-1 text-xl font-bold text-[#1d1d1f]">
                          {com == null ? "—" : reais(com)}
                        </p>
                        <p className="text-xs text-[#6e6e73]">
                          {ped == null ? "—" : `${inteiro(ped)} pedidos`}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <SincronizarVendas ultimo={p.comando} aoTerminar={() => void carregar(dias)} />
          </Cartao>

          <Cartao titulo="Saúde dos agentes" sub="Extensão, IAs e robôs" atraso={480}>
            <ul className="space-y-3 text-sm">
              <Linha
                ok={extensaoViva && p.saude.extensao_pausada !== "true"}
                rotulo="Extensão"
                valor={
                  p.saude.extensao_versao
                    ? `v${p.saude.extensao_versao}${vistoHa ? ` · ping há ${vistoHa}` : ""}${p.saude.extensao_pausada === "true" ? " · pausada" : ""}`
                    : "sem sinal"
                }
              />
              <Linha
                ok={!p.saude.ia_esgotadas.length}
                rotulo="Cotas das IAs"
                valor={
                  p.saude.ia_esgotadas.length
                    ? p.saude.ia_esgotadas
                        .map((c) => `${c.modelo} esgotada até ${quando(c.ate)}`)
                        .join(" · ")
                    : "todas disponíveis"
                }
              />
              <Linha
                ok={!!p.saude.cron.length && p.saude.operacao_pausada !== "true"}
                rotulo="Último cron"
                valor={
                  p.saude.cron[0]
                    ? `${p.saude.cron[0].tarefa} · ${quando(p.saude.cron[0].fim)}${p.saude.operacao_pausada === "true" ? " · operação pausada" : ""}`
                    : "nenhum nos últimos 3 dias"
                }
              />
              <Linha
                ok={p.saude.ofertas_24h > 0}
                rotulo="Ofertas atualizadas (24 h)"
                valor={inteiro(p.saude.ofertas_24h)}
              />
            </ul>
          </Cartao>
        </section>
      </div>
    </Tela>
  );
}

const SUGESTOES = [
  "Teve alguma anomalia de buscas ou cliques nesta semana?",
  "Quais produtos entram na próxima rodada do canal do Telegram?",
  "Escreva 3 posts para o Telegram com os produtos em alta.",
  "Que estratégia usar para a Black Friday e o Natal com estes dados?",
];

/* Copiloto: conversa só nesta aba (nada guardado); o servidor confere a conta mestre. */
const NOME_PORTAL = { mercadolivre: "Mercado Livre", amazon: "Amazon", shopee: "Shopee" } as const;
const TEXTO_LEITURA: Record<string, string> = {
  lido: "Lido",
  sem_numeros: "Abri o painel, mas não achei os números",
  sem_login: "Entre no portal pelo Chrome do notebook",
  verificacao: "O portal pediu verificação",
  pagina_inesperada: "O portal abriu outra página",
  erro: "Falhou ao ler",
};

/* "Sincronizar vendas agora": grava o pedido (RLS: só a conta mestre), avisa
   a extensão pela ponte e acompanha a etapa até ela terminar. */
function SincronizarVendas({
  ultimo,
  aoTerminar,
}: {
  ultimo: ComandoSinc | null;
  aoTerminar: () => void;
}) {
  const [cmd, setCmd] = useState<ComandoSinc | null>(ultimo);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setCmd(ultimo), [ultimo]);
  const ativo = cmd?.status === "pendente" || cmd?.status === "executando";

  useEffect(() => {
    if (!ativo || !cmd) return;
    const inicio = Date.now();
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("admin_comandos_sinc" as never)
        .select("*")
        .eq("id", cmd.id)
        .maybeSingle();
      const novo = data as ComandoSinc | null;
      if (novo) setCmd(novo);
      if (novo && (novo.status === "concluido" || novo.status === "erro")) {
        clearInterval(t);
        aoTerminar();
      } else if (Date.now() - inicio > 6 * 60e3) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, cmd?.id]);

  const pedir = async () => {
    setErro(null);
    const { data, error } = await supabase
      .from("admin_comandos_sinc" as never)
      .insert({ tipo: "sincronizar_vendas_afiliado" } as never)
      .select("*")
      .single();
    if (error || !data) return setErro("Não consegui pedir a leitura. Tente de novo.");
    setCmd(data as ComandoSinc);
    window.postMessage({ de: "cupons-afiliado-ml", tipo: "pedido-novo" }, window.location.origin);
  };

  const leituras = cmd?.resultado?.marketplaces ?? [];
  return (
    <div className="mt-4 border-t border-black/5 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void pedir()}
          disabled={ativo}
          className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0077ed] active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${ativo ? "animate-spin" : ""}`} />
          {ativo ? "Sincronizando..." : "Sincronizar vendas agora"}
        </button>
        <p className="text-xs text-[#6e6e73]" aria-live="polite">
          {erro ??
            (ativo
              ? (cmd?.etapa ?? "Esperando a extensão...")
              : cmd
                ? `${cmd.etapa ?? ""} · ${quando(cmd.concluido_em ?? cmd.criado_em)}`
                : "A extensão lê os portais com as suas contas, no Chrome do notebook.")}
        </p>
      </div>
      {!ativo && leituras.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs">
          {leituras.map((l) => (
            <li key={l.marketplace}>
              <span className="font-semibold text-[#1d1d1f]">{NOME_PORTAL[l.marketplace]}:</span>{" "}
              <span className={l.status === "lido" ? "text-[#34c759]" : "text-[#6e6e73]"}>
                {TEXTO_LEITURA[l.status] ?? l.status}
              </span>
              {!!l.achados?.length && (
                <details className="abertura-nativa mt-1 text-[#6e6e73]">
                  <summary className="cursor-pointer">O que li no portal</summary>
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {l.achados.map((a, i) => (
                      <li key={i}>
                        {a.rotulo} → <span className="tabular-nums">{a.valor}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CopilotoAdmin() {
  const [aberto, setAberto] = useState(false);
  const [conversa, setConversa] = useState<MensagemCopiloto[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(pergunta: string) {
    const t = pergunta.trim();
    if (!t || pensando) return;
    const historico = [...conversa, { papel: "voce" as const, texto: t.slice(0, 4000) }].slice(-12);
    setConversa(historico);
    setTexto("");
    setErro(null);
    setPensando(true);
    try {
      const r = await perguntarAoCopiloto({ data: { historico } });
      if ("resposta" in r && r.resposta)
        setConversa([...historico, { papel: "copiloto", texto: r.resposta }]);
      else
        setErro(
          r.erro === "indisponivel"
            ? "Sessão expirada. Recarregue a página."
            : "O modelo não respondeu agora. Tente de novo.",
        );
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    }
    setPensando(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#1d1d1f] shadow-sm transition active:scale-[0.98]"
      >
        <Sparkles className="size-4 text-[#0071e3]" /> Copiloto
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent className="flex w-full flex-col gap-0 bg-[#f5f5f7] p-0 sm:max-w-md">
          <SheetHeader className="border-b border-[#e5e5ea] bg-white px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-[#0071e3]" /> Copiloto
            </SheetTitle>
            <SheetDescription className="text-xs">
              Responde com os números dos últimos 7 dias. Nada desta conversa é guardado.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {!conversa.length && (
              <div className="space-y-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void enviar(s)}
                    className="block w-full rounded-2xl bg-white px-4 py-3 text-left text-sm text-[#1d1d1f] shadow-sm transition hover:bg-white/80 active:scale-[0.99]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {conversa.map((m, i) => (
              <div
                key={i}
                className={`animate-cartao max-w-[90%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm ${
                  m.papel === "voce"
                    ? "ml-auto bg-[#0071e3] text-white"
                    : "bg-white text-[#1d1d1f] shadow-sm"
                }`}
              >
                {m.texto}
              </div>
            ))}
            {pensando && (
              <p className="flex items-center gap-2 text-xs text-[#6e6e73]">
                <LoaderCircle className="size-3.5 animate-spin text-[#0071e3]" /> Lendo os números…
              </p>
            )}
            {erro && (
              <p role="alert" className="text-xs text-[#ff3b30]">
                {erro}
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(texto);
            }}
            className="flex items-end gap-2 border-t border-[#e5e5ea] bg-white p-3"
          >
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(texto);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Pergunte sobre o seu site…"
              aria-label="Pergunta ao copiloto"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-[#f5f5f7] px-4 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] sm:text-sm"
            />
            <button
              type="submit"
              disabled={pensando || !texto.trim()}
              aria-label="Enviar"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white transition active:scale-95 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Tela({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">{children}</main>;
}

function Kpi({
  titulo,
  icone,
  atraso,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  atraso: number;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-3xl bg-white p-5 shadow-sm animate-cartao"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-[#6e6e73]">
        <span className="grid size-7 place-items-center rounded-full bg-[#f5f5f7] text-[#0071e3]">
          {icone}
        </span>
        {titulo}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Cartao({
  titulo,
  sub,
  className = "",
  atraso,
  children,
}: {
  titulo: string;
  sub?: string;
  className?: string;
  atraso: number;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl bg-white p-5 shadow-sm animate-cartao ${className}`}
      style={{ animationDelay: `${atraso}ms` }}
    >
      <h2 className="text-base font-bold text-[#1d1d1f]">{titulo}</h2>
      {sub && <p className="mb-4 text-xs text-[#86868b]">{sub}</p>}
      {children}
    </div>
  );
}

function Linha({ ok, rotulo, valor }: { ok: boolean; rotulo: string; valor: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-[#34c759]" : "bg-[#ff9500]"}`}
      />
      <span>
        <span className="block text-[#1d1d1f]">{rotulo}</span>
        <span className="block text-xs text-[#6e6e73]">{valor}</span>
      </span>
    </li>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-[#f5f5f7] p-4 text-sm text-[#6e6e73]">
      <Activity className="size-4" /> {children}
    </p>
  );
}
