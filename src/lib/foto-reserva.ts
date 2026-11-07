/* PHOTO FALLBACK (Weslei, 07/11 "Layer 6": never a broken-image icon). One
   capture listener for every <img> on the site: when a photo fails and its
   own component does not swap it (FotoProduto retries other sizes first),
   it becomes a neutral Apple-style placeholder. Opt out with
   data-sem-reserva (logos, art that hides itself). */
export const FOTO_RESERVA =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f5f5f7"/><g fill="none" stroke="#a1a1a6" stroke-width="3" stroke-linejoin="round"><path d="M40 48l20-10 20 10v26l-20 10-20-10z"/><path d="M40 48l20 10 20-10M60 58v26"/></g></svg>',
  );

type Foto = { src: string; hasAttribute(n: string): boolean; closest?(s: string): unknown };

/** Swap only a real photo that is still on the src that failed. */
export function deveTrocar(img: Foto, srcQueFalhou: string) {
  if (!srcQueFalhou || srcQueFalhou.startsWith("data:")) return false;
  if (img.src !== srcQueFalhou) return false;
  if (img.hasAttribute("data-sem-reserva") || img.closest?.("[data-sem-reserva]")) return false;
  return true;
}

export function instalarFotoReserva() {
  const aoFalhar = (e: Event) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const falhou = img.src;
    /* Let the component's own onError run first (it may try another size). */
    window.setTimeout(() => {
      if (!deveTrocar(img, falhou)) return;
      img.srcset = "";
      img.src = FOTO_RESERVA;
      img.style.objectFit = "cover";
    }, 0);
  };
  document.addEventListener("error", aoFalhar, true);
  return () => document.removeEventListener("error", aoFalhar, true);
}
