<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Regra nº 1 do Weslei (10/10)

SEMPRE devolver o link de afiliado do Weslei em todo botão, mensagem e post
("essa é a minha fonte de renda por ser afiliado"). Detalhes e ordem de
garantia no topo do CLAUDE.md.

## Code map

Before changing code, read `docs/mapa-do-codigo.md`: what lives where, how
the areas connect, and the most connected files (widest impact). The extension
and the site share no code; they talk only through Supabase functions.

## Custo real das ofertas

Toda conta de custo de oferta (tela, bot, garimpo) passa por `custoTotalDaOferta` em `src/lib/internacional.ts`: frete pago sem valor ou envio internacional sem tributos lidos = custo desconhecido. Assim um preço que não se entrega nunca vence.

## Busca por texto

- The post-search shopping assistant (`src/lib/assistente-busca.ts`, `/api/public/assistente-busca`) only picks and orders products already on screen and drops any model answer quoting a price not in the chosen items; this keeps it from inventing products or prices.
- Typos are fixed once by `corrigirBusca` (`src/lib/corretor-busca.ts` engine, vocabulary built in `busca-intencao.ts`) before intent, shields and stock reads; it only rewrites a 5+ letter unknown word to a unique known type or brand with the same first letter. Why: "air fayer" must hit the air fryer shields, and a real word must never be rewritten.
- Own-stock search also reads `buscar_estoque_hibrido` (full text + trigram, RRF; SQL in `supabase/migrations/20261111150000_busca_estoque_hibrido.sql`), service_role only, and its rows pass the same `filtrarEstoque` shields; a database without it just skips it. Why: phrase relevance without trusting the database for quality rules.
- "Load more" in text search continues from a server cursor (`proximo`) over the catalog (capped at position 120) and then brand variants; pages never re-read each other's window, so "+20" does not repeat cards.

- AdSense: manual units only via `src/components/Anuncio.tsx` in the Guides article template (mid + end), loaded only with ad consent; Auto Ads and Auto Optimization are ON in the AdSense panel since 02/11/2026 by owner decision, so Google may place ads site-wide (see docs/adsense.md).

## Listas de afiliado do Mercado Livre

- Curation of the affiliate bookmark lists runs only in the database (`curar_listas_afiliado`, SQL in `supabase/manutencao/20261102_listas_afiliado.sql`); the extension (`extensao/listas.js`) only executes what `listas_tarefas` returns and reports through `gravar_listas`. Why: one quality rule for every list, and the extension never decides which product enters.
- Extension page clicks go through `extensao/escolha-pagina.js` (indexed clickable elements, ordered closed options, click only with confidence and no tie/occlusion, wait for DOM change instead of fixed sleeps; no LLM). Why: fast, free and never clicks the wrong thing on the affiliate account.
- The extension never removes products it did not add (`nosso = false`) and never touches lists that are not the agent's; ML has no public list API, so it clicks like a person and replays the page's own request (template kept only in chrome.storage). Why: protect the affiliate account and the owner's manual lists.
- Card "Acompanhar preço" bell (`LinhaComparar` in `src/components/BotoesCartao.tsx`) follows by URL via `acompanhar_por_link` (SQL in `supabase/manutencao/20261104_acompanhar_no_cartao.sql`); without a ready comparison it opens the comparison and the result auto-saves (`src/lib/acompanhar-cartao.ts`). Why: one-tap tracking without a second tracking path in the database.

## Text search domains
- Apparel, jewelry, shoes and bags widen the predicted catalog domain to its sibling family (`src/lib/familias-dominio.ts`), while the product type must still be in the title. Why: the official prediction returns one narrow domain and the catalog files the same pieces under siblings, which left those searches with 2-3 cards.

## Curation
- Every result list goes through `curarResultados` (`src/lib/curadoria.ts`) inside `buscaGuiada`, before the intent order; showcase-specific rules stay in `amigo-secreto-curadoria.ts`. Why: one quality bar for the whole site, word rules only (instant, free).
