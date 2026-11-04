/* Botão "Entrar" / conta no cabeçalho (04/11) e a janela do código. */
import { LogOut, UserRound } from "lucide-react";
import { useState } from "react";

import { LoginEmailOtp } from "@/components/LoginEmailOtp";
import { abrirLogin, sair, useConta } from "@/lib/auth-otp";

export function BotaoConta() {
  const usuario = useConta();
  const [menu, setMenu] = useState(false);
  const email = usuario?.email ?? "";

  return (
    <>
      {usuario ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-label={`Sua conta: ${email}`}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-sm font-semibold text-white"
          >
            {email.charAt(0).toUpperCase() || <UserRound className="size-4" aria-hidden />}
          </button>
          {menu && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-card p-3 text-sm shadow-modal">
              <p className="truncate px-2 text-secondary-ink">{email}</p>
              <a href="/meus-precos" className="mt-2 block rounded-xl px-2 py-2 hover:bg-muted">
                Meus preços
              </a>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  void sair();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted"
              >
                <LogOut className="size-4" aria-hidden /> Sair
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirLogin}
          aria-label="Entrar com seu e-mail"
          className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 vidro-botao rounded-full border border-border px-2.5 text-sm font-semibold text-[#1d1d1f] hover:bg-black/5 dark:text-white sm:px-3.5"
        >
          <UserRound className="size-4" aria-hidden />
          <span className="hidden sm:inline">Entrar</span>
        </button>
      )}
      <LoginEmailOtp />
    </>
  );
}
