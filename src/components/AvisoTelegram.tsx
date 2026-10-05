/* "Avisar no Telegram" (05/10): liga o aviso de preço de um produto que este
   navegador acompanha. Pede o código ao banco (alerta_telegram, só para quem
   segue o produto) e abre o bot com ?start=alerta_<codigo>. A janela abre
   no clique (antes da resposta) para o navegador não bloquear. */
import { useState } from "react";
import { Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { idDoNavegador } from "@/lib/navegador";
import { TELEGRAM_BOT } from "@/lib/telegram-publico";

export function AvisoTelegram({
  monitorId,
  className = "",
}: {
  monitorId: number | null | undefined;
  className?: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  if (!monitorId) return null;

  async function abrir() {
    setErro(null);
    const navegador = idDoNavegador();
    const janela = window.open("about:blank", "_blank");
    try {
      const { data, error } = await supabase.rpc(
        "alerta_telegram" as never,
        { p_navegador: navegador, p_monitor: monitorId } as never,
      );
      const codigo = typeof data === "string" ? data : null;
      if (error || !codigo) throw new Error("sem código");
      const url = `https://t.me/${TELEGRAM_BOT}?start=alerta_${codigo}`;
      if (janela) {
        janela.opener = null;
        janela.location.href = url;
      } else window.location.href = url;
    } catch {
      janela?.close();
      setErro("Não deu para ligar o aviso agora. Tente em instantes.");
    }
  }

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        onClick={() => void abrir()}
        data-origem="aviso_telegram"
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#229ED9] px-3 py-1.5 text-xs font-bold text-[#1c7fb0] hover:bg-[#229ED9]/10"
      >
        <Send className="size-3.5" aria-hidden="true" />
        Avisar no Telegram
      </button>
      {erro && <span className="mt-1 text-[11px] text-red-700">{erro}</span>}
    </span>
  );
}
