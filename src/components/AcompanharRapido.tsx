/* ACOMPANHAR NOS CARTÕES (Weslei, 04/11): o sino ao lado de "Detalhes"
   abre um painel com o produto, o preço e o preço-alvo (sugestão de 10%
   abaixo ou "Qualquer queda"). O cartão manda só a chave: o banco
   (acompanhar_da_vitrine) pega título, preço e o link de afiliado. Sem
   conta, convida a entrar com o e-mail para receber o aviso. */
import { Link } from "@tanstack/react-router";
import { BellRing, Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { erroDoAcompanhar } from "@/components/AcompanharPreco";
import { ConviteConta } from "@/components/ConviteConta";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/auth-otp";
import { idDoNavegador } from "@/lib/navegador";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Produto = { chave: string; titulo: string; imagem: string | null; preco: number | null };

export function AcompanharRapido(p: Produto) {
  const [aberto, setAberto] = useState(false);
  if (!p.chave) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-7 items-center gap-1 text-[11px] font-semibold text-[#0058b0] hover:underline focus-visible:outline-2 focus-visible:outline-[#0071e3]"
        aria-label={`Acompanhar preço: ${p.titulo}`}
      >
        <BellRing className="size-3.5" aria-hidden="true" />
        Acompanhar
      </button>
      {/* Painel só existe aberto: cem cartões não leem a sessão à toa. */}
      {aberto && <Painel {...p} fechar={() => setAberto(false)} />}
    </>
  );
}

function Painel({ chave, titulo, imagem, preco, fechar }: Produto & { fechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const idTitulo = useId();
  const sessao = useSessao();
  const sugestao = preco != null && preco > 0 ? Math.floor(preco * 0.9) : null;
  const [modo, setModo] = useState<"queda" | "alvo">(sugestao ? "alvo" : "queda");
  const [alvo, setAlvo] = useState(sugestao ? String(sugestao) : "");
  const [porEmail, setPorEmail] = useState(true);
  const [estado, setEstado] = useState<"parado" | "salvando" | "ok" | "erro">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const navegador = idDoNavegador();
    if (!navegador) {
      setErro(
        "Seu navegador não guarda dados deste site. Libere os dados do site para acompanhar.",
      );
      setEstado("erro");
      return;
    }
    const valor = Number(alvo.replace(/\./g, "").replace(",", "."));
    setEstado("salvando");
    const { error } = await supabase.rpc(
      "acompanhar_da_vitrine" as never,
      {
        p_chave: chave,
        p_navegador: navegador,
        p_alvo: modo === "alvo" && valor > 0 ? valor : null,
        p_avisar_email: sessao ? porEmail : null,
      } as never,
    );
    if (error) {
      setErro(erroDoAcompanhar(error.message));
      setEstado("erro");
      return;
    }
    setEstado("ok");
  }

  return (
    <dialog
      ref={ref}
      onClose={fechar}
      aria-labelledby={idTitulo}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="painel m-auto w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-border bg-white p-0 text-[#1d1d1f] shadow-modal dark:bg-neutral-900 dark:text-white"
    >
      <div className="relative px-5 pb-6 pt-7 sm:p-6">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Fechar"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full vidro-botao hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#0071e3]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <h2 id={idTitulo} className="flex items-center gap-2 text-[19px] font-bold tracking-tight">
          <BellRing className="size-5 text-[#0071e3]" aria-hidden="true" />
          Acompanhar preço
        </h2>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f5f5f7] p-3 dark:bg-white/5">
          {imagem ? (
            <img
              src={imagem}
              alt=""
              referrerPolicy="no-referrer"
              className="size-14 shrink-0 rounded-xl bg-white object-contain p-1"
            />
          ) : null}
          <div className="min-w-0">
            <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{titulo}</p>
            {preco != null && (
              <p className="text-sm font-extrabold tabular-nums">{brl(preco)} agora</p>
            )}
          </div>
        </div>

        {estado === "ok" ? (
          <div className="mt-4 text-center" role="status">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-sm font-bold text-success">
              <Check className="size-4" aria-hidden="true" /> Acompanhando
            </p>
            <p className="mt-2 text-[13px] text-[#6e6e73] dark:text-white/60">
              Eu confiro o preço de tempos em tempos e mostro em Meus preços quando cair.
            </p>
            <Link
              to="/meus-precos"
              className="mt-3 inline-block text-sm font-bold text-[#0071e3] hover:underline"
            >
              Ver meus preços
            </Link>
            <ConviteConta className="mt-3" />
          </div>
        ) : (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void salvar();
            }}
          >
            <fieldset className="space-y-2 text-[13px]">
              <legend className="sr-only">Quando avisar</legend>
              {sugestao != null && (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="modo"
                    checked={modo === "alvo"}
                    onChange={() => setModo("alvo")}
                    className="size-4 accent-[#0071e3]"
                  />
                  <span className="shrink-0">Quando chegar a</span>
                  <input
                    inputMode="decimal"
                    aria-label="Preço desejado em reais"
                    value={alvo}
                    onFocus={() => setModo("alvo")}
                    onChange={(e) => setAlvo(e.target.value.replace(/[^\d.,]/g, ""))}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-[#d2d2d7] bg-white px-3 text-base tabular-nums outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 dark:border-white/15 dark:bg-white/5"
                  />
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="modo"
                  checked={modo === "queda"}
                  onChange={() => setModo("queda")}
                  className="size-4 accent-[#0071e3]"
                />
                Qualquer queda de preço
              </label>
              {sessao && (
                <label className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={porEmail}
                    onChange={(e) => setPorEmail(e.target.checked)}
                    className="size-4 accent-[#0071e3]"
                  />
                  Avisar também por e-mail quando o preço cair
                </label>
              )}
            </fieldset>
            {estado === "erro" && erro && (
              <p role="alert" className="mt-2 text-[13px] text-red-700 dark:text-red-400">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={estado === "salvando"}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50 motion-reduce:transition-none"
            >
              {estado === "salvando" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <BellRing className="size-4" aria-hidden="true" />
              )}
              Acompanhar
            </button>
            {!sessao && <ConviteConta className="mt-3 text-center" />}
          </form>
        )}
      </div>
    </dialog>
  );
}
