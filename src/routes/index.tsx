import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cupons Afiliado ML — consulta rápida de cupons" },
      {
        name: "description",
        content:
          "Consulte cupons de afiliado do Mercado Livre por vendedor, desconto, orçamento e validade. Busca instantânea e exportação em CSV.",
      },
      { property: "og:title", content: "Cupons Afiliado ML" },
      {
        property: "og:description",
        content:
          "Busque cupons de afiliado do Mercado Livre por vendedor, desconto e validade. Rápido e direto no celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Cupom = {
  id: number;
  vendedor: string;
  desconto: string | null;
  tipo: string | null;
  valor: number | null;
  orcamento: number | null;
  vence: string | null;
  busca: string | null;
  updated_at?: string | null;
};

const PAGE_SIZE = 50;

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function diasAte(data: string | null) {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${data}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function carregarCupons(): Promise<Cupom[]> {
  const todos: Cupom[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await supabase
      .from("cupons")
      .select("id,vendedor,desconto,tipo,valor,orcamento,vence,busca,updated_at")
      .order("valor", { ascending: false })
      .range(de, de + passo - 1);
    if (error) throw error;
    const lote = (data ?? []) as Cupom[];
    todos.push(...lote);
    if (lote.length < passo) break;
  }
  return todos;
}

function Index() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["cupons"],
    queryFn: carregarCupons,
    staleTime: 60_000,
  });

  const cupons = useMemo(() => data ?? [], [data]);

  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  const [tipo, setTipo] = useState<"todos" | "%" | "R$">("todos");
  const [descontoMin, setDescontoMin] = useState("");
  const [orcamentoMin, setOrcamentoMin] = useState("");
  const [ordem, setOrdem] = useState<"desconto" | "orcamento" | "vence" | "vendedor">("desconto");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setTermo(texto), 150);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setPagina(1);
  }, [termo, tipo, descontoMin, orcamentoMin, ordem]);

  const indexado = useMemo(
    () =>
      cupons.map((c) => ({
        ...c,
        chave: normalizar(c.busca ?? c.vendedor ?? ""),
        dias: diasAte(c.vence),
      })),
    [cupons],
  );

  const termos = useMemo(
    () =>
      termo
        .split(",")
        .map((t) => normalizar(t))
        .filter(Boolean),
    [termo],
  );

  const filtrados = useMemo(() => {
    const dMin = Number(descontoMin) || 0;
    const oMin = Number(orcamentoMin) || 0;
    const lista = indexado.filter((c) => {
      if (tipo !== "todos" && c.tipo !== tipo) return false;
      if (dMin && (c.valor ?? 0) < dMin) return false;
      if (oMin && (c.orcamento ?? 0) < oMin) return false;
      if (termos.length && !termos.some((t) => c.chave.includes(t))) return false;
      return true;
    });
    const ordenado = [...lista];
    ordenado.sort((a, b) => {
      switch (ordem) {
        case "orcamento":
          return (b.orcamento ?? 0) - (a.orcamento ?? 0);
        case "vence":
          return (a.dias ?? 99999) - (b.dias ?? 99999);
        case "vendedor":
          return (a.vendedor ?? "").localeCompare(b.vendedor ?? "", "pt-BR");
        default:
          return (b.valor ?? 0) - (a.valor ?? 0);
      }
    });
    return ordenado;
  }, [indexado, termos, tipo, descontoMin, orcamentoMin, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const indicadores = useMemo(() => {
    const vendedores = new Set(indexado.map((c) => c.vendedor));
    const maiorPct = indexado.reduce(
      (max, c) => (c.tipo === "%" ? Math.max(max, c.valor ?? 0) : max),
      0,
    );
    const vencendo = indexado.filter((c) => c.dias !== null && c.dias >= 0 && c.dias <= 3).length;
    return {
      total: indexado.length,
      vendedores: vendedores.size,
      maiorPct,
      vencendo,
    };
  }, [indexado]);

  const atualizado = useMemo(() => {
    const datas = cupons
      .map((c) => (c.updated_at ? new Date(c.updated_at).getTime() : 0))
      .filter(Boolean);
    if (!datas.length) return null;
    return new Date(Math.max(...datas)).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }, [cupons]);

  function exportarCsv() {
    const cabecalho = ["Desconto", "Vendedor", "Orcamento restante", "Vence em"];
    const linhas = filtrados.map((c) => [
      c.desconto ?? "",
      c.vendedor ?? "",
      c.orcamento != null ? c.orcamento.toFixed(2).replace(".", ",") : "",
      c.vence ? new Date(`${c.vence}T00:00:00`).toLocaleDateString("pt-BR") : "",
    ]);
    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [cabecalho, ...linhas].map((l) => l.map(escapar).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cupons-afiliado-ml.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ml-yellow text-ml-yellow-foreground">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Cupons Afiliado ML</h1>
          <p className="mt-1 text-sm opacity-80">
            {atualizado
              ? `Dados atualizados em ${atualizado}`
              : "Aguardando a primeira carga de dados"}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador titulo="Cupons" valor={indicadores.total.toLocaleString("pt-BR")} />
          <Indicador titulo="Vendedores" valor={indicadores.vendedores.toLocaleString("pt-BR")} />
          <Indicador
            titulo="Maior desconto %"
            valor={indicadores.maiorPct ? `${indicadores.maiorPct}%` : "—"}
          />
          <Indicador titulo="Vencem em até 3 dias" valor={String(indicadores.vencendo)} />
        </section>

        <section className="mt-5 space-y-3">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            inputMode="search"
            placeholder="Buscar vendedor (use vírgula para vários: negocia tudo, kabum)"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2"
          />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Campo rotulo="Tipo">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as typeof tipo)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="%">Só %</option>
                <option value="R$">Só R$</option>
              </select>
            </Campo>
            <Campo rotulo="Desconto mínimo">
              <input
                type="number"
                min={0}
                value={descontoMin}
                onChange={(e) => setDescontoMin(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Campo>
            <Campo rotulo="Orçamento mínimo (R$)">
              <input
                type="number"
                min={0}
                value={orcamentoMin}
                onChange={(e) => setOrcamentoMin(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Campo>
            <Campo rotulo="Ordenar por">
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as typeof ordem)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="desconto">Maior desconto</option>
                <option value="orcamento">Maior orçamento</option>
                <option value="vence">Vence antes</option>
                <option value="vendedor">Vendedor A-Z</option>
              </select>
            </Campo>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Carregando cupons..."
                : `${filtrados.length.toLocaleString("pt-BR")} cupom(ns) encontrados`}
            </p>
            <button
              onClick={exportarCsv}
              disabled={!filtrados.length}
              className="rounded-lg bg-ml-blue px-4 py-2 text-sm font-semibold text-ml-blue-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Exportar CSV
            </button>
          </div>
        </section>

        <section className="mt-4">
          {error ? (
            <Aviso
              titulo="Não foi possível carregar os cupons"
              texto="Tente atualizar a página em alguns instantes."
            />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !cupons.length ? (
            <Aviso
              titulo="Nenhum cupom cadastrado ainda"
              texto="Assim que os cupons forem carregados no banco, eles aparecem aqui automaticamente."
            />
          ) : !filtrados.length ? (
            <Aviso
              titulo="Nenhum resultado para esses filtros"
              texto="Tente outro nome de vendedor ou reduza os filtros de desconto e orçamento."
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Desconto</th>
                      <th className="px-3 py-2">Vendedor</th>
                      <th className="px-3 py-2 text-right">Orçamento</th>
                      <th className="px-3 py-2 text-right">Vence em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((c) => {
                      const urgente = c.dias !== null && c.dias <= 3;
                      return (
                        <tr key={c.id} className="border-t border-border">
                          <td
                            className={`px-3 py-2 font-bold ${c.tipo === "%" ? "text-success" : ""}`}
                          >
                            {c.desconto ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <a
                              href={`https://www.mercadolivre.com.br/perfil/${encodeURIComponent(c.vendedor ?? "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-ml-blue underline-offset-2 hover:underline"
                            >
                              {c.vendedor}
                            </a>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {c.orcamento != null ? brl.format(c.orcamento) : "—"}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums ${urgente ? "font-semibold text-danger" : ""}`}
                          >
                            {c.vence
                              ? new Date(`${c.vence}T00:00:00`).toLocaleDateString("pt-BR")
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1}
                    className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="mt-8 border-t border-border py-6">
        <p className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground">
          Fotografia dos cupons, não é tempo real. Cupom é campanha do vendedor e pode acabar antes
          da validade.
        </p>
      </footer>
    </div>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{valor}</p>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
      <p className="text-base font-semibold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
