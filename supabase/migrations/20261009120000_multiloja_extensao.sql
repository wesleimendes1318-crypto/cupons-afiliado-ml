-- Outros marketplaces pela EXTENSÃO (09/10): sem credenciais das APIs da
-- Amazon e da Shopee, a extensão do Weslei busca pela sessão logada,
-- confere pela foto no servidor e grava aqui o resultado do pedido.
-- Aditiva: duas funções novas; multiloja_resultados já existe.
--
-- multiloja_vale: a extensão só trabalha em pedido de CLIENTE (origem
-- diferente de 'teste'), ainda sem resultado, e com a marketplace ligada
-- (sinc_config multiloja_amazon / multiloja_shopee; padrão ligada).
create or replace function public.multiloja_vale(p_token text, p_pedido bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  v_origem text;
  v_amazon boolean := coalesce((select valor from public.sinc_config where chave = 'multiloja_amazon'), 'true') <> 'false';
  v_shopee boolean := coalesce((select valor from public.sinc_config where chave = 'multiloja_shopee'), 'true') <> 'false';
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  select coalesce(origem, '') into v_origem from public.pedidos_link where id = p_pedido;
  if not found or v_origem = 'teste' then
    return jsonb_build_object('ok', false, 'motivo', 'pedido interno ou inexistente');
  end if;
  if exists (select 1 from public.multiloja_resultados
              where pedido_id = p_pedido and criado_em > now() - interval '6 hours') then
    return jsonb_build_object('ok', false, 'motivo', 'ja comparado');
  end if;
  return jsonb_build_object('ok', v_amazon or v_shopee, 'amazon', v_amazon, 'shopee', v_shopee);
end $f$;

-- gravar_multiloja: resultado da extensão para o site mostrar. O site
-- confere de novo cada link (só tag de afiliado / encurtador oficial) e cada
-- foto (hosts das marketplaces) antes de exibir.
create or replace function public.gravar_multiloja(p_token text, p_pedido bigint, p_resultado jsonb)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if p_resultado is null or jsonb_typeof(p_resultado) <> 'object' then
    raise exception 'resultado invalido';
  end if;
  insert into public.multiloja_resultados (pedido_id, resultado, criado_em)
  values (p_pedido, p_resultado, now())
  on conflict (pedido_id) do update set resultado = excluded.resultado, criado_em = excluded.criado_em;
end $f$;

revoke all on function public.multiloja_vale(text, bigint) from public;
revoke all on function public.gravar_multiloja(text, bigint, jsonb) from public;
grant execute on function public.multiloja_vale(text, bigint) to anon, authenticated;
grant execute on function public.gravar_multiloja(text, bigint, jsonb) to anon, authenticated;
