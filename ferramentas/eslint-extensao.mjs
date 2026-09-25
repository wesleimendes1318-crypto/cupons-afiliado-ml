/* Verificacao da extensao: pega variavel/funcao usada sem existir (no-undef).
   Foi um erro assim (MAX_CANDIDATOS_IA sem import, 1.97.0) que derrubou a
   comparacao inteira; "node --check" so confere sintaxe e deixou passar. */
import globals from '../node_modules/globals/index.js';
export default [{
  files: ['extensao/**/*.js', 'extensao/**/*.mjs'],
  languageOptions: {
    ecmaVersion: 2022, sourceType: 'module',
    globals: { ...globals.browser, ...globals.webextensions, ...globals.serviceworker, ...globals.node, chrome: 'readonly' }
  },
  rules: { 'no-undef': 'error' }
}];
