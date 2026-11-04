/* Mantém o gosto do visitante igual em todos os aparelhos da conta (04/11):
   cada mudança local sobe sozinha (espera 4 s e no máximo 1 envio a cada
   15 s); ao entrar e ao voltar para a aba, o que veio de outro aparelho é
   juntado. Usa os dados da própria conta: nada de tabela nova. */
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  EVENTO_PERFIL,
  gostoParaConta,
  mesclarGosto,
  obterPerfil,
} from "@/lib/perfil-visitante";

export const EVENTO_SINCRONIA = "conta-sincronizada";
let ultimoEnviado = "";
let ultimaSincronia = 0;

export const ultimaSincroniaEm = () => ultimaSincronia;

function marcar() {
  ultimaSincronia = Date.now();
  window.dispatchEvent(new Event(EVENTO_SINCRONIA));
}

async function puxar() {
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata as { gosto?: unknown } | undefined;
  if (!data.user) return false;
  if (meta?.gosto) mesclarGosto(meta.gosto);
  marcar();
  return true;
}

async function enviar() {
  const p = obterPerfil();
  if (!p) return;
  const gosto = gostoParaConta(p);
  const texto = JSON.stringify({ ...gosto, em: 0 });
  if (texto === ultimoEnviado) return;
  const { error } = await supabase.auth.updateUser({ data: { gosto } });
  if (!error) {
    ultimoEnviado = texto;
    marcar();
  }
}

/** Chamar uma vez (cabeçalho). Só age com alguém conectado. */
export function useSincroniaConta(conectado: boolean) {
  useEffect(() => {
    if (!conectado) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ultimoEnvio = 0;
    void puxar().then(() => enviar());
    const aoMudar = () => {
      clearTimeout(timer);
      const espera = Math.max(4000, 15000 - (Date.now() - ultimoEnvio));
      timer = setTimeout(() => {
        ultimoEnvio = Date.now();
        void enviar();
      }, espera);
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void puxar();
    };
    window.addEventListener(EVENTO_PERFIL, aoMudar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(EVENTO_PERFIL, aoMudar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [conectado]);
}

/** "Salvo na sua conta há X" para a página do perfil. */
export function useUltimaSincronia(): number {
  const [em, setEm] = useState(0);
  useEffect(() => {
    setEm(ultimaSincronia);
    const f = () => setEm(ultimaSincronia);
    window.addEventListener(EVENTO_SINCRONIA, f);
    return () => window.removeEventListener(EVENTO_SINCRONIA, f);
  }, []);
  return em;
}
