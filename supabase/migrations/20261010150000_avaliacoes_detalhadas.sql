-- AVALIAÇÕES EM TODOS OS CARTÕES E O DETALHAMENTO REAL (Weslei, 10/10:
-- "precisa ter as avaliações em TODOS, e precisa de um espaço que abra o
-- detalhamento das avaliações reais").
--
-- A extensão (1.165.0) lê na página de cada anúncio a nota, o total, a
-- distribuição por estrelas e as primeiras opiniões dos compradores, e grava
-- aqui (gravar_avaliacoes, só com a senha da extensão). A fila de leitura
-- (avaliacoes_pendentes) traz primeiro as ofertas de pedidos de cliente
-- recentes, depois as da vitrine, campanhas, brinquedos e mais vendidos.
-- Leitura pública só por funções: avaliacoes_da_vitrine_v2 (cartões da
-- vitrine e campanhas), avaliacoes_por_itens (demais cartões) e
-- detalhe_avaliacoes (o painel). Nada é inventado: "sem avaliações" só quando
-- a página inteira do próprio anúncio não tem nota.

-- item: o anúncio (MLB + números) ou, para a página de catálogo sem anúncio
-- escolhido, o produto com o prefixo que o próprio Mercado Livre usa no
-- "pid" (MLBP + números).
create table if not exists public.avaliacoes_anuncios (
  item text primary key check (item ~ '^MLBP?[0-9]{6,}$'),
  nota numeric(2,1) check (nota is null or (nota > 0 and nota <= 5)),
  total integer check (total is null or total >= 1),
  sem_avaliacoes boolean not null default false,
  distribuicao jsonb,
  comentarios jsonb,
  total_comentarios integer,
  aviso text,
  lido_em timestamptz,
  tentado_em timestamptz not null default now(),
  erro text
);
alter table public.avaliacoes_anuncios enable row level security;
revoke all on public.avaliacoes_anuncios from anon, authenticated;

-- Oferta mostrada no cartão (chave do produto + link de afiliado) -> anúncio
-- e a nota que a comparação leu. Refeita a cada 15 min pelo banco: a leitura
-- dos cartões não abre a análise inteira de cada pedido a cada visita.
create table if not exists public.avaliacoes_ofertas (
  chave text not null,
  link text not null,
  item text check (item is null or item ~ '^MLBP?[0-9]{6,}$'),
  nota numeric(2,1),
  total integer,
  prio integer not null default 9,
  quando timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (chave, link)
);
create index if not exists avaliacoes_ofertas_item on public.avaliacoes_ofertas (item);
alter table public.avaliacoes_ofertas enable row level security;
revoke all on public.avaliacoes_ofertas from anon, authenticated;

-- Anúncio (MLB + números) do endereço: item_id do filtro do catálogo, wid ou
-- MLB-123 do endereço do anúncio (a página de catálogo /p/ sozinha não é
-- anúncio).
create or replace function public.item_do_anuncio(u text)
returns text
language sql
immutable
as $$
  select upper(coalesce(
    substring(u from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(u from '(?i)[?&]wid=(MLB[0-9]{6,})'),
    case when u !~* '/p/MLB' then replace(substring(u from '(?i)MLB-?[0-9]{6,}'), '-', '') end))
$$;

create or replace function public.item_da_oferta(o jsonb)
returns text
language sql
immutable
as $$
  select case
    when upper(replace(coalesce(o->>'item', ''), '-', '')) ~ '^MLB[0-9]{6,}$'
      then upper(replace(o->>'item', '-', ''))
    else public.item_do_anuncio(coalesce(o->>'url', o->>'link_original', ''))
  end
$$;

create or replace function public.atualizar_avaliacoes_ofertas()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  create temporary table if not exists _alvos (chave text, link text, prio integer, quando timestamptz) on commit drop;
  truncate _alvos;
  insert into _alvos
  select pv.chave, l.link, 1, pv.visto_em
    from public.produtos_vistos pv
    cross join lateral (values (pv.link), (pv.melhor_link), (pv.alt_link)) l(link)
   where pv.visto_em > now() - interval '30 days' and l.link like 'https://meli.la/%';
  insert into _alvos
  select cp.chave, cp.link, 2, cp.conferido_em
    from public.campanha_produtos cp
   where cp.conferido_em > now() - interval '7 days' and cp.link like 'https://meli.la/%';

  delete from public.avaliacoes_ofertas;
  with ids as (
    select distinct on (k.chave) k.chave, p.id
      from public.pedidos_link p
      cross join lateral (select public.chave_do_url(p.url_alvo) as chave) k
     where p.status = 'pronto' and p.criado_em > now() - interval '30 days'
       and k.chave in (select a.chave from _alvos a)
     order by k.chave, coalesce(p.atendido_em, p.criado_em) desc
  ), ofertas as (
    select i.chave, p.link,
           coalesce(public.item_do_anuncio(p.url_alvo),
                    'MLBP' || substring(p.url_alvo from '(?i)/p/MLB([0-9]{6,})')) as item,
           p.analise->'avaliacoes' as av
      from ids i join public.pedidos_link p on p.id = i.id
    union all
    select i.chave, o->>'link', public.item_da_oferta(o), o->'avaliacoes'
      from ids i
      join public.pedidos_link p on p.id = i.id
      cross join lateral jsonb_array_elements(
        (case when jsonb_typeof(p.analise->'outrasLojas') = 'array' then p.analise->'outrasLojas' else '[]'::jsonb end)
        || (case when jsonb_typeof(p.analise->'referencias') = 'array' then p.analise->'referencias' else '[]'::jsonb end)
        || (case when jsonb_typeof(p.analise->'parecidos') = 'array' then p.analise->'parecidos' else '[]'::jsonb end)
      ) as o
  ), boas as (
    select distinct on (a.chave, a.link) a.chave, a.link, o.item,
           case when jsonb_typeof(o.av) = 'object'
                 and (o.av->>'nota') ~ '^[0-9]+(\.[0-9]+)?$' and (o.av->>'total') ~ '^[0-9]{1,9}$'
                 and (o.av->>'nota')::numeric > 0 and (o.av->>'nota')::numeric <= 5
                 and (o.av->>'total')::integer >= 1
                then floor((o.av->>'nota')::numeric * 10) / 10 end as nota,
           case when jsonb_typeof(o.av) = 'object' and (o.av->>'total') ~ '^[0-9]{1,9}$'
                 and (o.av->>'total')::integer >= 1
                 and (o.av->>'nota') ~ '^[0-9]+(\.[0-9]+)?$'
                 and (o.av->>'nota')::numeric > 0 and (o.av->>'nota')::numeric <= 5
                then (o.av->>'total')::integer end as total,
           a.prio, a.quando
      from _alvos a
      join ofertas o on o.chave = a.chave and o.link = a.link
     order by a.chave, a.link, a.prio, (o.item is null), (o.av is null)
  )
  insert into public.avaliacoes_ofertas (chave, link, item, nota, total, prio, quando)
  select chave, link, case when item ~ '^MLBP?[0-9]{6,}$' then item end, nota, total, prio, quando
    from boas;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.atualizar_avaliacoes_ofertas() from public, anon, authenticated;

-- Grava o que a extensão leu. Leitura com distribuição/opiniões só é trocada
-- por outra com distribuição/opiniões; erro de leitura só marca a tentativa.
create or replace function public.gravar_avaliacoes(p_token text, p_itens jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  x jsonb;
  v_item text;
  v_nota numeric;
  v_total integer;
  v_dist jsonb;
  v_coments jsonb;
  v_tc integer;
  v_aviso text;
  n integer := 0;
begin
  if p_token is null or p_token <> (select sc.valor from public.sinc_config sc where sc.chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then return 0; end if;

  for x in select e from jsonb_array_elements(p_itens) e limit 20 loop
    v_item := upper(replace(coalesce(x->>'item', ''), '-', ''));
    continue when v_item !~ '^MLBP?[0-9]{6,}$';

    -- Pausa por verificação é da extensão inteira, não do anúncio.
    continue when x->>'erro' = 'verificacao';

    if coalesce((x->>'sem')::boolean, false) then
      insert into public.avaliacoes_anuncios as a (item, sem_avaliacoes, lido_em, tentado_em)
      values (v_item, true, now(), now())
      on conflict (item) do update set
        nota = null, total = null, sem_avaliacoes = true, distribuicao = null, comentarios = null,
        total_comentarios = null, aviso = null, lido_em = now(), tentado_em = now(), erro = null;
      n := n + 1;
      continue;
    end if;

    v_nota := case when (x->>'nota') ~ '^[0-9]+(\.[0-9]+)?$' then (x->>'nota')::numeric end;
    v_total := case when (x->>'total') ~ '^[0-9]{1,9}$' then (x->>'total')::integer end;
    if v_nota is null or v_nota <= 0 or v_nota > 5 or v_total is null or v_total < 1 then
      insert into public.avaliacoes_anuncios as a (item, tentado_em, erro)
      values (v_item, now(), left(coalesce(x->>'erro', 'sem nota'), 120))
      on conflict (item) do update set tentado_em = now(), erro = excluded.erro;
      continue;
    end if;
    v_nota := floor(v_nota * 10) / 10;

    -- Distribuição: as 5 estrelas, contagens inteiras.
    v_dist := null;
    if jsonb_typeof(x->'distribuicao') = 'array' then
      select jsonb_agg(jsonb_build_object('estrelas', e, 'total', t) order by e desc)
        into v_dist
        from (
          select distinct on ((d->>'estrelas')::int) (d->>'estrelas')::int as e, (d->>'total')::int as t
            from jsonb_array_elements(x->'distribuicao') d
           where (d->>'estrelas') ~ '^[1-5]$' and (d->>'total') ~ '^[0-9]{1,9}$'
        ) s;
      if v_dist is not null and jsonb_array_length(v_dist) <> 5 then v_dist := null; end if;
    end if;

    -- Opiniões: até 6, com nota de 1 a 5 e texto.
    v_coments := null;
    if jsonb_typeof(x->'comentarios') = 'array' then
      select jsonb_agg(c order by ord)
        into v_coments
        from (
          select ord, jsonb_strip_nulls(jsonb_build_object(
                   'nota', (o->>'nota')::int,
                   'texto', left(btrim(regexp_replace(o->>'texto', '[[:cntrl:]]+', ' ', 'g')), 800),
                   'data', nullif(left(btrim(coalesce(o->>'data', '')), 40), ''),
                   'criado_em', case when (o->>'criadoEm') ~ '^\d{4}-\d{2}-\d{2}$' then o->>'criadoEm' end,
                   'uteis', case when (o->>'uteis') ~ '^[0-9]{1,7}$' then (o->>'uteis')::int end)) as c
            from jsonb_array_elements(x->'comentarios') with ordinality as t(o, ord)
           where (o->>'nota') ~ '^[1-5]$' and length(btrim(coalesce(o->>'texto', ''))) >= 2
           order by ord
           limit 6
        ) s;
    end if;
    v_tc := case when (x->>'totalComentarios') ~ '^[0-9]{1,9}$' then (x->>'totalComentarios')::int end;
    v_aviso := nullif(left(btrim(coalesce(x->>'aviso', '')), 140), '');

    if v_dist is not null or v_coments is not null then
      insert into public.avaliacoes_anuncios as a
        (item, nota, total, sem_avaliacoes, distribuicao, comentarios, total_comentarios, aviso, lido_em, tentado_em, erro)
      values (v_item, v_nota, v_total, false, v_dist, v_coments, v_tc, v_aviso, now(), now(), null)
      on conflict (item) do update set
        nota = excluded.nota, total = excluded.total, sem_avaliacoes = false,
        distribuicao = excluded.distribuicao, comentarios = excluded.comentarios,
        total_comentarios = excluded.total_comentarios, aviso = excluded.aviso,
        lido_em = now(), tentado_em = now(), erro = null;
    else
      -- Só nota e total: não apaga um detalhamento lido nos últimos 7 dias.
      insert into public.avaliacoes_anuncios as a (item, nota, total, sem_avaliacoes, lido_em, tentado_em)
      values (v_item, v_nota, v_total, false, now(), now())
      on conflict (item) do update set
        nota = case when a.distribuicao is not null and a.lido_em > now() - interval '7 days' then a.nota else excluded.nota end,
        total = case when a.distribuicao is not null and a.lido_em > now() - interval '7 days' then a.total else excluded.total end,
        sem_avaliacoes = false,
        lido_em = case when a.distribuicao is not null and a.lido_em > now() - interval '7 days' then a.lido_em else now() end,
        tentado_em = now(), erro = null;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.gravar_avaliacoes(text, jsonb) from public;
grant execute on function public.gravar_avaliacoes(text, jsonb) to anon, authenticated;

-- Fila de leitura da extensão: o que o site mostra e ainda não tem leitura
-- nos últimos 7 dias (tentativa que falhou espera 1 dia).
create or replace function public.avaliacoes_pendentes(p_token text, p_limite integer default 3)
returns table(item text, url text, origem text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_token is null or p_token <> (select sc.valor from public.sinc_config sc where sc.chave = 'token') then
    raise exception 'token invalido';
  end if;
  if not exists (select 1 from public.avaliacoes_ofertas where atualizado_em > now() - interval '30 minutes') then
    perform public.atualizar_avaliacoes_ofertas();
  end if;

  return query
  with cliente as (
    select public.item_do_anuncio(p.url_alvo) as item, coalesce(p.atendido_em, p.criado_em) as quando
      from public.pedidos_link p
     where p.status = 'pronto' and coalesce(p.origem, '') <> 'teste'
       and p.criado_em > now() - interval '3 hours'
    union all
    select public.item_da_oferta(o), coalesce(p.atendido_em, p.criado_em)
      from public.pedidos_link p
      cross join lateral jsonb_array_elements(
        (case when jsonb_typeof(p.analise->'outrasLojas') = 'array' then p.analise->'outrasLojas' else '[]'::jsonb end)
        || (case when jsonb_typeof(p.analise->'parecidos') = 'array' then p.analise->'parecidos' else '[]'::jsonb end)
      ) as o
     where p.status = 'pronto' and coalesce(p.origem, '') <> 'teste'
       and p.criado_em > now() - interval '3 hours'
       and coalesce(o->>'link', '') like 'https://meli.la/%'
  ), todos as (
    select c.item, 0 as prio, c.quando from cliente c
    union all
    select ao.item, ao.prio, ao.quando from public.avaliacoes_ofertas ao where ao.item is not null
    union all
    select upper(b.item), 3, b.atualizado_em from public.curadoria_brinquedos_itens b
    union all
    select upper(e.item), 4, e.atualizado_em from public.em_alta_catalogo e
     where e.atualizado_em > now() - interval '3 days'
  )
  select t.item,
         case when t.item like 'MLBP%'
              then 'https://www.mercadolivre.com.br/p/MLB' || substr(t.item, 5)
              else 'https://produto.mercadolivre.com.br/MLB-' || substr(t.item, 4) end,
         (array['cliente', 'vitrine', 'campanha', 'brinquedos', 'mais_vendidos'])[min(t.prio) + 1]
    from todos t
    left join public.avaliacoes_anuncios aa on aa.item = t.item
   where t.item ~ '^MLBP?[0-9]{6,}$'
     and (aa.item is null
          or (coalesce(aa.lido_em, '-infinity'::timestamptz) < now() - interval '7 days'
              and aa.tentado_em < now() - interval '1 day'))
   group by t.item
   order by min(t.prio), max(t.quando) desc nulls last
   limit greatest(1, least(coalesce(p_limite, 3), 5));
end $$;
revoke all on function public.avaliacoes_pendentes(text, integer) from public;
grant execute on function public.avaliacoes_pendentes(text, integer) to anon, authenticated;

-- Cartões da vitrine e das campanhas: a oferta mostrada (chave + link).
-- Leitura da página do anúncio vale mais que a nota da comparação.
create or replace function public.avaliacoes_da_vitrine_v2(p_chaves text[])
returns table(chave text, link text, item text, nota numeric, total integer,
              sem_avaliacoes boolean, com_detalhe boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select o.chave, o.link, o.item,
         case when aa.lido_em is not null then aa.nota else o.nota end,
         case when aa.lido_em is not null then aa.total else o.total end,
         coalesce(aa.lido_em is not null and aa.sem_avaliacoes, false),
         coalesce(aa.lido_em is not null and (aa.distribuicao is not null or aa.comentarios is not null), false)
    from public.avaliacoes_ofertas o
    left join public.avaliacoes_anuncios aa on aa.item = o.item
   where o.chave = any (p_chaves[1:300])
$$;
grant execute on function public.avaliacoes_da_vitrine_v2(text[]) to anon, authenticated;

-- Demais cartões (mais vendidos, brinquedos, resultado): pelo anúncio.
create or replace function public.avaliacoes_por_itens(p_itens text[])
returns table(item text, nota numeric, total integer, sem_avaliacoes boolean, com_detalhe boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select aa.item, aa.nota, aa.total, aa.sem_avaliacoes,
         (aa.distribuicao is not null or aa.comentarios is not null)
    from public.avaliacoes_anuncios aa
   where aa.item = any (p_itens[1:300]) and aa.lido_em is not null
$$;
grant execute on function public.avaliacoes_por_itens(text[]) to anon, authenticated;

-- O painel "Ver avaliações": tudo o que foi lido da página do anúncio.
create or replace function public.detalhe_avaliacoes(p_item text)
returns table(item text, nota numeric, total integer, sem_avaliacoes boolean, distribuicao jsonb,
              comentarios jsonb, total_comentarios integer, aviso text, lido_em timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select aa.item, aa.nota, aa.total, aa.sem_avaliacoes, aa.distribuicao, aa.comentarios,
         aa.total_comentarios, aa.aviso, aa.lido_em
    from public.avaliacoes_anuncios aa
   where aa.item = upper(replace(coalesce(p_item, ''), '-', '')) and aa.lido_em is not null
$$;
grant execute on function public.detalhe_avaliacoes(text) to anon, authenticated;

-- A cada 15 min o banco refaz o mapa oferta -> anúncio dos cartões.
select cron.schedule('avaliacoes-ofertas', '*/15 * * * *',
  $$select public.atualizar_avaliacoes_ofertas();$$);

select public.atualizar_avaliacoes_ofertas();
