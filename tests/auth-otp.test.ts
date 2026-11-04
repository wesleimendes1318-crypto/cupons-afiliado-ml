import assert from "node:assert/strict";
import test from "node:test";

import {
  codigoValido,
  emailValido,
  encurtarEmail,
  juntarPreferencias,
  limparCodigo,
  mensagemDeErro,
  normalizarEmail,
} from "../src/lib/auth-otp";
import { destinoDoBotao, quedaValeAviso } from "../src/lib/alertas-email";

test("e-mail: valida e normaliza", () => {
  assert.equal(emailValido("fulano@gmail.com"), true);
  assert.equal(emailValido("  Fulano@Gmail.com "), true);
  assert.equal(emailValido("fulano@gmail"), false);
  assert.equal(emailValido("fulano gmail.com"), false);
  assert.equal(emailValido(""), false);
  assert.equal(normalizarEmail("  Fulano@Gmail.COM "), "fulano@gmail.com");
});

test("código: só dígitos, de 6 a 8, aceita colar com texto", () => {
  assert.equal(limparCodigo("123 456"), "123456");
  assert.equal(limparCodigo("Código: 1234-5678"), "12345678");
  assert.equal(limparCodigo("1234567890"), "12345678");
  assert.equal(codigoValido("123456"), true);
  assert.equal(codigoValido("12345678"), true);
  assert.equal(codigoValido("12345"), false);
  assert.equal(codigoValido("12a456"), false);
});

test("e-mail encurtado cabe na pílula", () => {
  assert.equal(encurtarEmail("ana@x.com"), "ana@x.com");
  const e = encurtarEmail("fulano.de.tal.silva@gmail.com");
  assert.ok(e.length <= 22, e);
  assert.ok(e.endsWith("…@gmail.com"), e);
});

test("erros do Supabase viram português", () => {
  assert.equal(
    mensagemDeErro({ message: "Token has expired or is invalid" }),
    "Código expirado ou inválido.",
  );
  assert.equal(
    mensagemDeErro({
      status: 429,
      message: "For security purposes, you can only request this after 42 seconds.",
    }),
    "Aguarde para reenviar.",
  );
  assert.equal(mensagemDeErro({ message: "missing email" }), "E-mail não informado.");
});

test("preferências: conta vence, o que só o navegador tem sobe", () => {
  const r = juntarPreferencias({ a: 1 }, { a: 2, b: 3 });
  assert.deepEqual(r.final, { a: 1, b: 3 });
  assert.deepEqual(r.aplicarLocal, ["a"]);
  assert.equal(r.subir, true);
  assert.equal(juntarPreferencias({ a: 1 }, { a: 1 }).subir, false);
});

test("aviso por e-mail: mesma regra do Telegram", () => {
  const base = { preco_alvo: null, aviso_email_preco: null, preco_ao_seguir: 100 };
  assert.equal(quedaValeAviso(99, base), true);
  assert.equal(quedaValeAviso(99.5, base), false);
  assert.equal(quedaValeAviso(80, { ...base, preco_alvo: 85 }), true);
  assert.equal(quedaValeAviso(80, { ...base, preco_alvo: 85, aviso_email_preco: 80 }), false);
});

test("botão do e-mail: só link de afiliado do Weslei, senão o site", () => {
  assert.equal(destinoDoBotao("https://meli.la/1AbC", "x").href, "https://meli.la/1AbC");
  const sem = destinoDoBotao(
    "https://produto.mercadolivre.com.br/MLB-1",
    "https://produto.mercadolivre.com.br/MLB-1",
  );
  assert.ok(sem.href.startsWith("https://melhorescolha.io/?link="), sem.href);
});
