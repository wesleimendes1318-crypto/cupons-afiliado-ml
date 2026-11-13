# Revenue agents playbook (melhorescolha.io)

Installed 13/11/2026 at Weslei's request ("sistema permanente de agentes de receita").
Complements, does not replace, the scheduled routines in `docs/agentes.md`
(Guardião, Pesquisa, Manutenção, Segurança, Marca, Dados). `CLAUDE.md` and
`docs/regras/` win over this file.

## How it runs
- Agents: `.claude/agents/` (diretor-receita, auditor-de-links,
  engenheiro-de-conversao, engenheiro-de-seo, editor-de-conteudo,
  analista-de-growth, revisor-de-qualidade). Commands: `/ciclo-receita`,
  `/auditoria-afiliado`, `/revisar-mudancas`, `/backlog-receita`, `/novo-conteudo` (SEO guides, AdSense-safe, 13/11/2026).
- Subagents do not schedule themselves. Entry point is `/ciclo-receita`
  (on demand). Recurring options: (1) Weslei runs it weekly; (2) headless
  `claude -p "/ciclo-receita observar"` (validated flags: `-p`,
  `--permission-mode`; never `--dangerously-skip-permissions`); (3) a Claude
  Code routine like those in `docs/agentes.md`. The repo has no GitHub
  Actions, so no CI workflow was created.
- Autonomy (`config.json`): `observar` = read + reports; `propor_pr` (default)
  = branch, QA, PR; `auto_merge_seguro` = disabled (`permitir_auto_merge:
  false`); `produzir` (deploy) = forbidden without Weslei's written approval
  naming the PR. Merge and deploy are always Weslei's step.
- Never auto-merge, even if later enabled: price files, matching,
  recommendation gates, migrations, `src/routes/api/public/`, extension,
  anything that changes a link destination, the frozen search.

## North star
Revenue per 1,000 sessions. Funnel: session -> search or pasted link ->
result -> offer -> affiliate click -> sale. Protect existing revenue before
chasing growth. Secondary: offer->affiliate CTR, result->offer CTR,
fallback and extension-timeout rate, organic qualified clicks, pages indexed
with unique value, LCP/CLS/INP. Affiliate earnings stay private (never in
the repo or public code).

## Priorities
- **P0 integrity and measurement:** link/fallback monitor (`auditoria_exibicao`
  already flags `link_sem_afiliado`, `link_no_clique_falhou`), canonical
  events, sub-ID per placement only if the program supports it officially,
  funnel view, alerts for timeout/fallback/zero results.
- **P1 conversion:** verdict above the fold, instant CTA, sticky mobile CTA,
  transparent total cost, trust and disclosure, error/empty states,
  "Parecidos" separated.
- **P2 technical SEO:** SSR meta, canonical, real structured data, sitemap and
  robots, Core Web Vitals, internal links, index hygiene.
- **P3 content:** high-intent templates, unique value per page, E-E-A-T, real
  FAQ, Search Console-driven updates, no scaled thin content.
- **P4 experiments:** one variable at a time; hypothesis, metric, guardrails,
  duration; segment by device, store and intent.

## Persuasion: allowed when backed by real data (Weslei, 13/11/2026)
Weslei asked to drop the blanket "no dark patterns that induce purchase" ban
("precisa ter"). Purchase triggers ARE wanted; each needs a real source:
- Price drop vs our own price history ("Caiu R$ X desde <data>").
- "Últimas unidades" / low stock only when the store reports the quantity.
- Promotion end time only when the store shows it.
- Sold counts, ratings and review counts from the listing.
- Highlighted savings ("Economize R$ X") from `custoTotalDaOferta`.
- Sticky CTA, strong verdict, "Mais barato no total".
- Social proof from our own measured data (e.g. people tracking this price).
Still forbidden because they are deceptive and conflict with rule "never
invent" and consumer law (CDC): fake urgency or countdowns, invented scarcity,
fake reviews, hidden costs, pre-checked add-ons, confirmshaming, misdirection.

## Anti-patterns
Bare store link, someone else's link, dead button, infinite loading, fake
urgency, fake review, cloaking, doorway pages, copied content, "IA" in copy,
stale structured price, destructive migration, editing the frozen search.

## Notes from install (13/11/2026)
- The spec said the extension timeout is 6-8 s; the code and CLAUDE.md use
  6 s pending / 12 s total before `link_de_reserva`. Agents follow the code.
- Coupon flow (`routes/index.tsx` `paginaDaLoja`, `abrirLoja`) opens the
  seller's ML store page, not a meli.la link; see backlog R-17.
