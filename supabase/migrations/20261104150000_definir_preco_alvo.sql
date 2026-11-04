-- Preço-alvo editável em Meus preços (04/11). Só cria função nova.
create or replace function public.definir_preco_alvo(p_monitor bigint, p_navegador uuid, p_alvo numeric)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  if p_alvo is not null and (p_alvo <= 0 or p_alvo > 10000000) then
    raise exception 'preco invalido';
  end if;
  update monitor_seguidores s set preco_alvo = round(p_alvo, 2)
   where s.monitor_id = p_monitor and seguidor_visivel(s, p_navegador);
  get diagnostics n = row_count;
  return n > 0;
end $function$;

revoke all on function public.definir_preco_alvo(bigint, uuid, numeric) from public;
grant execute on function public.definir_preco_alvo(bigint, uuid, numeric) to anon, authenticated;
