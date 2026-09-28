/* ACOMPANHAR PREÇO (Weslei, 28/09, modelo de teste): a pessoa marca o
   produto e vê em "Meus preços" quando o preço cai. A conferência é feita
   de tempos em tempos (3 h a 12 h, conforme o preço mexe); o aviso é no site. */
import { Link } from "@tanstack/react-router";
import { BellRing, Check, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { idDoNavegador } from "@/lib/navegador";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AcompanharPreco({ pedidoId, preco }: { pedidoId: number; preco: number | null }) {
  const [estado, setEstado] = useState<"parado" | "alvo" | "salvando" | "ok" | "erro">("parado");
  const [alvo, setAlvo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const navegador = idDoNavegador();
    if (!navegador) {
      setErro(
        "Seu navegador não guarda dados deste site. Libere os dados do site para acompanhar.",
      );
      setEstado("erro");
      return;
    }
    const valor = Number(alvo.replace(/\./g, "").replace(",", "."));
    setEstado("salvando");
    const { error } = await supabase.rpc(
      "acompanhar_preco" as never,
      {
        p_pedido: pedidoId,
        p_navegador: navegador,
        p_alvo: alvo.trim() && valor > 0 ? valor : null,
      } as never,
    );
    if (error) {
      setErro(
        /limite de 20/.test(error.message)
          ? "Você já acompanha 20 produtos. Pare de acompanhar algum em Meus preços."
          : /limite do teste/.test(error.message)
            ? "O acompanhamento está no limite de produtos desta fase de teste."
            : /desligado/.test(error.message)
              ? "O acompanhamento de preço está pausado no momento."
              : "Não deu para salvar agora. Tente em instantes.",
      );
      setEstado("erro");
      return;
    }
    setEstado("ok");
  }

  if (estado === "ok")
    return (
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-xs">
        <Check className="size-4 text-success" aria-hidden="true" />
        <span className="font-semibold">Acompanhando o preço deste produto.</span>
        <Link to="/meus-precos" className="font-bold text-ml-blue hover:underline">
          Ver meus preços
        </Link>
      </p>
    );

  return (
    <div className="mt-3 rounded-md border border-border bg-card px-3 py-2">
      {estado === "parado" || estado === "erro" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-secondary-ink">
            <strong className="text-foreground">Vai comprar depois?</strong> Eu acompanho o preço e
            mostro quando cair.
          </p>
          <button
            type="button"
            onClick={() => setEstado("alvo")}
            className="inline-flex items-center gap-1.5 rounded-md border border-ml-blue px-3 py-1.5 text-xs font-bold text-ml-blue hover:bg-ml-blue/5"
          >
            <BellRing className="size-3.5" aria-hidden="true" />
            Acompanhar preço
          </button>
          {estado === "erro" && erro && <p className="w-full text-xs text-red-700">{erro}</p>}
        </div>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <label className="min-w-0 flex-1 text-xs">
            <span className="font-semibold">Me avise quando chegar a (opcional)</span>
            <input
              inputMode="decimal"
              placeholder={
                preco != null ? `ex.: ${brl(Math.floor(preco * 0.9))}` : "ex.: R$ 100,00"
              }
              value={alvo}
              onChange={(e) => setAlvo(e.target.value.replace(/[^\d.,]/g, ""))}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={estado === "salvando"}
            className="inline-flex items-center gap-1.5 rounded-md bg-ml-blue px-3 py-2 text-xs font-bold text-white hover:brightness-95 disabled:opacity-60"
          >
            {estado === "salvando" ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <BellRing className="size-3.5" aria-hidden="true" />
            )}
            Acompanhar
          </button>
        </form>
      )}
    </div>
  );
}
