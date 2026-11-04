# Project rules (Weslei Mendes, melhorescolha.io)

Also read AGENTS.md (never force-push or rewrite published history).

This file is the always-loaded core. Detailed rules live in `docs/regras/`,
moved there verbatim (Portuguese, with Weslei's quotes, dates and order
numbers). **Before changing anything in an area, read its topic file.** The
detailed file wins over this summary when they differ. To find a rule, grep
`docs/regras/` for the old section title (e.g. "Amazon e Shopee sob demanda").

## Language
- Write internal material (this file, new rules, memory, commits, code
  comments) in English to save tokens (Weslei, 04/11/2026). Replies to Weslei
  and every user-facing string on the site stay in Portuguese.
- When a topic file is edited, it may be translated to English, but never drop
  quotes, dates, thresholds, order numbers or function names.

## Rule no. 1: ALWAYS return Weslei's affiliate link (10/10)
- Weslei: "SEMPRE DEVE DEVOLVER O MEU LINK. [...] essa é a minha fonte de
  renda por ser afiliado!". Above any other display rule, in every channel:
  site, showcases, campaigns, toys, guided search, photo search, Meus preços,
  bot, channel, Facebook and Shorts.
- Every buy path ends in HIS affiliate link: Mercado Livre only
  `https://meli.la/<code>`; Amazon `tag=melhoresc0fff-20` or amzn.to; Shopee
  s.shopee.com.br or shope.ee. Never a bare URL, never someone else's link,
  never a button that goes nowhere.
- Guarantee order (VerNaLoja / pedir_link_da_loja): link on screen → link
  already generated for the same listing (link_conhecido) → generated on click
  by the extension → after 6-12 s, the product page affiliate link
  (link_de_reserva) with the "o preço pode ser diferente" notice.
- Any change touching a button, link, showcase, bot or channel: verify before
  publishing that the path still ends in his link.
- Full rule: `docs/regras/afiliado-e-extensao.md`.

## Product in one paragraph
A price COMPARATOR for products sold on Mercado Livre (independent, no link
to ML; never ML logo/colors). The recommendation is always from ML; Amazon and
Shopee run on demand in their own sections. "Same product" only after the
photo check (two checks, Gemini/Gemma, confidence ≥ 90); a similar product
shown as identical is the worst possible error. Cheaper similar items go to
"Parecidos" / "Melhor alternativa" with "Muda: ..." spelled out. Details:
`docs/regras/comparacao.md`.

## Hard rules (never break)
- Never invent products, prices, shipping or advantages. A price shown must be
  the price the link opens; unknown cost never wins (`custoTotalDaOferta`).
- Never expose commission, earnings, sales, conversion or affiliate panel data
  in public routes, client code or UI.
- Never ask for or write keys in code or chat (Lovable Secrets only).
- Public DB functions that WRITE require the extension token (p_token) or stay
  DB-only. Protect writes; reads of showcases/past searches are public on
  purpose.
- Never mention AI in site copy or guides. Short texts, always a product
  photo, buy button "Comprar com segurança" (never the store name).
- Design and animation follow the site's current references (Apple-style
  tokens in `src/styles.css`, liquid glass bars, rounded-3xl cards). Check
  320 px width: no horizontal overflow.
- Protect the affiliate account: no read bursts, brake on captcha, one
  request at a time, no incognito.

## Database
- Only Weslei's own Supabase project `itgdvxvqbwjcvmglfval`
  (`mcp__Supabase__*`). Lovable's DB NEVER (23/10: "Não deve usar 1 crédito
  sequer!"): forbidden query_database, get_database_status, enable_database,
  send_message, create_project, remix_project. From Lovable only list_edits,
  get_project, deploy_project.
- Migrations are additive only, with a file in `supabase/migrations/`.
  Never change an existing function signature (create `_v2`).
- Lovable commits straight to main and does NOT apply SQL: after a Lovable
  batch, compare every `.rpc("x")` / `rpc/x` in `src` and `extensao` with
  `pg_proc` and apply what is missing.
- Env access only with dot notation (`import.meta.env.X`), never brackets
  (it inlined the whole .env, 19/10).
- Details: `docs/regras/operacao.md` ("Banco próprio no Supabase").

## Before publishing (checklist)
A PreToolUse hook (`.claude/hooks/portao-publicar.sh`) runs `bun test` and
blocks `git push`, `gh pr merge` and the GitHub merge tool when a test fails.
Still do by hand:
1. Affiliate path intact for every touched button/link/channel (rule no. 1).
2. Extension changed: `ferramentas/verificar-extensao.sh` and bump
   `extensao/manifest.json` version (Weslei runs ATUALIZAR-EXTENSAO.bat).
3. New/changed `.rpc()` calls exist in the DB (query above); SQL applied.
4. UI changed: screenshot at 320 px and 1280 px, no overflow.
5. Comparison changed: run `ferramentas/bateria-de-testes.sql` and check all
   targets before telling Weslei it is ready.
6. After merge: wait for Lovable `list_edits` "completed", then
   `deploy_project` (without it the site stays on the old version).

## Topic index (read before working in the area)
| File | Read when touching |
|---|---|
| `docs/regras/afiliado-e-extensao.md` | affiliate links, link recognition, shown price vs link price, extension paused/absent, ML affiliate lists |
| `docs/regras/comparacao.md` | same-product rules, photo check, alternatives, safe recommendation, Amazon/Shopee, reviews, delivery date, fakes |
| `docs/regras/visual-e-texto.md` | copy, brand, visual style, mobile width/zoom, home, photos, navigation, desktop, liquid glass |
| `docs/regras/vitrines-e-campanhas.md` | showcases, campaigns, art, best sellers, most wanted, guided search, categories, toys |
| `docs/regras/garimpo-e-inteligencia.md` | anonymous profile, sourcing (garimpo), intelligence operation, multi-player sourcing |
| `docs/regras/canais.md` | Telegram bot, price tracking, YouTube Shorts |
| `docs/regras/operacao.md` | agent team, customer-first queue, account security, per-release guarantees, own Supabase, publishing |
| `docs/agentes.md` | scheduled agent routines |
| `AGENTS.md` | cost of offers, text search assistant, AdSense, ML affiliate lists |

## Adding a rule
Put it in the matching `docs/regras/` file (English, with date and Weslei's
quote when there is one). Only promote it to this file if it applies to every
task.
