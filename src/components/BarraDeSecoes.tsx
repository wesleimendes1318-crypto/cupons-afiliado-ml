import { useEffect, useRef, useState } from "react";

/* NAVEGAÇÃO SOFT (design de 10/10, "Navegação soft — resultado da
   comparação"): barra de seções fixa logo abaixo do cabeçalho, com pílulas
   (Resumo, Lojas, Alternativas, 3 marketplaces, Dúvidas). A pílula ativa
   acompanha a seção visível; o toque leva até a seção com rolagem suave (sem
   movimento com "reduzir movimento"). No celular a barra rola na horizontal.
   Só aparecem as seções que existem neste resultado. */

export type Secao = { id: string; nome: string; conta?: number | null };

/* Cabeçalho (56/60 px) + barra (52 px) + folga: o título da seção nunca fica
   escondido atrás deles. */
const LINHA_DE_LEITURA = 140;

export function BarraDeSecoes({ secoes }: { secoes: Secao[] }) {
  const [ativa, setAtiva] = useState<string | null>(secoes[0]?.id ?? null);
  const trilho = useRef<HTMLDivElement>(null);
  const ids = secoes.map((s) => s.id).join(",");

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

  const ir = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    travadoAte.current = Date.now() + (reduzir ? 150 : 900);
    el.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
    setAtiva(id);
  };

  return (
    <div className="sticky top-14 z-20 -mx-4 mb-1 bg-white/90 px-4 py-2 backdrop-blur-xl dark:bg-neutral-950/90 sm:top-[60px] sm:-mx-5 sm:px-5">
      <div
        ref={trilho}
        className="relative overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <nav
          aria-label="Seções do resultado"
          className="flex w-max gap-1 rounded-full bg-[#e9e9ee] p-1 dark:bg-white/10"
        >
          {secoes.map((s) => {
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
