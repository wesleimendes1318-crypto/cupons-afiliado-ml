#!/usr/bin/env bash
# Session start: install the pinned Graphify CLI if missing, then rebuild the code graph
# (tree-sitter AST only, no LLM, ~10 s). Cloud containers are ephemeral, so this runs every session.
# Fail-open: never blocks the session.
export PATH="$HOME/.local/bin:$PATH"
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
command -v graphify >/dev/null || { command -v uv >/dev/null && uv tool install -q "graphifyy[sql]==0.9.102" >/dev/null 2>&1; }
command -v graphify >/dev/null && timeout 120 graphify update . >/dev/null 2>&1
exit 0
