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

function carregarFreio(store: Record<string, any>, onAviso: () => void) {
  const src = readFileSync(new URL("../extensao/background.js", import.meta.url), "utf8");
  const trecho = src.slice(src.indexOf("const PAUSAS_MS"), src.indexOf("let avisouLivre"));
  const chrome = { storage: { local: {
    get: async (k: string | string[]) => Object.fromEntries((Array.isArray(k) ? k : [k]).filter((x) => x in store).map((x) => [x, store[x]])),
    set: async (o: Record<string, unknown>) => { Object.assign(store, o); },
  } } };
  return new Function("chrome", "diaSP", "anotarEstadoRobo", "avisarQueEstouLivre", "avisarWeslei",
    trecho + "; return puxarFreio;")(chrome, () => "d", async () => {}, () => {}, async () => { onAviso(); });
}

// 17/11 (Weslei): "Enquanto não aprovar para não enviar notificações adicionais".
test("extensão: depois do 1º aviso, nenhum outro até o Weslei liberar", async () => {
  const store: Record<string, any> = {};
  let avisos = 0;
  const puxarFreio = carregarFreio(store, () => avisos++);
  await puxarFreio("captcha", "leitura");
  expect(avisos).toBe(1);
  expect(store.aguardandoAprovacao).toBeTruthy();
  // a pausa de 60 min acaba de madrugada e a leitura bate no mesmo captcha, 5 vezes
  for (let i = 0; i < 5; i++) {
    store.freio_leitura.ate = Date.now() - 1;
    store.freioAvisoAte = Date.now() - 1;
    await puxarFreio("captcha de novo", "leitura");
  }
  expect(avisos).toBe(1);
  // ele libera no popup (liberarFreio remove a trava): o próximo captcha avisa de novo
  delete store.aguardandoAprovacao;
  store.freio_leitura.ate = Date.now() - 1;
  store.freioAvisoAte = Date.now() - 1;
  await puxarFreio("captcha novo", "leitura");
  expect(avisos).toBe(2);
});

test("extensão: liberar no popup apaga a trava de aprovação", () => {
  const src = readFileSync(new URL("../extensao/background.js", import.meta.url), "utf8");
  const liberar = src.slice(src.indexOf("async function liberarFreio"), src.indexOf("let abaVerificacao"));
  expect(liberar).toContain("'aguardandoAprovacao'");
});

test("extensão: aviso no celular é silencioso das 22h às 8h", () => {
  const src = readFileSync(new URL("../extensao/background.js", import.meta.url), "utf8");
  const ini = src.indexOf("function horaDeDormirSP");
  const corpo = src.slice(ini, src.indexOf("\n}\n", ini) + 2);
  const dormir = new Function("minutosAgoraSP", corpo + "; return horaDeDormirSP;")(() => 0);
  expect(dormir(22 * 60)).toBe(true);
  expect(dormir(3 * 60)).toBe(true);
  expect(dormir(7 * 60 + 59)).toBe(true);
  expect(dormir(8 * 60)).toBe(false);
  expect(dormir(21 * 60 + 59)).toBe(false);
});
