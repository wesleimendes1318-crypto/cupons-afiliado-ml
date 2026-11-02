import { useEffect, useState } from "react";

import type { EnvioInternacional } from "@/lib/internacional";

/** Envio internacional de cada oferta da comparação (lista oficial da
    ficha, lida no servidor). Sem resposta: mapa vazio (a tela não afirma). */
export function useEnvioInternacional(
  pedidoId: number | null | undefined,
  /* Muda quando a lista de ofertas muda (segunda volta): busca de novo. */
  versao: string | null,
) {
  const [dados, setDados] = useState<{
    chave: string;
    envio: Record<string, EnvioInternacional>;
  } | null>(null);
  const chave = pedidoId != null && versao != null ? `${pedidoId}|${versao}` : null;
  useEffect(() => {
    if (chave == null || dados?.chave === chave) return;
    let vivo = true;
    fetch("/api/public/envio-internacional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido: pedidoId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { envio?: Record<string, EnvioInternacional> } | null) => {
        if (vivo) setDados({ chave, envio: j?.envio ?? {} });
      })
      .catch(() => vivo && setDados({ chave, envio: {} }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return dados?.envio ?? null;
}
