import { describe, expect, test } from "bun:test";

import { codigoValido, emailValido, limparCodigo } from "../src/lib/auth-otp";

describe("login por código", () => {
  test("aceita código de 8 dígitos", () => expect(codigoValido("12345678")).toBe(true));
  test("recusa código incompleto", () => expect(codigoValido("12345")).toBe(false));
  test("limpa espaços e corta em 8", () => expect(limparCodigo("1234 5678 9")).toBe("12345678"));
  test("e-mail válido", () => expect(emailValido("wes_lei18@hotmail.com")).toBe(true));
  test("e-mail sem domínio é recusado", () => expect(emailValido("wes@")).toBe(false));
});

import { destinoDoBotao, quedaValeAviso } from "../src/lib/alertas-email";

test("aviso por e-mail: só queda que vale", () => {
  const base = { preco_alvo: null, aviso_email_preco: null, preco_ao_seguir: 100 };
  expect(quedaValeAviso(99, base)).toBe(true);
  expect(quedaValeAviso(99.5, base)).toBe(false);
  expect(quedaValeAviso(80, { ...base, preco_alvo: 85 })).toBe(true);
  expect(quedaValeAviso(80, { ...base, preco_alvo: 85, aviso_email_preco: 80 })).toBe(false);
});

test("botão do e-mail: só link de afiliado, senão a comparação", () => {
  expect(destinoDoBotao("https://meli.la/1AbC", "x").href).toBe("https://meli.la/1AbC");
  const sem = destinoDoBotao(
    "https://www.mercadolivre.com.br/p/MLB1",
    "https://www.mercadolivre.com.br/p/MLB1",
  );
  expect(sem.href).toMatch(/\/\?link=/);
  expect(sem.texto).not.toBe("Comprar com segurança");
});
