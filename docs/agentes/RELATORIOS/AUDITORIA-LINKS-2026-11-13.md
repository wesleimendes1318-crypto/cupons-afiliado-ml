# Affiliate link audit — 2026-11-13 (read-only, install dry-run)

Run inline during the install, following `.claude/agents/auditor-de-links.md`
in read-only mode, on main `066e774`. Scope: every `window.open` /
`location.href|assign` in `src/` plus the VerNaLoja guarantee chain. Not
covered this run (next audit): all 46 `href={...}` anchors one by one,
`src/routes/api/public/` link responses, the extension. No code changed.

## Critical / needs Weslei
- **REVIEW R-17 — coupon flow opens a bare ML store page.** `paginaDaLoja`
  (src/routes/index.tsx:802-813) returns `https://lista.mercadolivre.com.br/_CustId_<id>`
  or `www.mercadolivre.com.br/pagina/<x>`; `abrirLoja` (:992-996) opens it from
  "Usar este cupom" (:1035, :1136). Plan B `listaDaCampanha` (:1026-1028)
  strips the query string of `link_origem`. None is meli.la. Attribution may
  rely on the coupon code (comment at :1021-1025: "o Weslei quer a loja
  inteira"), but no rule in `docs/regras/` documents this exception. Not
  marked FAIL until Weslei confirms how these sales are attributed.

## Paths
| Component | file:line | Destination | Status | Action |
|---|---|---|---|---|
| VerNaLoja (buy button) | components/BuscaPorLink.tsx ~4181-4290 | link on screen -> `pedir_link_da_loja` -> `link_de_reserva` at 6 s pending / 12 s total | PASS | matches CLAUDE.md order; add fallback event (R-03) |
| Coupon redirect | components/BuscaPorLink.tsx:2241 | `destino` prop after 700 ms | REVIEW | trace callers of `destino` next run |
| WhatsApp share | components/BuscaPorLink.tsx:298, routes/index.tsx:570 | `wa.me` with the message text (link inside) | PASS | `noopener,noreferrer` set |
| Telegram share | components/BuscaPorLink.tsx:309 | `t.me/share/url?url=<affiliate link>` | PASS | `noopener,noreferrer` set |
| Detalhes "enviar" | components/DetalhesVitrine.tsx:726-738 | `buscarLinkAfiliado(item)`; closes the tab when no link | PASS | blank tab opened first, no `opener = null` (minor) |
| Telegram alert | components/AvisoTelegram.tsx:25-37 | bot URL from `alerta_telegram` | PASS (not a buy path) | minor: no `opener = null` |
| Amigo Secreto share | components/AmigoSecreto/CompartilharSigilo.tsx:27-42 | share URL | PASS (not a buy path) | — |
| Cards -> comparison | components/BotoesCartao.tsx:48, CatalogoCategoria.tsx:62, EmAltaCatalogo.tsx:162, BuscaGuiada.tsx:183 | internal `/?link=<url>` | PASS | ends in the comparison, which ends in VerNaLoja |
| Coupon store page | routes/index.tsx:992-996, 1035, 1136, 1150 | bare `lista.mercadolivre.com.br` / `/pagina/` | REVIEW | R-17 |
| OAuth consent | routes/[.]lovable.oauth.consent.tsx:66 | auth target | N/A | not a buy path |

## Findings for the backlog
- `rel="sponsored"` appears on 20 anchors vs 46 `target="_blank"`: check the
  remaining external affiliate anchors next run (Google guidance for affiliate
  links).
- Fallback and timeout are not measured (R-03).
