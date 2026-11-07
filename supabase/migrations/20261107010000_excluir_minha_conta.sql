-- DELETE MY ACCOUNT (Weslei, 06/11/2026, LGPD art. 18 "eliminação"): the
-- "Excluir permanentemente minha conta e dados" button on /painel. Additive:
-- one new function, no table or existing function changed.
-- Acts only on auth.uid(): tracked prices of the account id (and of the
-- device id the caller sends, which only that browser knows), Telegram price
-- alerts, public wishlists, then the auth user itself, which cascades
-- conta_navegadores, lista_desejos_conta and amigo_secreto_conta.

create or replace function public.excluir_minha_conta(p_navegador uuid default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario uuid := auth.uid();
  v_navs uuid[];
begin
  if v_usuario is null then raise exception 'entre com seu e-mail primeiro'; end if;

  select array_remove(array[(select navegador from conta_navegadores where usuario_id = v_usuario), p_navegador], null)
    into v_navs;

  delete from monitor_telegram where navegador = any (v_navs);
  delete from monitor_seguidores where navegador = any (v_navs) or usuario_id = v_usuario;
  delete from listas_compartilhadas where usuario_id = v_usuario;
  delete from auth.users where id = v_usuario;
  return true;
end;
$$;
revoke all on function public.excluir_minha_conta(uuid) from public, anon;
grant execute on function public.excluir_minha_conta(uuid) to authenticated;
