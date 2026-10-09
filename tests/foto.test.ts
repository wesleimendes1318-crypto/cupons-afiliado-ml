import { test } from "node:test";
import assert from "node:assert/strict";

import { fotoNitida, fotoOriginalJpeg, idFotoMl, srcSetNitido } from "../src/lib/foto";

test("código da foto do mlstatic em várias formas", () => {
  assert.equal(
    idFotoMl("https://http2.mlstatic.com/D_NQ_NP_601002-MLU70683691691_072023-O.webp"),
    "601002-MLU70683691691_072023",
  );
  assert.equal(
    idFotoMl(
      "https://http2.mlstatic.com/D_NQ_NP_600123-MLB111692222478_062026-O-barra-led-inflavel.webp",
    ),
    "600123-MLB111692222478_062026",
  );
  assert.equal(
    idFotoMl("http://http2.mlstatic.com/D_602345-MLA43456789_012021-I.jpg"),
    "602345-MLA43456789_012021",
  );
  assert.equal(
    idFotoMl("https://http2.mlstatic.com/D_Q_NP_2X_881308-MLA99861611421_112025-R.webp"),
    "881308-MLA99861611421_112025",
  );
  assert.equal(idFotoMl("https://m.media-amazon.com/images/I/71abc._AC_UL320_.jpg"), null);
  assert.equal(idFotoMl(null), null);
});

test("versões nítidas e endereço de fora intacto", () => {
  const u = "https://http2.mlstatic.com/D_NQ_NP_601002-MLU70683691691_072023-O.webp";
  assert.equal(
    fotoNitida(u),
    "https://http2.mlstatic.com/D_NQ_NP_2X_601002-MLU70683691691_072023-V.webp",
  );
  assert.equal(
    fotoNitida(u, "grande"),
    "https://http2.mlstatic.com/D_NQ_NP_601002-MLU70683691691_072023-F.webp",
  );
  assert.match(srcSetNitido(u)!, /-V\.webp 640w, .*-F\.webp 1200w$/);
  assert.equal(
    fotoOriginalJpeg(u),
    "https://http2.mlstatic.com/D_NQ_NP_601002-MLU70683691691_072023-F.jpg",
  );
  const fora = "https://down-br.img.susercontent.com/file/abc";
  assert.equal(fotoNitida(fora), fora);
  assert.equal(srcSetNitido(fora), undefined);
});
