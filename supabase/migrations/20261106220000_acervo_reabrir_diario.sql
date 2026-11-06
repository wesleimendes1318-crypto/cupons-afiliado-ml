-- DAILY FEED (Weslei, 06/11/2026: "diariamente deve ir alimentando anuncios em
-- todas as vitrines, até mesmo nas personalizadas"). Additive only: one new
-- function + one pg_cron job. Once a day, every showcase term that finished its
-- pages (fim) and was asked for in the last 30 days goes back to page 0, so the
-- 3-min acervo-garimpo job re-reads its top listings and finds new ones. Only
-- the queue bookkeeping (fim/pagina/cursor) changes; no listing is deleted.
-- Same pace as before: still one term every 3 min.
create or replace function public.acervo_reabrir_diario()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.acervo_garimpo
     set fim = false, pagina = 0, cursor = 0
   where fim
     and pedido_em > now() - interval '30 days'
     and coalesce(lido_em, 'epoch'::timestamptz) < now() - interval '20 hours';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.acervo_reabrir_diario() from public, anon, authenticated;

-- 06:00 UTC = 03:00 in São Paulo, before the morning traffic.
select cron.schedule('acervo-reabrir', '0 6 * * *', 'select public.acervo_reabrir_diario();');
