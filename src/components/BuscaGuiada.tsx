import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, Search, Sparkles } from "lucide-react";

/* BUSCA GUIADA (05/10): para quem não tem o link. A pessoa escreve do jeito
   dela ("presente para menino de 8 anos até R$ 200"), o servidor entende o
   pedido, busca no catálogo oficial e devolve produtos com anúncio ativo.
   O botão abre a COMPARAÇÃO (nunca compra direto): o link de afiliado sai
   dela, com as regras de sempre. Identidade da marca (modelo de arte do
   Weslei, 05/10): degradê roxo/violeta, destaque verde-menta, "Antes de
   comprar, compare.". Os textos não citam IA. */

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

/* Arte da marca: pedestais roxos com produtos (fone e tênis) e o cartão de
   comparação com os ✓ em menta. Só decoração (aria-hidden). */
function ArteMarca({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9b6bff" />
          <stop offset="1" stopColor="#4b1fb0" />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9b5ff" />
          <stop offset="1" stopColor="#7b4dff" />
        </linearGradient>
        <radialGradient id={`${id}l`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="110" r="110" fill={`url(#${id}l)`} />
      {/* pedestal esquerdo + fone */}
      <ellipse cx="78" cy="196" rx="54" ry="12" fill="#2a0f6e" />
      <rect x="24" y="160" width="108" height="36" fill={`url(#${id}p)`} />
      <ellipse cx="78" cy="160" rx="54" ry="12" fill="#b293ff" />
      <g className="campanha-flutua">
        <path
          d="M50 128 a28 30 0 0 1 56 0"
          fill="none"
          stroke={`url(#${id}t)`}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <rect x="40" y="120" width="20" height="30" rx="9" fill="#e9e1ff" />
        <rect x="96" y="120" width="20" height="30" rx="9" fill="#e9e1ff" />
      </g>
      {/* pedestal direito + tênis */}
      <ellipse cx="246" cy="200" rx="58" ry="12" fill="#2a0f6e" />
      <rect x="188" y="166" width="116" height="34" fill={`url(#${id}p)`} />
      <ellipse cx="246" cy="166" rx="58" ry="12" fill="#b293ff" />
      <g className="campanha-flutua campanha-atraso-1">
        <path d="M204 152 q4 -22 22 -24 q8 10 22 10 q18 2 34 12 q6 4 2 8 h-76 z" fill="#f4f0ff" />
        <path d="M200 156 h86 v6 h-86 z" fill="#5ef2b5" />
        <path d="M228 134 l6 8 M238 136 l5 8" stroke="#7b4dff" strokeWidth="2.5" />
      </g>
      {/* cartão de comparação */}
      <g className="campanha-balanca">
        <rect x="120" y="22" width="92" height="86" rx="14" fill="#ffffff" opacity="0.96" />
        {[44, 66, 88].map((y) => (
          <g key={y}>
            <circle cx="138" cy={y} r="7" fill="#5ef2b5" />
            <path
              d={`M134.5 ${y} l2.5 2.5 l4.5 -5`}
              fill="none"
              stroke="#0e5c3f"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <rect x="152" y={y - 4} width="48" height="8" rx="4" fill="#e3dafc" />
          </g>
        ))}
      </g>
      <g className="campanha-cintila" fill="#ffffff">
        <circle cx="30" cy="40" r="2" />
        <circle cx="292" cy="54" r="2.5" />
        <circle cx="240" cy="22" r="1.6" />
      </g>
    </svg>
  );
}

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
      className={`relative overflow-hidden rounded-3xl text-white shadow-[0_20px_60px_-30px_rgba(60,20,160,0.7)] ${className}`}
      style={{
        background:
          "radial-gradient(120% 90% at 85% 10%, #8b5cff 0%, rgba(139,92,255,0) 55%), linear-gradient(135deg, #1d0b52 0%, #3b16a3 55%, #5a2bd8 100%)",
      }}
    >
      <div className="relative grid gap-4 p-5 sm:p-7 md:grid-cols-[1fr_260px] md:items-center lg:grid-cols-[1fr_320px]">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#5ef2b5]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Busca guiada
          </p>
          <h2
            id={`${idCampo}-titulo`}
            className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"
          >
            {textos.linha1} <span className="text-[#5ef2b5]">{textos.linha2}</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/80">{textos.apoio}</p>

          <form onSubmit={enviar} className="mt-4 flex max-w-xl gap-2" role="search">
            <label htmlFor={idCampo} className="sr-only">
              O que você procura?
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#5a2bd8]"
                aria-hidden="true"
              />
              <input
                id={idCampo}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={160}
                placeholder="Ex.: fone bluetooth até R$ 300"
                className="h-12 w-full rounded-full border-0 bg-white pl-10 pr-4 text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5ef2b5]/60"
              />
            </div>
            <button
              type="submit"
              disabled={carregando || q.trim().length < 2}
              className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-[#5ef2b5] px-5 text-sm font-extrabold text-[#0b3b2a] transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
                  className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5ef2b5]"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <ArteMarca className="hidden w-full md:block" />
      </div>

      <div aria-live="polite" className="relative">
        {carregando && (
          <div className="px-5 pb-6 sm:px-7">
            <p className="text-sm text-white/80">Procurando os produtos certos para você…</p>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((k) => (
                <li key={k} className="h-56 animate-pulse rounded-2xl bg-white/10" />
              ))}
            </ul>
          </div>
        )}

        {erro && !carregando && (
          <p className="mx-5 mb-6 rounded-2xl bg-white/10 px-4 py-3 text-sm sm:mx-7">{erro}</p>
        )}

        {resposta && !carregando && (
          <div className="px-5 pb-6 sm:px-7">
            {resposta.resumo && <p className="text-sm text-white/90">{resposta.resumo}</p>}
            {resposta.resultados.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-white/10 px-4 py-3 text-sm">
                Não achei um produto com anúncio ativo para essa busca. Tente com outras palavras ou
                cole o link do produto acima.
              </p>
            ) : (
              <>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {resposta.resultados.map((r) => (
                    <li
                      key={r.produto}
                      className="campanha-cartao flex flex-col overflow-hidden rounded-2xl bg-white text-[#1d1d1f]"
                    >
                      <div className="flex h-32 items-center justify-center bg-[#f5f5f7] p-2 sm:h-36">
                        {r.imagem ? (
                          <img
                            src={r.imagem}
                            alt=""
                            loading="lazy"
                            className="max-h-full max-w-full object-contain mix-blend-multiply"
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
                        <div className="mt-auto pt-3">
                          <button
                            type="button"
                            onClick={() => comparar(r.url)}
                            className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#5a2bd8] px-2 py-2 text-xs font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5a2bd8]"
                          >
                            Comparar preço
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-white/75">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#5ef2b5]" aria-hidden="true" />
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
