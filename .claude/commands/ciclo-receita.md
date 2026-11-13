---
description: Runs one revenue cycle (audit, prioritization, at most 3 changes, QA, PR). Never merges or deploys.
argument-hint: "[observar|propor_pr]"
---
Run one revenue cycle for melhorescolha.io. Mode: `$ARGUMENTS` (empty = `autonomia` in `docs/agentes/config.json`, default `propor_pr`). `auto_merge_seguro` and `produzir` are refused here: say so and run as `propor_pr`.

1. Read `CLAUDE.md`, `docs/agentes/PLAYBOOK-RECEITA.md` and `docs/agentes/config.json`. Note the start time; stop at `max_minutos_por_ciclo`.
2. `git status --short`. Unrelated uncommitted changes: stop and report.
3. In parallel: `auditor-de-links` (read-only) and `analista-de-growth`.
4. `diretor-receita` consolidates and writes `docs/agentes/PLANO-<YYYY-MM-DD>.md` with at most 3 items.
5. Mode `observar`: skip to step 10. Nothing outside `docs/agentes/` may change.
6. `git switch -c agentes/receita-<YYYY-MM-DD-HHMM>` from an up-to-date `main`.
7. For each item call the owner: conversion `engenheiro-de-conversao`; technical SEO `engenheiro-de-seo`; content `editor-de-conteudo`; links `auditor-de-links` (edit mode).
8. `revisor-de-qualidade` on the full diff. FAIL: fix only what it flagged, rerun once; still FAIL: abort, keep the branch unpushed, go to step 10.
9. PASS: commit (English message), `git push -u origin <branch>`, `gh pr create` (or the GitHub MCP tool) with the plan, QA result and rollback. Never merge: Weslei approves and merges, then deploys.
10. `diretor-receita` writes `docs/agentes/RELATORIOS/RELATORIO-<YYYY-MM-DD>.md`.
11. End with a 10-line summary in Portuguese for Weslei.

Stop at once on: any risk to rule no. 1; a gate failing without a safe fix; a non-additive migration; a change in `caminhos_de_risco` or the frozen search without Weslei's written approval; more than 3 changes or 20 files; over the time limit; doubt about a business rule; any need to read a secret.
