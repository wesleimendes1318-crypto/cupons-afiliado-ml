import { useEffect, useState } from "react";

import {
  lerConsentimento,
  observarConsentimento,
  type Preferencias,
} from "@/lib/consentimento";

/* Lê a preferência só depois da hidratação: no servidor não existe
   localStorage, e ler no primeiro render causaria diferença entre o HTML
   enviado e o que o navegador monta. */
export function useConsentimento() {
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setPreferencias(lerConsentimento());
    setPronto(true);
    return observarConsentimento(setPreferencias);
  }, []);

  return { preferencias, pronto };
}
