/* CONTA POR E-MAIL SEM SENHA (Weslei, 04/11): o código chega no e-mail e a
   pessoa digita aqui. Ao entrar, o "Meus preços" deste aparelho passa a ser
   o da conta (vincular_navegador_conta), em qualquer aparelho. */
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { idDoNavegador } from "@/lib/navegador";

const CHAVE_NAVEGADOR = "melhorescolha-navegador";
export const EVENTO_ABRIR_LOGIN = "abrir-login";

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Só dígitos, de 6 a 8 (o tamanho vem da configuração do envio). */
export function limparCodigo(codigo: string): string {
  return codigo.replace(/\D/g, "").slice(0, 8);
}

export function codigoValido(codigo: string): boolean {
  return /^\d{6,8}$/.test(codigo);
}

export async function solicitarCodigo(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/meus-precos` },
  });
  return error ? traduzir(error.message) : null;
}

export async function validarCodigo(email: string, codigo: string) {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: limparCodigo(codigo),
    type: "email",
  });
  if (error) return traduzir(error.message);
  await vincularAparelho();
  return null;
}

/** Adota o identificador da conta neste aparelho, trazendo o que ele já acompanhava. */
export async function vincularAparelho() {
  const local = idDoNavegador();
  if (!local) return;
  const { data, error } = await supabase.rpc(
    "vincular_navegador_conta" as never,
    { p_navegador: local } as never,
  );
  if (error || typeof data !== "string") return;
  try {
    if (data !== local) localStorage.setItem(CHAVE_NAVEGADOR, data);
  } catch {
    /* armazenamento bloqueado: segue com o local */
  }
  window.dispatchEvent(new Event("conta-vinculada"));
}

export async function sair() {
  await supabase.auth.signOut();
  try {
    localStorage.removeItem(CHAVE_NAVEGADOR);
  } catch {
    /* nada */
  }
  window.dispatchEvent(new Event("conta-vinculada"));
}

export function abrirLogin() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_LOGIN));
}

export function useConta(): User | null {
  const [usuario, setUsuario] = useState<User | null>(null);
  useEffect(() => {
    let vivo = true;
    supabase.auth.getUser().then(({ data }) => vivo && setUsuario(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED")
        setUsuario(sessao?.user ?? null);
      if (evento === "SIGNED_IN") void vincularAparelho();
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return usuario;
}

function traduzir(msg: string): string {
  if (/expired|invalid|token/i.test(msg)) return "Código inválido ou vencido. Confira ou peça outro.";
  if (/rate|seconds|security purposes/i.test(msg))
    return "Aguarde alguns segundos antes de pedir outro código.";
  if (/signups not allowed|disabled/i.test(msg))
    return "A entrada por e-mail está desligada no momento.";
  return "Não deu agora. Tente de novo em instantes.";
}
