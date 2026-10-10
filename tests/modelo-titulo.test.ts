import { test } from "node:test";
import assert from "node:assert/strict";

import { diferencaDeModelo } from "../src/lib/modelo-titulo";
import { limparResultado } from "../src/lib/multiloja-resultado";

test("modelo diferente pelo título (versão ou geração)", () => {
  assert.equal(
    diferencaDeModelo(
      "Amazon Echo Dot 5ª Geração Com Alexa E Som Inteligente",
      "Amazon Echo Dot Max (Geração mais recente), smart speaker com Alexa",
    ),
    "Modelo: 5ª geração -> Max",
  );
  assert.equal(
    diferencaDeModelo("Echo Dot 5ª Geração Preto", "Echo Dot 4ª Geração Azul"),
    "Modelo: 5ª geração -> 4ª geração",
  );
  assert.equal(
    diferencaDeModelo("Galaxy S24 128GB", "Galaxy S24+ 256GB"),
    "Modelo: versão padrão -> Plus",
  );
  assert.equal(diferencaDeModelo("iPhone 15 Pro 128GB", "Apple iPhone 15 Pro (128 GB)"), null);
  // Sem geração num dos lados não é diferença; cor sozinha também não.
  assert.equal(diferencaDeModelo("Echo Dot 5ª Geração Preto", "Echo Dot 5 Alexa Azul"), null);
  assert.equal(
    diferencaDeModelo("Air Fryer Mondial 4L", "Fritadeira Air Fryer Mondial 4 Litros"),
    null,
  );
  assert.equal(diferencaDeModelo(null, "Echo Dot Max"), null);
});

test("resultado das outras lojas: modelo diferente nunca é mesmo produto", () => {
  const loja = {
    marketplace: "amazon",
    id: "B0DKLNNYY4",
    titulo: "Amazon Echo Dot Max (Geração mais recente), smart speaker",
    preco: 608.99,
    link: "https://www.amazon.com.br/dp/B0DKLNNYY4?tag=melhoresc0fff-20",
    relacao: "mesmo",
    muda: "Cor: Preto -> Roxo",
    qualidade: "equivalente",
    semelhanca: 90,
  };
  const r = limparResultado({ ativo: true, lojas: [loja] }, "Amazon Echo Dot 5ª Geração Com Alexa");
  assert.equal(r.lojas[0]!.relacao, "parecido");
  assert.equal(r.lojas[0]!.muda, "Modelo: 5ª geração -> Max; Cor: Preto -> Roxo");
  assert.equal(r.lojas[0]!.qualidade, null);
  // Sem o título do colado, nada muda.
  assert.equal(limparResultado({ ativo: true, lojas: [loja] }).lojas[0]!.relacao, "mesmo");
});
