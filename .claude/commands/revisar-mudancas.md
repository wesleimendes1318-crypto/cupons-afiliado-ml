---
description: Runs the quality gate on the current diff before a commit or push.
---
Call `revisor-de-qualidade` on the current diff (`git diff` plus staged, against `main`). Do not edit code. Return PASS or FAIL with evidence; on FAIL list each blocker with `file:line` and the command that reproduces it.
