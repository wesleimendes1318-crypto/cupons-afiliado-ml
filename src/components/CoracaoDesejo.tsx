/* Heart on product cards (wishlist, 05/11/2026). BotaoCoracao is the shared
   look (also the per-person heart of Amigo Secreto); CoracaoDesejo saves the
   product in the device/account wishlist (src/lib/lista-desejos.ts). */
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import {
  alternar,
  itemDoProduto,
  mudarLista,
  useListaDesejos,
  type ProdutoDesejo,
} from "@/lib/lista-desejos";

export function BotaoCoracao({
  ativo,
  aoTocar,
  rotulo,
  compacto = false,
}: {
  ativo: boolean;
  aoTocar: () => void;
  rotulo?: string;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={rotulo ?? (ativo ? "Tirar dos favoritos" : "Favoritar")}
      title={ativo ? "Na sua lista de desejos" : "Salvar na lista de desejos"}
      onClick={(e) => {
        /* The card photo opens details; the heart never does. */
        e.stopPropagation();
        e.preventDefault();
        aoTocar();
      }}
      className={
        "vidro-botao grid place-items-center rounded-full shadow-sm transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
        (compacto ? "size-9" : "size-11")
      }
    >
      <Heart
        className={
          (compacto ? "size-[18px]" : "size-5") +
          " transition-all duration-300 " +
          (ativo ? "scale-110 fill-[#ff2d55] text-[#ff2d55]" : "text-[#1d1d1f] dark:text-white")
        }
        aria-hidden="true"
      />
    </button>
  );
}

/** Wishlist heart for a product; renders nothing when the product cannot be
    bought through Weslei's link (rule no. 1). */
export function CoracaoDesejo({
  produto,
  compacto = false,
}: {
  produto: ProdutoDesejo;
  compacto?: boolean;
}) {
  const lista = useListaDesejos();
  const item = itemDoProduto(produto);
  if (!item) return null;
  const ativo = lista.itens.some((i) => i.id === item.id);
  return (
    <BotaoCoracao
      ativo={ativo}
      compacto={compacto}
      rotulo={
        ativo
          ? `Tirar da lista de desejos: ${item.titulo}`
          : `Salvar na lista de desejos: ${item.titulo}`
      }
      aoTocar={() => mudarLista((l) => alternar(l, item))}
    />
  );
}

/** Header shortcut to /favoritos with the count (every width). */
export function AtalhoFavoritos() {
  const n = useListaDesejos().itens.length;
  return (
    <Link
      to="/favoritos"
      aria-label={
        n ? `Lista de desejos: ${n} ${n === 1 ? "produto" : "produtos"}` : "Lista de desejos"
      }
      title="Lista de desejos"
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full vidro-botao min-[400px]:size-10 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
    >
      <Heart
        className={
          "size-5 " + (n ? "fill-[#ff2d55] text-[#ff2d55]" : "text-[#1d1d1f] dark:text-white")
        }
        aria-hidden="true"
      />
      {n > 0 && (
        <span
          key={n}
          className="animate-cartao absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[#ff2d55] px-1 text-[10px] font-bold leading-[18px] text-white"
          aria-hidden="true"
        >
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
