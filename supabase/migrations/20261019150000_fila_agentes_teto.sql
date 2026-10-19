-- Fila dos agentes com teto de pendentes (Guardião, 19/10).
-- A extensão ficou sem contato das 02:25 às 14:45 UTC (notebook desligado)
-- e as rotinas seguiram enfileirando: 58 pedidos internos pendentes. Na
-- volta, uma fila grande de leituras seguidas já pediu verificação ao
-- Mercado Livre (10/10). Regra: "Nunca enfileirar pedidos internos em lote
-- grande de uma vez". Com 20 ou mais internos pendentes (a extensão não está
-- dando conta ou está parada), o agente não põe mais nada na fila; o que já
-- está lá continua. Pedido de cliente não passa por aqui.
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
  if (select count(*) from public.pedidos_link where origem = 'teste' and status = 'pendente') >= v_fila_max then
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
