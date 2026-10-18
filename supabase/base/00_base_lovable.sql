-- Base do banco que o Lovable criou antes de 23/09/2026 e que nunca virou
-- arquivo de migração: as 6 tabelas iniciais e as funções antigas (cupons,
-- etiquetas, estado do robô). Reconstruída em 18/10/2026, na mudança para o
-- Supabase próprio do Weslei (o Lovable Cloud pausou o banco por falta de
-- crédito em 16/10), a partir de src/integrations/supabase/types.ts e de como
-- o site e a extensão chamam cada função. Roda ANTES das migrações de
-- supabase/migrations (que vêm depois, em ordem).
--
-- Filas de cupom que fazem a extensão abrir o Mercado Livre (etiquetas,
-- links e vitrines de cupom, condições) devolvem lista vazia aqui: o recurso
-- de cupom é antigo ("Não prometer cupom") e código de cupom é permanente.
-- Proteger a conta de afiliado vem antes.

set check_function_bodies = off;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create extension if not exists http with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tabelas

create table if not exists public.sinc_config (
  chave text primary key,
  valor text not null default ''
);

create table if not exists public.sinc_log (
  id bigserial primary key,
  quando timestamptz not null default now(),
  recebidos integer,
  novos integer,
  sumidos_removidos integer,
  vencidos_removidos integer
);

create table if not exists public.contatos (
  canal text not null,
  valor text not null,
  ativo boolean not null default true,
  primary key (canal, valor)
);

create table if not exists public.limites (
  chave text primary key,
  valor numeric not null default 0
);

create table if not exists public.cupons (
  id bigint primary key,
  vendedor text not null,
  desconto text,
  orcamento numeric,
  vence date,
  tipo text,
  valor numeric,
  teto numeric,
  compra_min numeric,
  sem_teto boolean not null default false,
  categoria text,
  qualidade text,
  nivel text,
  estoque integer,
  vendas integer,
  busca text,
  conferido_em timestamptz,
  tentativas integer not null default 0,
  codigo_cupom text,
  codigo_em timestamptz,
  codigo_pedido_em timestamptz,
  codigo_tentativas integer not null default 0,
  link_afiliado text,
  link_em timestamptz,
  link_conferido_em timestamptz,
  link_loja text,
  link_origem text,
  link_tentativas integer not null default 0,
  loja_pedida_em timestamptz,
  vitrine_ok boolean,
  vitrine_motivo text,
  vitrine_conferida_em timestamptz,
  vitrine_resolvida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedidos_link (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  status text not null default 'pendente',
  url_alvo text,
  vendedor text not null default '',
  cupom_id bigint,
  link text,
  codigo text,
  erro text,
  preco numeric,
  titulo text,
  analise jsonb,
  atendido_em timestamptz,
  processando_em timestamptz,
  origem text,
  chave uuid not null default gen_random_uuid(),
  cep_destino varchar(9)
);
create index if not exists pedidos_link_status_idx on public.pedidos_link (status, criado_em);
create index if not exists pedidos_link_url_idx on public.pedidos_link (url_alvo);

alter table public.sinc_config enable row level security;
alter table public.sinc_log enable row level security;
alter table public.contatos enable row level security;
alter table public.limites enable row level security;
alter table public.cupons enable row level security;
alter table public.pedidos_link enable row level security;

-- Cupons sempre foram lidos pelo navegador (código e página da loja).
drop policy if exists "cupons leitura publica" on public.cupons;
create policy "cupons leitura publica" on public.cupons for select to anon, authenticated using (true);

-- Senhas: sem a linha 'token', a comparação dá NULL e qualquer senha passaria.
insert into public.sinc_config (chave, valor)
values ('token', encode(extensions.gen_random_bytes(24), 'hex')),
       ('cron_segredo', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (chave) do nothing;

-- ---------------------------------------------------------------- funções

create or replace function public.normalizar_nome(p text)
returns text language sql immutable as $$
  select regexp_replace(
    translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '', 'g')
$$;

create or replace function public._token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_token is not null and exists (
    select 1 from public.sinc_config where chave = 'token' and valor = p_token and valor <> '')
$$;
revoke all on function public._token_ok(text) from public, anon, authenticated;

create or replace function public.estado_do_robo()
returns table (freio_ate text, freio_motivo text, visto_em text)
language sql stable security definer set search_path = public as $$
  select (select valor from sinc_config where chave = 'freio_ate'),
         (select valor from sinc_config where chave = 'freio_motivo'),
         (select valor from sinc_config where chave = 'visto_em')
$$;
grant execute on function public.estado_do_robo() to anon, authenticated, service_role;

create or replace function public.consultar_etiqueta(p_cupom_id bigint)
returns text language sql stable security definer set search_path = public as $$
  select codigo_cupom from cupons where id = p_cupom_id
$$;
grant execute on function public.consultar_etiqueta(bigint) to anon, authenticated, service_role;

create or replace function public.salvar_link_loja(p_cupom_id bigint, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update cupons set link_loja = p_link, updated_at = now() where id = p_cupom_id;
end $$;

create or replace function public.iniciar_pedido(p_token text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  update pedidos_link
     set status = 'processando', processando_em = now()
   where id = p_id and status in ('pendente', 'processando');
end $$;
grant execute on function public.iniciar_pedido(text, bigint) to anon, authenticated, service_role;

create or replace function public.expirar_pedidos()
returns void language plpgsql security definer set search_path = public as $$
begin
  update pedidos_link
     set status = 'falhou', erro = coalesce(erro, 'expirou na fila')
   where status in ('pendente', 'processando') and criado_em < now() - interval '2 hours';
end $$;

-- Cupons: guarda o que a extensão manda (sem abrir o Mercado Livre).
create or replace function public.sincronizar_cupons(p_token text, p_cupons jsonb, p_completo boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_receb int; v_novos int; v_sumidos int := 0; v_vencidos int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  v_receb := coalesce(jsonb_array_length(p_cupons), 0);
  select count(*) into v_novos
    from jsonb_array_elements(p_cupons) e
   where not exists (select 1 from cupons c where c.id = (e->>'id')::bigint);
  insert into cupons (id, vendedor, desconto, orcamento, vence)
  select (e->>'id')::bigint, e->>'vendedor', e->>'desconto',
         nullif(e->>'orcamento', '')::numeric, nullif(e->>'vence', '')::date
    from jsonb_array_elements(p_cupons) e
   where (e->>'id') ~ '^[0-9]+$' and coalesce(e->>'vendedor', '') <> ''
  on conflict (id) do update
     set vendedor = excluded.vendedor, desconto = excluded.desconto,
         orcamento = excluded.orcamento, vence = excluded.vence, updated_at = now();
  if p_completo and v_receb > 0 then
    delete from cupons c
     where not exists (select 1 from jsonb_array_elements(p_cupons) e where (e->>'id')::bigint = c.id);
    get diagnostics v_sumidos = row_count;
  end if;
  delete from cupons where vence < current_date;
  get diagnostics v_vencidos = row_count;
  insert into sinc_log (recebidos, novos, sumidos_removidos, vencidos_removidos)
  values (v_receb, v_novos, v_sumidos, v_vencidos);
  return jsonb_build_object('recebidos', v_receb, 'novos', v_novos,
                            'sumidos_removidos', v_sumidos, 'vencidos_removidos', v_vencidos);
end $$;
grant execute on function public.sincronizar_cupons(text, jsonb, boolean) to anon, authenticated, service_role;

create or replace function public.melhor_cupom(p_token text, p_vendedor text)
returns table (id bigint, vendedor text, desconto text, tipo text, valor numeric, teto numeric,
               compra_min numeric, sem_teto boolean, categoria text, qualidade text, vence date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  return query
    select c.id, c.vendedor, c.desconto, c.tipo, c.valor, c.teto, c.compra_min, c.sem_teto,
           c.categoria, c.qualidade, c.vence
      from cupons c
     where public.normalizar_nome(c.vendedor) = public.normalizar_nome(p_vendedor)
       and (c.vence is null or c.vence >= current_date)
     order by (c.conferido_em is not null) desc, c.valor desc nulls last
     limit 1;
end $$;
grant execute on function public.melhor_cupom(text, text) to anon, authenticated, service_role;

-- Filas de cupom que abririam o Mercado Livre: vazias (ver o topo do arquivo).
create or replace function public.condicoes_pendentes(p_token text, p_limite integer default 150)
returns table (id bigint) language plpgsql stable security definer set search_path = public as $$
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  return;
end $$;
grant execute on function public.condicoes_pendentes(text, integer) to anon, authenticated, service_role;

create or replace function public.links_pendentes(p_token text, p_limite integer default 60)
returns table (id bigint) language plpgsql stable security definer set search_path = public as $$
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  return;
end $$;
grant execute on function public.links_pendentes(text, integer) to anon, authenticated, service_role;

create or replace function public.etiquetas_pendentes(p_token text, p_limite integer default 20)
returns table (id bigint, desconto text, pedido boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  return;
end $$;
grant execute on function public.etiquetas_pendentes(text, integer) to anon, authenticated, service_role;

create or replace function public.vitrines_para_conferir(p_token text, p_limite integer default 40)
returns table (id bigint, vendedor text, link_origem text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  return;
end $$;
grant execute on function public.vitrines_para_conferir(text, integer) to anon, authenticated, service_role;

create or replace function public.links_para_conferir(p_token text, p_limite integer default 40)
returns table (id bigint, link_origem text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  return;
end $$;
grant execute on function public.links_para_conferir(text, integer) to anon, authenticated, service_role;

-- Gravações de cupom: aceitam e guardam (chegam só se a extensão leu algo).
create or replace function public.salvar_condicoes(p_token text, p_cond jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  update cupons c
     set teto = coalesce(nullif(e->>'teto', '')::numeric, c.teto),
         compra_min = coalesce(nullif(e->>'compra_min', '')::numeric, c.compra_min),
         conferido_em = case when (e->>'achou')::boolean then now() else c.conferido_em end,
         tentativas = c.tentativas + 1, updated_at = now()
    from jsonb_array_elements(p_cond) e
   where c.id = (e->>'id')::bigint;
  get diagnostics v_n = row_count;
  return jsonb_build_object('atualizados', v_n);
end $$;
grant execute on function public.salvar_condicoes(text, jsonb) to anon, authenticated, service_role;

create or replace function public.salvar_links(p_token text, p_links jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  update cupons c
     set link_afiliado = case when (e->>'link') ~ '^https://meli\.la/[A-Za-z0-9]+$' then e->>'link' else c.link_afiliado end,
         link_em = now(), link_tentativas = c.link_tentativas + 1, updated_at = now()
    from jsonb_array_elements(p_links) e
   where c.id = (e->>'id')::bigint;
  get diagnostics v_n = row_count;
  return jsonb_build_object('atualizados', v_n);
end $$;
grant execute on function public.salvar_links(text, jsonb) to anon, authenticated, service_role;

create or replace function public.salvar_etiquetas(p_token text, p_lista jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  update cupons c
     set codigo_cupom = coalesce(nullif(e->>'codigo', ''), c.codigo_cupom),
         codigo_em = case when coalesce(e->>'codigo', '') <> '' then now() else c.codigo_em end,
         codigo_tentativas = c.codigo_tentativas + 1, updated_at = now()
    from jsonb_array_elements(p_lista) e
   where c.id = (e->>'id')::bigint;
  get diagnostics v_n = row_count;
  return jsonb_build_object('atualizados', v_n);
end $$;
grant execute on function public.salvar_etiquetas(text, jsonb) to anon, authenticated, service_role;

create or replace function public.salvar_vitrines(p_token text, p_lista jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  update cupons c
     set vitrine_ok = (e->>'ok')::boolean, vitrine_motivo = e->>'motivo',
         link_origem = coalesce(c.link_origem, e->>'origem'),
         vitrine_conferida_em = now(), updated_at = now()
    from jsonb_array_elements(p_lista) e
   where c.id = (e->>'id')::bigint;
  get diagnostics v_n = row_count;
  return jsonb_build_object('atualizados', v_n);
end $$;
grant execute on function public.salvar_vitrines(text, jsonb) to anon, authenticated, service_role;

create or replace function public.conferir_links(p_token text, p_lista jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  update cupons c set link_conferido_em = now(), updated_at = now()
    from jsonb_array_elements(p_lista) e
   where c.id = (e->>'id')::bigint;
  get diagnostics v_n = row_count;
  return jsonb_build_object('conferidos', v_n);
end $$;
grant execute on function public.conferir_links(text, jsonb) to anon, authenticated, service_role;

create or replace function public.salvar_pagina_loja(p_token text, p_vendedor text, p_url text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  if p_url is null or p_url !~ '^https://[a-z0-9.-]*mercadolivre\.com\.br/' then return 0; end if;
  update cupons set link_loja = p_url, vitrine_resolvida_em = now(), updated_at = now()
   where public.normalizar_nome(vendedor) = public.normalizar_nome(p_vendedor);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.salvar_pagina_loja(text, text, text) to anon, authenticated, service_role;

create or replace function public.marcar_loja_sem_pagina(p_token text, p_vendedor text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._token_ok(p_token) then raise exception 'token invalido'; end if;
  update cupons set vitrine_resolvida_em = now(), updated_at = now()
   where public.normalizar_nome(vendedor) = public.normalizar_nome(p_vendedor);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.marcar_loja_sem_pagina(text, text) to anon, authenticated, service_role;

create or replace function public.limpar_vencidos()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from cupons where vence < current_date;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
