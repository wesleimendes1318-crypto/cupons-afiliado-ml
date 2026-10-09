/* BUSCA POR FOTO (Weslei, 09/10): botão de câmera junto do campo do link
   (no celular abre a câmera traseira) e o painel com o que foi achado. A
   compra sai sempre da comparação (link de afiliado), nunca daqui. */
import { useRef } from "react";
import { Camera, LoaderCircle, X } from "lucide-react";

import type { EstadoFoto } from "@/lib/busca-foto-cliente";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BotaoFoto({
  aoEscolher,
  ocupado,
}: {
  aoEscolher: (arquivo: File) => void;
  ocupado: boolean;
}) {
  const campo = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => campo.current?.click()}
        disabled={ocupado}
        aria-label="Buscar pela foto do produto"
        title="Buscar pela foto do produto"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-[#7547E8] transition hover:border-[#7547E8] hover:bg-[#F7F5FC] disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
      >
        {ocupado ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Camera className="size-5" aria-hidden="true" />
        )}
      </button>
      <input
        ref={campo}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) aoEscolher(arquivo);
        }}
      />
    </>
  );
}

export function PainelFoto({
  estado,
  comparar,
  fechar,
}: {
  estado: EstadoFoto;
  comparar: (url: string) => void;
  fechar: () => void;
}) {
  if (estado.fase === "parado") return null;
  if (estado.fase === "lendo")
    return (
      <p
        className="mt-3 flex items-center gap-2 rounded-2xl bg-[#F7F5FC] px-3 py-2.5 text-sm text-[#21134A] dark:bg-white/5 dark:text-foreground"
        aria-live="polite"
      >
        <LoaderCircle className="size-4 animate-spin text-[#7547E8]" aria-hidden="true" />
        Identificando o produto pela foto…
      </p>
    );
  if (estado.fase === "erro")
    return (
      <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <p>{estado.mensagem}</p>
        <button type="button" onClick={fechar} aria-label="Fechar aviso" className="shrink-0">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  return (
    <section
      aria-label="Produtos achados pela foto"
      className="mt-3 rounded-2xl border border-border bg-[#f5f5f7] p-3 dark:bg-white/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Qual destes é o seu?</p>
          {estado.identificado && (
            <p className="text-xs text-secondary-ink">
              Pela foto: {estado.identificado.produto}. Confira o modelo antes de comparar.
            </p>
          )}
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar" className="shrink-0 p-1">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {estado.candidatos.map((c) => (
          <li
            key={c.produto}
            className="flex items-center gap-3 rounded-2xl bg-card p-2.5 shadow-sm"
          >
            <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-white">
              {c.imagem && (
                <img
                  src={c.imagem}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-xs font-semibold leading-snug">{c.nome}</span>
              {c.preco != null && (
                <span className="block text-[11px] text-secondary-ink">
                  Anúncio de referência: {brl(c.preco)}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => comparar(c.url)}
              className="shrink-0 rounded-full bg-[#0071e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
            >
              Comparar este
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-secondary-ink">
        Nenhum destes? Tente outra foto, com o nome ou o modelo visível, ou cole o link do anúncio.
      </p>
    </section>
  );
}
