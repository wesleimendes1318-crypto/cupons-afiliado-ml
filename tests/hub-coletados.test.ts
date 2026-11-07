import assert from "node:assert/strict";
import test from "node:test";

import { contarPorStatus, ondeNoSite, ORDEM_STATUS, type Coletado } from "../src/lib/hub-coletados";

const base = {
  url: "https://produto.mercadolivre.com.br/MLB-4455667788-x-_JM",
  categoria_site: "eletronicos",
};

test("site location only for items actually on the site", () => {
  assert.equal(ondeNoSite({ ...base, status: "link_pronto" }), null);
  const s = ondeNoSite({ ...base, status: "no_site" })!;
  assert.equal(s.vitrine, "https://melhorescolha.io/categorias/eletronicos");
  assert.equal(s.resultado, "https://melhorescolha.io/?link=" + encodeURIComponent(base.url));
  // "outros" (no category page) lands on the home showcase.
  assert.equal(
    ondeNoSite({ ...base, categoria_site: "outros", status: "no_site" })!.vitrine,
    "https://melhorescolha.io/",
  );
});

test("counts every status, zero when absent", () => {
  const c = contarPorStatus([
    { status: "no_site" },
    { status: "no_site" },
    { status: "na_fila" },
  ] as Coletado[]);
  assert.equal(c.no_site, 2);
  assert.equal(c.na_fila, 1);
  assert.equal(c.falhou, 0);
  assert.equal(Object.keys(c).length, ORDEM_STATUS.length);
});
