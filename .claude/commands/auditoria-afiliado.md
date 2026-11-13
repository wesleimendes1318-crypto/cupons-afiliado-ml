---
description: Read-only audit of affiliate links and buy CTAs, with a PASS/FAIL report.
argument-hint: "[file or route, optional]"
---
Call `auditor-de-links` in READ-ONLY mode on `$ARGUMENTS` (empty = whole site). No branch, no code edits.
Write `docs/agentes/RELATORIOS/AUDITORIA-LINKS-<YYYY-MM-DD>.md`: critical FAILs at the top with a suggested fix, then the PASS/FAIL/REVIEW table per path. Add each FAIL to `docs/agentes/BACKLOG.md` with risk "alto".
