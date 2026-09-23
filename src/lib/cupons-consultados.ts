import { useCallback, useEffect, useState } from "react";

/**
 * Guarda no proprio navegador quais cupons a pessoa ja abriu no Mercado Livre.
 * Serve so para marcar o botao como "consultado" — nada e enviado para fora.
 */
const CHAVE = "cupons-consultados";
const EVENTO = "cupons-consultados-mudou";

function ler(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as unknown) : [];
    return Array.isArray(lista) ? lista.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
}

export function marcarConsultado(id: number) {
  if (typeof window === "undefined") return;
  const atual = ler();
  if (atual.includes(id)) return;
  const proximo = [...atual, id].slice(-500);
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(proximo));
  } catch {
    /* navegador sem espaco: seguir sem marcar */
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function useConsultado(id: number) {
  const [consultado, setConsultado] = useState(false);

  const sincronizar = useCallback(() => setConsultado(ler().includes(id)), [id]);

  useEffect(() => {
    sincronizar();
    window.addEventListener(EVENTO, sincronizar);
    window.addEventListener("storage", sincronizar);
    return () => {
      window.removeEventListener(EVENTO, sincronizar);
      window.removeEventListener("storage", sincronizar);
    };
  }, [sincronizar]);

  return consultado;
}
