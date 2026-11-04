/* LOGIN SEM SENHA (Weslei, 04/11): a pessoa informa o e-mail, recebe um
   código (OTP do Supabase Auth, 6 a 8 dígitos, vale 1 h) e digita aqui.
   Ao entrar, o que este navegador já acompanhava vai para a conta
   (vincular_navegador_conta) e as preferências (região/CEP, de onde sai a
   voltagem, e o perfil de recomendação) passam a ficar na conta também. */
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { idDoNavegador } from "@/lib/navegador";

export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const emailValido = (email: string) => RE_EMAIL.test(email.trim());
export const normalizarEmail = (email: string) => email.trim().toLowerCase();

/** Só os dígitos do que foi digitado ou colado ("123 456", "Código: 12345678"). */
export const limparCodigo = (s: string) => s.replace(/\D/g, "").slice(0, 8);
export const codigoValido = (s: string) => /^\d{6,8}$/.test(s);

/** "fulano.de.tal@gmail.com" → "fulano.d…@gmail.com" (pílula do topo). */
export function encurtarEmail(email: string, max = 22) {
  if (email.length <= max) return email;
  const [nome = "", dominio = ""] = email.split("@");
  const sobra = Math.max(3, max - dominio.length - 2);
  return `${nome.slice(0, sobra)}…@${dominio}`;
}

/** Erro do Supabase Auth → frase em português para a tela. */
export function mensagemDeErro(
  erro: {
    message?: string | undefined;
    status?: number | undefined;
    code?: string | undefined;
  } | null,
) {
  const m = `${erro?.code ?? ""} ${erro?.message ?? ""}`.toLowerCase();
  if (!m.trim()) return "Não deu certo agora. Tente em instantes.";
  if (/expired|invalid|otp_expired|token/.test(m)) return "Código expirado ou inválido.";
  if (erro?.status === 429 || /rate|seconds|too many|security purposes/.test(m))
    return "Aguarde para reenviar.";
  if (/missing email|email.*required|anonymous/.test(m)) return "E-mail não informado.";
  if (/signups not allowed|not allowed/.test(m)) return "Cadastro por e-mail desligado no momento.";
  if (/email.*invalid|invalid.*email/.test(m)) return "Confira o e-mail digitado.";
  return "Não deu certo agora. Tente em instantes.";
}

export async function solicitarCodigoEmail(email: string) {
  const e = normalizarEmail(email);
  if (!e) return { error: { message: "missing email" } };
  return supabase.auth.signInWithOtp({
    email: e,
    options: {
      shouldCreateUser: true,
      // O link do e-mail volta para a mesma página (abre no navegador padrão).
      ...(typeof window !== "undefined"
        ? { emailRedirectTo: window.location.href.split("#")[0] ?? window.location.origin }
        : {}),
    },
  });
}

export async function validarCodigoEmail(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email: normalizarEmail(email),
    token: token.trim(),
    type: "email",
  });
}

export async function obterSessao() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function escutarSessao(callback: (s: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_evento, s) => callback(s));
  return () => data.subscription.unsubscribe();
}

export async function sair() {
  await supabase.auth.signOut();
}

/** Passa para a conta o que este navegador acompanhava sem conta. */
export async function vincularNavegadorAConta(userId: string) {
  const navegador = idDoNavegador();
  if (!navegador) return 0;
  const { data } = await supabase.rpc(
    "vincular_navegador_conta" as never,
    { p_navegador: navegador, p_usuario_id: userId } as never,
  );
  return typeof data === "number" ? data : 0;
}

/* Preferências que vão para a conta: região/CEP (a voltagem sai dela) e o
   perfil de recomendação. Ao entrar, o que está na conta vale; o que só
   este navegador tinha sobe para a conta. */
export const CHAVES_PREFERENCIA = ["melhorescolha:cep", "melhorescolha_perfil"] as const;
const EVENTOS_PREFERENCIA = ["cep-trocado", "perfil-visitante-atualizado"] as const;

function lerLocal(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** Junta conta e navegador: conta vence; só local sobe. Puro (testável). */
export function juntarPreferencias(
  conta: Record<string, unknown>,
  local: Record<string, unknown>,
): { final: Record<string, unknown>; aplicarLocal: string[]; subir: boolean } {
  const final: Record<string, unknown> = { ...local, ...conta };
  const aplicarLocal = Object.keys(conta).filter(
    (k) => JSON.stringify(conta[k]) !== JSON.stringify(local[k]),
  );
  const subir = Object.keys(local).some((k) => !(k in conta));
  return { final, aplicarLocal, subir };
}

function preferenciasLocais() {
  const r: Record<string, unknown> = {};
  for (const k of CHAVES_PREFERENCIA) {
    const v = lerLocal(k);
    if (v == null) continue;
    try {
      r[k] = JSON.parse(v);
    } catch {
      /* valor estragado: não sobe */
    }
  }
  return r;
}

async function gravarNaConta(userId: string, preferencias: Record<string, unknown>) {
  await supabase
    .from("perfil_conta" as never)
    .upsert({ usuario_id: userId, preferencias, atualizado_em: new Date().toISOString() } as never);
}

export async function sincronizarPreferencias(userId: string) {
  const { data } = await supabase
    .from("perfil_conta" as never)
    .select("preferencias")
    .eq("usuario_id" as never, userId as never)
    .maybeSingle();
  const conta = ((data as { preferencias?: Record<string, unknown> } | null)?.preferencias ??
    {}) as Record<string, unknown>;
  const { final, aplicarLocal, subir } = juntarPreferencias(conta, preferenciasLocais());
  for (const k of aplicarLocal) {
    try {
      localStorage.setItem(k, JSON.stringify(final[k]));
    } catch {
      /* sem armazenamento: vale a conta na próxima visita */
    }
  }
  if (aplicarLocal.includes("melhorescolha:cep"))
    window.dispatchEvent(new CustomEvent("cep-trocado", { detail: final["melhorescolha:cep"] }));
  if (aplicarLocal.includes("melhorescolha_perfil"))
    window.dispatchEvent(new CustomEvent("perfil-visitante-atualizado"));
  if (subir) await gravarNaConta(userId, final);
}

/** Depois de entrar: cada troca de CEP ou do perfil sobe para a conta (agrupado em 3 s). */
export function acompanharPreferencias(userId: string) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const aoMudar = () => {
    clearTimeout(t);
    t = setTimeout(() => void gravarNaConta(userId, preferenciasLocais()), 3000);
  };
  for (const e of EVENTOS_PREFERENCIA) window.addEventListener(e, aoMudar);
  return () => {
    clearTimeout(t);
    for (const e of EVENTOS_PREFERENCIA) window.removeEventListener(e, aoMudar);
  };
}

/** Sessão atual (null = deslogado; undefined = ainda lendo). */
export function useSessao() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    void obterSessao().then((s) => vivo && setSessao(s));
    const parar = escutarSessao((s) => setSessao(s));
    return () => {
      vivo = false;
      parar();
    };
  }, []);
  return sessao;
}

/* O modal de login fica montado uma vez (no cabeçalho); qualquer botão abre. */
export const EVENTO_ABRIR_LOGIN = "abrir-login-email";
export const abrirLogin = () => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_LOGIN));
