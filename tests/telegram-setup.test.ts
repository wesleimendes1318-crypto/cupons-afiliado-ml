import assert from "node:assert/strict";
import test from "node:test";
import { Route } from "../src/routes/api/public/telegram-setup";

test("setup do Telegram exige autorização, fixa destino e preserva mensagens", async () => {
  const originalFetch = globalThis.fetch;
  const nomes = ["API_TELEGRAM", "CRON_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const originais = nomes.map((nome) => process.env[nome]);
  const segredo = "segredo-ficticio-com-mais-de-16-caracteres";
  process.env["API_TELEGRAM"] = "token-ficticio";
  process.env["CRON_SECRET"] = segredo;
  process.env["SUPABASE_URL"] = "https://banco.example";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_ficticio";
  let chamadasTelegram = 0;
  let falhar = false;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://banco.example/")) {
      return Response.json({ valor: segredo });
    }
    assert.equal(url, "https://api.telegram.org/bottoken-ficticio/setWebhook");
    chamadasTelegram++;
    if (falhar) throw new Error(`Falha na URL ${url}`);
    assert.equal(init?.method, "POST");
    const corpo = JSON.parse(String(init?.body));
    assert.equal(corpo.url, "https://melhorescolha.io/api/public/telegram-webhook");
    assert.equal(corpo.drop_pending_updates, false);
    assert.equal(typeof corpo.secret_token, "string");
    return Response.json({ ok: true });
  };
  try {
    const handlers = Route.options.server!.handlers!;
    const get = await handlers.GET!({} as never);
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("Allow"), "POST");
    const chamar = (chave?: string) =>
      handlers.POST!({
        request: new Request("https://preview.example/api/public/telegram-setup", {
          method: "POST",
          headers: chave ? { "x-cron-secret": chave } : {},
        }),
      } as never);
    assert.equal((await chamar()).status, 403);
    assert.equal((await chamar("invalido")).status, 403);
    assert.equal(chamadasTelegram, 0);
    assert.equal((await chamar(segredo)).status, 200);
    assert.equal(chamadasTelegram, 1);
    falhar = true;
    const erro = await chamar(segredo);
    assert.equal(erro.status, 502);
    assert.equal((await erro.text()).includes("token-ficticio"), false);
  } finally {
    globalThis.fetch = originalFetch;
    nomes.forEach((nome, i) => {
      if (originais[i] === undefined) delete process.env[nome];
      else process.env[nome] = originais[i];
    });
  }
});
