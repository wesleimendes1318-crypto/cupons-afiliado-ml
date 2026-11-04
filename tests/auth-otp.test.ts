import { describe, expect, test } from "bun:test";

import { codigoValido, emailValido, limparCodigo } from "../src/lib/auth-otp";

describe("login por código", () => {
  test("aceita código de 8 dígitos", () => expect(codigoValido("12345678")).toBe(true));
  test("recusa código incompleto", () => expect(codigoValido("12345")).toBe(false));
  test("limpa espaços e corta em 8", () => expect(limparCodigo("1234 5678 9")).toBe("12345678"));
  test("e-mail válido", () => expect(emailValido("wes_lei18@hotmail.com")).toBe(true));
  test("e-mail sem domínio é recusado", () => expect(emailValido("wes@")).toBe(false));
});
