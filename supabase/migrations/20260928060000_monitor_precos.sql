-- ACOMPANHAR PREÇO (Weslei, 28/09: "uma ferramenta que agregue valor, que
-- funcione de verdade e monitore"; modelo de teste). Só tabelas e funções
-- NOVAS: nada existente muda. Sem SerpAPI e sem pedido de comparação: a
-- extensão só abre a página do produto e lê o preço (1 leitura a cada ~10
-- min, com o freio de captcha). Intervalo adaptativo por produto (3 h a 12 h);
-- pesquisa feita no site já conta como leitura (precos_vistos).
-- Liga/desliga: sinc_config.monitor_ativo ('true'/'false').

create table if not exists public.monitor_precos (
  id bigserial primary key,
  chave text not null unique,          -- mesma chave de produtos_vistos/precos_vistos
  url text not null,
  titulo text,
  imagem text,
  loja text,
  link text,                           -- link de afiliado do Weslei
  preco_inicial numeric,
  preco_atual numeric,
  preco_pix numeric,
  preco_cheio numeric,
  parcelas jsonb,
  menor_preco numeric,
  menor_em timestamptz,
  maior_preco numeric,
  disponivel boolean,
  erro text,
  leituras integer not null default 0,
  sem_mudanca integer not null default 0,
  ultima_leitura timestamptz,
  proxima_leitura timestamptz not null default now(),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists monitor_precos_fila on public.monitor_precos (proxima_leitura) where ativo;

create table if not exists public.monitor_seguidores (
  monitor_id bigint not null references public.monitor_precos(id) on delete cascade,
  navegador uuid not null,             -- id aleatório guardado no navegador (sem dado pessoal)
  preco_alvo numeric,
  preco_ao_seguir numeric,
  criado_em timestamptz not null default now(),
  primary key (monitor_id, navegador)
);
create index if not exists monitor_seguidores_navegador on public.monitor_seguidores (navegador);

alter table public.monitor_precos enable row level security;
alter table public.monitor_seguidores enable row level security;
revoke all on public.monitor_precos, public.monitor_seguidores from anon, authenticated;

insert into public.sinc_config (chave, valor) values ('monitor_ativo', 'true')
  on conflict (chave) do nothing;

-- Chave do produto: a mesma de registrar_produto_visto.
create or replace function public.chave_do_produto(p_url text)
returns text language sql immutable as $$
  select upper(coalesce(
    substring(p_url from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(p_url from '(?i)/p/(MLB[0-9]+)'),
    substring(p_url from '(?i)/up/(MLBU[0-9]+)'),
    replace(substring(p_url from '(?i)MLB-[0-9]{6,}'), '-', ''),
    md5(split_part(p_url, '?', 1))));
$$;

-- Site: acompanhar o produto de uma comparação pronta. Limites do teste:
-- 20 produtos por navegador e 200 produtos acompanhados no total.
create or replace function public.acompanhar_preco(p_pedido bigint, p_navegador uuid, p_alvo numeric default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.pedidos_link;
  v_id bigint;
  v_chave text;
  v_preco numeric;
begin
  if coalesce((select valor from sinc_config where chave = 'monitor_ativo'), 'false') <> 'true' then
    raise exception 'acompanhamento desligado';
  end if;
  if p_navegador is null then raise exception 'navegador ausente'; end if;
  select * into p from pedidos_link where id = p_pedido;
  if p.id is null or p.status <> 'pronto' or p.link is null or p.analise->>'titulo' is null then
    raise exception 'comparacao nao encontrada';
  end if;
  v_preco := nullif(p.analise->>'preco', '')::numeric;
  v_chave := chave_do_produto(p.url_alvo);
  select id into v_id from monitor_precos where chave = v_chave;
  if v_id is null then
    if (select count(*) from monitor_precos where ativo) >= 200 then
      raise exception 'limite do teste atingido';
    end if;
    insert into monitor_precos (chave, url, titulo, imagem, loja, link, preco_inicial, preco_atual,
                                preco_pix, preco_cheio, parcelas, menor_preco, menor_em, maior_preco,
                                ultima_leitura, proxima_leitura)
    values (v_chave, p.url_alvo, p.analise->>'titulo', p.analise->>'imagem', p.analise->>'vendedor', p.link,
            v_preco, v_preco,
            nullif(p.analise->'precos'->>'pix', '')::numeric, nullif(p.analise->'precos'->>'cheio', '')::numeric,
            p.analise->'precos'->'parcelas', v_preco, coalesce(p.atendido_em, now()), v_preco,
            coalesce(p.atendido_em, now()), now() + interval '6 hours')
    returning id into v_id;
  else
    update monitor_precos set ativo = true, link = coalesce(p.link, link) where id = v_id;
  end if;
  if not exists (select 1 from monitor_seguidores where monitor_id = v_id and navegador = p_navegador)
     and (select count(*) from monitor_seguidores where navegador = p_navegador) >= 20 then
    raise exception 'limite de 20 produtos acompanhados';
  end if;
  insert into monitor_seguidores (monitor_id, navegador, preco_alvo, preco_ao_seguir)
  values (v_id, p_navegador, p_alvo, (select preco_atual from monitor_precos where id = v_id))
  on conflict (monitor_id, navegador) do update set preco_alvo = excluded.preco_alvo;
  return v_id;
end $$;

create or replace function public.parar_de_acompanhar(p_monitor bigint, p_navegador uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from monitor_seguidores where monitor_id = p_monitor and navegador = p_navegador;
  update monitor_precos set ativo = false
   where id = p_monitor and not exists (select 1 from monitor_seguidores where monitor_id = p_monitor);
end $$;

-- Site: a lista do navegador, com o histórico (até 60 pontos, 90 dias).
create or replace function public.meus_precos(p_navegador uuid)
returns table (id bigint, titulo text, imagem text, loja text, link text, url text,
               preco_atual numeric, preco_pix numeric, preco_cheio numeric, parcelas jsonb,
               preco_ao_seguir numeric, preco_alvo numeric, menor_preco numeric, menor_em timestamptz,
               maior_preco numeric, disponivel boolean, ultima_leitura timestamptz,
               proxima_leitura timestamptz, seguindo_desde timestamptz, historico jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.id, m.titulo, m.imagem, m.loja, m.link, m.url, m.preco_atual, m.preco_pix, m.preco_cheio, m.parcelas,
         s.preco_ao_seguir, s.preco_alvo, m.menor_preco, m.menor_em, m.maior_preco, m.disponivel,
         m.ultima_leitura, m.proxima_leitura, s.criado_em,
         coalesce((select jsonb_agg(jsonb_build_object('p', h.preco, 'em', h.visto_em) order by h.visto_em)
                     from (select pv.preco, pv.visto_em from precos_vistos pv
                            where pv.chave = m.chave and pv.visto_em > now() - interval '90 days'
                            order by pv.visto_em desc limit 60) h), '[]'::jsonb)
    from monitor_seguidores s join monitor_precos m on m.id = s.monitor_id
   where s.navegador = p_navegador
   order by s.criado_em desc;
$$;

-- Extensão: o próximo produto a conferir (um por vez). Se uma pesquisa do
-- site já viu o preço nas últimas 3 h, usa esse preço e não abre a página.
create or replace function public.proximo_monitor(p_token text)
returns table (id bigint, url text, chave text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m record;
  v record;
begin
  if p_token is null or p_token <> (select valor from sinc_config where sinc_config.chave = 'token') then
    raise exception 'token invalido';
  end if;
  if coalesce((select valor from sinc_config where sinc_config.chave = 'monitor_ativo'), 'false') <> 'true' then
    return;
  end if;
  for m in select mp.* from monitor_precos mp
            where mp.ativo and mp.proxima_leitura <= now()
              and exists (select 1 from monitor_seguidores s where s.monitor_id = mp.id)
            order by mp.proxima_leitura limit 20 loop
    select pv.preco, pv.visto_em into v from precos_vistos pv
     where pv.chave = m.chave and pv.visto_em > greatest(now() - interval '3 hours', coalesce(m.ultima_leitura, 'epoch'))
     order by pv.visto_em desc limit 1;
    if v.preco is not null then
      update monitor_precos set
        preco_atual = v.preco, ultima_leitura = v.visto_em, leituras = leituras + 1,
        menor_preco = least(coalesce(menor_preco, v.preco), v.preco),
        menor_em = case when v.preco < coalesce(menor_preco, v.preco + 1) then v.visto_em else menor_em end,
        maior_preco = greatest(coalesce(maior_preco, v.preco), v.preco),
        proxima_leitura = v.visto_em + interval '6 hours'
       where monitor_precos.id = m.id;
      continue;
    end if;
    -- Reserva por 30 min para não ser pego duas vezes.
    update monitor_precos set proxima_leitura = now() + interval '30 minutes' where monitor_precos.id = m.id;
    id := m.id; url := m.url; chave := m.chave;
    return next;
    return;
  end loop;
end $$;

-- Extensão: grava a leitura e agenda a próxima (adaptativo, sem SerpAPI):
-- erro 2 h; mudou de preço ou perto do alvo (<= 5% acima) 3 h; parado 6 h;
-- parado em 3 leituras seguidas 12 h.
create or replace function public.gravar_monitor(p_token text, p_id bigint, p_preco numeric,
                                                 p_pix numeric, p_cheio numeric, p_parcelas jsonb,
                                                 p_disponivel boolean, p_erro text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m public.monitor_precos;
  v_mudou boolean;
  v_perto boolean;
  v_prox interval;
begin
  if p_token is null or p_token <> (select valor from sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  select * into m from monitor_precos where id = p_id;
  if m.id is null then return; end if;
  if p_preco is null or p_preco <= 0 then
    update monitor_precos set erro = left(coalesce(p_erro, 'preco nao lido'), 200), disponivel = p_disponivel,
                              proxima_leitura = now() + interval '2 hours'
     where id = p_id;
    return;
  end if;
  v_mudou := m.preco_atual is null or abs(p_preco - m.preco_atual) >= 0.5;
  v_perto := exists (select 1 from monitor_seguidores s where s.monitor_id = p_id
                       and s.preco_alvo is not null and p_preco <= s.preco_alvo * 1.05);
  v_prox := case when v_mudou or v_perto then interval '3 hours'
                 when m.sem_mudanca + 1 >= 3 then interval '12 hours'
                 else interval '6 hours' end;
  update monitor_precos set
    preco_atual = p_preco, preco_pix = p_pix, preco_cheio = p_cheio, parcelas = p_parcelas,
    disponivel = p_disponivel, erro = null, leituras = leituras + 1,
    sem_mudanca = case when v_mudou then 0 else sem_mudanca + 1 end,
    menor_preco = least(coalesce(menor_preco, p_preco), p_preco),
    menor_em = case when p_preco < coalesce(menor_preco, p_preco + 1) then now() else menor_em end,
    maior_preco = greatest(coalesce(maior_preco, p_preco), p_preco),
    ultima_leitura = now(), proxima_leitura = now() + v_prox
   where id = p_id;
  insert into precos_vistos (chave, loja, preco, visto_em) values (m.chave, coalesce(m.loja, 'acompanhamento'), p_preco, now());
end $$;

revoke all on function public.acompanhar_preco(bigint, uuid, numeric) from public;
revoke all on function public.parar_de_acompanhar(bigint, uuid) from public;
revoke all on function public.meus_precos(uuid) from public;
revoke all on function public.proximo_monitor(text) from public;
revoke all on function public.gravar_monitor(text, bigint, numeric, numeric, numeric, jsonb, boolean, text) from public;
grant execute on function public.acompanhar_preco(bigint, uuid, numeric) to anon, authenticated;
grant execute on function public.parar_de_acompanhar(bigint, uuid) to anon, authenticated;
grant execute on function public.meus_precos(uuid) to anon, authenticated;
grant execute on function public.proximo_monitor(text) to anon, authenticated;
grant execute on function public.gravar_monitor(text, bigint, numeric, numeric, numeric, jsonb, boolean, text) to anon, authenticated;
