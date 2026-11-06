/* "Compartilhar minha lista pública" on /favoritos (Weslei, 05/11/2026):
   asks an optional title and occasion, saves the selected items and gives a
   permanent /lista/<id> link (sharing again from this device updates the same
   link). Only items with Weslei's link or an ML address go in (server check). */
import { Check, Copy, Globe, LoaderCircle } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { linkWhatsApp, type ItemDesejo } from "@/lib/lista-desejos";
import { OCASIOES, salvarListaPublica, textoConvite } from "@/lib/lista-publica";

const botao =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] disabled:opacity-50";

export function CompartilharListaPublica({
  itens,
  ocasiaoFixa,
  slot,
  rotulo = "Compartilhar minha lista pública",
  aoGerar,
}: {
  itens: ItemDesejo[];
  /** Planners: the occasion is the planner's own (no picker). */
  ocasiaoFixa?: string;
  /** Separate owner key on this device (see salvarListaPublica). */
  slot?: string;
  rotulo?: string;
  aoGerar?: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [ocasiao, setOcasiao] = useState(ocasiaoFixa ?? OCASIOES[0]!);
  const [estado, setEstado] = useState<"form" | "salvando" | "erro">("form");
  const [url, setUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setEstado("salvando");
    const r = await salvarListaPublica({ titulo: titulo.trim(), ocasiao, itens }, slot);
    if (!r) return setEstado("erro");
    aoGerar?.(r.id);
    setUrl(r.url);
    setEstado("form");
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* the link stays visible to copy by hand */
    }
  }

  return (
    <Dialog onOpenChange={(aberto) => !aberto && setUrl(null)}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!itens.length}
          className={
            botao +
            " vidro-botao w-full border border-white/60 text-[#0071e3] shadow-sm sm:w-auto dark:border-white/10"
          }
        >
          <Globe className="size-4" aria-hidden="true" />
          {rotulo}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-3xl sm:max-w-md">
        <DialogTitle>Lista pública</DialogTitle>
        <DialogDescription>
          Quem abrir o link vê{" "}
          {itens.length === 1 ? "o item selecionado" : `os ${itens.length} itens selecionados`},
          pode comprar e marcar o que já comprou para ninguém repetir.
        </DialogDescription>
        {url ? (
          <div className="flex min-w-0 flex-col gap-3">
            <p className="break-all rounded-2xl bg-[#f5f5f7] px-3 py-2.5 text-sm font-medium dark:bg-white/5">
              {url}
            </p>
            <button
              type="button"
              onClick={() => void copiar()}
              className={botao + " border border-border bg-card"}
            >
              {copiado ? (
                <Check className="size-4 text-[#34c759]" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copiado ? "Link copiado" : "Copiar link público"}
            </button>
            <a
              href={linkWhatsApp(textoConvite({ titulo, ocasiao }, url))}
              target="_blank"
              rel="noopener noreferrer"
              className={botao + " bg-[#25D366] text-white hover:brightness-95"}
            >
              Compartilhar no WhatsApp
            </a>
          </div>
        ) : (
          <form
            className="flex min-w-0 flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void gerar();
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Nome da lista (opcional)
              <input
                value={titulo}
                maxLength={60}
                placeholder={
                  ocasiaoFixa ? `Ex.: ${ocasiaoFixa} da Ana` : "Ex.: Aniversário do Lucas"
                }
                onChange={(e) => setTitulo(e.target.value)}
                className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-base font-normal"
              />
            </label>
            {!ocasiaoFixa && (
              <fieldset className="flex flex-wrap gap-2">
                <legend className="mb-1 text-sm font-semibold">Ocasião</legend>
                {OCASIOES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={ocasiao === o}
                    onClick={() => setOcasiao(o)}
                    className={
                      "min-h-11 rounded-full px-3 text-sm font-semibold " +
                      (ocasiao === o ? "bg-[#0071e3] text-white" : "bg-card ring-1 ring-border")
                    }
                  >
                    {o}
                  </button>
                ))}
              </fieldset>
            )}
            <button
              type="submit"
              disabled={estado === "salvando"}
              className={botao + " bg-[#0071e3] text-white"}
            >
              {estado === "salvando" && (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              )}
              Gerar link público
            </button>
            {estado === "erro" && (
              <p className="text-center text-xs text-[#d70015]">
                Não deu para gerar o link agora. Tente de novo.
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
