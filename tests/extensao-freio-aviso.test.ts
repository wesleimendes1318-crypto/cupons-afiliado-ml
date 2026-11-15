import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 15/11: 10+ captcha hits in parallel sent 10+ phone alerts and escalated the pause to 60 min.
test("extensão: captchas em paralelo geram um aviso só e não renovam a pausa", async () => {
  const src = readFileSync(new URL("../extensao/background.js", import.meta.url), "utf8");
  const trecho = src.slice(src.indexOf("const PAUSAS_MS"), src.indexOf("let avisouLivre"));
  const store: Record<string, any> = {};
  let avisos = 0;
  const chrome = { storage: { local: {
    get: async (k: string | string[]) => Object.fromEntries((Array.isArray(k) ? k : [k]).filter((x) => x in store).map((x) => [x, store[x]])),
    set: async (o: Record<string, unknown>) => { await new Promise((r) => setTimeout(r, 5)); Object.assign(store, o); },
  } } };
  const puxarFreio = new Function("chrome", "diaSP", "anotarEstadoRobo", "avisarQueEstouLivre", "avisarWeslei",
    trecho + "; return puxarFreio;")(chrome, () => "d", async () => {}, () => {}, async () => { avisos++; });
  await Promise.all(Array.from({ length: 10 }, (_, i) => puxarFreio("x", i % 2 ? "leitura" : "etiqueta")));
  expect(avisos).toBe(1);
  expect(store.freio_leitura.vezes).toBe(1);
  expect(store.freio_etiqueta.vezes).toBe(1);
});
