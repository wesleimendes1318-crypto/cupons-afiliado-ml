import { afterEach, expect, test } from "bun:test";

import { carregarAte, passosIniciais, restamReservas } from "@/lib/amigo-secreto-busca";

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test("termos acabaram: entram os de reserva e a vitrine segue carregando", async () => {
  const lidos: string[] = [];
  let n = 0;
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body)) as { termo?: string; q?: string };
    lidos.push(String(corpo.termo ?? corpo.q ?? ""));
    n += 1;
    const id = `MLB${1000 + n}`;
    return new Response(
      JSON.stringify({ resultados: [{ produto: id, item: id, nome: `Camiseta masculina modelo ${n} ${"xyz".repeat(n)}`, imagem: null, preco: 50, url: "https://x", freteGratis: true }], proximo: null }),
      { status: 200 },
    );
  }) as typeof fetch;
  const r = await carregarAte({
    passos: passosIniciais(["a"]),
    faixa: { min: 0, max: 100 },
    vistos: new Set(),
    alvo: 3,
    termosReserva: ["b", "c", "d"],
  });
  expect(r.novos.length).toBeGreaterThanOrEqual(3);
  expect(r.passos.map((p) => p.termo)).toEqual(["a", "b", "c", "d"]);
  expect(restamReservas(r.passos, ["b", "c", "d", "e"])).toBe(true);
  expect(restamReservas(r.passos, ["b", "c"])).toBe(false);
});

test("freio: dois lotes seguidos sem nada na faixa param a carga (sem 30 chamadas)", async () => {
  let n = 0;
  globalThis.fetch = (async () => {
    n += 1;
    return new Response(JSON.stringify({ resultados: [], proximo: null }), { status: 200 });
  }) as typeof fetch;
  const r = await carregarAte({
    passos: passosIniciais(["a", "b", "c"]),
    faixa: { min: 0, max: 120 },
    vistos: new Set(),
    alvo: 12,
    termosReserva: ["d", "e", "f", "g", "h", "i", "j", "k"],
  });
  expect(r.travado).toBe(true);
  expect(r.novos.length).toBe(0);
  expect(n).toBeLessThanOrEqual(6);
});
