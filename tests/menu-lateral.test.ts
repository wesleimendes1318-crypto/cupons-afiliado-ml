import { describe, expect, it } from "bun:test";

import { itemAtivo } from "@/components/MenuLateral";
import { deveTrocar, FOTO_RESERVA } from "@/lib/foto-reserva";

describe("menu lateral", () => {
  it("marca a página e as filhas, e o início só no /", () => {
    expect(itemAtivo("/", "/")).toBe(true);
    expect(itemAtivo("/", "/categorias")).toBe(false);
    expect(itemAtivo("/planejadores", "/planejadores/casa-nova")).toBe(true);
    expect(itemAtivo("/painel", "/painel-x")).toBe(false);
  });
});

describe("foto de reserva", () => {
  const img = (src: string, semReserva = false) => ({
    src,
    hasAttribute: (n: string) => semReserva && n === "data-sem-reserva",
  });
  it("troca só a foto que continua no endereço que falhou", () => {
    expect(deveTrocar(img("https://x/a.jpg"), "https://x/a.jpg")).toBe(true);
    expect(deveTrocar(img("https://x/b.jpg"), "https://x/a.jpg")).toBe(false);
    expect(deveTrocar(img(FOTO_RESERVA), FOTO_RESERVA)).toBe(false);
    expect(deveTrocar(img("https://x/a.jpg", true), "https://x/a.jpg")).toBe(false);
  });
});
