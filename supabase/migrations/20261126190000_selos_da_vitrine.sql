-- Black Friday badges (Weslei, 26/11/2026): public, read-only, aggregated.
-- Seller seals of the compared offers (same source as the campaign curation)
-- and the 30-day price range seen for each product in precos_vistos, so the
-- card shows "Loja oficial", "MercadoLíder Platinum" and "Menor preço dos
-- últimos 30 dias" only when the data backs it. Additive: new function only.
create or replace function public.selos_da_vitrine(p_chaves text[])
returns table (
  chave text,
  melhor_oficial boolean,
  melhor_lider text,
  alt_oficial boolean,
  alt_lider text,
  colado_oficial boolean,
  colado_lider text,
  minimo_30d numeric,
  maximo_30d numeric,
  leituras_30d integer,
  desde_30d timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with k as (
    select distinct unnest(p_chaves[1:300]) as chave
  ),
  h as (
    select pv.chave, min(pv.preco) mn, max(pv.preco) mx, count(*)::int n, min(pv.visto_em) desde
    from precos_vistos pv
    join k on k.chave = pv.chave
    where pv.visto_em > now() - interval '30 days' and pv.preco > 0
    group by pv.chave
  )
  select k.chave,
         c.melhor_oficial, c.melhor_lider, c.alt_oficial, c.alt_lider,
         c.colado_oficial, c.colado_lider,
         h.mn, h.mx, h.n, h.desde
  from k
  left join public.confiabilidade_da_vitrine(array(select chave from k)) c on c.chave = k.chave
  left join h on h.chave = k.chave;
$$;

revoke all on function public.selos_da_vitrine(text[]) from public;
grant execute on function public.selos_da_vitrine(text[]) to anon, authenticated;
