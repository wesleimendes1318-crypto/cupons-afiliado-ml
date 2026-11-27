-- 27/11 (Weslei: "precisa inserir o valor assim como os outros possuem"):
-- one read of the store's own search results page prices dozens of cards.
-- Returns the most recent searched term whose cards still lack a price, with
-- those catalog ids. Read-only; token required like robo_precos_fila.
create or replace function public.robo_precos_buscas(p_token text, p_pular text[] default '{}')
returns table(termo text, produtos text[])
language plpgsql security definer set search_path to 'public' as $function$
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  return query
  with b as (
    select split_part(g.chave, '|', 3) as termo, g.criado_em, r->>'produto' as produto
      from public.busca_guiada g, jsonb_array_elements(g.resposta->'resultados') r
     where g.criado_em > now() - interval '24 hours'
       and r->>'preco' is null and r->>'produto' ~ '^MLB[0-9]+$'
       and split_part(g.chave, '|', 3) <> ''
       and not (split_part(g.chave, '|', 3) = any(coalesce(p_pular, '{}')))
  )
  select b.termo, array_agg(distinct b.produto)
    from b
   where not exists (select 1 from public.precos_robo p
                      where p.produto = b.produto and p.lido_em > now() - interval '10 hours')
   group by b.termo
   order by max(b.criado_em) desc
   limit 1;
end $function$;
revoke all on function public.robo_precos_buscas(text, text[]) from public;
grant execute on function public.robo_precos_buscas(text, text[]) to anon, authenticated;
