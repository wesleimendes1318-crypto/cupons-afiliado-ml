-- ACERVO DE OFERTAS (Weslei, 05/11/2026): listings already read by the site's
-- searches (real price + known shipping), reused by showcases instead of
-- searching from scratch, plus the queue of terms the background job keeps
-- reading. Additive only. Server only: RLS on and no policies; the write
-- functions are not executable by anon/authenticated.

create table if not exists public.acervo_ofertas (
  produto text primary key check (produto ~ '^MLB[0-9]+$'),
  item text not null check (item ~ '^MLB[0-9]+$'),
  nome text not null,
  imagem text,
  foto text,
  preco numeric not null check (preco > 0),
  frete_gratis boolean not null,
  internacional boolean not null default false,
  loja_oficial boolean not null default false,
  url text not null,
  termos text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);
create index if not exists acervo_ofertas_termos on public.acervo_ofertas using gin (termos);
create index if not exists acervo_ofertas_preco on public.acervo_ofertas (preco);
create index if not exists acervo_ofertas_atualizado on public.acervo_ofertas (atualizado_em desc);
alter table public.acervo_ofertas enable row level security;

create table if not exists public.acervo_garimpo (
  chave text primary key,
  termo text not null,
  preco_min numeric,
  preco_max numeric,
  frete_a_calcular boolean not null default false,
  pagina integer not null default 1,
  cursor integer not null default 0,
  variantes text[] not null default '{}',
  fim boolean not null default false,
  pedido_em timestamptz not null default now(),
  lido_em timestamptz
);
create index if not exists acervo_garimpo_fila on public.acervo_garimpo (fim, lido_em nulls first);
alter table public.acervo_garimpo enable row level security;

-- Upsert of a batch; the term joins `termos` (max 20 terms per listing).
create or replace function public.acervo_guardar(p_linhas jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.acervo_ofertas as a
    (produto, item, nome, imagem, foto, preco, frete_gratis, internacional, loja_oficial, url, termos, atualizado_em)
  select x.produto, x.item, left(x.nome, 160), x.imagem, x.foto, x.preco, x.frete_gratis,
         coalesce(x.internacional, false), coalesce(x.loja_oficial, false), x.url, coalesce(x.termos, '{}'), now()
  from jsonb_to_recordset(p_linhas) as x(produto text, item text, nome text, imagem text, foto text, preco numeric,
       frete_gratis boolean, internacional boolean, loja_oficial boolean, url text, termos text[])
  where x.produto ~ '^MLB[0-9]+$' and x.item ~ '^MLB[0-9]+$' and x.preco > 0 and x.frete_gratis is not null
  on conflict (produto) do update set
    item = excluded.item, nome = excluded.nome, imagem = excluded.imagem, foto = excluded.foto,
    preco = excluded.preco, frete_gratis = excluded.frete_gratis, internacional = excluded.internacional,
    loja_oficial = excluded.loja_oficial, url = excluded.url, atualizado_em = now(),
    termos = (select array(select distinct t from unnest(a.termos || excluded.termos) t limit 20));
  get diagnostics n = row_count;
  return n;
end $$;

-- A term + budget asked by a visitor: queued once; asking again re-opens it.
create or replace function public.acervo_pedir_garimpo(
  p_termo text, p_min numeric, p_max numeric, p_frete_a_calcular boolean, p_cursor integer, p_variantes text[])
returns void language sql security definer set search_path = public as $$
  insert into public.acervo_garimpo (chave, termo, preco_min, preco_max, frete_a_calcular, cursor, variantes)
  values (coalesce(p_min::text, '') || '-' || coalesce(p_max::text, '') || case when p_frete_a_calcular then '|f' else '' end
          || '|' || left(p_termo, 80),
          left(p_termo, 80), p_min, p_max, coalesce(p_frete_a_calcular, false), greatest(p_cursor, 0), coalesce(p_variantes, '{}'))
  on conflict (chave) do update set pedido_em = now();
$$;

revoke all on function public.acervo_guardar(jsonb) from public, anon, authenticated;
revoke all on function public.acervo_pedir_garimpo(text, numeric, numeric, boolean, integer, text[]) from public, anon, authenticated;

-- Background job: one term every 3 min (one request at a time, no bursts).
create or replace function public.disparar_acervo()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_segredo text;
begin
  select valor into v_segredo from public.sinc_config where chave = 'cron_segredo';
  if v_segredo is null then return null; end if;
  return net.http_post(url := 'https://melhorescolha.io/api/public/jobs/garimpar-acervo',
    headers := jsonb_build_object('x-cron-secret', v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
end $$;
revoke all on function public.disparar_acervo() from public, anon, authenticated;

select cron.schedule('acervo-garimpo', '*/3 * * * *', 'select public.disparar_acervo();');
