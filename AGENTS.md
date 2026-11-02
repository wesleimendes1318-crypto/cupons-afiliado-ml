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

## Custo real das ofertas

Toda conta de custo de oferta (tela, bot, garimpo) passa por `custoTotalDaOferta` em `src/lib/internacional.ts`: frete pago sem valor ou envio internacional sem tributos lidos = custo desconhecido. Assim um preço que não se entrega nunca vence.

## Busca por texto

- The post-search shopping assistant (`src/lib/assistente-busca.ts`, `/api/public/assistente-busca`) only picks and orders products already on screen and drops any model answer quoting a price not in the chosen items; this keeps it from inventing products or prices.
- "Load more" in text search continues from a server cursor (`proximo`) over the catalog (capped at position 120) and then brand variants; pages never re-read each other's window, so "+20" does not repeat cards.

- AdSense: manual units only via `src/components/Anuncio.tsx` in the Guides article template (mid + end), loaded only with ad consent; Auto Ads and Auto Optimization are ON in the AdSense panel since 02/11/2026 by owner decision, so Google may place ads site-wide (see docs/adsense.md).

## Listas de afiliado do Mercado Livre

- Curation of the affiliate bookmark lists runs only in the database (`curar_listas_afiliado`, SQL in `supabase/manutencao/20261102_listas_afiliado.sql`); the extension (`extensao/listas.js`) only executes what `listas_tarefas` returns and reports through `gravar_listas`. Why: one quality rule for every list, and the extension never decides which product enters.
- The extension never removes products it did not add (`nosso = false`) and never touches lists that are not the agent's; ML has no public list API, so it clicks like a person and replays the page's own request (template kept only in chrome.storage). Why: protect the affiliate account and the owner's manual lists.
