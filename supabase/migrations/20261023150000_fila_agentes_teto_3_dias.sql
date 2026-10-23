-- Teto da fila dos agentes só conta o que a extensão ainda atende (Guardião,
-- 23/10). pedidos_pendentes só entrega pedido criado nos últimos 3 dias; os
-- 58 internos de 19/10 (extensão recusada pelo banco de 19 a 23/10) nunca
-- mais seriam atendidos e, contando no teto de 20, travavam os agentes para
-- sempre: nenhuma comparação nova para vitrines, campanhas e brinquedos.
-- 1) o teto conta só pendentes dos últimos 3 dias (a mesma janela da fila);
-- 2) os internos parados há mais de 3 dias saem da fila como 'falhou'.
-- Pedido de cliente não é tocado.
create or replace function public.pedir_link_agente(p_url text, p_fonte text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_teto int := coalesce((select nullif(valor, '')::int from public.sinc_config where chave = 'agentes_teto_dia'), 40);
  v_fila_max int := coalesce((select nullif(valor, '')::int from public.sinc_config where chave = 'agentes_fila_max'), 20);
  v_hoje int;
begin
  if exists (select 1 from public.ia_cotas where modelo = 'gemini-flash-lite-latest' and ate > now())
     and exists (select 1 from public.ia_cotas where modelo = 'gemma-4-26b-a4b-it' and ate > now()) then
    return null;
  end if;
  if (select count(*) from public.pedidos_link
       where origem = 'teste' and status = 'pendente'
         and criado_em > now() - interval '3 days') >= v_fila_max then
    return null;
  end if;
  select count(*) into v_hoje from public.pedidos_link
   where origem = 'teste'
     and criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
  if v_hoje >= v_teto then return null; end if;
  insert into public.pedidos_link (vendedor, url_alvo, status, origem)
  values ('(a descobrir)', split_part(p_url, '#', 1), 'pendente', 'teste')
  returning id into v_hoje;
  return v_hoje;
end
$function$;

revoke all on function public.pedir_link_agente(text, text) from public, anon, authenticated;

update public.pedidos_link
   set status = 'falhou', erro = coalesce(erro, 'expirou na fila (interno parado mais de 3 dias)')
 where origem = 'teste' and status = 'pendente' and criado_em < now() - interval '3 days';
