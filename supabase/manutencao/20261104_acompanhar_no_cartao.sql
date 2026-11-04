-- ACOMPANHAR NO CARTÃO (Weslei, 04/11). Aplicar no Supabase próprio (SQL
-- Editor). O sino dos cartões (vitrine, campanhas, brinquedos, mais vendidos
-- e busca) segue o produto pelo endereço, usando a comparação pronta mais
-- recente do MESMO produto. Sem comparação, responde 'sem comparacao' e o
-- site compara primeiro (o resultado salva sozinho). Mesmos limites de
-- acompanhar_preco (20 por navegador, 200 no total).

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

revoke all on function public.acompanhar_por_link(text, uuid, numeric) from public;
grant execute on function public.acompanhar_por_link(text, uuid, numeric) to anon, authenticated;
