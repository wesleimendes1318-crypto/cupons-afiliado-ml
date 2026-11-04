/* ENTRAR COM E-MAIL, SEM SENHA (Weslei, 04/11, modelo aprovado). Painel
   (<dialog class="painel">: no PC centralizado, no celular folha que sobe do
   pé da tela, com alça; sem animação com prefers-reduced-motion). Etapas:
   e-mail → código → pronto. Fica montado uma vez no cabeçalho e abre por
   abrirLogin() de qualquer botão. */
import { LoaderCircle, MailCheck, ShieldCheck, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  codigoValido,
  emailValido,
  EVENTO_ABRIR_LOGIN,
  limparCodigo,
  mensagemDeErro,
  normalizarEmail,
  solicitarCodigoEmail,
  validarCodigoEmail,
} from "@/lib/auth-otp";

/* Tamanho do código configurado no Supabase (Authentication → Email → OTP
   length). O campo aceita de 6 a 8 de qualquer jeito. */
const DIGITOS_CODIGO = 8;
const ESPERA_REENVIO = 50;

type Etapa = "email" | "codigo" | "sucesso";

export function LoginEmailOtp() {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    const abrir = () => {
      setErro(null);
      if (etapa === "sucesso") {
        setEtapa("email");
        setCodigo("");
      }
      const d = ref.current;
      if (d && !d.open) d.showModal();
    };
    window.addEventListener(EVENTO_ABRIR_LOGIN, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_LOGIN, abrir);
  }, [etapa]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const fechar = () => ref.current?.close();

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (!emailValido(email)) {
      setErro(email.trim() ? "Confira o e-mail digitado." : "E-mail não informado.");
      return;
    }
    setOcupado(true);
    setErro(null);
    const { error } = await solicitarCodigoEmail(email);
    setOcupado(false);
    if (error) {
      setErro(mensagemDeErro(error));
      return;
    }
    setEmail(normalizarEmail(email));
    setCodigo("");
    setEspera(ESPERA_REENVIO);
    setEtapa("codigo");
  }

  async function entrar(e?: FormEvent) {
    e?.preventDefault();
    if (!codigoValido(codigo)) {
      setErro("Código expirado ou inválido.");
      return;
    }
    setOcupado(true);
    setErro(null);
    const { error } = await validarCodigoEmail(email, codigo);
    setOcupado(false);
    if (error) {
      setErro(mensagemDeErro(error));
      return;
    }
    setEtapa("sucesso");
    setTimeout(fechar, 1400);
  }

  const campo =
    "h-12 w-full rounded-2xl border border-[#d2d2d7] bg-white px-4 text-base text-[#1d1d1f] outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 motion-reduce:transition-none dark:border-white/15 dark:bg-white/5 dark:text-white";
  const primario =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] px-5 text-[15px] font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] disabled:opacity-50 motion-reduce:transition-none";

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClick={(e) => {
        if (e.target === ref.current) fechar();
      }}
      className="painel m-auto w-[min(448px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-border bg-white p-0 text-[#1d1d1f] shadow-modal dark:bg-neutral-900 dark:text-white"
    >
      <div className="relative px-5 pb-6 pt-7 sm:p-8">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full vidro-botao text-[#1d1d1f] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#0071e3] dark:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        {etapa === "email" && (
          <form onSubmit={(e) => void enviar(e)} noValidate>
            <ShieldCheck className="size-9 text-success" aria-hidden="true" />
            <h2 id={idTitulo} className="mt-3 text-[22px] font-bold tracking-tight">
              Entre com seu e-mail
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#6e6e73] dark:text-white/60">
              Sem senha: mandamos um código para você digitar aqui. Seus alertas de preço e
              preferências ficam na sua conta.
            </p>
            <label htmlFor="login-email" className="sr-only">
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="seu-email@exemplo.com"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${campo} mt-5`}
            />
            {erro && (
              <p
                role="alert"
                className="mt-2 text-[13px] font-medium text-red-700 dark:text-red-400"
              >
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={ocupado || !emailValido(email)}
              className={`${primario} mt-4`}
            >
              {ocupado && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Enviar código
            </button>
          </form>
        )}

        {etapa === "codigo" && (
          <form onSubmit={(e) => void entrar(e)} noValidate>
            <MailCheck className="size-9 text-[#0071e3]" aria-hidden="true" />
            <h2 id={idTitulo} className="mt-3 text-[22px] font-bold tracking-tight">
              Digite o código
            </h2>
            <p className="mt-1.5 break-words text-[14px] leading-relaxed text-[#6e6e73] dark:text-white/60">
              Mandamos um código de {DIGITOS_CODIGO} dígitos para{" "}
              <strong className="text-[#1d1d1f] dark:text-white">{email}</strong>. Vale por uma
              hora.
            </p>
            <label htmlFor="login-codigo" className="sr-only">
              Código recebido por e-mail
            </label>
            <input
              id="login-codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={12}
              autoFocus
              value={codigo}
              onChange={(e) => {
                const c = limparCodigo(e.target.value);
                setCodigo(c);
                setErro(null);
              }}
              placeholder={"•".repeat(DIGITOS_CODIGO)}
              className={`${campo} mt-5 h-14 text-center font-mono text-2xl font-bold tracking-[0.3em] min-[360px]:tracking-[0.4em]`}
            />
            {erro && (
              <p
                role="alert"
                className="mt-2 text-[13px] font-medium text-red-700 dark:text-red-400"
              >
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={ocupado || !codigoValido(codigo)}
              className={`${primario} mt-4`}
            >
              {ocupado && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Entrar
            </button>
            <p className="mt-4 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-[13px] leading-snug text-[#4b5563] dark:bg-white/5 dark:text-white/70">
              O e-mail também traz um link. Ele abre no navegador padrão do celular: se você está no
              Instagram, prefira o código.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]">
              {espera > 0 ? (
                <span className="tabular-nums text-[#6e6e73] dark:text-white/60" aria-live="polite">
                  Reenviar em {espera} s
                </span>
              ) : (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void enviar()}
                  className="font-semibold text-[#0071e3] hover:underline"
                >
                  Reenviar código
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEtapa("email");
                  setCodigo("");
                  setErro(null);
                }}
                className="font-semibold text-[#0071e3] hover:underline"
              >
                Digitar outro e-mail
              </button>
            </div>
          </form>
        )}

        {etapa === "sucesso" && (
          <div className="py-4 text-center" role="status">
            <ShieldCheck className="mx-auto size-10 text-success" aria-hidden="true" />
            <h2 id={idTitulo} className="mt-3 text-[20px] font-bold tracking-tight">
              Pronto, você entrou
            </h2>
            <p className="mt-1 break-words text-[14px] text-[#6e6e73] dark:text-white/60">
              Seus preços acompanhados agora ficam na conta {email}.
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}
