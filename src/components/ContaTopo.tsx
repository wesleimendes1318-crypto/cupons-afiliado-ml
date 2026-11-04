/* Conta no topo (04/11): deslogado, "Entrar" discreto (abre o login por
   e-mail); logado, pílula com o e-mail encurtado, "Meus preços" e "Sair".
   Ao entrar, leva para a conta o que o navegador já acompanhava e passa a
   guardar as preferências na conta. No celular só o ícone (cabe em 320 px). */
import { Link } from "@tanstack/react-router";
import { LogOut, Tag, UserRound } from "lucide-react";
import { useEffect } from "react";

import { LoginEmailOtp } from "@/components/LoginEmailOtp";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  abrirLogin,
  acompanharPreferencias,
  encurtarEmail,
  sair,
  sincronizarPreferencias,
  useSessao,
  vincularNavegadorAConta,
} from "@/lib/auth-otp";

/* Avisa quem lista os preços (Meus preços) que a conta mudou. */
export const EVENTO_CONTA_VINCULADA = "conta-vinculada";

const botao =
  "inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full vidro-botao border border-black/10 px-2.5 text-sm font-semibold text-[#1d1d1f] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] dark:border-white/15 dark:text-white sm:px-3.5";

export function ContaTopo() {
  const sessao = useSessao();
  const userId = sessao?.user.id;

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    void (async () => {
      await vincularNavegadorAConta(userId).catch(() => 0);
      await sincronizarPreferencias(userId).catch(() => undefined);
      if (vivo) window.dispatchEvent(new CustomEvent(EVENTO_CONTA_VINCULADA));
    })();
    const parar = acompanharPreferencias(userId);
    return () => {
      vivo = false;
      parar();
    };
  }, [userId]);

  const email = sessao?.user.email ?? "";

  return (
    <>
      <LoginEmailOtp />
      {sessao === undefined ? (
        <span className="inline-block size-10" aria-hidden />
      ) : !sessao ? (
        <button type="button" onClick={abrirLogin} className={botao} aria-label="Entrar com e-mail">
          <UserRound className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Entrar</span>
        </button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className={botao} aria-label={`Minha conta: ${email}`}>
            <UserRound className="size-4 text-[#0071e3]" aria-hidden="true" />
            <span className="hidden max-w-[180px] truncate lg:inline">{encurtarEmail(email)}</span>
            <span className="hidden sm:inline lg:hidden">Minha conta</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-24px)] rounded-2xl">
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/meus-precos">
                <Tag className="size-4" aria-hidden="true" /> Meus preços
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void sair()}>
              <LogOut className="size-4" aria-hidden="true" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
