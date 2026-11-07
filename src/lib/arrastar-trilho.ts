/* Drag to scroll (Weslei, 07/11: "permita a rolagem arrastando a tela").
   One document-level listener: a mouse/pen drag on any horizontally
   scrollable rail scrolls it. Touch already scrolls natively, so it is left
   alone; wheel and keyboard are untouched. A drag past LIMIAR px swallows the
   click that follows, so letting go over a card or buy link opens nothing. */

const LIMIAR = 6;
const CAMPO = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

function trilhoDe(alvo: Element | null): HTMLElement | null {
  for (let el = alvo as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const x = getComputedStyle(el).overflowX;
      if (x === "auto" || x === "scroll") return el;
    }
  }
  return null;
}

export function instalarArrastarTrilhos(): () => void {
  let trilho: HTMLElement | null = null;
  let inicioX = 0;
  let inicioScroll = 0;
  let arrastou = false;

  const soltar = () => {
    if (trilho) {
      // Restore snapping so the rail settles on the nearest card.
      trilho.removeAttribute("data-arrastando");
      document.documentElement.classList.remove("arrastando-trilho");
    }
    trilho = null;
  };

  const aoApertar = (e: PointerEvent) => {
    arrastou = false; // a drag whose click never fired must not eat this one
    if (e.pointerType === "touch" || e.button !== 0) return;
    const alvo = e.target as Element;
    if (alvo.closest(CAMPO)) return;
    trilho = trilhoDe(alvo);
    if (!trilho) return;
    inicioX = e.clientX;
    inicioScroll = trilho.scrollLeft;
  };

  const aoMover = (e: PointerEvent) => {
    if (!trilho) return;
    if (!(e.buttons & 1)) return soltar();
    const dx = e.clientX - inicioX;
    if (!arrastou) {
      if (Math.abs(dx) < LIMIAR) return;
      arrastou = true;
      trilho.setAttribute("data-arrastando", "");
      document.documentElement.classList.add("arrastando-trilho");
    }
    trilho.scrollLeft = inicioScroll - dx;
  };

  const aoClicar = (e: MouseEvent) => {
    if (!arrastou) return;
    arrastou = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // Native image/link dragging would steal the pointer from the rail.
  const aoArrastarNativo = (e: DragEvent) => {
    if (trilhoDe(e.target as Element)) e.preventDefault();
  };

  const opcoes = { capture: true } as const;
  document.addEventListener("pointerdown", aoApertar, opcoes);
  document.addEventListener("pointermove", aoMover, opcoes);
  document.addEventListener("pointerup", soltar, opcoes);
  document.addEventListener("pointercancel", soltar, opcoes);
  document.addEventListener("click", aoClicar, opcoes);
  document.addEventListener("dragstart", aoArrastarNativo, opcoes);
  return () => {
    soltar();
    document.removeEventListener("pointerdown", aoApertar, opcoes);
    document.removeEventListener("pointermove", aoMover, opcoes);
    document.removeEventListener("pointerup", soltar, opcoes);
    document.removeEventListener("pointercancel", soltar, opcoes);
    document.removeEventListener("click", aoClicar, opcoes);
    document.removeEventListener("dragstart", aoArrastarNativo, opcoes);
  };
}
