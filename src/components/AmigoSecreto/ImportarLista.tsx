/* "Colar lista do grupo": paste the draw message (names + wishes) and every
   person is created at once. */
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { importarListaWhatsapp } from "@/lib/amigo-secreto-parser-local";

const EXEMPLO = `Anna: roupa de academia (M pra shorts, G pra tops), livros, decoração Star Wars ou anéis prata
Nath - roupa P, calçado 35, skincare, acessórios dourados, plantas, bolsa`;

export function ImportarLista({
  aberto,
  aoFechar,
  aoImportar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoImportar: (texto: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [texto, setTexto] = useState("");
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  const pessoas = useMemo(() => importarListaWhatsapp(texto), [texto]);
  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      aria-labelledby="importar-titulo"
      className="painel m-auto w-[min(560px,calc(100vw-24px))] rounded-3xl border border-border bg-card p-0 text-foreground shadow-modal backdrop:bg-black/40"
    >
      <form
        method="dialog"
        className="flex flex-col gap-3 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pessoas.length) return;
          aoImportar(texto);
          setTexto("");
          aoFechar();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="importar-titulo" className="text-xl font-extrabold tracking-tight">
              Colar a lista do grupo
            </h2>
            <p className="mt-1 text-sm text-secondary-ink">
              Cole a mensagem do sorteio com os nomes e os pedidos. Uma pessoa por linha, com o nome no começo.
            </p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="vidro-botao grid size-11 shrink-0 place-items-center rounded-full">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, 8000))}
          rows={8}
          placeholder={EXEMPLO}
          className="rounded-2xl border border-border bg-background px-3 py-2 text-base"
        />
        <p className="text-xs text-secondary-ink" aria-live="polite">
          {pessoas.length
            ? `${pessoas.length} ${pessoas.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}: ${pessoas.map((p) => p.nome).join(", ")}`
            : "Nenhuma pessoa reconhecida ainda."}
        </p>
        <button
          type="submit"
          disabled={!pessoas.length}
          className="min-h-11 rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Montar vitrines de todos
        </button>
      </form>
    </dialog>
  );
}
