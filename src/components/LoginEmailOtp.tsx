/* Entrar com o e-mail, sem senha (Weslei, 04/11). Abre em qualquer página
   pelo evento "abrir-login" (abrirLogin). Visual do site: cartão branco,
   cantos amplos, azul #0071e3, campo de 16 px (sem zoom no iPhone). */
import { ClipboardPaste, LoaderCircle, Mail, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  EVENTO_ABRIR_LOGIN,
  codigoValido,
  emailValido,
  limparCodigo,
  solicitarCodigo,
  validarCodigo,
} from "@/lib/auth-otp";

const ESPERA_REENVIO = 50;

export function LoginEmailOtp() {
  const ref = useRef<HTMLDialogElement>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<"email" | "codigo" | "ok">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falta, setFalta] = useState(0);

  useEffect(() => {
    const abrir = () => {
      setErro(null);
      setEtapa((e) => (e === "ok" ? "email" : e));
      ref.current?.showModal();
    };
    window.addEventListener(EVENTO_ABRIR_LOGIN, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_LOGIN, abrir);
  }, []);

  useEffect(() => {
    if (falta <= 0) return;
    const t = setTimeout(() => setFalta((f) => f - 1), 1000);
    return () => clearTimeout(t);
  }, [falta]);

  useEffect(() => {
    if (etapa === "codigo") campoCodigo.current?.focus();
  }, [etapa]);

  const fechar = () => ref.current?.close();

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!emailValido(email)) return setErro("Confira o e-mail digitado.");
    setOcupado(true);
    setErro(null);
    const falha = await solicitarCodigo(email);
    setOcupado(false);
    if (falha) return setErro(falha);
    setCodigo("");
    setEtapa("codigo");
    setFalta(ESPERA_REENVIO);
  }

  async function entrar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!codigoValido(codigo)) return setErro("Digite o código completo.");
    setOcupado(true);
    setErro(null);
    const falha = await validarCodigo(email, codigo);
    setOcupado(false);
    if (falha) return setErro(falha);
    setEtapa("ok");
    setTimeout(fechar, 1400);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="login-titulo"
      className="painel m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border bg-card p-0 text-foreground shadow-modal backdrop:bg-black/40"
      onClick={(e) => e.target === ref.current && fechar()}
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-secondary-ink hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>

        <div className="mr-10">
          <CenaLogin etapa={etapa} enviando={etapa === "email" && ocupado} />
        </div>

        <ol className="mt-4 flex items-center gap-2 text-xs text-secondary-ink" aria-label="Etapas">
          {["Seu e-mail", "Código", "Pronto"].map((nome, i) => {
            const atual = etapa === "email" ? 0 : etapa === "codigo" ? 1 : 2;
            return (
              <li key={nome} className="flex flex-1 items-center gap-1.5" aria-current={i === atual ? "step" : undefined}>
                <span
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-300 ${
                    i <= atual ? "bg-[#0071e3] text-white" : "bg-muted text-secondary-ink"
                  }`}
                >
                  {i < atual ? "✓" : i + 1}
                </span>
                <span className={i === atual ? "font-medium text-foreground" : ""}>{nome}</span>
                {i < 2 && (
                  <span className="h-0.5 flex-1 overflow-hidden rounded bg-muted">
                    <span
                      className="block h-full bg-[#0071e3] transition-all duration-500"
                      style={{ width: i < atual ? "100%" : i === atual && ocupado ? "60%" : "0%" }}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {etapa === "email" && (
          <form onSubmit={enviar} className="mt-4">
            <h2 id="login-titulo" className="text-xl font-semibold tracking-tight">
              Entre com seu e-mail
            </h2>
            <p className="mt-1.5 text-sm text-secondary-ink">
              Sem senha: mandamos um código para você digitar aqui. Seus preços acompanhados e
              preferências ficam na sua conta, em qualquer aparelho.
            </p>
            <label htmlFor="login-email" className="sr-only">
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="send"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu-email@exemplo.com"
              className="mt-5 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30"
            />
            {erro && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={ocupado || !email.trim()}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] text-base font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {ocupado && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {ocupado ? "Enviando…" : "Enviar código"}
            </button>
          </form>
        )}

        {etapa === "codigo" && (
          <form onSubmit={entrar} className="mt-4">
            <h2 id="login-titulo" className="text-xl font-semibold tracking-tight">
              Digite o código
            </h2>
            <p className="mt-1.5 text-sm text-secondary-ink">
              Mandamos um código para <strong className="break-all text-foreground">{email}</strong>.
              Vale por uma hora.
            </p>
            <label htmlFor="login-codigo" className="sr-only">
              Código
            </label>
            <input
              ref={campoCodigo}
              id="login-codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
              value={codigo}
              onChange={(e) => setCodigo(limparCodigo(e.target.value))}
              placeholder="••••••••"
              className="mt-5 h-14 w-full rounded-2xl border border-border bg-background px-4 text-center font-mono text-2xl font-bold tracking-[0.4em] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const texto = limparCodigo(await navigator.clipboard.readText());
                  if (!texto) return setErro("Copie o código do e-mail e toque de novo.");
                  setCodigo(texto);
                  setErro(null);
                } catch {
                  campoCodigo.current?.focus();
                  setErro("Toque e segure no campo acima e escolha Colar.");
                }
              }}
              className="vidro-botao mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold text-[#0071e3]"
            >
              <ClipboardPaste className="size-4" aria-hidden />
              Colar código copiado
            </button>
            {erro && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={ocupado || !codigoValido(codigo)}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] text-base font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {ocupado && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              Entrar
            </button>
            <p className="mt-4 rounded-2xl bg-background px-4 py-3 text-xs leading-relaxed text-secondary-ink">
              O e-mail também traz um link. Ele abre no navegador padrão do celular: se você está no
              Instagram, prefira o código.
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setEtapa("email");
                  setErro(null);
                }}
                className="text-secondary-ink underline-offset-2 hover:underline"
              >
                Trocar e-mail
              </button>
              {falta > 0 ? (
                <span className="text-secondary-ink">Reenviar em {falta} s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void enviar()}
                  disabled={ocupado}
                  className="font-semibold text-[#0071e3] hover:underline"
                >
                  Reenviar código
                </button>
              )}
            </div>
          </form>
        )}

        {etapa === "ok" && (
          <div className="mt-4" role="status">
            <h2 id="login-titulo" className="text-xl font-semibold tracking-tight">
              Pronto, você entrou
            </h2>
            <p className="mt-1.5 text-sm text-secondary-ink">
              Seus preços acompanhados agora ficam na sua conta.
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}
