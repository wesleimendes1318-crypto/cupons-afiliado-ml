/* Glass card with what the person asked for, the sizes read from it and the
   actions: edit, refresh showcases, "Presente já escolhido", remove. */
import { Check, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { selosDeTamanho } from "@/lib/amigo-secreto-parser-local";
import type { Amigo } from "@/lib/amigo-secreto-tipos";

export function PainelDesejosAmigo({
  amigo,
  processando,
  aoSalvar,
  aoReprocessar,
  aoMarcarComprado,
  aoExcluir,
}: {
  amigo: Amigo;
  processando: boolean;
  aoSalvar: (nome: string, desejos: string) => void;
  aoReprocessar: () => void;
  aoMarcarComprado: (v: boolean) => void;
  aoExcluir: () => void;
}) {
  const [editando, setEditando] = useState(!amigo.desejosTexto);
  const [nome, setNome] = useState(amigo.nome);
  const [desejos, setDesejos] = useState(amigo.desejosTexto);
  useEffect(() => {
    setNome(amigo.nome);
    setDesejos(amigo.desejosTexto);
    setEditando(!amigo.desejosTexto);
  }, [amigo.id, amigo.nome, amigo.desejosTexto]);
  const selos = selosDeTamanho(amigo.tamanhosIdentificados);
  const botao =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]";

  return (
    <section
      aria-label={`Pedidos de ${amigo.nome}`}
      className={
        "vidro-barra animate-cartao relative overflow-hidden rounded-3xl border border-white/60 p-4 shadow-sm transition-opacity duration-300 sm:p-6 dark:border-white/10 " +
        (amigo.comprado ? "opacity-80" : "")
      }
    >
      {editando ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim() && desejos.trim().length > 2) {
              aoSalvar(nome.trim(), desejos.trim());
              setEditando(false);
            }
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-secondary-ink">
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value.slice(0, 40))}
              className="h-11 rounded-xl border border-border bg-card px-3 text-base text-foreground"
              placeholder="Ex.: Anna"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-secondary-ink">
            O que a pessoa gostaria de ganhar
            <textarea
              value={desejos}
              onChange={(e) => setDesejos(e.target.value.slice(0, 600))}
              rows={4}
              className="rounded-xl border border-border bg-card px-3 py-2 text-base text-foreground"
              placeholder="Ex.: roupa de academia (M pra shorts, G pra tops), livros, decoração Star Wars ou anéis prata"
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={botao + " bg-[#0071e3] text-white"}>
              Montar vitrines
            </button>
            {amigo.desejosTexto && (
              <button type="button" onClick={() => setEditando(false)} className={botao + " vidro-botao"}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className={
                  "text-2xl font-extrabold tracking-tight transition-all duration-500 " +
                  (amigo.comprado ? "text-secondary-ink line-through decoration-[#34c759] decoration-[3px]" : "")
                }
              >
                {amigo.nome}
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground/90">“{amigo.desejosTexto}”</p>
            </div>
            <button
              type="button"
              onClick={() => setEditando(true)}
              aria-label="Editar pedidos"
              className="vidro-botao grid size-11 shrink-0 place-items-center rounded-full"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </div>
          {selos.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tamanhos">
              {selos.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-[#0071e3]/10 px-2.5 py-1 text-xs font-bold text-[#0058b0] dark:text-[#64a8ff]"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
          {selos.length > 0 && (
            <p className="mt-1.5 text-[11px] text-secondary-ink">Escolha o tamanho na página da loja antes de comprar.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={amigo.comprado}
              onClick={() => aoMarcarComprado(!amigo.comprado)}
              className={
                botao +
                (amigo.comprado ? " bg-[#34c759] text-white shadow-sm" : " bg-card text-foreground ring-1 ring-border")
              }
            >
              <Check className={"size-4 transition-transform duration-300 " + (amigo.comprado ? "scale-110" : "")} aria-hidden="true" />
              {amigo.comprado ? "Presente já escolhido" : "Marcar presente escolhido"}
            </button>
            <button type="button" onClick={aoReprocessar} disabled={processando} className={botao + " vidro-botao disabled:opacity-60"}>
              <RefreshCw className={"size-4 " + (processando ? "animate-spin" : "")} aria-hidden="true" />
              Atualizar vitrines
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Tirar ${amigo.nome} da lista?`)) aoExcluir();
              }}
              className={botao + " text-[#b3261e] hover:bg-[#b3261e]/5"}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remover
            </button>
          </div>
        </>
      )}
    </section>
  );
}
