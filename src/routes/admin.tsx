/* PAINEL DO FUNDADOR (Weslei, 04/11). Fora de menus, rodapé e sitemap.
   A página não guarda nada de sigiloso: os números só saem de
   painel_fundador(), que confere no banco se é a conta mestre confirmada.
   Nunca expulsa (04/11): sem sessão mostra o login por código; outra conta
   ou falha de rede ficam na página com a saída certa. */
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ArrowUpDown,
  Download,
  LoaderCircle,
  LogOut,
  Maximize2,
  MousePointerClick,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { sair } from "@/lib/auth-otp";
import {
  aReceberPorData,
  perguntarAoCopiloto,
  type ItemHub,
  type MensagemCopiloto,
} from "@/lib/copiloto-admin";
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
  const [estado, setEstado] = useState<"conferindo" | "entrar" | "negado" | "erro" | "pronto">(
    "conferindo",
  );
  const [email, setEmail] = useState<string | null>(null);
  const [dias, setDias] = useState(30);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const semMovimento = useSemMovimento();

  const carregar = useCallback(async (n: number) => {
    setCarregando(true);
    const p = await carregarPainel(n);
    setCarregando(false);
    if (p === "negado" || p === "falha") return setEstado(p === "negado" ? "negado" : "erro");
    setPainel(p);
    setEstado("pronto");
  }, []);

  useEffect(() => {
    const conferir = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setEstado("entrar");
      setEmail(data.session.user.email ?? null);
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
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
          <LoginEmailOtp embutido emailSugerido="weslei.mendes1318@gmail.com" />
        </div>
      </Tela>
    );

  if (estado === "negado")
    return (
      <Tela>
        <Aviso
          texto={`Conectado como ${email ?? "outra conta"}. Esta conta não possui privilégios de fundador.`}
          botao="Sair e entrar com outra conta"
          acao={() => void sair().then(() => setEstado("entrar"))}
        />
      </Tela>
    );

  if (estado === "erro")
    return (
      <Tela>
        <Aviso
          texto="Não consegui falar com o banco agora. Confira a internet e tente de novo."
          botao={carregando ? "Tentando…" : "Tentar novamente"}
          acao={() => void carregar(dias)}
        />
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
  const xDias: Expandir = {
    titulo: "Números por dia",
    colunas: [
      { chave: "dia", rotulo: "Dia" },
      { chave: "visitas", rotulo: "Visitas", tipo: "num" },
      { chave: "buscas_link", rotulo: "Buscas por link", tipo: "num" },
      { chave: "buscas_texto", rotulo: "Buscas por texto", tipo: "num" },
      { chave: "comparacoes", rotulo: "Comparações", tipo: "num" },
      { chave: "cliques_ml", rotulo: "Cliques ML", tipo: "num" },
      { chave: "cliques_amazon", rotulo: "Cliques Amazon", tipo: "num" },
      { chave: "cliques_shopee", rotulo: "Cliques Shopee", tipo: "num" },
      { chave: "favoritados", rotulo: "Favoritados", tipo: "num" },
      { chave: "alertas_ativos", rotulo: "Alertas ativos", tipo: "num" },
      { chave: "alertas_disparados", rotulo: "Alertas disparados", tipo: "num" },
    ],
    linhas: [...p.serie].reverse(),
  };
  const xVendas: Expandir = {
    titulo: "Leituras dos portais de afiliado",
    colunas: [
      { chave: "data", rotulo: "Mês" },
      { chave: "marketplace", rotulo: "Portal" },
      { chave: "comissao_centavos", rotulo: "Comissão", tipo: "reais" },
      { chave: "pedidos", rotulo: "Pedidos", tipo: "num" },
      { chave: "cliques", rotulo: "Cliques", tipo: "num" },
      { chave: "status", rotulo: "Status" },
      { chave: "capturado_em", rotulo: "Lido em", tipo: "data" },
    ],
    linhas: p.vendas,
  };
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
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6e6e73]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                <span className="size-2 rounded-full bg-[#34c759]" /> Conectado como{" "}
                <b className="break-all text-[#1d1d1f]">{email ?? "—"}</b>
              </span>
              <button
                type="button"
                onClick={() => void sair().then(() => setEstado("entrar"))}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-[#1d1d1f] shadow-sm transition hover:text-[#ff3b30] active:scale-95"
              >
                <LogOut className="size-3.5" /> Sair
              </button>
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
            <CopilotoAdmin dias={dias} />
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi atraso={0} icone={<Wallet className="size-4" />} titulo="Comissão estimada do mês">
            {r.comissaoMes == null ? (
              <p className="text-lg font-semibold text-[#6e6e73]">{AGUARDANDO}</p>
            ) : (
              <>
                <p className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
                  <Contador valor={r.comissaoMes} formato={reais} />
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
              <Contador valor={r.totalCliques} formato={inteiro} />
            </p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              ML {inteiro(r.cliques.ml)} · Amazon {inteiro(r.cliques.amazon)} · Shopee{" "}
              {inteiro(r.cliques.shopee)}
            </p>
          </Kpi>
          <Kpi atraso={120} icone={<Target className="size-4" />} titulo="Taxa de decisão">
            <p className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
              {r.taxaDecisao == null ? "—" : <Contador valor={r.taxaDecisao} formato={pct} />}
            </p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              {inteiro(r.totalCliques)} cliques em {inteiro(r.buscas)} buscas
            </p>
          </Kpi>
          <Kpi atraso={180} icone={<Bell className="size-4" />} titulo="Meus preços">
            <p className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
              <Contador valor={p.monitorados} formato={inteiro} />
            </p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              produtos monitorados · {inteiro(r.alertasDisparados)} alertas disparados
            </p>
          </Kpi>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Cartao
            titulo="Evolução diária"
            expandir={xDias}
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
                    isAnimationActive={!semMovimento}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="cliques"
                    name="Cliques"
                    stroke={VERDE}
                    strokeWidth={2.5}
                    fill="url(#gCliques)"
                    isAnimationActive={!semMovimento}
                    animationDuration={1400}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Cartao>

          <Cartao
            titulo="Marketplaces"
            sub="Cliques em links de afiliado"
            atraso={280}
            expandir={{ ...xDias, blocos: [xDias, xVendas] }}
          >
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
                      isAnimationActive={!semMovimento}
                      animationDuration={1000}
                      animationEasing="ease-out"
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
            expandir={xDias}
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
                      className="h-2 rounded-full transition-[width] duration-700 ease-out animate-barra"
                      style={{
                        animationDelay: `${320 + i * 90}ms`,
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

          <Cartao
            titulo="Categorias mais buscadas"
            sub="Produtos colados no período"
            atraso={360}
            expandir={{
              titulo: "Categorias mais buscadas",
              colunas: [
                { chave: "nome", rotulo: "Categoria" },
                { chave: "buscas", rotulo: "Buscas", tipo: "num" },
              ],
              linhas: p.categorias,
            }}
          >
            {!p.categorias.length ? (
              <Vazio>Sem buscas no período.</Vazio>
            ) : (
              <ul className="space-y-2.5">
                {p.categorias.map((c, i) => (
                  <li key={c.nome}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-[#1d1d1f]">{c.nome}</span>
                      <span className="font-semibold tabular-nums">{inteiro(c.buscas)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#f5f5f7]">
                      <div
                        className="h-1.5 rounded-full bg-[#0071e3] animate-barra"
                        style={{
                          width: `${(c.buscas / maxCat) * 100}%`,
                          animationDelay: `${360 + i * 70}ms`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao
            titulo="Termos com mais intenção"
            expandir={{
              titulo: "Termos buscados nos anúncios",
              colunas: [
                { chave: "termo", rotulo: "Termo" },
                { chave: "vezes", rotulo: "Vezes", tipo: "num" },
              ],
              linhas: p.termos,
            }}
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
            expandir={xVendas}
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

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Cartao
            titulo="Produtos mais buscados"
            sub="Colados no comparador no período"
            atraso={500}
            expandir={{
              titulo: "Produtos mais buscados",
              colunas: [
                { chave: "titulo", rotulo: "Produto" },
                { chave: "categoria", rotulo: "Categoria" },
                { chave: "vezes", rotulo: "Buscas", tipo: "num" },
                { chave: "cliques", rotulo: "Cliques", tipo: "num" },
                { chave: "preco", rotulo: "Preço colado" },
                { chave: "melhor_preco", rotulo: "Melhor preço" },
                { chave: "melhor_loja", rotulo: "Melhor loja" },
              ],
              linhas: p.top_produtos,
            }}
          >
            {!p.top_produtos.length ? (
              <Vazio>Sem produtos no período.</Vazio>
            ) : (
              <ol className="space-y-2 text-sm">
                {p.top_produtos.slice(0, 5).map((t, i) => (
                  <li key={t.titulo + i} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-[#1d1d1f]">
                      <b className="mr-1.5 text-[#86868b]">{i + 1}</b>
                      {t.titulo}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[#6e6e73]">
                      {inteiro(t.vezes)} buscas · {inteiro(t.cliques)} cliques
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>
          <Cartao
            titulo="Procuras sem boa oferta"
            sub="O que o cliente buscou e o site não resolveu bem"
            atraso={540}
            expandir={{
              titulo: "Procuras sem boa oferta",
              colunas: [
                { chave: "titulo", rotulo: "Produto" },
                { chave: "categoria", rotulo: "Categoria" },
                { chave: "motivo", rotulo: "Motivo" },
                { chave: "lojas", rotulo: "Lojas", tipo: "num" },
                { chave: "preco", rotulo: "Preço" },
              ],
              linhas: p.gaps,
            }}
          >
            {!p.gaps.length ? (
              <Vazio>Nenhuma no período.</Vazio>
            ) : (
              <ul className="space-y-2 text-sm">
                {p.gaps.slice(0, 5).map((g, i) => (
                  <li key={g.titulo + i} className="min-w-0">
                    <span className="block break-words text-[#1d1d1f]">{g.titulo}</span>
                    <span className="block text-xs text-[#6e6e73]">{g.motivo}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </section>

        <HubMercadoLivre atualizado={p.gerado_em} comando={p.comando} />
      </div>
    </Tela>
  );
}

function useSemMovimento() {
  const [sem, setSem] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSem(m.matches);
    const mudou = () => setSem(m.matches);
    m.addEventListener("change", mudou);
    return () => m.removeEventListener("change", mudou);
  }, []);
  return sem;
}

/* Número que sobe do zero até o valor (como a entrada do login); parado se o
   sistema pede menos movimento. */
function Contador({ valor, formato }: { valor: number; formato: (n: number) => string }) {
  const semMovimento = useSemMovimento();
  const [atual, setAtual] = useState(0);
  const de = useRef(0);
  useEffect(() => {
    if (semMovimento) return setAtual(valor);
    const inicio = performance.now();
    const partida = de.current;
    let quadro = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / 900);
      const v = partida + (valor - partida) * (1 - Math.pow(1 - k, 3));
      de.current = v;
      setAtual(v);
      if (k < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, semMovimento]);
  const inteiroNoFim = Number.isInteger(valor);
  return <span className="tabular-nums">{formato(inteiroNoFim ? Math.round(atual) : atual)}</span>;
}

type LinhaHub = {
  id: string;
  capturado_em: string;
  periodo: string;
  comissao_estimada_centavos: number | null;
  comissao_aprovada_centavos: number | null;
  comissao_pendente_centavos: number | null;
  faturamento_gerado_centavos: number | null;
  pedidos_totais: number | null;
  cliques_totais: number | null;
  taxa_conversao: number | null;
  trecho_lido: { rotulo: string; valor: string }[] | null;
  itens: ItemHub[] | null;
  tabelas: { pagina: string; cab: string[]; linhas: string[][]; total: number }[] | null;
};

const CAMPOS_HUB = [
  "comissao_estimada_centavos",
  "comissao_aprovada_centavos",
  "comissao_pendente_centavos",
  "faturamento_gerado_centavos",
  "pedidos_totais",
  "cliques_totais",
  "taxa_conversao",
] as const;
/* Precisão = quantos dos 7 números o hub mostrou de fato (o resto fica "—"). */
const lidosDoHub = (l: LinhaHub) => CAMPOS_HUB.filter((c) => l[c] != null).length;
const mesDe = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const STATUS_COMANDO: Record<ComandoSinc["status"], string> = {
  pendente: "Aguardando a extensão",
  executando: "Lendo agora",
  concluido: "Concluída",
  erro: "Falhou",
};

/* Hub de afiliados do Mercado Livre: últimas leituras da extensão (RLS:
   só a conta mestre lê metricas_hub_ml). Valor não lido fica "—". */
function HubMercadoLivre({
  atualizado,
  comando,
}: {
  atualizado: string;
  comando: ComandoSinc | null;
}) {
  const [linhas, setLinhas] = useState<LinhaHub[] | "carregando">("carregando");
  useEffect(() => {
    void supabase
      .from("metricas_hub_ml" as never)
      .select(
        "id, capturado_em, periodo, comissao_estimada_centavos, comissao_aprovada_centavos, comissao_pendente_centavos, faturamento_gerado_centavos, pedidos_totais, cliques_totais, taxa_conversao, trecho_lido, itens, tabelas",
      )
      .order("capturado_em", { ascending: false })
      .limit(10)
      .then(({ data }) => setLinhas((data as LinhaHub[] | null) ?? []));
  }, [atualizado]);

  const linha = linhas === "carregando" ? null : (linhas[0] ?? null);
  const leituraMl = comando?.resultado?.marketplaces?.find((m) => m.marketplace === "mercadolivre");
  const itens: { rotulo: string; valor: number | null; formato: (n: number) => string }[] = linha
    ? [
        { rotulo: "Ganho estimado", valor: linha.comissao_estimada_centavos, formato: reais },
        { rotulo: "Comissão aprovada", valor: linha.comissao_aprovada_centavos, formato: reais },
        { rotulo: "Comissão pendente", valor: linha.comissao_pendente_centavos, formato: reais },
        { rotulo: "Vendas geradas", valor: linha.faturamento_gerado_centavos, formato: reais },
        { rotulo: "Pedidos", valor: linha.pedidos_totais, formato: inteiro },
        { rotulo: "Cliques", valor: linha.cliques_totais, formato: inteiro },
        {
          rotulo: "Conversão",
          valor: linha.taxa_conversao == null ? null : Number(linha.taxa_conversao),
          formato: pct,
        },
      ]
    : [];
  const vendas = linha?.itens ?? [];
  const aReceber = aReceberPorData(vendas);
  const xHub: Expandir = {
    titulo: "Vendas por produto (hub do Mercado Livre)",
    colunas: [
      { chave: "produto", rotulo: "Produto" },
      { chave: "data", rotulo: "Data" },
      { chave: "tipo", rotulo: "Tipo" },
      { chave: "valor_centavos", rotulo: "Valor", tipo: "reais" },
      { chave: "comissao_pct", rotulo: "% comissão", tipo: "pct" },
      { chave: "comissao_centavos", rotulo: "Comissão", tipo: "reais" },
      { chave: "status", rotulo: "Status" },
      { chave: "liberacao", rotulo: "Liberação" },
      { chave: "pagina", rotulo: "Página" },
    ],
    linhas: vendas,
    blocos: [
      {
        titulo: "Vendas por produto (hub do Mercado Livre)",
        colunas: [
          { chave: "produto", rotulo: "Produto" },
          { chave: "data", rotulo: "Data" },
          { chave: "tipo", rotulo: "Tipo" },
          { chave: "valor_centavos", rotulo: "Valor", tipo: "reais" },
          { chave: "comissao_pct", rotulo: "% comissão", tipo: "pct" },
          { chave: "comissao_centavos", rotulo: "Comissão", tipo: "reais" },
          { chave: "status", rotulo: "Status" },
          { chave: "liberacao", rotulo: "Liberação" },
          { chave: "pagina", rotulo: "Página" },
        ],
        linhas: vendas,
      },
      {
        titulo: "A receber por data",
        colunas: [
          { chave: "data", rotulo: "Liberação" },
          { chave: "centavos", rotulo: "Valor", tipo: "reais" },
        ],
        linhas: aReceber,
      },
      {
        titulo: "Histórico de leituras",
        colunas: [
          { chave: "capturado_em", rotulo: "Lido em", tipo: "data" },
          { chave: "comissao_estimada_centavos", rotulo: "Ganho estimado", tipo: "reais" },
          { chave: "comissao_aprovada_centavos", rotulo: "Aprovada", tipo: "reais" },
          { chave: "comissao_pendente_centavos", rotulo: "Pendente", tipo: "reais" },
          { chave: "faturamento_gerado_centavos", rotulo: "Vendas geradas", tipo: "reais" },
          { chave: "pedidos_totais", rotulo: "Pedidos", tipo: "num" },
          { chave: "cliques_totais", rotulo: "Cliques", tipo: "num" },
        ],
        linhas: linhas === "carregando" ? [] : linhas,
      },
      /* Como o portal mostrou (confere a leitura coluna por coluna). */
      ...(linha?.tabelas ?? []).map((t) => ({
        titulo: `Tabela lida em "${t.pagina}" (${t.total} linhas)`,
        colunas: t.cab.map((c, i) => ({ chave: String(i), rotulo: c || `Coluna ${i + 1}` })),
        linhas: t.linhas.map((l) => Object.fromEntries(l.map((v, i) => [String(i), v]))),
      })),
    ],
  };
  const proxima = linha
    ? quando(new Date(new Date(linha.capturado_em).getTime() + 12 * 3600e3).toISOString())
    : null;

  return (
    <section className="mt-4">
      <Cartao
        titulo="Hub de afiliados do Mercado Livre"
        sub={linha ? `Período: ${mesDe(linha.capturado_em)} (acumulado do mês)` : "Mês atual"}
        atraso={520}
        expandir={linha ? xHub : undefined}
      >
        {linhas === "carregando" ? (
          <Vazio>Carregando…</Vazio>
        ) : !linha ? (
          <Vazio>
            Ainda sem leitura do hub. Toque em “Sincronizar vendas agora” com a extensão aberta no
            Chrome.
          </Vazio>
        ) : (
          <>
            <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <div className="min-w-0">
                <dt className="text-[#86868b]">Última leitura</dt>
                <dd className="font-semibold text-[#1d1d1f]">{quando(linha.capturado_em)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[#86868b]">Precisão</dt>
                <dd
                  className={`font-semibold ${lidosDoHub(linha) >= 5 ? "text-[#34c759]" : "text-[#ff9500]"}`}
                >
                  {lidosDoHub(linha)} de {CAMPOS_HUB.length} números lidos
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[#86868b]">Status</dt>
                <dd className="font-semibold text-[#1d1d1f]">
                  {comando
                    ? `${STATUS_COMANDO[comando.status]}${leituraMl ? ` · ${TEXTO_LEITURA[leituraMl.status] ?? leituraMl.status}` : ""}`
                    : "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[#86868b]">Próxima leitura automática</dt>
                <dd className="font-semibold text-[#1d1d1f]">por volta de {proxima}</dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {itens.map((it, i) => (
                <div
                  key={it.rotulo}
                  className="min-w-0 rounded-2xl bg-[#f5f5f7] p-3 animate-cartao"
                  style={{ animationDelay: `${560 + i * 50}ms` }}
                >
                  <p className="text-[11px] font-semibold leading-tight text-[#6e6e73]">
                    {it.rotulo}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-sm font-bold tracking-tight text-[#1d1d1f] min-[360px]:text-base sm:text-lg">
                    {it.valor == null ? "—" : <Contador valor={it.valor} formato={it.formato} />}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <h3 className="text-sm font-bold text-[#1d1d1f]">Vendas por produto</h3>
                {!vendas.length ? (
                  <p className="mt-2 rounded-2xl bg-[#f5f5f7] p-3 text-xs text-[#6e6e73]">
                    {linha.tabelas?.length
                      ? "Li as tabelas do hub, mas nenhuma tinha produto e valor. Veja em “Ver tudo” como o portal mostrou."
                      : "Nenhuma venda listada na última leitura. Com a extensão 1.182.0, a leitura abre Métricas e Receita do hub."}
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-[#e5e5ea] rounded-2xl border border-[#e5e5ea]">
                    {[...vendas]
                      .sort((a, b) => (b.comissao_centavos ?? 0) - (a.comissao_centavos ?? 0))
                      .slice(0, 6)
                      .map((v, i) => (
                        <li
                          key={i}
                          className="flex items-start justify-between gap-3 px-3 py-2 text-xs"
                        >
                          <span className="min-w-0">
                            <span className="block break-words font-semibold text-[#1d1d1f]">
                              {v.produto ?? "—"}
                            </span>
                            <span className="block text-[#6e6e73]">
                              {[v.data, v.tipo && `venda ${v.tipo}`, v.status]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </span>
                          </span>
                          <span className="shrink-0 text-right tabular-nums">
                            <span className="block font-bold text-[#1d1d1f]">
                              {v.comissao_centavos == null ? "—" : reais(v.comissao_centavos)}
                            </span>
                            <span className="block text-[#6e6e73]">
                              {v.comissao_pct == null ? "" : `${pct(v.comissao_pct)} de `}
                              {v.valor_centavos == null ? "—" : reais(v.valor_centavos)}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#1d1d1f]">A receber</h3>
                {aReceber.length ? (
                  <ul className="mt-2 space-y-1.5 rounded-2xl bg-[#f5f5f7] p-3 text-xs">
                    {aReceber.map((a) => (
                      <li key={a.data} className="flex justify-between gap-2">
                        <span className="text-[#6e6e73]">{a.data}</span>
                        <b className="tabular-nums text-[#1d1d1f]">{reais(a.centavos)}</b>
                      </li>
                    ))}
                    <li className="flex justify-between gap-2 border-t border-[#e5e5ea] pt-1.5">
                      <span className="font-semibold">Total</span>
                      <b className="tabular-nums text-[#34c759]">
                        {reais(aReceber.reduce((t, a) => t + a.centavos, 0))}
                      </b>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 rounded-2xl bg-[#f5f5f7] p-3 text-xs text-[#6e6e73]">
                    {linha.comissao_pendente_centavos != null
                      ? `${reais(linha.comissao_pendente_centavos)} pendente no resumo do hub; as datas de liberação aparecem quando o hub listar.`
                      : "O hub ainda não mostrou valores a receber com data."}
                  </p>
                )}
              </div>
            </div>

            <h3 className="mt-5 text-sm font-bold text-[#1d1d1f]">Histórico de leituras</h3>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-[#e5e5ea]">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-[#f5f5f7] text-[#6e6e73]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Data</th>
                    <th className="px-3 py-2 font-semibold">Ganho estimado</th>
                    <th className="px-3 py-2 font-semibold">Aprovada</th>
                    <th className="px-3 py-2 font-semibold">Pendente</th>
                    <th className="px-3 py-2 font-semibold">Vendas geradas</th>
                    <th className="px-3 py-2 font-semibold">Pedidos</th>
                    <th className="px-3 py-2 font-semibold">Precisão</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums text-[#1d1d1f]">
                  {linhas.map((l) => (
                    <tr key={l.id} className="border-t border-[#e5e5ea]">
                      <td className="whitespace-nowrap px-3 py-2">{quando(l.capturado_em)}</td>
                      <td className="px-3 py-2">
                        {l.comissao_estimada_centavos == null
                          ? "—"
                          : reais(l.comissao_estimada_centavos)}
                      </td>
                      <td className="px-3 py-2">
                        {l.comissao_aprovada_centavos == null
                          ? "—"
                          : reais(l.comissao_aprovada_centavos)}
                      </td>
                      <td className="px-3 py-2">
                        {l.comissao_pendente_centavos == null
                          ? "—"
                          : reais(l.comissao_pendente_centavos)}
                      </td>
                      <td className="px-3 py-2">
                        {l.faturamento_gerado_centavos == null
                          ? "—"
                          : reais(l.faturamento_gerado_centavos)}
                      </td>
                      <td className="px-3 py-2">
                        {l.pedidos_totais == null ? "—" : inteiro(l.pedidos_totais)}
                      </td>
                      <td className="px-3 py-2">
                        {lidosDoHub(l)}/{CAMPOS_HUB.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!!linha.trecho_lido?.length && (
              <details className="abertura-nativa mt-3 text-xs text-[#6e6e73]">
                <summary className="cursor-pointer font-semibold">O que li no portal</summary>
                <ul className="mt-2 space-y-1 break-words">
                  {linha.trecho_lido.slice(0, 12).map((t, i) => (
                    <li key={i}>
                      {t.rotulo} → <span className="tabular-nums">{t.valor}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-3 text-[11px] text-[#86868b]">
              Números do mês corrente, como o hub mostra. Valor que o hub não mostrou fica “—”.
            </p>
          </>
        )}
      </Cartao>
    </section>
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

function CopilotoAdmin({ dias }: { dias: number }) {
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
      const r = await perguntarAoCopiloto({ data: { historico, dias } });
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
              Responde com os números dos últimos {dias} dias, os portais de afiliado e a última
              leitura do hub do Mercado Livre. Nada desta conversa é guardado.
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
                {m.papel === "voce" ? m.texto : <TextoSimples texto={m.texto} />}
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

function Aviso({ texto, botao, acao }: { texto: string; botao: string; acao: () => void }) {
  return (
    <div
      role="status"
      className="mx-4 mt-32 rounded-3xl bg-white p-6 text-center shadow-sm animate-cartao sm:mx-auto sm:max-w-sm"
    >
      <p className="break-words text-sm text-[#6e6e73]">{texto}</p>
      <button
        type="button"
        onClick={acao}
        className="mt-4 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
      >
        {botao}
      </button>
    </div>
  );
}

function Tela({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#f5f5f7] pb-24 text-[#1d1d1f] md:pb-0">{children}</main>;
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
  expandir,
  children,
}: {
  titulo: string;
  sub?: string;
  className?: string;
  atraso: number;
  expandir?: Expandir | undefined;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div
      className={`min-w-0 rounded-3xl bg-white p-5 shadow-sm animate-cartao ${className}`}
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold text-[#1d1d1f]">{titulo}</h2>
        {expandir && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold text-[#0071e3] transition hover:bg-[#e8e8ed] active:scale-95"
            aria-label={`Ver todos os dados: ${titulo}`}
          >
            <Maximize2 className="size-3" /> Ver tudo
          </button>
        )}
      </div>
      {sub && <p className="mb-4 text-xs text-[#86868b]">{sub}</p>}
      {children}
      {expandir && (
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetContent className="flex w-full flex-col gap-0 bg-[#f5f5f7] p-0 sm:max-w-3xl">
            <SheetHeader className="border-b border-[#e5e5ea] bg-white px-5 py-4 text-left">
              <SheetTitle className="text-base">{expandir.titulo ?? titulo}</SheetTitle>
              <SheetDescription className="text-xs">
                Filtre, ordene tocando no título da coluna e baixe em planilha (.csv).
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              {(expandir.blocos ?? [expandir]).map((b, i) => (
                <TabelaCompleta key={i} {...b} />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

type Coluna = { chave: string; rotulo: string; tipo?: "reais" | "num" | "pct" | "data" };
type BlocoTabela = {
  titulo?: string;
  colunas: Coluna[];
  linhas: Record<string, unknown>[];
};
type Expandir = BlocoTabela & { blocos?: BlocoTabela[] };

function celula(v: unknown, tipo?: Coluna["tipo"]) {
  if (v == null || v === "") return "—";
  if (tipo === "reais" && typeof v === "number") return reais(v);
  if (tipo === "num" && typeof v === "number") return inteiro(v);
  if (tipo === "pct" && typeof v === "number") return pct(v);
  if (tipo === "data" && typeof v === "string") return quando(v);
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/* Tabela inteira de um cartão: filtro, ordem por coluna e .csv (07/11,
   "preciso da possibilidade de expandir dados e consultas"). */
function TabelaCompleta({ titulo, colunas, linhas }: BlocoTabela) {
  const [filtro, setFiltro] = useState("");
  const [ordem, setOrdem] = useState<{ chave: string; desc: boolean } | null>(null);
  const f = filtro.trim().toLowerCase();
  let vistas = f
    ? linhas.filter((l) =>
        colunas.some((c) => celula(l[c.chave], c.tipo).toLowerCase().includes(f)),
      )
    : linhas;
  if (ordem) {
    const k = ordem.chave;
    vistas = [...vistas].sort((a, b) => {
      const x = a[k];
      const y = b[k];
      if (x == null) return 1;
      if (y == null) return -1;
      const r =
        typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return ordem.desc ? -r : r;
    });
  }
  const baixar = () => {
    const esc = (t: string) => `"${t.replace(/"/g, '""')}"`;
    const csv = [
      colunas.map((c) => esc(c.rotulo)).join(";"),
      ...vistas.map((l) => colunas.map((c) => esc(celula(l[c.chave], c.tipo))).join(";")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${(titulo ?? "dados").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="mb-6">
      {titulo && <h3 className="mb-2 text-sm font-bold text-[#1d1d1f]">{titulo}</h3>}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar…"
          aria-label={`Filtrar ${titulo ?? "tabela"}`}
          className="min-w-0 flex-1 rounded-full border border-[#e5e5ea] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#0071e3]"
        />
        <span className="text-xs text-[#6e6e73]">
          {vistas.length} de {linhas.length}
        </span>
        <button
          type="button"
          onClick={baixar}
          disabled={!vistas.length}
          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] shadow-sm disabled:opacity-40"
        >
          <Download className="size-3.5" /> .csv
        </button>
      </div>
      {!linhas.length ? (
        <Vazio>Sem dados para mostrar.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e5e5ea] bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f5f5f7] text-[#6e6e73]">
              <tr>
                {colunas.map((c) => (
                  <th key={c.chave} className="whitespace-nowrap px-3 py-2 font-semibold">
                    <button
                      type="button"
                      onClick={() =>
                        setOrdem((o) =>
                          o?.chave === c.chave
                            ? { chave: c.chave, desc: !o.desc }
                            : { chave: c.chave, desc: true },
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-[#1d1d1f]"
                    >
                      {c.rotulo} <ArrowUpDown className="size-3 opacity-50" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-[#1d1d1f]">
              {vistas.slice(0, 1000).map((l, i) => (
                <tr key={i} className="border-t border-[#e5e5ea]">
                  {colunas.map((c) => (
                    <td key={c.chave} className="max-w-[260px] px-3 py-2 align-top">
                      {celula(l[c.chave], c.tipo)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* Resposta do copiloto: **negrito** e listas "- " sem biblioteca. */
function TextoSimples({ texto }: { texto: string }) {
  const negrito = (t: string) =>
    t
      .split(/(\*\*[^*]+\*\*)/g)
      .map((x, i) => (/^\*\*[^*]+\*\*$/.test(x) ? <strong key={i}>{x.slice(2, -2)}</strong> : x));
  return (
    <div className="space-y-1.5 whitespace-normal">
      {texto.split("\n").map((l, i) => {
        const t = l.trim();
        if (!t) return null;
        const item = /^[-*•]\s+(.*)$/.exec(t);
        const titulo = /^#{1,4}\s+(.*)$/.exec(t);
        if (item)
          return (
            <p key={i} className="flex gap-2">
              <span className="text-[#0071e3]">•</span>
              <span>{negrito(item[1]!)}</span>
            </p>
          );
        if (titulo)
          return (
            <p key={i} className="font-bold">
              {negrito(titulo[1]!)}
            </p>
          );
        return <p key={i}>{negrito(t)}</p>;
      })}
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
