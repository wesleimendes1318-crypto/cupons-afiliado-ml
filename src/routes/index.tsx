import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock3, Copy, Info, Search, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cupons Afiliado ML — descubra o desconto real" },
      {
        name: "description",
        content:
          "Consulte o teto real, a compra mínima e as condições dos cupons de afiliado do Mercado Livre.",
      },
      { property: "og:title", content: "Cupons Afiliado ML — descubra o desconto real" },
      {
        property: "og:description",
        content: "Compare o percentual anunciado com o teto real de desconto de cada cupom.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Qualidade = "bom" | "armadilha";
type Cupom = {
  id: number;
  vendedor: string;
  desconto: string | null;
  tipo: string | null;
  valor: number | null;
  orcamento: number | null;
  vence: string | null;
  busca: string | null;
  compra_min: number | null;
  teto: number | null;
  qualidade: string | null;
  updated_at: string | null;
};

type CupomIndexado = Cupom & { chave: string; dias: number | null };

const PAGE_SIZE = 50;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dataExtensa = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function dataDoBanco(data: string) {
  return new Date(`${data}T00:00:00Z`);
}

function diasAte(data: string | null) {
  if (!data) return null;
  const hoje = new Date();
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((dataDoBanco(data).getTime() - hojeUtc) / 86400000);
}

function formatarMoeda(valor: number | null) {
  return valor == null ? "Não informado" : brl.format(valor);
}

function descontoRealEm200(cupom: Cupom) {
  const teto = cupom.teto ?? Number.POSITIVE_INFINITY;
  const descontoCalculado = cupom.tipo === "%" ? 200 * ((cupom.valor ?? 0) / 100) : (cupom.valor ?? 0);
  return Math.min(descontoCalculado, teto);
}

async function carregarCupons(): Promise<Cupom[]> {
  const todos: Cupom[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await supabase
      .from("cupons")
      .select(
        "id,vendedor,desconto,tipo,valor,orcamento,vence,busca,compra_min,teto,qualidade,updated_at",
      )
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
  const [qualidade, setQualidade] = useState<"todos" | Qualidade>("todos");
  const [tipo, setTipo] = useState<"todos" | "%" | "R$">("todos");
  const [descontoMin, setDescontoMin] = useState("");
  const [orcamentoMin, setOrcamentoMin] = useState("");
  const [tetoMin, setTetoMin] = useState("");
  const [compraMax, setCompraMax] = useState("");
  const [ordem, setOrdem] = useState<"desconto" | "teto" | "orcamento" | "vence" | "vendedor">(
    "desconto",
  );
  const [pagina, setPagina] = useState(1);
  const [cupomAberto, setCupomAberto] = useState<CupomIndexado | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTermo(texto), 150);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setPagina(1);
  }, [termo, qualidade, tipo, descontoMin, orcamentoMin, tetoMin, compraMax, ordem]);

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
        .map((item) => normalizar(item))
        .filter(Boolean),
    [termo],
  );

  const filtrados = useMemo(() => {
    const dMin = Number(descontoMin) || 0;
    const oMin = Number(orcamentoMin) || 0;
    const tMin = Number(tetoMin) || 0;
    const cMax = compraMax === "" ? null : Number(compraMax);
    const lista = indexado.filter((cupom) => {
      if (qualidade !== "todos" && cupom.qualidade !== qualidade) return false;
      if (tipo !== "todos" && cupom.tipo !== tipo) return false;
      if (dMin && (cupom.valor ?? 0) < dMin) return false;
      if (oMin && (cupom.orcamento ?? 0) < oMin) return false;
      if (tMin && (cupom.teto ?? 0) < tMin) return false;
      if (cMax !== null && (cupom.compra_min == null || cupom.compra_min > cMax)) return false;
      if (termos.length && !termos.some((item) => cupom.chave.includes(item))) return false;
      return true;
    });

    return [...lista].sort((a, b) => {
      switch (ordem) {
        case "teto":
          return (b.teto ?? 0) - (a.teto ?? 0);
        case "orcamento":
          return (b.orcamento ?? 0) - (a.orcamento ?? 0);
        case "vence":
          return (a.dias ?? 99999) - (b.dias ?? 99999);
        case "vendedor":
          return a.vendedor.localeCompare(b.vendedor, "pt-BR");
        default:
          return (b.valor ?? 0) - (a.valor ?? 0);
      }
    });
  }, [indexado, termos, qualidade, tipo, descontoMin, orcamentoMin, tetoMin, compraMax, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const indicadores = useMemo(() => {
    const vendedores = new Set(indexado.map((cupom) => cupom.vendedor));
    return {
      total: indexado.length,
      vendedores: vendedores.size,
      bons: indexado.filter((cupom) => cupom.qualidade === "bom").length,
      armadilhas: indexado.filter((cupom) => cupom.qualidade === "armadilha").length,
    };
  }, [indexado]);

  const atualizado = useMemo(() => {
    const datas = cupons
      .map((cupom) => (cupom.updated_at ? new Date(cupom.updated_at).getTime() : 0))
      .filter(Boolean);
    if (!datas.length) return null;
    return new Date(Math.max(...datas)).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }, [cupons]);

  function exportarCsv() {
    const cabecalho = [
      "Desconto",
      "Vendedor",
      "Compra mínima",
      "Teto de desconto",
      "Qualidade",
      "Orçamento restante",
      "Vence em",
    ];
    const linhas = filtrados.map((cupom) => [
      cupom.desconto ?? "",
      cupom.vendedor,
      cupom.compra_min != null ? cupom.compra_min.toFixed(2).replace(".", ",") : "",
      cupom.teto != null ? cupom.teto.toFixed(2).replace(".", ",") : "",
      cupom.qualidade ?? "",
      cupom.orcamento != null ? cupom.orcamento.toFixed(2).replace(".", ",") : "",
      cupom.vence ? dataCurta.format(dataDoBanco(cupom.vence)) : "",
    ]);
    const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
    const csv = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cupons-afiliado-ml.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full bg-ml-yellow text-ml-yellow-foreground">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 size-7 shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Cupons Afiliado ML</h1>
              <p className="mt-1 max-w-2xl text-sm font-medium sm:text-base">
                Percentual alto não garante desconto alto. Confira o teto antes de comprar.
              </p>
              <p className="mt-2 text-xs text-secondary-ink">
                {atualizado ? `Dados atualizados em ${atualizado}` : "Aguardando a primeira carga de dados"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo dos cupons">
          <Indicador titulo="Cupons" valor={indicadores.total.toLocaleString("pt-BR")} />
          <Indicador titulo="Vendedores" valor={indicadores.vendedores.toLocaleString("pt-BR")} />
          <Indicador titulo="Vale a pena" valor={indicadores.bons.toLocaleString("pt-BR")} tom="bom" />
          <Indicador
            titulo="Armadilhas"
            valor={indicadores.armadilhas.toLocaleString("pt-BR")}
            tom="armadilha"
          />
        </section>

        <section className="mt-6" aria-label="Filtros de cupons">
          <div className="flex border-b border-border" role="tablist" aria-label="Qualidade do cupom">
            {([
              ["todos", "Todos"],
              ["bom", "Vale a pena"],
              ["armadilha", "Armadilhas"],
            ] as const).map(([valor, rotulo]) => (
              <Button
                key={valor}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={qualidade === valor}
                onClick={() => setQualidade(valor)}
                className={cn(
                  "h-11 rounded-none border-b-2 px-3 sm:px-5",
                  qualidade === valor
                    ? "border-ml-blue text-ml-blue"
                    : "border-transparent text-secondary-ink",
                )}
              >
                {rotulo}
              </Button>
            ))}
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              inputMode="search"
              aria-label="Buscar vendedor"
              placeholder="Buscar vendedor (separe vários nomes por vírgula)"
              className="w-full rounded-lg border border-border bg-card py-3 pl-11 pr-4 text-base outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Campo rotulo="Tipo">
              <select
                value={tipo}
                onChange={(event) => setTipo(event.target.value as typeof tipo)}
                className="campo-filtro"
              >
                <option value="todos">Todos</option>
                <option value="%">Só %</option>
                <option value="R$">Só R$</option>
              </select>
            </Campo>
            <Campo rotulo="Desconto mínimo">
              <InputNumero valor={descontoMin} aoMudar={setDescontoMin} />
            </Campo>
            <Campo rotulo="Orçamento mínimo (R$)">
              <InputNumero valor={orcamentoMin} aoMudar={setOrcamentoMin} />
            </Campo>
            <Campo rotulo="Teto mínimo (R$)">
              <InputNumero valor={tetoMin} aoMudar={setTetoMin} />
            </Campo>
            <Campo rotulo="Compra máxima que aceito (R$)">
              <InputNumero valor={compraMax} aoMudar={setCompraMax} />
            </Campo>
            <Campo rotulo="Ordenar por">
              <select
                value={ordem}
                onChange={(event) => setOrdem(event.target.value as typeof ordem)}
                className="campo-filtro"
              >
                <option value="desconto">Maior desconto</option>
                <option value="teto">Maior teto de desconto</option>
                <option value="orcamento">Maior orçamento</option>
                <option value="vence">Vence antes</option>
                <option value="vendedor">Vendedor A-Z</option>
              </select>
            </Campo>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary-ink" aria-live="polite">
              {isLoading
                ? "Carregando cupons..."
                : `${filtrados.length.toLocaleString("pt-BR")} cupom(ns) encontrados`}
            </p>
            <Button onClick={exportarCsv} disabled={!filtrados.length} className="bg-ml-blue text-ml-blue-foreground hover:bg-ml-blue/90">
              Exportar CSV
            </Button>
          </div>
        </section>

        <section className="mt-4" aria-label="Cupons encontrados">
          {error ? (
            <Aviso titulo="Não foi possível carregar os cupons" texto="Tente atualizar a página em alguns instantes." />
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, indice) => (
                <div key={indice} className="h-56 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !cupons.length ? (
            <Aviso
              titulo="Nenhum cupom cadastrado ainda"
              texto="Assim que os cupons forem carregados, eles aparecem aqui automaticamente."
            />
          ) : !filtrados.length ? (
            <Aviso
              titulo="Nenhum resultado para esses filtros"
              texto="Tente outro vendedor ou ajuste os limites de desconto, teto e compra."
            />
          ) : (
            <>
              <div className="grid items-stretch gap-4 md:grid-cols-2">
                {visiveis.map((cupom) => (
                  <CupomCard key={cupom.id} cupom={cupom} abrirCondicoes={setCupomAberto} />
                ))}
              </div>

              {totalPaginas > 1 && (
                <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Paginação">
                  <Button
                    variant="outline"
                    onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
                    disabled={paginaAtual === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-secondary-ink">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
                    disabled={paginaAtual === totalPaginas}
                  >
                    Próxima
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>
      </main>

      <CondicoesModal cupom={cupomAberto} fechar={() => setCupomAberto(null)} />

      <footer className="mt-8 border-t border-border py-6">
        <p className="mx-auto max-w-6xl px-4 text-xs text-secondary-ink">
          Fotografia dos cupons, não é tempo real. Cupom é campanha do vendedor e pode acabar antes da validade.
        </p>
      </footer>
    </div>
  );
}

function CupomCard({
  cupom,
  abrirCondicoes,
}: {
  cupom: CupomIndexado;
  abrirCondicoes: (cupom: CupomIndexado) => void;
}) {
  const armadilha = cupom.qualidade === "armadilha";
  const rotuloQualidade = armadilha
    ? `CUIDADO · desconto para em ${formatarMoeda(cupom.teto)}`
    : `VALE A PENA · até ${formatarMoeda(cupom.teto)}`;

  return (
    <article
      className={cn(
        "flex min-h-56 flex-col rounded-lg border bg-card p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card",
        armadilha ? "border-danger" : "border-border",
      )}
    >
      <div className="flex min-h-10 items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 pt-1 text-xs text-secondary-ink">
          <Clock3 className="size-4 shrink-0" aria-hidden="true" />
          {cupom.vence ? `Vence em ${dataExtensa.format(dataDoBanco(cupom.vence))}` : "Validade não informada"}
        </p>
        <span
          className={cn(
            "max-w-[58%] rounded-sm px-2 py-1 text-right text-[10px] font-bold uppercase leading-4 sm:text-xs",
            armadilha ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
          )}
        >
          {rotuloQualidade}
        </span>
      </div>

      <div className="my-5 grid grid-cols-[minmax(110px,auto)_1fr] items-center gap-5">
        <p className="max-w-48 text-3xl font-extrabold leading-none sm:text-4xl">{cupom.desconto ?? "—"}</p>
        <div className="min-w-0 border-l border-border pl-5">
          <p className="text-sm text-secondary-ink">Em produtos de</p>
          <p className="mt-0.5 break-words font-semibold">{cupom.vendedor}</p>
          <a
            href={`https://www.mercadolivre.com.br/perfil/${encodeURIComponent(cupom.vendedor)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-semibold text-ml-blue hover:underline"
          >
            Ver produtos
          </a>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-secondary-ink">
        <Button
          variant="link"
          className="h-auto p-0 text-xs font-medium text-secondary-ink"
          onClick={() => abrirCondicoes(cupom)}
          aria-label={`Abrir condições do cupom ${cupom.desconto ?? cupom.id}`}
        >
          Condições do cupom <Info className="size-3.5" aria-hidden="true" />
        </Button>
        <span aria-hidden="true">|</span>
        <span>Orçamento restante: {formatarMoeda(cupom.orcamento)}</span>
      </div>
    </article>
  );
}

function CondicoesModal({ cupom, fechar }: { cupom: CupomIndexado | null; fechar: () => void }) {
  if (!cupom) return null;

  const validade = cupom.vence ? dataCurta.format(dataDoBanco(cupom.vence)) : "não informada";
  const texto = `ID ${cupom.id} - Cupom válido no Brasil, até ${validade}, incluindo ambas as datas, para compras de produtos realizadas no site e no aplicativo Mercado Livre. Válido apenas para os produtos selecionados e enquanto durarem os estoques. O cupom será aplicado automaticamente no carrinho elegível, sem necessidade de ativação pelo usuário. O cupom é aplicável apenas para compras mínimas de produtos selecionados cujo valor seja igual ou superior a ${formatarMoeda(cupom.compra_min)}. O cupom consiste em ${cupom.desconto ?? "desconto não informado"} sobre o valor da compra dos produtos selecionados. Não será aplicado sobre o custo de envio. O cupom é limitado a 1 (um) uso por CPF. Máximo de desconto de ${formatarMoeda(cupom.teto)}. Este cupom é de responsabilidade do vendedor dos produtos participantes.`;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border-border bg-card p-0 text-card-foreground shadow-modal sm:rounded-lg">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold">{cupom.desconto ?? "Condições do cupom"}</DialogTitle>
          <DialogDescription>Condições e limite real do desconto</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 pb-6 sm:px-6">
          <div className="divide-y divide-border rounded-lg border border-border bg-muted/50">
            <ResumoModal rotulo="Compra mínima" valor={formatarMoeda(cupom.compra_min)} />
            <ResumoModal rotulo="Teto de desconto" valor={formatarMoeda(cupom.teto)} destaque />
            <ResumoModal
              rotulo="Desconto real se a compra for de R$ 200"
              valor={formatarMoeda(descontoRealEm200(cupom))}
              destaque
            />
          </div>
          <p className="text-sm leading-6 text-secondary-ink">{texto}</p>
          <GeradorTexto cupom={cupom} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeradorTexto({ cupom }: { cupom: CupomIndexado }) {
  const [canal, setCanal] = useState<"WhatsApp" | "Instagram">("WhatsApp");
  const [resultado, setResultado] = useState("");
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro("");
    setResultado("");
    setCopiado(false);
    try {
      const resposta = await fetch("/api/public/gerar-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendedor: cupom.vendedor,
          desconto: cupom.desconto ?? "Desconto não informado",
          teto: cupom.teto,
          compra_min: cupom.compra_min,
          canal,
          qualidade: cupom.qualidade === "armadilha" ? "armadilha" : "bom",
        }),
      });
      const dados = (await resposta.json()) as { texto?: string; erro?: string };
      if (!resposta.ok || !dados.texto) throw new Error(dados.erro ?? "Não foi possível gerar o texto.");
      setResultado(dados.texto);
    } catch (motivo) {
      setErro(motivo instanceof Error ? motivo.message : "Não foi possível gerar o texto.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    const copiarModoCompativel = () => {
      const campo = document.createElement("textarea");
      campo.value = resultado;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      const copiou = document.execCommand("copy");
      campo.remove();
      return copiou;
    };
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(resultado);
        } catch {
          if (!copiarModoCompativel()) throw new Error("Falha ao copiar");
        }
      } else {
        if (!copiarModoCompativel()) throw new Error("Falha ao copiar");
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2_000);
    } catch {
      setErro("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <section className="border-t border-border pt-5" aria-label="Gerador de texto de venda">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo rotulo="Canal da mensagem">
          <select
            value={canal}
            onChange={(event) => {
              setCanal(event.target.value as typeof canal);
              setResultado("");
              setErro("");
            }}
            className="campo-filtro sm:min-w-44"
            aria-label="Canal da mensagem"
          >
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
          </select>
        </Campo>
        <Button
          type="button"
          onClick={gerar}
          disabled={gerando}
          className="bg-ml-blue text-ml-blue-foreground hover:bg-ml-blue/90 sm:mb-0 sm:w-auto"
        >
          <Sparkles aria-hidden="true" />
          {gerando ? "Gerando..." : "Gerar texto de venda"}
        </Button>
      </div>

      {erro && <p className="mt-3 rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger" role="alert">{erro}</p>}
      {resultado && (
        <div className="mt-3 rounded-lg border border-border bg-muted/50 p-4">
          <p className="whitespace-pre-line text-sm leading-6">{resultado}</p>
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={copiar}>
              {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ResumoModal({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-secondary-ink">{rotulo}</span>
      <strong className={cn("text-right text-sm", destaque && "text-ml-blue")}>{valor}</strong>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  tom,
}: {
  titulo: string;
  valor: string;
  tom?: Qualidade;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-secondary-ink">{titulo}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", tom === "bom" && "text-success", tom === "armadilha" && "text-danger")}>
        {valor}
      </p>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block min-h-8 text-xs leading-4 text-secondary-ink">{rotulo}</span>
      {children}
    </label>
  );
}

function InputNumero({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={valor}
      onChange={(event) => aoMudar(event.target.value)}
      placeholder="0"
      className="campo-filtro"
    />
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
      <p className="text-base font-semibold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-secondary-ink">{texto}</p>
    </div>
  );
}
