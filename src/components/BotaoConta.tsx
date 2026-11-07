/* Botão "Entrar" / conta no cabeçalho (04/11) e a janela do código. */
import { LogOut, UserRound } from "lucide-react";
import { useState } from "react";

import { LoginEmailOtp } from "@/components/LoginEmailOtp";
import { abrirLogin, sair, useConta } from "@/lib/auth-otp";
import { useSincroniaDesejos } from "@/lib/lista-desejos";
import { useSincroniaConta } from "@/lib/sincronia-conta";

/* Só mostra o atalho; os números continuam protegidos no banco (eh_fundador). */
const FUNDADORES = ["wes_lei18@hotmail.com", "weslei.mendes1318@gmail.com"];

export function BotaoConta() {
  const usuario = useConta();
  useSincroniaConta(Boolean(usuario));
  useSincroniaDesejos(usuario?.id ?? null);
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
              <p className="flex items-center gap-1.5 px-2 pt-1 text-xs text-secondary-ink">
                <span className="size-2 rounded-full bg-[#34c759]" /> Buscas e preferências salvas
                na conta
              </p>
              <a href="/painel" className="mt-2 block rounded-xl px-2 py-2 hover:bg-muted">
                Meu painel
              </a>
              <a href="/meus-precos" className="block rounded-xl px-2 py-2 hover:bg-muted">
                Meus preços
              </a>
              <a href="/painel?aba=ajustes" className="block rounded-xl px-2 py-2 hover:bg-muted">
                Ajustes e privacidade
              </a>
              {FUNDADORES.includes(email.toLowerCase()) && (
                <a
                  href="/admin"
                  className="block rounded-xl px-2 py-2 font-semibold text-[#0071e3] hover:bg-muted"
                >
                  Painel do fundador
                </a>
              )}
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
          title="Entre sem senha: suas buscas e preços ficam salvos em todos os aparelhos"
          className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0071e3] px-3 text-sm font-semibold text-white shadow-[0_6px_18px_-8px_rgba(0,113,227,0.7)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] sm:px-4"
        >
          <UserRound className="size-4" aria-hidden />
          <span className="hidden min-[400px]:inline">Entrar</span>
        </button>
      )}
      <LoginEmailOtp />
    </>
  );
}
