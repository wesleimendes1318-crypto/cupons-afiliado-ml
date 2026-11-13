# Revenue backlog

Rules: never delete an item without a reason (move it to "Archived"); max 30
active; every item needs evidence and a success criterion; risk "alto" needs
Weslei's written approval. ICE = I x C x E (1-5 each). Evidence verified on
main `066e774` (13/11/2026) unless marked "spec".

| ID | Hypothesis | Area | I | C | E | ICE | Risk | Owner | Evidence | Status | Success criterion |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | A recurring link/fallback monitor catches revenue leaks before Weslei does | P0 links | 5 | 4 | 4 | 80 | medio | auditor-de-links | `auditoria_exibicao(p_horas)` already flags `link_sem_afiliado`, `link_no_clique_falhou` (docs/agentes.md); no report from it in docs/agentes/ yet | open | weekly audit report; 0 grave items open > 24 h |
| R-03 | Measuring `link_de_reserva` use and extension timeouts shows how often the exact link is lost | P0 measurement | 4 | 4 | 4 | 64 | alto (touches BuscaPorLink VerNaLoja) | analista-de-growth | VerNaLoja falls back at 6 s pending / 12 s total (src/components/BuscaPorLink.tsx ~4286), no event emitted | open | fallback and timeout rate visible per day |
| R-02 | Canonical funnel events let us compute revenue/1,000 sessions | P0 measurement | 5 | 4 | 3 | 60 | medio (additive migration) | analista-de-growth | `registrar_evento` types today: `visita`, `busca_texto`, `clique_afiliado`, `clique_telegram`, `impressao_campanha` (src/lib/medicao.ts and callers); missing results_rendered, zero_results, offer_impression, fallback_used, extension_timeout, price_alert_signup | open | funnel report per page type with real counts |
| R-08 | Canonical + OG on every indexable route | P2 SEO | 3 | 4 | 4 | 48 | baixo | engenheiro-de-seo | `canonical` found in 9 route files; not checked on sobre, contato, telegram, favoritos, meus-precos | open | every indexable route renders canonical + OG |
| R-04 | Verdict with Produto + Frete = Total above the fold on mobile raises offer CTR | P1 conversion | 4 | 3 | 3 | 36 | medio | engenheiro-de-conversao | comparison redesign #156 just merged, not deployed (13/11); measure before changing | blocked: wait deploy + 2 weeks data | CTR offer->affiliate up vs sequential baseline |
| R-05 | Sticky buy bar on mobile on every result surface | P1 conversion | 3 | 3 | 4 | 36 | baixo | engenheiro-de-conversao | product page has a glass buy bar (PR #154), comparison has a fixed store bar (PR #139); other surfaces unverified | open | audit lists surfaces without sticky CTA = 0 |
| R-06 | Trust block (disclosure, "você não paga nada a mais", last check time) near the CTA | P1 conversion | 3 | 3 | 4 | 36 | baixo | engenheiro-de-conversao | `/divulgacao-de-afiliados` route exists; placement next to CTAs unverified | open | block visible at 320 px next to the main CTA |
| R-09 | Sitemap with lastmod and product URLs brings product pages into the index | P2 SEO | 4 | 3 | 3 | 36 | baixo | engenheiro-de-seo | `public/sitemap.xml` static, 39 URLs, 0 `lastmod`, 0 product URLs | open | generated sitemap with lastmod, Search Console "Discovered" up |
| R-11 | noindex on internal search/empty combos avoids thin pages | P2 SEO | 3 | 3 | 4 | 36 | baixo | engenheiro-de-seo | noindex only in lista.$id and campanhas.previa; `/?link=` and `/?q=` handling unverified | open | no search-result URL indexed |
| R-10 | Structured data with price timestamp, never stale | P2 SEO | 3 | 3 | 3 | 27 | medio (price) | engenheiro-de-seo | JSON-LD in produto.$id, categorias, guias, natal and others; timestamp/priceValidUntil unverified | open | Rich Results test with 0 errors, price = live price |
| R-13 | Breadcrumbs and internal links category -> product -> comparison | P2 SEO | 3 | 3 | 3 | 27 | baixo | engenheiro-de-seo | spec; not verified | open | breadcrumbs visible + BreadcrumbList on product/category |
| R-07 | Real-data purchase triggers (price drop vs history, store-reported stock, savings) lift CTR | P1 conversion | 4 | 2 | 3 | 24 | medio | engenheiro-de-conversao | Weslei 13/11: "precisa ter"; allowed list in PLAYBOOK | open | sequential test, CTR up with no complaint/refund signal |
| R-17 | Coupon "Usar este cupom" opens a bare ML store page (no meli.la) | P0 links | 4 | 3 | 2 | 24 | alto (rule no. 1) | auditor-de-links | `paginaDaLoja` returns `https://lista.mercadolivre.com.br/_CustId_<id>` or `/pagina/<x>`; `abrirLoja` opens it; plan B `listaDaCampanha` strips the query (src/routes/index.tsx 802-813, 992-996, 1026-1028). Attribution may rely on the coupon code; not documented in docs/regras | needs Weslei | Weslei confirms the coupon flow is attributed, or the store page goes through his affiliate link |
| R-12 | Core Web Vitals within targets on home and product page | P2 SEO | 3 | 2 | 3 | 18 | baixo | engenheiro-de-seo | sem dados (no field data in repo) | open: needs data | LCP < 2.5 s, CLS < 0.1, INP < 200 ms |
| R-14 | High-intent templates (vale a pena, X vs Y, melhor X) earn qualified clicks | P3 content | 4 | 2 | 2 | 16 | medio | editor-de-conteudo | guides exist at guias.$slug; needs Search Console demand data | open: needs data | pages with unique verdict + data; organic clicks per page |
| R-16 | CTA copy experiment | P4 experiment | 2 | 2 | 4 | 16 | baixo | engenheiro-de-conversao | CTA "Comprar com segurança" is a hard rule (CLAUDE.md); only secondary copy can be tested | open | sequential test result |
| R-18 | Price alert signup with LGPD consent | P1 conversion | 3 | 2 | 2 | 12 | medio | engenheiro-de-conversao | Meus preços + Telegram alerts exist; consent wording unverified | open | signup rate measured |
| R-15 | Sub-ID per placement attributes revenue to CTA position | P0 measurement | 4 | 1 | 2 | 8 | alto (link) | analista-de-growth | unknown whether ML/Amazon/Shopee programs support it officially for his account | open: needs check | official doc confirming support |
| R-19 | New stores only with Weslei's link | expansion | 2 | 2 | 1 | 4 | alto | diretor-receita | spec | parked | program approved and link generator in place |

## Missing at install (spec vs repo)
- Spec quality gates `bun run lint`/`typecheck`/`bun test` scripts: package.json only has `lint` (eslint .) and `build`; tests run with `bun test`, typecheck with `bunx tsc --noEmit`.
- No GitHub Actions in the repo: no CI workflow created (documented in PLAYBOOK).
- Spec URL patterns `/produto/<slug>-<id>`, `/comparar/<a>-vs-<b>`, `/melhor/<categoria>` do not exist; current routes are `/produto/$id`, `/categorias/$slug`, `/guias/$slug`. Changing URLs needs redirects and Weslei's ok.

## Archived
(none)
