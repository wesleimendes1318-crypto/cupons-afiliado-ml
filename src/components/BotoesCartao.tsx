/* RODAPÉ PADRÃO DOS CARTÕES (Weslei, 25/10: "preciso que mantenha esse
   padrão"; alguns cartões não tinham "Comparar preço"): em toda vitrine,
   "Comprar com segurança" largo (link de afiliado) e "Comparar preço" logo
   abaixo, no mesmo desenho dos Mais vendidos. */
import { Link } from "@tanstack/react-router";
import { ArrowRight, BellRing, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { acompanharPorLink, marcarParaDepois } from "@/lib/acompanhar-cartao";

/* 27/10: escudo e brilho sutil (botao-seguro, styles.css). */
const CLASSE_COMPRAR =
  "botao-seguro inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-success py-2.5 text-center text-sm font-bold text-white hover:brightness-95";

export function ComprarComSeguranca({ link, origem }: { link: string; origem: string }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-origem={origem}
      className={CLASSE_COMPRAR}
    >
      <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
      Comprar com segurança ↗
    </a>
  );
}

/* Na tela inicial abre a comparação ali mesmo; fora dela, pelo endereço. */
export function abrirComparacao(url: string) {
  if (window.location.pathname === "/")
    window.dispatchEvent(new CustomEvent("comparar-link", { detail: url }));
  else window.location.href = `/?link=${encodeURIComponent(url)}`;
}

export function CompararPreco({
  url,
  onComparar,
}: {
  url: string;
  onComparar?: (url: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => (onComparar ? onComparar(url) : abrirComparacao(url))}
      className="inline-flex min-w-0 flex-1 w-full items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#0071e3]/40 px-2 py-1.5 text-xs font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
    >
      Comparar preço
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/* SINO NO CARTÃO (Weslei, 04/11): "Comparar preço" e, ao lado, o sino que
   acompanha o preço com 1 toque. Sem comparação pronta, compara primeiro e o
   resultado salva sozinho (src/lib/acompanhar-cartao.ts). */
export function LinhaComparar({
  url,
  titulo,
  onComparar,
}: {
  url: string;
  titulo?: string;
  onComparar?: (url: string) => void;
}) {
  const [estado, setEstado] = useState<"parado" | "salvando" | "ok" | "erro">("parado");
  const [texto, setTexto] = useState<string | null>(null);
  const comparar = onComparar ?? abrirComparacao;

  async function seguir() {
    if (estado === "salvando" || estado === "ok") return;
    setEstado("salvando");
    const r = await acompanharPorLink(url);
    if (r.ok) {
      setEstado("ok");
      setTexto(null);
      return;
    }
    if (r.motivo === "comparar") {
      marcarParaDepois(url);
      setEstado("parado");
      comparar(url);
      return;
    }
    setEstado("erro");
    setTexto(r.texto);
  }

  const rotulo =
    estado === "ok"
      ? "Acompanhando o preço"
      : `Acompanhar preço${titulo ? `: ${titulo}` : ""}`;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <CompararPreco url={url} onComparar={comparar} />
        <button
          type="button"
          onClick={() => void seguir()}
          aria-label={rotulo}
          title={estado === "ok" ? "Acompanhando: veja em Meus preços" : "Acompanhar preço"}
          aria-pressed={estado === "ok"}
          className={
            "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
            (estado === "ok"
              ? "border-[#34c759] bg-[#34c759] text-white"
              : "border-[#0071e3]/40 text-[#0058b0] hover:bg-[#f5f5f7]")
          }
        >
          {estado === "salvando" ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : estado === "ok" ? (
            <Check className="size-4 sino-ok" aria-hidden="true" />
          ) : (
            <BellRing className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
      <p aria-live="polite" className="min-h-0 text-center text-[11px] leading-tight">
        {estado === "ok" ? (
          <Link to="/meus-precos" className="mt-1 inline-block font-semibold text-[#0058b0] hover:underline">
            Acompanhando · ver em Meus preços
          </Link>
        ) : estado === "erro" && texto ? (
          <span className="mt-1 inline-block text-destructive">{texto}</span>
        ) : null}
      </p>
    </div>
  );
}
