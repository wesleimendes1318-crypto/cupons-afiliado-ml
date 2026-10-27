import assert from "node:assert/strict";
import test from "node:test";

import { analiseSoComAfiliado } from "@/lib/afiliado";
import { limparTitulo } from "@/lib/identificar-link";
import { ehTituloDeDesafio } from "@/lib/titulo-desafio";

test("o muro de verificação do Mercado Livre não é nome de produto", () => {
  assert.equal(ehTituloDeDesafio("Por segurança, complete esta etapa"), true);
  assert.equal(ehTituloDeDesafio("  Por seguranca complete esta etapa"), true);
  assert.equal(ehTituloDeDesafio("Robot Check"), true);
  assert.equal(limparTitulo("Por segurança, complete esta etapa"), null);
});

test("produto de verdade passa", () => {
  assert.equal(ehTituloDeDesafio("Câmera de Segurança Wi-Fi Intelbras"), false);
  assert.equal(ehTituloDeDesafio("Cadeado de segurança complete com 3 chaves"), false);
  assert.equal(ehTituloDeDesafio(null), false);
});

test("análise antiga com o título do muro chega à tela sem nome", () => {
  const a = analiseSoComAfiliado({ titulo: "Por segurança, complete esta etapa", preco: null });
  assert.equal(a?.titulo, null);
  assert.equal(analiseSoComAfiliado({ titulo: "Kit Wella" })?.titulo, "Kit Wella");
});
