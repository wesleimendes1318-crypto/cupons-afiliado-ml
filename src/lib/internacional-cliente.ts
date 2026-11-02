import { useEffect, useState } from "react";

import type { EnvioInternacional } from "@/lib/internacional";

/** Envio internacional de cada oferta da comparação (lista oficial da
    ficha, lida no servidor). Sem resposta: mapa vazio (a tela não afirma). */
export function useEnvioInternacional(pedidoId: number | null | undefined, pronto: boolean) {
  const [dados, setDados] = useState<{
    pedido: number;
    envio: Record<string, EnvioInternacional>;
  } | null>(null);
  useEffect(() => {
    if (pedidoId == null || !pronto || dados?.pedido === pedidoId) return;
    let vivo = true;
    fetch("/api/public/envio-internacional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido: pedidoId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { envio?: Record<string, EnvioInternacional> } | null) => {
        if (vivo) setDados({ pedido: pedidoId, envio: j?.envio ?? {} });
      })
      .catch(() => vivo && setDados({ pedido: pedidoId, envio: {} }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, pronto]);
  return dados?.pedido === pedidoId ? dados.envio : null;
}
