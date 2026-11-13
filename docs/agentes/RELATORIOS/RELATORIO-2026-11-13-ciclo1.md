# Cycle report — 2026-11-13 (cycle 1, propor_pr)

Weslei, 13/11 12:06 BRT: "pode fazer merge do PR #157 e rodar todos agora para já garantir as melhorias".

## Executive summary
All five audit agents ran read-only in parallel (links, growth, SEO, conversion,
content). The director picked 3 low-risk changes outside `caminhos_de_risco`;
the quality reviewer returned PASS against the environment baseline. Risk-path
fixes (dead coupon button, rel=sponsored, comparison trust line, funnel events)
wait for Weslei's written ok.

## Baseline
- Sessions / searches / CTRs / fallback / timeout: sem dados (health endpoint blocked by the proxy; no DB read tool; metrics RPCs are founder-only).
- Events that exist: `visita`, `clique_afiliado`, `clique_telegram`, `busca_texto`, `impressao_campanha` (consent-gated, global cap 300/min).

## Findings (top)
| Evidence | I | C | E | ICE |
|---|---|---|---|---|
| R-20 dead coupon button risk, BuscaPorLink.tsx:3691-3697 | 4 | 4 | 5 | 80 (risk path) |
| R-01 no recurring link monitor report | 5 | 4 | 4 | 80 |
| R-03 fallback/timeout invisible, BuscaPorLink.tsx:4286 | 4 | 4 | 4 | 64 (risk path) |
| R-21 12 buy anchors without rel=sponsored | 2 | 5 | 5 | 50 (risk path) |
| R-09 11 indexable pages missing from sitemap | 4 | 3 | 3 | 36 |
| R-06 no disclosure next to the buy CTA | 3 | 3 | 4 | 36 |
| Guides: Article JSON-LD without author/date, FAQ not marked up | 3 | 4 | 4 | 48 |

## Changes applied
| File | Change | Risk | Rollback |
|---|---|---|---|
| public/sitemap.xml | +11 URLs: guide geladeira-frost-free-500l-comparativo, /amigo-secreto, /planejadores and its 8 slugs | low | revert |
| src/routes/guias.$slug.tsx | Article JSON-LD gets author (Weslei Mendes), publisher, dateModified from `atualizacao`; FAQPage JSON-LD from `perguntas`; byline + links to /sobre, /divulgacao-de-afiliados, /contato | low | revert |
| src/routes/produto.$id.tsx | line under the buy button: "Você não paga nada a mais pelo nosso link. O preço pode mudar na loja. Saiba mais" (only when the button exists; wording matches /divulgacao-de-afiliados) | low, no link/price change | revert |

## Validation
- Tests: 506 pass / 18 fail / 17 errors, identical to main (all missing modules: bun install gets proxy 403 here).
- Lint (touched files): only the pre-existing prettier error at guias.$slug.tsx:94.
- Typecheck: only missing-module cascades. Build: blocked by missing modules.
- 320px / 1280px: NOT verified (no build in this session). Text wraps; no fixed widths added.
- Rule no. 1: no CTA destination touched. Database, extension and frozen search: untouched.

## Expected impact
More guide/planner pages discovered; FAQ and author signals for guides; less hesitation at the product buy button. Watch: Search Console coverage for the 11 URLs; `clique_afiliado` with origem `pagina_produto` per visit, 2 weeks before vs after deploy.

## Residual risks
- Layout unverified at 320 px until Lovable builds it.
- Guide byline names Weslei publicly (his spec asked for "Autoria: Weslei Mendes").

## Next cycle (needs Weslei's ok on risk paths)
R-20 + R-21 in BuscaPorLink, trust line in the comparison, then R-03/R-02 events (additive migration first).
