-- 28/11 (Weslei card "As duas coisas"): the extension's price robot stores the
-- store search page's priced catalog cards into acervo_ofertas, which our
-- search already reads (doEstoque, same shields). acervo_guardar stays
-- server-only; this wrapper checks the extension token. Additive only.
create or replace function public.robo_acervo_guardar(p_token text, p_linhas jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' then return 0; end if;
  -- At most 60 rows per call; national, free shipping proven, sane price
  -- (a x1000 misread above 50.000 never enters).
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v
    from (select x from jsonb_array_elements(p_linhas) x limit 60) s
   where (x->>'preco') ~ '^[0-9]+(\.[0-9]+)?$'
     and (x->>'preco')::numeric between 1 and 50000
     and coalesce((x->>'internacional')::boolean, false) = false
     and (x->>'frete_gratis') = 'true'
     and (x->>'url') ~ '^https://(www|produto)\.mercadolivre\.com\.br/'
     and length(coalesce(x->>'nome', '')) >= 6;
  return public.acervo_guardar(v);
end $$;
revoke all on function public.robo_acervo_guardar(text, jsonb) from public;
grant execute on function public.robo_acervo_guardar(text, jsonb) to anon, authenticated;
