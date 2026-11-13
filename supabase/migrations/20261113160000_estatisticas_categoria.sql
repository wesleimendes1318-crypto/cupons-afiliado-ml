-- Public, read-only aggregates of the comparisons made on the site, per ML
-- category (SEO task 5, 13/11/2026). Additive: new function only, no table
-- change. Exposes counts and medians of price differences, never commission,
-- clicks or sales. Only categories with >= 20 comparisons are returned.
create or replace function public.estatisticas_categoria()
returns table (
  categoria text,
  comparados integer,
  com_economia integer,
  economia_mediana numeric,
  economia_mediana_pct numeric,
  economia_p90 numeric,
  pequenas integer,
  frete_conhecido integer,
  mais_barata_cobra_frete integer,
  inicio date,
  fim date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pv.categoria,
    count(*)::int,
    (count(*) filter (where pv.economia > 0))::int,
    round((percentile_cont(0.5) within group (order by pv.economia) filter (where pv.economia > 0))::numeric, 2),
    round((100 * percentile_cont(0.5) within group (order by pv.economia / pv.preco) filter (where pv.economia > 0))::numeric, 1),
    round((percentile_cont(0.9) within group (order by pv.economia) filter (where pv.economia > 0))::numeric, 2),
    (count(*) filter (where pv.economia > 0 and pv.economia / pv.preco < 0.05))::int,
    (count(*) filter (where pv.economia > 0 and pv.melhor_frete_gratis is not null))::int,
    (count(*) filter (where pv.economia > 0 and pv.melhor_frete_gratis is false))::int,
    min(coalesce(pv.primeiro_em, pv.visto_em))::date,
    max(pv.visto_em)::date
  from public.produtos_vistos pv
  where pv.lojas_comparadas >= 2
    and pv.preco > 0
    and pv.categoria is not null
    and pv.categoria <> '...'
    and pv.visto_em > now() - interval '120 days'
  group by pv.categoria
  having count(*) >= 20;
$$;

revoke all on function public.estatisticas_categoria() from public;
grant execute on function public.estatisticas_categoria() to anon, authenticated;
