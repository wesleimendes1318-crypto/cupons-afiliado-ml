import { useId, useState, type FormEvent } from "react";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { ArrowRight, Check, Loader2, Search, Sparkles } from "lucide-react";

/* BUSCA GUIADA (05/10): para quem não tem o link. A pessoa escreve do jeito
   dela ("presente para menino de 8 anos até R$ 200"), o servidor entende o
   pedido, busca no catálogo oficial e devolve produtos com anúncio ativo.
   O botão abre a COMPARAÇÃO (nunca compra direto): o link de afiliado sai
   dela, com as regras de sempre. Visual do site (Weslei, 05/10: "mantenha
   clean... devolva a identidade do site"): cartão branco, cinza #f5f5f7 e
   azul #0071e3. Os textos não citam IA. */

type Resultado = {
  produto: string;
  item: string;
  nome: string;
  imagem: string | null;
  preco: number | null;
  url: string;
};

type Resposta = {
  resumo: string;
  buscas: string[];
  resultados: Resultado[];
  enfileirados: number;
};

export type ContextoBusca = "home" | "natal" | "criancas";

const SUGESTOES: Record<ContextoBusca, string[]> = {
  home: [
    "Air fryer boa e econômica",
    "Fone bluetooth com cancelamento de ruído",
    "Presente até R$ 200 para menino de 8 anos",
    "Perfume masculino amadeirado",
    "Aspirador vertical para apartamento",
  ],
  natal: [
    "Presente de Natal para mãe até R$ 150",
    "Amigo secreto até R$ 50",
    "Caixa de som para presente",
    "Kit de perfume feminino",
    "Smartwatch para presente",
  ],
  criancas: [
    "Brinquedo educativo para 3 anos",
    "LEGO até R$ 200",
    "Boneca para 5 anos",
    "Carrinho de controle remoto",
    "Bicicleta infantil aro 16",
  ],
};

const TITULOS: Record<ContextoBusca, { linha1: string; linha2: string; apoio: string }> = {
  home: {
    linha1: "Não tem o link?",
    linha2: "Me diga o que procura.",
    apoio: "Escreva do seu jeito. Eu acho o produto e comparo o preço em outras lojas.",
  },
  natal: {
    linha1: "Procurando presente?",
    linha2: "Me diga para quem.",
    apoio: "Diga a pessoa, o estilo e quanto quer gastar. Eu acho e comparo o preço.",
  },
  criancas: {
    linha1: "Qual brinquedo?",
    linha2: "Me diga a idade.",
    apoio: "Diga a idade, o que a criança gosta e quanto quer gastar. Eu acho e comparo.",
  },
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BuscaGuiada({
  contexto = "home",
  naHome = false,
  className = "",
}: {
  contexto?: ContextoBusca;
  naHome?: boolean;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const idCampo = useId();
  const textos = TITULOS[contexto];

  async function buscar(texto: string) {
    const pergunta = texto.trim();
    if (pergunta.length < 2 || carregando) return;
    setQ(pergunta);
    setCarregando(true);
    setErro(null);
    setResposta(null);
    try {
      const r = await fetch("/api/public/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: pergunta, contexto }),
      });
      const j = (await r.json()) as Resposta & { erro?: string };
      if (!r.ok || j.erro) setErro(j.erro ?? "A busca não respondeu agora. Tente de novo.");
      else setResposta(j);
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void buscar(q);
  }

  function comparar(url: string) {
    if (naHome) {
      window.dispatchEvent(new CustomEvent("comparar-link", { detail: url }));
    } else {
      window.location.href = `/?link=${encodeURIComponent(url)}`;
    }
  }

  return (
    <section
      aria-labelledby={`${idCampo}-titulo`}
      data-origem={`busca_${contexto}`}
      className={`rounded-3xl border border-border bg-card shadow-sm ${className}`}
    >
      <div className="p-5 sm:p-7">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0058b0]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Busca guiada
          </p>
          <h2
            id={`${idCampo}-titulo`}
            className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"
          >
            {textos.linha1} <span className="text-[#0071e3]">{textos.linha2}</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-secondary-ink">{textos.apoio}</p>

          <form onSubmit={enviar} className="mt-4 flex max-w-xl gap-2" role="search">
            <label htmlFor={idCampo} className="sr-only">
              O que você procura?
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#86868b]"
                aria-hidden="true"
              />
              <input
                id={idCampo}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={160}
                placeholder="Ex.: fone bluetooth até R$ 300"
                className="h-12 w-full rounded-full border border-transparent bg-[#f5f5f7] pl-10 pr-4 text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus-visible:border-[#0071e3] focus-visible:ring-4 focus-visible:ring-[#0071e3]/20"
              />
            </div>
            <button
              type="submit"
              disabled={carregando || q.trim().length < 2}
              className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-[#0071e3] px-5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
            >
              {carregando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="size-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Buscar</span>
              <span className="sr-only sm:hidden">Buscar</span>
            </button>
          </form>

          <ul className="mt-3 flex max-w-2xl flex-wrap gap-2" aria-label="Sugestões de busca">
            {SUGESTOES[contexto].map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => void buscar(s)}
                  disabled={carregando}
                  className="rounded-full border border-border bg-[#f5f5f7] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-[#e8e8ed] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div aria-live="polite">
        {carregando && (
          <div className="px-5 pb-6 sm:px-7">
            <p className="text-sm text-secondary-ink">Procurando os produtos certos para você…</p>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((k) => (
                <li key={k} className="h-56 animate-pulse rounded-2xl bg-[#f5f5f7]" />
              ))}
            </ul>
          </div>
        )}

        {erro && !carregando && (
          <p className="mx-5 mb-6 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm sm:mx-7">{erro}</p>
        )}

        {resposta && !carregando && (
          <div className="px-5 pb-6 sm:px-7">
            {resposta.resumo && <p className="text-sm text-secondary-ink">{resposta.resumo}</p>}
            {resposta.resultados.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm">
                Não achei um produto com anúncio ativo para essa busca. Tente com outras palavras ou
                cole o link do produto acima.
              </p>
            ) : (
              <>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {resposta.resultados.map((r) => (
                    <li
                      key={r.produto}
                      className="campanha-cartao flex flex-col overflow-hidden rounded-2xl border border-border bg-white text-[#1d1d1f]"
                    >
                      <div className="relative grid h-28 place-items-center overflow-hidden bg-[#f5f5f7] sm:h-32">
                        {r.imagem ? (
                          <img
                            src={r.imagem}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-contain p-2 mix-blend-multiply"
                          />
                        ) : (
                          <Search className="size-6 text-[#86868b]" aria-hidden="true" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <p className="line-clamp-3 text-[13px] font-semibold leading-snug">
                          {r.nome}
                        </p>
                        {r.preco ? (
                          <p className="mt-2 text-[11px] text-[#6e6e73]">
                            Anúncio de referência
                            <span className="block text-base font-extrabold tabular-nums text-[#1d1d1f]">
                              {brl(r.preco)}
                            </span>
                          </p>
                        ) : null}
                        <div className="mt-auto space-y-1.5 pt-3">
                          {/* Direto para a oferta (Weslei, 05/10): o link de
                              afiliado é gerado no clique. */}
                          <VerNaLoja url={r.url} grande />
                          <button
                            type="button"
                            onClick={() => comparar(r.url)}
                            className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#0071e3]/40 px-2 py-1.5 text-xs font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                          >
                            Comparar preço
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-secondary-ink">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                  Preço de um anúncio do catálogo agora. "Comparar preço" confere o mesmo produto em
                  outras lojas antes de você comprar
                  {resposta.enfileirados > 0
                    ? "; os primeiros também passam pela comparação completa e, se valerem a pena, entram na vitrine."
                    : "."}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
