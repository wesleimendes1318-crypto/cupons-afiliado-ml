import assert from "node:assert/strict";
import test from "node:test";

import { dataIso } from "../src/lib/autor";

// Google Search Console: "O valor de datetime para dateModified não é válido"
// em /sobre (ProfilePage). Data precisa de hora + offset ISO 8601.
test("dataIso devolve ISO 8601 completo com offset de São Paulo", () => {
  assert.equal(dataIso("13/11/2026"), "2026-11-13T00:00:00-03:00");
  assert.equal(dataIso("  23/09/2026  "), "2026-09-23T00:00:00-03:00");
});

test("dataIso descarta o que não é dd/mm/aaaa", () => {
  assert.equal(dataIso("2026-11-13"), undefined);
  assert.equal(dataIso("13/11/26"), undefined);
  assert.equal(dataIso(""), undefined);
});
