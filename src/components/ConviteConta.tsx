/* Convite discreto para entrar (04/11), em "Acompanhar preço" e Meus preços.
   Usa só <span> para caber dentro de parágrafos. */
import { UserRound } from "lucide-react";

import { abrirLogin, useSessao } from "@/lib/auth-otp";

export function ConviteConta({ className = "" }: { className?: string }) {
  const sessao = useSessao();
  if (sessao === undefined) return null;
  if (sessao)
    return (
      <span className={`flex min-w-0 items-center gap-1.5 text-xs text-secondary-ink ${className}`}>
        <UserRound className="size-3.5 shrink-0 text-[#0071e3]" aria-hidden="true" />
        <span className="min-w-0 break-words">
          Monitorando nesta conta: <strong className="text-foreground">{sessao.user.email}</strong>
        </span>
      </span>
    );
  return (
    <span className={`block text-xs text-secondary-ink ${className}`}>
      Quer ver seus preços em outros aparelhos e receber por e-mail?{" "}
      <button
        type="button"
        onClick={abrirLogin}
        className="font-bold text-[#0071e3] hover:underline"
      >
        Entre com seu e-mail (sem senha).
      </button>
    </span>
  );
}
