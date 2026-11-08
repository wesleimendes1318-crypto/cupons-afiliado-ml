-- FAST OWN-STOCK SEARCH (Weslei, 08/11/2026: "busca mais rápida e precisa").
-- The search reads em_alta_catalogo and acervo_ofertas with nome ILIKE
-- '%tipo%'. Without an index that is a full scan: 76 ms warm, 4.4 s cold
-- (measured 08/11). Trigram GIN indexes serve the same ILIKE in a few ms.
-- Additive only: no column, function or permission changes.
create extension if not exists pg_trgm with schema extensions;

create index if not exists em_alta_catalogo_nome_trgm
  on public.em_alta_catalogo using gin (nome extensions.gin_trgm_ops);
create index if not exists acervo_ofertas_nome_trgm
  on public.acervo_ofertas using gin (nome extensions.gin_trgm_ops);
