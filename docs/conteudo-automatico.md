# Automatic data guides (weekly, 13/11/2026)

Weslei, 13/11/2026: "preciso que a criação seja automatica e autonoma, que nao
dependa de min ou input. ainda, precisa ser dados relevantes, reais,
verdadeiros e que despertem o desejo de compra".

A weekly scheduled task runs this procedure and opens ONE PR. It never merges,
deploys or applies SQL (Weslei approves each PR in writing).

## What updates by itself (no PR needed)
- Department pages read `estatisticas_categoria()` on every visit
  (`src/lib/dados-categoria.ts`). New categories appear once they reach 20
  comparisons.

## Weekly PR
1. Run the queries in `ferramentas/dados-guias.sql` (Supabase project
   itgdvxvqbwjcvmglfval, read-only `execute_sql`).
2. Refresh the dated numbers in `quanto-se-economiza-comparando-lojas` and in
   `como-saber-se-um-desconto-e-realmente-vantajoso` (period, n, tables,
   resumo30, perguntas, `atualizacao`, `verificado`, sitemap `lastmod`).
3. Pick at most ONE new product guide: the most compared product family of
   the last 14 days with >= 3 comparisons and >= 4 stores
   (query 3). Use `lava-e-seca-midea-11kg-comparativo` as the template:
   resumo30, h2 as buyer questions with the direct answer in the first
   sentence, a semantic `tabela`, a section "Quando o seu anúncio já é o
   melhor" when the data shows it, an alert for offers 30%+ below official
   stores (never name the seller), a `chamada` block, 3 FAQs, >= 800 words.
   Add it to the sitemap and set `categoria` + `relacionados`.
4. `bun test`, render check at 320 px, then PR to main with the queries'
   output summarized in the body.

## Hard rules for the text
- Every number comes from a query result with its date range and sample size.
  No estimate, no rounding that changes meaning, no invented percentages.
- Persuasion only with true facts: real savings, real price swings, "você
  compra no Mercado Livre, com pagamento protegido". Every CTA ends in
  Weslei's affiliate link (rule no. 1); internal CTAs go to `/` or
  `/meus-precos`.
- Keep the affiliate disclosure (CONAR, CDC, AdSense and ML affiliate terms).
  Never hide that links are affiliate links.
- No "IA", "AI" or "Inteligência" in user-facing text. No seller names.
- Do not touch the search system (frozen, 13/11/2026).
