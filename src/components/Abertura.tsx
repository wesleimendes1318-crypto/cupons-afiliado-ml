/* ABERTURAS (Weslei, 23/10: "invista na melhoria de navegação, detalhes,
   aberturas, precisa ser profissional e bem completo"). Um só jeito de abrir
   e fechar conteúdo no resultado: botão com seta que gira, área que cresce
   com animação suave (grid 0fr -> 1fr, sem medir altura), aria-expanded /
   aria-controls, Esc fecha e devolve o foco ao botão, e o conteúdo aberto
   abaixo da tela é trazido para a vista. Com "reduzir movimento", abre na
   hora. O conteúdo só é montado na primeira abertura (não pesa a tela) e
   continua montado depois (fechar também anima). */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

export type EstadoAbertura = {
  aberto: boolean;
  montado: boolean;
  alternar: () => void;
  fechar: () => void;
  idBotao: string;
  idRegiao: string;
  botao: React.RefObject<HTMLButtonElement | null>;
};

const reduzirMovimento = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

export function useAbertura(padrao = false): EstadoAbertura {
  const [aberto, setAberto] = useState(padrao);
  const [montado, setMontado] = useState(padrao);
  const base = useId();
  const botao = useRef<HTMLButtonElement | null>(null);
  const alternar = useCallback(() => {
    setMontado(true);
    setAberto((x) => !x);
  }, []);
  const fechar = useCallback(() => setAberto(false), []);
  return {
    aberto,
    montado,
    alternar,
    fechar,
    idBotao: `${base}-botao`,
    idRegiao: `${base}-regiao`,
    botao,
  };
}

/* link: azul, como texto ("Ver detalhes do produto").
   pilula: cinza arredondado ("Ver análise completa").
   linha: largura inteira, rótulo à esquerda e seta à direita. */
export type EstiloAbertura = "link" | "pilula" | "linha";

const ESTILOS: Record<EstiloAbertura, string> = {
  link: "inline-flex min-h-8 items-center gap-1 rounded-md text-left text-xs font-semibold text-ml-blue hover:underline",
  pilula:
    "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-3.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-[#e8e8ed] dark:hover:bg-white/15",
  linha:
    "flex min-h-11 w-full items-center justify-between gap-3 text-left text-[13px] font-semibold text-foreground",
};

export function BotaoAbertura({
  a,
  rotulo,
  rotuloAberto,
  estilo = "link",
  icone = null,
  contagem = null,
  className = "",
}: {
  a: EstadoAbertura;
  rotulo: ReactNode;
  rotuloAberto?: ReactNode;
  estilo?: EstiloAbertura;
  icone?: ReactNode;
  contagem?: number | null;
  className?: string;
}) {
  return (
    <button
      ref={a.botao}
      id={a.idBotao}
      type="button"
      onClick={a.alternar}
      aria-expanded={a.aberto}
      aria-controls={a.idRegiao}
      className={
        ESTILOS[estilo] +
        " focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
        className
      }
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {icone}
        <span className="min-w-0">{a.aberto && rotuloAberto != null ? rotuloAberto : rotulo}</span>
        {contagem != null && contagem > 0 && (
          <span className="rounded-full bg-black/[0.06] px-1.5 py-px text-[10px] font-semibold tabular-nums text-secondary-ink dark:bg-white/15">
            {contagem}
          </span>
        )}
      </span>
      <ChevronDown
        aria-hidden="true"
        className={
          "size-3.5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none " +
          (a.aberto ? "rotate-180" : "")
        }
      />
    </button>
  );
}

export function RegiaoAbertura({
  a,
  children,
  className = "",
}: {
  a: EstadoAbertura;
  children: ReactNode;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement | null>(null);
  /* Durante a animação o conteúdo fica cortado; aberto e parado, nada corta
     (sombras e o contorno de foco dos botões aparecem inteiros). */
  const [animando, setAnimando] = useState(false);
  /* Só anima quando o estado muda de verdade (no modo de desenvolvimento o
     efeito roda duas vezes na montagem). */
  const anterior = useRef(a.aberto);
  useEffect(() => {
    if (anterior.current === a.aberto) return;
    anterior.current = a.aberto;
    if (reduzirMovimento()) {
      setAnimando(false);
      if (a.aberto) trazerParaVista(caixa.current, false);
      return;
    }
    setAnimando(true);
    /* Reserva: se o fim da transição não chegar (aba oculta), solta igual. */
    const t = window.setTimeout(() => {
      setAnimando(false);
      if (a.aberto) trazerParaVista(caixa.current, true);
    }, 360);
    return () => window.clearTimeout(t);
  }, [a.aberto]);

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && a.aberto) {
      e.stopPropagation();
      a.fechar();
      a.botao.current?.focus();
    }
  };

  return (
    <div
      ref={caixa}
      id={a.idRegiao}
      inert={!a.aberto}
      onKeyDown={teclas}
      className={
        "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none " +
        (a.aberto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
      }
    >
      <div className={"min-h-0 " + (!a.aberto || animando ? "overflow-hidden" : "")}>
        {a.montado && <div className={className}>{children}</div>}
      </div>
    </div>
  );
}

/* Abriu e o começo do conteúdo ficou abaixo da tela (ou quase): rola só o
   necessário para ele aparecer. Nunca rola para cima. */
function trazerParaVista(el: HTMLElement | null, suave: boolean) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const alto = window.innerHeight;
  if (r.top > alto - 96) {
    el.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "nearest" });
  }
}

/* Botão + região juntos (o caso comum). */
export function Abertura({
  rotulo,
  rotuloAberto,
  children,
  estilo = "link",
  padrao = false,
  icone = null,
  contagem = null,
  acao = null,
  className = "",
  classeConteudo = "",
}: {
  rotulo: ReactNode;
  rotuloAberto?: ReactNode;
  children: ReactNode;
  estilo?: EstiloAbertura;
  padrao?: boolean;
  icone?: ReactNode;
  contagem?: number | null;
  /* Ação ao lado do botão (ex.: "Comprar com segurança"). */
  acao?: ReactNode;
  className?: string;
  classeConteudo?: string;
}) {
  const a = useAbertura(padrao);
  return (
    <div className={className}>
      {acao ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BotaoAbertura
            a={a}
            rotulo={rotulo}
            rotuloAberto={rotuloAberto}
            estilo={estilo}
            icone={icone}
            contagem={contagem}
          />
          {acao}
        </div>
      ) : (
        <BotaoAbertura
          a={a}
          rotulo={rotulo}
          rotuloAberto={rotuloAberto}
          estilo={estilo}
          icone={icone}
          contagem={contagem}
        />
      )}
      <RegiaoAbertura a={a} className={classeConteudo}>
        {children}
      </RegiaoAbertura>
    </div>
  );
}
