import { useEffect, useId, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, Search, X } from "lucide-react";

import type { ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";
import type { ItemAssistente, RespostaAssistente } from "@/lib/assistente-busca";

/* ASSISTENTE DE COMPRA (Weslei, 02/11): depois da busca, a pessoa diz o que
   importa e o assistente escolhe e ordena entre os produtos da tela. A
   compra continua pelos cartões (link de afiliado). Texto público sem citar
   IA. */

type CartaoAssistente = {
  chave: string;
  nome: string;
  preco: number | null;
  freteGratis: boolean | null;
  lojaOficial: boolean;
  maisVendido: number | null;
  avaliacao: string | null;
};

const SUGESTOES = [
  "Qual é o melhor custo-benefício?",
  "Só com frete grátis",
  "A mais bem avaliada",
  "Só de loja oficial",
];

export function AssistenteBusca({
  consulta,
  cartoes,
  notas,
  escolhidos,
  aoEscolher,
  buscarTermo,
}: {
  consulta: string;
  cartoes: CartaoAssistente[];
  notas: Map<string, ResumoAvaliacoes>;
  escolhidos: number | null;
  aoEscolher: (ids: string[] | null) => void;
  buscarTermo?: (t: string) => void;
}) {
  const id = useId();
  const [pedido, setPedido] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resposta, setResposta] = useState<RespostaAssistente | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setResposta(null);
    setErro(null);
    setPedido("");
  }, [consulta]);

  async function perguntar(texto: string) {
    const t = texto.trim();
    if (t.length < 2 || carregando) return;
    setPedido(t);
    setCarregando(true);
    setErro(null);
    const itens: ItemAssistente[] = cartoes.slice(0, 80).map((c) => {
      const a = c.avaliacao ? notas.get(c.avaliacao)?.avaliacoes : null;
      return {
        id: c.chave,
        nome: c.nome.slice(0, 160),
        preco: c.preco,
        freteGratis: c.freteGratis,
        lojaOficial: c.lojaOficial,
        nota: a?.nota ?? null,
        avaliacoes: a?.total ?? null,
        maisVendido: c.maisVendido,
      };
    });
    try {
      const r = await fetch("/api/public/assistente-busca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta: consulta.slice(0, 160), pedido: t.slice(0, 300), itens }),
      });
      const j = (await r.json()) as RespostaAssistente & { erro?: string };
      if (!r.ok || j.erro) {
        setErro(j.erro ?? "Não consegui responder agora. Tente de novo.");
        return;
      }
      setResposta(j);
      aoEscolher(j.ids.length ? j.ids : null);
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void perguntar(pedido);
  }

  function limpar() {
    setResposta(null);
    setErro(null);
    setPedido("");
    aoEscolher(null);
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="mt-3 rounded-2xl border border-[#0071e3]/15 bg-[#0071e3]/[0.04] p-3 sm:p-4"
    >
      <h3 id={`${id}-titulo`} className="flex items-center gap-1.5 text-sm font-semibold">
        <MessageCircle className="size-4 text-[#0071e3]" aria-hidden="true" />
        Assistente de compra
      </h3>
      <p className="mt-0.5 text-xs text-secondary-ink">
        Diga o que é importante para você e eu escolho entre estes produtos.
      </p>
      <form onSubmit={enviar} className="mt-2 flex gap-2">
        <label htmlFor={`${id}-campo`} className="sr-only">
          O que é importante para você?
        </label>
        <input
          id={`${id}-campo`}
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          maxLength={300}
          enterKeyHint="send"
          placeholder="Ex.: até R$ 3.000, 127V e bem avaliada"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 text-base outline-none focus-visible:border-[#0071e3] focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 sm:text-sm"
        />
        <button
          type="submit"
          disabled={carregando || pedido.trim().length < 2}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-sm font-semibold text-white transition hover:bg-[#0062c4] disabled:opacity-60"
        >
          {carregando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {carregando ? "Pensando…" : "Perguntar"}
        </button>
      </form>
      {!resposta && !carregando && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void perguntar(s)}
              className="vidro-botao min-h-8 rounded-full border border-black/10 px-3 text-xs font-medium text-[#0058b0]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div aria-live="polite">
        {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
        {resposta && (
          <div className="mt-3 rounded-2xl bg-white p-3 text-sm shadow-sm">
            <p>{resposta.resposta}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {escolhidos != null && (
                <span className="text-xs text-secondary-ink">
                  Mostrando {escolhidos === 1 ? "1 escolhida" : `${escolhidos} escolhidas`} para você.
                </span>
              )}
              {resposta.buscar && buscarTermo && (
                <button
                  type="button"
                  onClick={() => buscarTermo(resposta.buscar!)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#0071e3] px-3 text-xs font-semibold text-white"
                >
                  <Search className="size-3.5" aria-hidden="true" />
                  Buscar “{resposta.buscar}”
                </button>
              )}
              <button
                type="button"
                onClick={limpar}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-black/10 px-3 text-xs font-medium"
              >
                <X className="size-3.5" aria-hidden="true" />
                Ver todos de novo
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
