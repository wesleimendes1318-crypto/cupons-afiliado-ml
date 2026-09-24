import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/* A extensão do Weslei está trabalhando agora?

   Ela anota "visto_em" no banco enquanto roda (a cada ~10 minutos). Sem essa
   anotação recente, nada que dependa dela vai acontecer: link de afiliado,
   código do cupom, página da loja. O site usa isto para NÃO fazer o cliente
   esperar por algo que não vem, e para dizer isso com clareza. */
const MARGEM_MS = 25 * 60 * 1000;

export async function roboAtivo(): Promise<boolean> {
  try {
    const { data } = await supabase.rpc("estado_do_robo");
    const linha = (Array.isArray(data) ? data[0] : data) as
      { visto_em?: string | null; freio_ate?: string | null } | null;
    const visto = Date.parse(linha?.visto_em ?? "");
    if (!Number.isFinite(visto) || Date.now() - visto > MARGEM_MS) return false;
    const freio = Date.parse(linha?.freio_ate ?? "");
    return !(Number.isFinite(freio) && freio > Date.now());
  } catch {
    /* Sem resposta do banco não dá para afirmar nada: segue como antes. */
    return true;
  }
}

/** null enquanto não sabe; confere de novo a cada 2 minutos. */
export function useRoboAtivo(): boolean | null {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    const conferir = () => { void roboAtivo().then((a) => { if (vivo) setAtivo(a); }); };
    conferir();
    const t = window.setInterval(conferir, 120_000);
    return () => { vivo = false; window.clearInterval(t); };
  }, []);
  return ativo;
}
