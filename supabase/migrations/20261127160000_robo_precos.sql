-- PRICE ROBOT (Weslei, 27/11/2026: "pode adicionar os valores! sempre deve ter!").
-- ML refuses /products/{id}/items (403 even with his user token), so search
-- cards came without a price. The extension reads each catalog page without
-- the account cookie and stores the buy box price here; the site shows it for
-- 12 h. Additive only. RLS on, no policies (server reads with service role);
-- the two functions need the extension token.

create table if not exists public.precos_robo (
  produto text primary key check (produto ~ '^MLB[0-9]+$'),
  item text check (item ~ '^MLB[0-9]+$'),
  preco numeric check (preco > 0 and preco < 10000000),
  loja_oficial boolean not null default false,
  internacional boolean not null default false,
  lido_em timestamptz not null default now()
);
create index if not exists precos_robo_lido on public.precos_robo (lido_em desc);
alter table public.precos_robo enable row level security;

-- Work list: products the searches of the last 24 h showed without a price
-- (most recent first), then best sellers whose price is older than 2 days
-- (best position first). Nothing read in the last 10 h.
create or replace function public.robo_precos_fila(p_token text, p_limite integer default 8)
returns table (produto text)
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  return query
  with buscados as (
    select r->>'produto' as produto, max(b.criado_em) as em
      from public.busca_guiada b, jsonb_array_elements(b.resposta->'resultados') r
     where b.criado_em > now() - interval '24 hours'
       and r->>'preco' is null and r->>'produto' ~ '^MLB[0-9]+$'
     group by 1
  ), candidatos as (
    select b.produto, 0 as prio, b.em, 0 as pos from buscados b
    union all
    select e.produto, 1, null::timestamptz, e.posicao
      from public.em_alta_catalogo e
     where e.atualizado_em < now() - interval '2 days' and e.produto ~ '^MLB[0-9]+$'
  )
  select c.produto from candidatos c
   where not exists (select 1 from public.precos_robo p
                      where p.produto = c.produto and p.lido_em > now() - interval '10 hours')
   group by c.produto
   order by min(c.prio), max(c.em) desc nulls last, min(c.pos)
   limit least(greatest(coalesce(p_limite, 8), 1), 20);
end $$;

-- One round of readings. A product without a buy box (or a used one) is kept
-- with null price, so it is not read again for 10 h. Best sellers also get
-- the fresh price in em_alta_catalogo (the searches' own stock).
create or replace function public.robo_precos_gravar(p_token text, p_linhas jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  insert into public.precos_robo as p (produto, item, preco, loja_oficial, internacional, lido_em)
  select x.produto,
         case when x.item ~ '^MLB[0-9]+$' and x.preco > 0 and x.preco < 10000000 then x.item end,
         case when x.item ~ '^MLB[0-9]+$' and x.preco > 0 and x.preco < 10000000 then x.preco end,
         coalesce(x.loja_oficial, false), coalesce(x.internacional, false), now()
    from jsonb_to_recordset(case when jsonb_typeof(p_linhas) = 'array' then p_linhas else '[]'::jsonb end)
         as x(produto text, item text, preco numeric, loja_oficial boolean, internacional boolean)
   where x.produto ~ '^MLB[0-9]+$'
   limit 20
  on conflict (produto) do update set
    item = excluded.item, preco = excluded.preco, loja_oficial = excluded.loja_oficial,
    internacional = excluded.internacional, lido_em = now();
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
end $$;

revoke all on function public.robo_precos_fila(text, integer) from public;
revoke all on function public.robo_precos_gravar(text, jsonb) from public;
grant execute on function public.robo_precos_fila(text, integer) to anon, authenticated;
grant execute on function public.robo_precos_gravar(text, jsonb) to anon, authenticated;
