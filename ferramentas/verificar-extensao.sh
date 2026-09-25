#!/usr/bin/env bash
# Obrigatorio antes de publicar qualquer versao da extensao.
set -e
cd "$(dirname "$0")/.."
for f in extensao/*.js; do node --check "$f"; done
npx eslint --no-config-lookup -c ferramentas/eslint-extensao.mjs extensao/*.js
node --test extensao/testes/comparador.test.mjs
echo "EXTENSAO OK"
