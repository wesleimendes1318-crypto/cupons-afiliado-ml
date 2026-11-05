# Code map (melhorescolha.io)

Generated 05/11/2026 from commit `c89c4bd` by Graphify (tree-sitter, no AI).
Regenerate: `graphify update . && python3 ferramentas/mapa-do-codigo.py`.
Counts are code links (imports, calls, references), not site traffic.
Read this before changing code to see what lives where and what a change can break.

```mermaid
flowchart TB
  paginas["Site pages<br/>272 pieces"]
  componentes["Screens and blocks<br/>507 pieces"]
  ui["Base UI kit<br/>273 pieces"]
  logica["Comparator engine<br/>1203 pieces"]
  lojas["Amazon and Shopee<br/>19 pieces"]
  servidor["Server and jobs<br/>151 pieces"]
  banco["Database (Supabase)<br/>462 pieces"]
  extensao["Browser extension<br/>531 pieces"]
  testes["Tests<br/>122 pieces"]
  shorts["YouTube Shorts<br/>201 pieces"]
  regras["Rules and docs<br/>192 pieces"]
  config["Packages and config<br/>255 pieces"]
  componentes ---|987| logica
  logica ---|518| servidor
  logica ---|301| testes
  logica ---|265| ui
  componentes ---|193| paginas
  logica ---|180| paginas
  config ---|109| ui
  componentes ---|106| config
  paginas ---|88| servidor
  extensao ---|83| testes
  config ---|53| servidor
  config ---|49| paginas
  paginas ---|34| ui
  config ---|29| logica
  logica ---|24| lojas
  extensao -.-|44 DB functions| banco
  logica -.-|49 DB functions| banco
```

Solid line: code links between areas (20+ shown). Dotted: Supabase functions called by name.

## Areas

| Area | Paths | Pieces | Files | What it is | Most connected |
|---|---|---|---|---|---|
| Site pages | `src/routes/*.tsx, src/router.tsx` | 272 | 28 | Routes visitors open: home (index.tsx), categories, campaigns, guides, Meus preços, admin. | `routeTree.gen.ts`, `index.tsx`, `FileRoutesByPath` |
| Screens and blocks | `src/components/ (except ui/)` | 507 | 56 | Blocks that build the pages: link search, guided search, showcases, marketplace comparison. | `BuscaPorLink.tsx`, `BuscaGuiada.tsx`, `VitrineSazonal.tsx` |
| Base UI kit | `src/components/ui/` | 273 | 46 | shadcn primitives: buttons, menus, forms, carousels. | `sidebar.tsx`, `Button`, `menubar.tsx` |
| Comparator engine | `src/lib/, src/hooks/, src/content/, src/integrations/` | 1203 | 118 | Same-product check, search, recommendations, shipping, delivery date, visitor profile, affiliate links. Center of the system. | `cn()`, `perfil-visitante.ts`, `client.server.ts` |
| Amazon and Shopee | `src/lib/integracoes/` | 19 | 3 | On-demand search in the other stores. | `amazon.ts`, `shopee.ts`, `buscarNaAmazon()` |
| Server and jobs | `src/routes/api/, src/server.ts, src/lib/mcp/` | 151 | 33 | Public APIs and scheduled jobs: sourcing cron, Telegram webhook, operation, search. | `cron-garimpo.ts`, `telegram-webhook.ts`, `operacao.ts` |
| Database (Supabase) | `supabase/, drizzle/` | 462 | 123 | Tables and functions in project itgdvxvqbwjcvmglfval. | `public.sinc_config`, `public.pedidos_link`, `00_base_lovable.sql` |
| Browser extension | `extensao/` | 531 | 17 | Generates Weslei's affiliate links and compares prices (background.js, comparador.js, sincronia.js). | `background.js`, `comparador.js`, `sincronia.js` |
| Tests | `tests/, extensao/testes/` | 122 | 56 | bun tests; a failure blocks push and merge. | `comparador.test.mjs`, `recomendacoes.test.ts`, `multiloja.test.mjs` |
| YouTube Shorts | `scripts/automacao_shorts/, ferramentas/video/` | 201 | 20 | Standalone Python pipeline: product radar, script, video edit, upload. | `gerador_roteiro.py`, `radar_produtos.py`, `Config` |
| Rules and docs | `CLAUDE.md, AGENTS.md, docs/` | 192 | 28 | Project rules, topic files, intelligence reports. | `visual-e-texto`, `Project rules (Weslei Mendes, melhorescolha.io)`, `Operação de inteligência — ciclo 1 (05/10/2026)` |
| Packages and config | `package.json, tsconfig.json, public/, .lovable/, ferramentas/` | 255 | 13 | Dependencies, TypeScript, app manifest, extension check tools. | `react`, `package.json`, `lucide-react` |

## Strongest links between areas

- Screens and blocks ↔ Comparator engine: 987
- Comparator engine ↔ Server and jobs: 518
- Comparator engine ↔ Tests: 301
- Comparator engine ↔ Base UI kit: 265
- Screens and blocks ↔ Site pages: 193
- Comparator engine ↔ Site pages: 180
- Packages and config ↔ Base UI kit: 109
- Screens and blocks ↔ Packages and config: 106

## Things the map makes clear

- The extension never imports site code. Extension and site talk only through Supabase functions (44 called by the extension, 49 by the site). Changing a function's signature breaks both sides: create a `_v2` instead (rule in CLAUDE.md).
- YouTube Shorts is standalone Python and shares no code with the site.
- Every buy path must still end in Weslei's affiliate link (rule no. 1); check the pieces below when touching links or buttons.

## Most connected pieces (widest impact when changed)

| # | Piece | File | Area | Links |
|---|---|---|---|---|
| 1 | `background.js` | `extensao/background.js` | Browser extension | 279 |
| 2 | `BuscaPorLink.tsx` | `src/components/BuscaPorLink.tsx` | Screens and blocks | 245 |
| 3 | `cn()` | `src/lib/utils.ts` | Comparator engine | 229 |
| 4 | `routeTree.gen.ts` | `src/routeTree.gen.ts` | Site pages | 173 |
| 5 | `react` | `package.json` | Packages and config | 117 |
| 6 | `index.tsx` | `src/routes/index.tsx` | Site pages | 115 |
| 7 | `BuscaGuiada.tsx` | `src/components/BuscaGuiada.tsx` | Screens and blocks | 107 |
| 8 | `VitrineSazonal.tsx` | `src/components/VitrineSazonal.tsx` | Screens and blocks | 93 |
| 9 | `package.json` | `package.json` | Packages and config | 84 |
| 10 | `comparador.js` | `extensao/comparador.js` | Browser extension | 77 |
| 11 | `perfil-visitante.ts` | `src/lib/perfil-visitante.ts` | Comparator engine | 74 |
| 12 | `cron-garimpo.ts` | `src/routes/api/public/cron-garimpo.ts` | Server and jobs | 73 |
