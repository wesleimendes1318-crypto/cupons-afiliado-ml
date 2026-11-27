-- 27/11: most catalog products read by the price robot have no active seller
-- (price HIDDEN, "indisponivel"). Mark them so the site drops those cards
-- instead of showing a product nobody sells. Additive: new column + _v2.
alter table public.precos_robo add column if not exists sem_vendedor boolean not null default false;

create or replace function public.robo_precos_gravar_v2(p_token text, p_linhas jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n integer;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  insert into public.precos_robo as p (produto, item, preco, loja_oficial, internacional, sem_vendedor, lido_em)
  select x.produto,
         case when x.item ~ '^MLB[0-9]+$' and x.preco > 0 and x.preco < 10000000 then x.item end,
         case when x.item ~ '^MLB[0-9]+$' and x.preco > 0 and x.preco < 10000000 then x.preco end,
         coalesce(x.loja_oficial, false), coalesce(x.internacional, false),
         coalesce(x.sem_vendedor, false) and not coalesce(x.item ~ '^MLB[0-9]+$' and x.preco > 0, false),
         now()
    from jsonb_to_recordset(case when jsonb_typeof(p_linhas) = 'array' then p_linhas else '[]'::jsonb end)
         as x(produto text, item text, preco numeric, loja_oficial boolean, internacional boolean, sem_vendedor boolean)
   where x.produto ~ '^MLB[0-9]+$'
   limit 20
  on conflict (produto) do update set
    item = excluded.item, preco = excluded.preco, loja_oficial = excluded.loja_oficial,
    internacional = excluded.internacional, sem_vendedor = excluded.sem_vendedor, lido_em = now();
  get diagnostics n = row_count;

  update public.em_alta_catalogo e
     set preco = r.preco,
         item = r.item,
         url = 'https://www.mercadolivre.com.br/p/' || r.produto || '?pdp_filters=item_id%3A' || r.item,
         frete_gratis = case when e.item = r.item then e.frete_gratis end,
         loja_oficial = r.loja_oficial,
         atualizado_em = now()
    from public.precos_robo r
   where r.produto = e.produto and r.lido_em > now() - interval '1 minute'
     and r.preco is not null and not r.internacional;
  return n;
end $function$;
revoke all on function public.robo_precos_gravar_v2(text, jsonb) from public;
grant execute on function public.robo_precos_gravar_v2(text, jsonb) to anon, authenticated;
