/* BUSCA POR FOTO (Weslei, 09/10): botão de câmera junto do campo do link.
   Ao tocar, a pessoa escolhe "Tirar foto" (câmera traseira, só em tela de
   toque) ou "Escolher da galeria"; vê a prévia e só então consente o envio
   ("Usar esta foto"). Depois, o painel com o que foi achado. A compra sai
   sempre da comparação (link de afiliado), nunca daqui. */
import { useState, type ChangeEvent, type ReactNode } from "react";
import { Camera, ImageIcon, LoaderCircle, Lock, X } from "lucide-react";

import type { EstadoFoto } from "@/lib/busca-foto-cliente";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BotaoFoto({
  aoTocar,
  aberto,
  ocupado,
}: {
  aoTocar: () => void;
  /* Escolha da origem ou confirmação na tela. */
  aberto: boolean;
  ocupado: boolean;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      disabled={ocupado}
      aria-expanded={aberto}
      aria-controls="painel-busca-foto"
      aria-label="Buscar pela foto do produto"
      title="Buscar pela foto do produto"
      className={
        "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border bg-card text-[#7547E8] transition hover:border-[#7547E8] hover:bg-[#F7F5FC] disabled:cursor-not-allowed disabled:opacity-60 sm:self-start " +
        (aberto ? "border-[#7547E8] bg-[#F7F5FC]" : "border-border")
      }
    >
      {ocupado ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <Camera className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}

/* Tela de toque: câmera e galeria. No PC, "Tirar foto" só abriria o mesmo
   seletor de arquivos, então fica só a imagem do computador. */
function telaDeToque() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
}

const AVISO_PRIVACIDADE =
  "A foto só é enviada depois que você confirmar. Ela serve só para achar o produto e não fica guardada.";

function OpcaoArquivo({
  icone,
  texto,
  camera,
  aoEscolher,
}: {
  icone: ReactNode;
  texto: string;
  camera: boolean;
  aoEscolher: (arquivo: File) => void;
}) {
  const mudou = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) aoEscolher(arquivo);
  };
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-[#21134A] shadow-sm transition focus-within:ring-2 focus-within:ring-[#7547E8]/40 hover:border-[#7547E8] dark:text-foreground">
      {icone}
      {texto}
      <input
        type="file"
        accept="image/*"
        {...(camera ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={mudou}
      />
    </label>
  );
}

function Previa({ src }: { src: string }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className="relative block size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
      {falhou ? (
        <ImageIcon
          className="absolute inset-0 m-auto size-8 text-secondary-ink"
          aria-hidden="true"
        />
      ) : (
        <img
          src={src}
          alt="Prévia da foto escolhida"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFalhou(true)}
        />
      )}
    </span>
  );
}

export function PainelFoto({
  estado,
  comparar,
  fechar,
  abrir,
  escolher,
  consentir,
}: {
  estado: EstadoFoto;
  comparar: (url: string) => void;
  fechar: () => void;
  abrir: () => void;
  escolher: (arquivo: File) => void;
  consentir: () => void;
}) {
  if (estado.fase === "parado") return null;
  if (estado.fase === "origem") {
    const toque = telaDeToque();
    return (
      <section
        id="painel-busca-foto"
        aria-label="Buscar pela foto do produto"
        className="mt-3 rounded-2xl border border-border bg-[#f5f5f7] p-3 dark:bg-white/5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">Buscar pela foto do produto</p>
            <p className="text-xs text-secondary-ink">
              {toque
                ? "Tire uma foto agora ou escolha uma da galeria."
                : "Escolha uma foto do produto no seu computador."}
            </p>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="shrink-0 p-1">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className={"mt-2 grid gap-2 " + (toque ? "grid-cols-2" : "sm:max-w-xs")}>
          {toque && (
            <OpcaoArquivo
              camera
              icone={<Camera className="size-5 text-[#7547E8]" aria-hidden="true" />}
              texto="Tirar foto"
              aoEscolher={escolher}
            />
          )}
          <OpcaoArquivo
            camera={false}
            icone={<ImageIcon className="size-5 text-[#7547E8]" aria-hidden="true" />}
            texto={toque ? "Da galeria" : "Escolher imagem"}
            aoEscolher={escolher}
          />
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-secondary-ink">
          <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
          {AVISO_PRIVACIDADE}
        </p>
      </section>
    );
  }
  if (estado.fase === "confirmar")
    return (
      <section
        id="painel-busca-foto"
        aria-label="Confirmar a foto"
        className="mt-3 rounded-2xl border border-border bg-[#f5f5f7] p-3 dark:bg-white/5"
      >
        <div className="flex items-start gap-3">
          <Previa src={estado.previa} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Usar esta foto?</p>
            <p className="mt-0.5 text-xs text-secondary-ink">
              Ela é enviada só para identificar o produto e não fica guardada.
            </p>
          </div>
          <button type="button" onClick={fechar} aria-label="Cancelar" className="shrink-0 p-1">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={consentir}
            className="min-h-11 flex-1 whitespace-nowrap rounded-full bg-[#0071e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110 sm:flex-none"
          >
            Usar esta foto
          </button>
          <button
            type="button"
            onClick={abrir}
            className="min-h-11 flex-1 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-[#7547E8] sm:flex-none"
          >
            Escolher outra
          </button>
        </div>
      </section>
    );
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
