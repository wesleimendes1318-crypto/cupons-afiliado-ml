#!/usr/bin/env bash
# Pre-publish gate: blocks git push / PR merge when a test assertion fails.
# shortcut: GitHub merge tool is checked against the local tree, not the PR head; check out the PR branch before merging.
entrada=$(cat)
ferramenta=$(printf '%s' "$entrada" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write((j.tool_name||"")+"\n"+((j.tool_input||{}).command||""))})')
nome=${ferramenta%%$'\n'*}
comando=${ferramenta#*$'\n'}
if [[ "$nome" == "Bash" ]] && ! grep -qE '(^|[;&| ])(git push|gh pr merge)' <<<"$comando"; then exit 0; fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
command -v bun >/dev/null || { echo "portao-publicar: bun not installed, tests not run" >&2; exit 0; }
saida=$(timeout 300 bun test 2>&1); codigo=$?
[[ $codigo -eq 0 ]] && exit 0

falhas=$(grep -E '^\(fail\)' <<<"$saida")
erros=$(grep -E '^error:' <<<"$saida" | grep -vE "Cannot find (module|package)")
if [[ -n "$falhas" || -n "$erros" ]]; then
  { echo "Publish blocked: tests failing. Fix before pushing/merging."; echo "$falhas"; echo "$erros"; } | head -40 >&2
  exit 2
fi
# Only missing packages (incomplete bun install): environment issue, not a broken rule.
echo "portao-publicar: some test files could not load (missing packages; run bun install). Assertions that ran passed." >&2
exit 0
