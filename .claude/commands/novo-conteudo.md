---
description: Writes or refreshes up to 2 SEO guides with real data, AdSense-safe, and opens a PR. Never merges or deploys.
argument-hint: "[topic or guide slug, optional]"
---
Call `editor-de-conteudo` in content mode on `$ARGUMENTS` (empty = it picks up to 2 topics per its priority list).
1. `git status --short`; unrelated changes: stop. Create `agentes/conteudo-<YYYY-MM-DD-HHMM>` from an up-to-date `main`.
2. The agent edits only `src/content/guias.ts`, `public/sitemap.xml` and, if needed, `docs/agentes/BACKLOG.md`.
3. `revisor-de-qualidade` on the diff. FAIL: fix what it flagged once; still FAIL: stop and report.
4. PASS: commit, push, open a PR listing each page, its sources and the AdSense checklist result.
5. Reply to Weslei in Portuguese: pages written, sources, PR link. Merge and deploy are his step.
