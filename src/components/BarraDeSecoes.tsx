import { useEffect, useRef, useState, type ReactNode } from "react";

/* NAVEGAÇÃO SOFT (design de 10/10, "Navegação soft — resultado da
   comparação"): barra de seções fixa logo abaixo do cabeçalho, com pílulas
   (Resumo, Lojas, Alternativas, 3 marketplaces, Dúvidas). A pílula ativa
   acompanha a seção visível; o toque leva até a seção com rolagem suave (sem
   movimento com "reduzir movimento"). No celular a barra rola na horizontal.
   Só aparecem as seções que existem neste resultado.
   23/10: as pílulas seguem a ordem em que as seções aparecem na tela (no PC
   "Dúvidas" vem antes dos 3 marketplaces; no celular, depois), e o trilho do
   celular esmaece a ponta que ainda tem pílulas escondidas. */

export type Secao = { id: string; nome: string; conta?: number | null };

/* Cabeçalho (56/60 px) + barra (52 px) + folga: o título da seção nunca fica
   escondido atrás deles. */
const LINHA_DE_LEITURA = 140;

/* inicio (24/10): o CEP do frete na mesma linha das pílulas (uma barra só
   antes do resultado). */
export function BarraDeSecoes({ secoes, inicio = null }: { secoes: Secao[]; inicio?: ReactNode }) {
  const [ativa, setAtiva] = useState<string | null>(secoes[0]?.id ?? null);
  const [ordem, setOrdem] = useState<string | null>(null);
  const [ponta, setPonta] = useState<"nenhuma" | "inicio" | "meio" | "fim">("nenhuma");
  const trilho = useRef<HTMLDivElement>(null);
  const ids = secoes.map((s) => s.id).join(",");

  /* Ordem visual: pela posição de cada seção na página (muda com a largura). */
  useEffect(() => {
    const ordenar = () => {
      const pos = ids
        .split(",")
        .map((id) => {
          const el = document.getElementById(id);
          const r = el?.getBoundingClientRect();
          return { id, y: r && r.height > 0 ? r.top + window.scrollY : Number.POSITIVE_INFINITY };
        })
        .sort((a, b) => a.y - b.y)
        .map((x) => x.id)
        .join(",");
      setOrdem((o) => (o === pos ? o : pos));
    };
    ordenar();
    const t = window.setTimeout(ordenar, 600);
    window.addEventListener("resize", ordenar);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", ordenar);
    };
  }, [ids]);

  /* Pontas do trilho: qual lado ainda tem pílulas fora da vista. */
  useEffect(() => {
    const caixa = trilho.current;
    if (!caixa) return;
    const medir = () => {
      const resto = caixa.scrollWidth - caixa.clientWidth;
      if (resto <= 2) return setPonta("nenhuma");
      const x = caixa.scrollLeft;
      setPonta(x <= 2 ? "inicio" : x >= resto - 2 ? "fim" : "meio");
    };
    medir();
    caixa.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      caixa.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [ids]);

  /* Depois de um toque, a pílula escolhida fica ativa até a rolagem suave
     terminar (a página pode não conseguir levar a seção até o topo). */
  const travadoAte = useRef(0);

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      if (Date.now() < travadoAte.current) return;
      const lista = ids
        .split(",")
        .map((id) => ({ id, r: document.getElementById(id)?.getBoundingClientRect() }))
        .filter((x): x is { id: string; r: DOMRect } => Boolean(x.r && x.r.height > 0));
      if (!lista.length) return;
      const fim = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const maisBaixa = (xs: typeof lista) => xs.reduce((a, b) => (b.r.top > a.r.top ? b : a)).id;
      let atual: string;
      if (fim) {
        const vistas = lista.filter(
          (x) => x.r.top < window.innerHeight && x.r.bottom > LINHA_DE_LEITURA,
        );
        atual = vistas.length ? maisBaixa(vistas) : lista[lista.length - 1]!.id;
      } else {
        const naLinha = lista.filter(
          (x) => x.r.top <= LINHA_DE_LEITURA && x.r.bottom > LINHA_DE_LEITURA,
        );
        const acima = lista.filter((x) => x.r.top <= LINHA_DE_LEITURA);
        atual = naLinha.length
          ? maisBaixa(naLinha)
          : acima.length
            ? maisBaixa(acima)
            : lista[0]!.id;
      }
      setAtiva(atual);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [ids]);

  /* A pílula ativa fica à vista no trilho do celular (só rolagem lateral do
     trilho; a página não se mexe). */
  useEffect(() => {
    const caixa = trilho.current;
    const el = caixa?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!caixa || !el) return;
    const esquerda = el.offsetLeft - 16;
    const direita = el.offsetLeft + el.offsetWidth + 16 - caixa.clientWidth;
    if (caixa.scrollLeft > esquerda) caixa.scrollLeft = esquerda;
    else if (caixa.scrollLeft < direita) caixa.scrollLeft = direita;
  }, [ativa]);

  if (secoes.length < 2) return null;
  const posicao = (ordem ?? ids).split(",");
  const visiveis = [...secoes].sort(
    (a, b) =>
      (posicao.indexOf(a.id) + 1 || Number.MAX_SAFE_INTEGER) -
      (posicao.indexOf(b.id) + 1 || Number.MAX_SAFE_INTEGER),
  );

  const ir = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    travadoAte.current = Date.now() + (reduzir ? 150 : 900);
    el.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
    setAtiva(id);
  };

  return (
    <div className="sticky top-14 z-20 -mx-4 mb-1 flex flex-col border-b border-slate-200/50 vidro-barra px-4 py-2 dark:border-white/10 sm:top-[60px] sm:-mx-5 sm:px-5 lg:flex-row lg:items-center lg:gap-4">
      {/* No celular o CEP fica fora da barra fixa (ela não cresce). */}
      {/* PC (25/10): as pílulas nunca encolhem (a última saía cortada em 1440 px); o CEP usa o resto. */}
      {inicio && <div className="hidden min-w-0 lg:block lg:flex-1">{inicio}</div>}
      <div
        ref={trilho}
        data-ponta={ponta}
        className="trilho-esmaece relative min-w-0 overflow-x-auto lg:ml-auto lg:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <nav
          aria-label="Seções do resultado"
          className="flex w-max gap-1 rounded-full bg-[#e9e9ee] p-1 dark:bg-white/10"
        >
          {visiveis.map((s) => {
            const atual = s.id === ativa;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => ir(s.id)}
                aria-current={atual ? "location" : undefined}
                className={
                  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transition-none " +
                  (atual
                    ? "bg-white text-[#0f1729] shadow-[0_1px_3px_rgba(15,23,41,0.14),0_0_0_0.5px_rgba(15,23,41,0.06)] dark:bg-white/90"
                    : "text-[#55555b] hover:text-[#0f1729] dark:text-white/70 dark:hover:text-white")
                }
              >
                {s.nome}
                {s.conta != null && s.conta > 0 && (
                  <span className="min-w-[18px] rounded-full bg-[#e4e4e9] px-1.5 py-px text-center text-[11px] text-[#3a3a40] dark:bg-white/20 dark:text-white">
                    {s.conta}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
