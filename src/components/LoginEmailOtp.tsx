/* Entrar com o e-mail, sem senha (Weslei, 04/11). Abre em qualquer página
   pelo evento "abrir-login" (abrirLogin). Visual do site: cartão branco,
   cantos amplos, azul #0071e3, campo de 16 px (sem zoom no iPhone). */
import { Check, ClipboardPaste, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CenaLogin } from "@/components/CenaLogin";

import {
  EVENTO_ABRIR_LOGIN,
  codigoValido,
  emailValido,
  limparCodigo,
  solicitarCodigo,
  validarCodigo,
} from "@/lib/auth-otp";

const ESPERA_REENVIO = 50;
const CAIXAS = 8;

/* Link "Copiar código" do e-mail (04/11): /?codigo=…&email=… abre o login já
   na etapa do código. Tira os dois da barra de endereços na hora; o código
   só vale com o toque em "Entrar" (verifyOtp) e vence em 1 hora. */
function lerCodigoDaUrl(): { codigo: string; email: string } | null {
  try {
    const url = new URL(window.location.href);
    const codigo = limparCodigo(url.searchParams.get("codigo") ?? "");
    const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
    if (!url.searchParams.has("codigo")) return null;
    url.searchParams.delete("codigo");
    url.searchParams.delete("email");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    return codigoValido(codigo) && emailValido(email) ? { codigo, email } : null;
  } catch {
    return null;
  }
}

/* embutido: o formulário na própria página (/login e /admin), sem janela;
   emailSugerido: já vem no campo, a pessoa pode trocar. */
export function LoginEmailOtp({
  embutido = false,
  emailSugerido = "",
}: { embutido?: boolean; emailSugerido?: string } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<"email" | "codigo" | "ok">("email");
  const [email, setEmail] = useState(emailSugerido);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falta, setFalta] = useState(0);
  const [colado, setColado] = useState(false);
  const [doEmail, setDoEmail] = useState(false);
  const [focado, setFocado] = useState(false);
  const cascata = useRef<number[]>([]);

  /* Preenche as caixas uma a uma (40 ms por dígito). */
  function preencherEmCascata(texto: string) {
    cascata.current.forEach((t) => clearTimeout(t));
    setCodigo("");
    cascata.current = [...texto].map((_, i) =>
      window.setTimeout(() => setCodigo(texto.slice(0, i + 1)), (i + 1) * 40),
    );
  }

  // Lido uma vez só: a leitura limpa a URL e o efeito pode rodar 2x (StrictMode).
  const daUrl = useRef<{ codigo: string; email: string } | null | undefined>(undefined);
  useEffect(() => {
    if (daUrl.current === undefined) daUrl.current = lerCodigoDaUrl();
    const vindo = daUrl.current;
    if (!vindo) return;
    navigator.clipboard?.writeText(vindo.codigo).catch(() => {});
    setEmail(vindo.email);
    setEtapa("codigo");
    setDoEmail(true);
    setErro(null);
    if (!ref.current?.open) ref.current?.showModal();
    preencherEmCascata(vindo.codigo);
    return () => cascata.current.forEach((t) => clearTimeout(t));
  }, []);

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
    if (!embutido) setTimeout(fechar, 1400);
  }

  const conteudo = (
    <div className="relative p-6 sm:p-8">
      {!embutido && (
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-secondary-ink hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}

      <div className="mr-10">
        <CenaLogin etapa={etapa} enviando={etapa === "email" && ocupado} />
      </div>

      <ol className="mt-4 flex items-center gap-2 text-xs text-secondary-ink" aria-label="Etapas">
        {["Seu e-mail", "Código", "Pronto"].map((nome, i) => {
          const atual = etapa === "email" ? 0 : etapa === "codigo" ? 1 : 2;
          return (
            <li
              key={nome}
              className="flex flex-1 items-center gap-1.5"
              aria-current={i === atual ? "step" : undefined}
            >
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
          {doEmail && (
            <p
              role="status"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#34c759]/12 px-3 py-1 text-xs font-semibold text-[#1f7a3a]"
            >
              <Check className="size-3.5" aria-hidden /> Código copiado e preenchido do seu e-mail!
            </p>
          )}
          <label htmlFor="login-codigo" className="sr-only">
            Código de {CAIXAS} dígitos
          </label>
          {/* 8 caixas no visual do e-mail; por baixo, um campo só (teclado,
                Backspace, colar e o preenchimento automático do celular). */}
          <div className="relative mt-5">
            <input
              ref={campoCodigo}
              id="login-codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
              maxLength={CAIXAS}
              value={codigo}
              onFocus={() => setFocado(true)}
              onBlur={() => setFocado(false)}
              onChange={(e) => {
                setDoEmail(false);
                setCodigo(limparCodigo(e.target.value));
              }}
              className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent opacity-0 outline-none"
            />
            <div className="grid grid-cols-8 gap-1.5 sm:gap-2" aria-hidden="true">
              {Array.from({ length: CAIXAS }, (_, i) => {
                const d = codigo[i];
                const atual =
                  focado && (i === codigo.length || (i === CAIXAS - 1 && codigo.length === CAIXAS));
                return (
                  <span
                    key={`${i}-${d ?? ""}`}
                    className={
                      "grid h-12 place-items-center rounded-xl border bg-white font-mono text-xl font-bold text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors duration-150 dark:bg-white/5 dark:text-white sm:h-14 sm:text-2xl " +
                      (d
                        ? "login-digito border-[#0071e3] bg-[#0071e3]/[0.06] "
                        : "border-[#e3e3e8] dark:border-white/15 ") +
                      (atual ? "ring-2 ring-[#0071e3]/35" : "")
                    }
                  >
                    {d ?? ""}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const texto = limparCodigo(await navigator.clipboard.readText());
                if (!codigoValido(texto))
                  return setErro("Copie o código do e-mail e toque de novo.");
                setErro(null);
                setDoEmail(false);
                preencherEmCascata(texto);
                setColado(true);
                window.setTimeout(() => setColado(false), 1500);
              } catch {
                campoCodigo.current?.focus();
                setErro("Toque e segure nas caixas acima e escolha Colar.");
              }
            }}
            className={
              "mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-colors duration-200 " +
              (colado
                ? "border-[#34c759] bg-[#34c759] text-white"
                : "vidro-botao border-border text-[#0071e3]")
            }
          >
            {colado ? (
              <>
                <Check className="size-4 sino-ok" aria-hidden /> Código colado!
              </>
            ) : (
              <>
                <ClipboardPaste className="size-4" aria-hidden /> Colar código copiado
              </>
            )}
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
  );

  if (embutido)
    return (
      <section
        aria-labelledby="login-titulo"
        className="painel w-full max-w-md rounded-3xl border border-border bg-card text-foreground shadow-modal animate-cartao"
      >
        {conteudo}
      </section>
    );

  return (
    <dialog
      ref={ref}
      aria-labelledby="login-titulo"
      className="painel m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border bg-card p-0 text-foreground shadow-modal backdrop:bg-black/40"
      onClick={(e) => e.target === ref.current && fechar()}
    >
      {conteudo}
    </dialog>
  );
}
