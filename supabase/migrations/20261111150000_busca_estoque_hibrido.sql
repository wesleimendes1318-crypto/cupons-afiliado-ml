-- HYBRID OWN-STOCK SEARCH (Weslei, 11/11/2026: "melhoria em todos os caminhos
-- de buscas"). One read ranks the fresh own stock (em_alta_catalogo, 3 days)
-- and the acervo (acervo_ofertas, 12 h) by the whole phrase, not only by the
-- product type: Portuguese full-text rank and trigram word similarity (typo
-- tolerant), fused by Reciprocal Rank Fusion (k = 60).
-- Server only (service_role): the app still runs every shield (type, brand,
-- kids, fakes, price floor) on what comes back. Additive: new function and
-- indexes, nothing existing changes.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() is not IMMUTABLE, so indexes need this wrapper.
create or replace function public.sem_acento(t text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

create index if not exists em_alta_catalogo_nome_fts
  on public.em_alta_catalogo using gin (to_tsvector('portuguese'::regconfig, public.sem_acento(nome)));
create index if not exists acervo_ofertas_nome_fts
  on public.acervo_ofertas using gin (to_tsvector('portuguese'::regconfig, public.sem_acento(nome)));
create index if not exists em_alta_catalogo_nome_trgm_sem_acento
  on public.em_alta_catalogo using gin (lower(public.sem_acento(nome)) extensions.gin_trgm_ops);
create index if not exists acervo_ofertas_nome_trgm_sem_acento
  on public.acervo_ofertas using gin (lower(public.sem_acento(nome)) extensions.gin_trgm_ops);

create or replace function public.buscar_estoque_hibrido(p_termo text, p_limite int default 60)
returns table (
  produto text,
  item text,
  nome text,
  imagem text,
  preco numeric,
  url text,
  frete_gratis boolean,
  loja_oficial boolean,
  dominio_ml text,
  origem text,
  pontos float8
)
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_txt text := lower(public.sem_acento(left(coalesce(p_termo, ''), 120)));
  v_q tsquery;
  v_lim int := least(greatest(coalesce(p_limite, 60), 1), 120);
begin
  if length(trim(v_txt)) < 2 then
    return;
  end if;
  v_q := plainto_tsquery('portuguese'::regconfig, v_txt);
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  return query
  with lexico as (
    select x.produto, min(x.pos) as pos
    from (
      select y.produto, row_number() over (order by y.r desc) as pos
      from (
        select c.produto,
               ts_rank_cd(to_tsvector('portuguese'::regconfig, public.sem_acento(c.nome)), v_q) as r
        from public.em_alta_catalogo c
        where to_tsvector('portuguese'::regconfig, public.sem_acento(c.nome)) @@ v_q
          and c.atualizado_em > now() - interval '3 days'
        union all
        select a.produto,
               ts_rank_cd(to_tsvector('portuguese'::regconfig, public.sem_acento(a.nome)), v_q)
        from public.acervo_ofertas a
        where to_tsvector('portuguese'::regconfig, public.sem_acento(a.nome)) @@ v_q
          and a.atualizado_em > now() - interval '12 hours'
      ) y
      order by y.r desc
      limit 200
    ) x
    group by x.produto
  ),
  trigrama as (
    select x.produto, min(x.pos) as pos
    from (
      select y.produto, row_number() over (order by y.s desc) as pos
      from (
        select c.produto, word_similarity(v_txt, lower(public.sem_acento(c.nome))) as s
        from public.em_alta_catalogo c
        where v_txt <% lower(public.sem_acento(c.nome))
          and c.atualizado_em > now() - interval '3 days'
        union all
        select a.produto, word_similarity(v_txt, lower(public.sem_acento(a.nome)))
        from public.acervo_ofertas a
        where v_txt <% lower(public.sem_acento(a.nome))
          and a.atualizado_em > now() - interval '12 hours'
      ) y
      order by y.s desc
      limit 200
    ) x
    group by x.produto
  ),
  fusao as (
    select coalesce(l.produto, t.produto) as produto,
           (coalesce(1.0 / (60 + l.pos), 0) + coalesce(1.0 / (60 + t.pos), 0))::float8 as rrf
    from lexico l
    full join trigrama t on t.produto = l.produto
  )
  select r.produto, r.item, r.nome, r.imagem, r.preco, r.url, r.frete_gratis, r.loja_oficial,
         r.dominio_ml, r.origem, f.rrf
  from fusao f
  join lateral (
    select * from (
      select c.produto, c.item, c.nome, c.imagem, c.preco, c.url, c.frete_gratis, c.loja_oficial,
             c.dominio_ml, 'estoque'::text as origem
      from public.em_alta_catalogo c
      where c.produto = f.produto and c.atualizado_em > now() - interval '3 days'
      union all
      select a.produto, a.item, a.nome, a.imagem, a.preco, a.url, a.frete_gratis, a.loja_oficial,
             null::text, 'acervo'::text
      from public.acervo_ofertas a
      where a.produto = f.produto and a.atualizado_em > now() - interval '12 hours'
    ) u
    limit 1
  ) r on true
  order by f.rrf desc
  limit v_lim;
end;
$$;

revoke all on function public.buscar_estoque_hibrido(text, int) from public, anon, authenticated;
grant execute on function public.buscar_estoque_hibrido(text, int) to service_role;
