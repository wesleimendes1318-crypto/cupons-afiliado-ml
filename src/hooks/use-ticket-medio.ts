/* Preço médio do que o visitante abriu (perfil anônimo, só com o
   consentimento de análise); 0 sem perfil. Lido no navegador, depois da
   hidratação: o HTML do servidor é igual para todos. */
import { useEffect, useState } from "react";

import { obterPerfil } from "@/lib/perfil-visitante";

export function useTicketMedio(): number {
  const [ticket, setTicket] = useState(0);
  useEffect(() => {
    setTicket(obterPerfil()?.ticketMedio ?? 0);
  }, []);
  return ticket;
}
