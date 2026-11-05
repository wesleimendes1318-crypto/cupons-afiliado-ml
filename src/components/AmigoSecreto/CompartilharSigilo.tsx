/* Ask a friend's opinion on WhatsApp without revealing who was drawn
   (Weslei, 05/11). The person picks which favorites go; every link is
   Weslei's affiliate link (rule no. 1); items without one are left out. */
import { LoaderCircle, MessageCircle, X } from "lucide-react";
import { useState } from "react";

import { textoSigiloWhatsApp, type ItemSigilo } from "@/lib/amigo-secreto-perfil";
import type { Favorito } from "@/lib/amigo-secreto-tipos";
import { buscarLinkAfiliado, itemDoProduto, linkWhatsApp } from "@/lib/lista-desejos";

export function CompartilharSigilo({ favoritos, faixa }: { favoritos: Favorito[]; faixa: string }) {
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const abrir = () => {
    setMarcados(new Set(favoritos.map((f) => f.produto)));
    setAviso(null);
    setAberto(true);
  };

  const enviar = async () => {
    setEnviando(true);
    setAviso(null);
    /* Opened now (popup blockers), filled after the links come back. */
    const janela = window.open("", "_blank");
    const itens: ItemSigilo[] = [];
    for (const f of favoritos.filter((x) => marcados.has(x.produto))) {
      const item = itemDoProduto({ chave: f.produto, titulo: f.nome, preco: f.preco, foto: f.imagem, url: f.url });
      const link = item ? await buscarLinkAfiliado(item) : null;
      if (link) itens.push({ titulo: f.nome, preco: f.preco ?? null, link });
    }
    setEnviando(false);
    if (!itens.length) {
      janela?.close();
      setAviso("Não deu para preparar os links agora. Tente de novo em instantes.");
      return;
    }
    const url = linkWhatsApp(textoSigiloWhatsApp(itens, faixa));
    if (janela) janela.location.href = url;
    else window.location.href = url;
    setAberto(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="vidro-botao inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold"
      >
        <MessageCircle className="size-4 text-[#34c759]" aria-hidden="true" />
        Pedir opinião no WhatsApp
      </button>
      {aberto && (
        <div role="dialog" aria-modal="true" aria-label="Pedir opinião no WhatsApp" className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" onClick={() => setAberto(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">Escolha o que mostrar</p>
                <p className="mt-0.5 text-xs text-secondary-ink">A mensagem não diz quem é o seu amigo secreto.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setAberto(false)} className="grid size-11 place-items-center rounded-full">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
              {favoritos.map((f) => (
                <li key={f.produto}>
                  <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted">
                    <input
                      type="checkbox"
                      className="size-5 accent-[#0071e3]"
                      checked={marcados.has(f.produto)}
                      onChange={() =>
                        setMarcados((s) => {
                          const n = new Set(s);
                          if (n.has(f.produto)) n.delete(f.produto);
                          else n.add(f.produto);
                          return n;
                        })
                      }
                    />
                    {f.imagem && <img src={f.imagem} alt="" className="size-10 shrink-0 rounded-lg object-contain" />}
                    <span className="line-clamp-2 text-sm">{f.nome}</span>
                  </label>
                </li>
              ))}
            </ul>
            {aviso && <p className="mt-2 text-xs font-semibold text-destructive">{aviso}</p>}
            <button
              type="button"
              disabled={!marcados.size || enviando}
              onClick={() => void enviar()}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#34c759] text-sm font-semibold text-white disabled:opacity-60"
            >
              {enviando && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Enviar {marcados.size} {marcados.size === 1 ? "opção" : "opções"} no WhatsApp
            </button>
          </div>
        </div>
      )}
    </>
  );
}
