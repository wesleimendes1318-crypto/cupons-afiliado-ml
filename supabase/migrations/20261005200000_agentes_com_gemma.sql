-- Agentes com o Gemma (05/10, noite). A conferência sem Gemini voltou a
-- funcionar com o gemma-4-26b-a4b-it (raciocínio no mínimo, 1,3 s com foto),
-- então a fila dos agentes só para quando o Gemma também estiver sem cota.
-- Teto diário 200 (Weslei, 05/10: "pelo menos 20 itens em cada vitrine
-- sazonal"); clientes continuam na frente da fila (pedidos_pendentes).
create or replace function public.pedir_link_agente(p_url text, p_fonte text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teto int := coalesce((select nullif(valor, '')::int from public.sinc_config where chave = 'agentes_teto_dia'), 40);
  v_hoje int;
begin
  if exists (select 1 from public.ia_cotas where modelo = 'gemini-flash-lite-latest' and ate > now())
     and exists (select 1 from public.ia_cotas where modelo = 'gemma-4-26b-a4b-it' and ate > now()) then
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
$$;

update public.sinc_config set valor = '200' where chave = 'agentes_teto_dia';
