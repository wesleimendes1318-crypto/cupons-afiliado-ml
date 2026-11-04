-- CONTA POR E-MAIL SEM SENHA (Weslei, 04/11). Aplicar no Supabase próprio
-- (SQL Editor). Um identificador de "Meus preços" por conta; cada aparelho
-- que entra adota esse identificador e traz junto o que já acompanhava.

create table if not exists public.conta_navegadores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  navegador uuid not null,
  criado_em timestamptz not null default now()
);
grant all on public.conta_navegadores to service_role;
alter table public.conta_navegadores enable row level security;
revoke all on public.conta_navegadores from anon, authenticated;

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
revoke all on function public.vincular_navegador_conta(uuid) from public, anon;
grant execute on function public.vincular_navegador_conta(uuid) to authenticated;
