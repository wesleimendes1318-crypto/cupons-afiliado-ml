-- CONTA DO LOVABLE NO BANCO (04/11). O site no ar (feito no Lovable) usa um
-- identificador de "Meus preços" por conta (conta_navegadores) e o sino dos
-- cartões (acompanhar_por_link). Junta os dois arquivos de
-- supabase/manutencao/20261104_* e ajusta o que a migração
-- 20261104020000 tinha criado com outro desenho:
-- - vincular_navegador_conta(uuid, uuid) vira vincular_navegador_conta_v0 (sem drop: o
--   app do Weslei não mostra a confirmação do Supabase). A chamada do site com 1
--   argumento passa a ser a do Lovable, que devolve o identificador da conta.
-- - seguidor_visivel: o identificador do navegador manda (a conta adota um só).
-- - definir_aviso_email: liga o aviso nas linhas do identificador da conta e
--   grava usuario_id nelas (o gatilho e o envio usam o usuario_id).

alter function public.vincular_navegador_conta(uuid, uuid) rename to vincular_navegador_conta_v0;


create table if not exists public.conta_navegadores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  navegador uuid not null,
  criado_em timestamptz not null default now()
);
grant all on public.conta_navegadores to service_role;
alter table public.conta_navegadores enable row level security; -- sem política: só o servidor lê

create or replace function public.vincular_navegador_conta(p_navegador uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario uuid := auth.uid();
  v_conta uuid;
begin
  if v_usuario is null then raise exception 'entre com seu e-mail primeiro'; end if;
  if p_navegador is null then raise exception 'navegador ausente'; end if;

  insert into conta_navegadores (usuario_id, navegador)
  values (v_usuario, p_navegador)
  on conflict (usuario_id) do nothing;

  select navegador into v_conta from conta_navegadores where usuario_id = v_usuario;

  if v_conta <> p_navegador then
    insert into monitor_seguidores (monitor_id, navegador, preco_alvo, preco_ao_seguir, criado_em)
    select monitor_id, v_conta, preco_alvo, preco_ao_seguir, criado_em
      from monitor_seguidores where navegador = p_navegador
    on conflict (monitor_id, navegador) do nothing;
    delete from monitor_seguidores where navegador = p_navegador;
  end if;
  return v_conta;
end;
$$;
grant execute on function public.vincular_navegador_conta(uuid) to authenticated;


create index if not exists pedidos_link_chave_pronto
  on public.pedidos_link (public.chave_do_produto(url_alvo), id desc)
  where status = 'pronto' and link is not null;

create or replace function public.acompanhar_por_link(p_url text, p_navegador uuid, p_alvo numeric default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_chave text;
  v_pedido bigint;
  v_monitor bigint;
begin
  if p_url is null or length(p_url) > 2000 then raise exception 'endereco invalido'; end if;
  if p_navegador is null then raise exception 'navegador ausente'; end if;
  v_chave := chave_do_produto(p_url);

  select id into v_pedido
    from pedidos_link
   where chave_do_produto(url_alvo) = v_chave
     and status = 'pronto' and link is not null
     and analise->>'titulo' is not null
   order by id desc
   limit 1;

  if v_pedido is not null then
    return acompanhar_preco(v_pedido, p_navegador, p_alvo);
  end if;

  -- Produto já acompanhado por outra pessoa: só junta o seguidor.
  select id into v_monitor from monitor_precos where chave = v_chave and ativo;
  if v_monitor is null then raise exception 'sem comparacao'; end if;
  if coalesce((select valor from sinc_config where chave = 'monitor_ativo'), 'false') <> 'true' then
    raise exception 'acompanhamento desligado';
  end if;
  if not exists (select 1 from monitor_seguidores where monitor_id = v_monitor and navegador = p_navegador)
     and (select count(*) from monitor_seguidores where navegador = p_navegador) >= 20 then
    raise exception 'limite de 20 produtos acompanhados';
  end if;
  insert into monitor_seguidores (monitor_id, navegador, preco_alvo, preco_ao_seguir)
  values (v_monitor, p_navegador, p_alvo, (select preco_atual from monitor_precos where id = v_monitor))
  on conflict (monitor_id, navegador) do update set preco_alvo = coalesce(excluded.preco_alvo, monitor_seguidores.preco_alvo);
  return v_monitor;
end $$;

grant execute on function public.acompanhar_por_link(text, uuid, numeric) to anon, authenticated;

create or replace function public.seguidor_visivel(s public.monitor_seguidores, p_navegador uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select s.navegador = p_navegador or (auth.uid() is not null and s.usuario_id = auth.uid());
$$;

create or replace function public.definir_aviso_email(p_monitor bigint, p_ligado boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nav uuid;
  n integer;
begin
  if v_uid is null then raise exception 'sem sessao'; end if;
  select navegador into v_nav from conta_navegadores where usuario_id = v_uid;
  update monitor_seguidores
     set avisar_email = coalesce(p_ligado, false), usuario_id = v_uid
   where monitor_id = p_monitor
     and (usuario_id = v_uid or (v_nav is not null and navegador = v_nav));
  get diagnostics n = row_count;
  return n > 0;
end $$;
grant execute on function public.definir_aviso_email(bigint, boolean) to authenticated;
