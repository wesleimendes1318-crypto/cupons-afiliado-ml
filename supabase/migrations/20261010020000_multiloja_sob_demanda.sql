-- AMAZON E SHOPEE SOB DEMANDA (Weslei, 10/10: "para não gastar muitas
-- requisições, use essa hierarquia: o cliente cola o link, meu site
-- identifica o player e faz a busca só nele. Deixe Amazon e Shopee
-- disponíveis, mas com valores borrados. Caso o cliente queira saber nessas
-- outras páginas, ele precisa clicar num botão").
-- A extensão não busca mais sozinha na Amazon e na Shopee: só quando o
-- cliente pede no site (pedir_multiloja, com a chave do pedido). Aditiva:
-- tabela nova, duas funções novas e duas recriadas com o mesmo contrato.

create table if not exists public.multiloja_solicitacoes (
  pedido_id bigint primary key,
  solicitado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);
alter table public.multiloja_solicitacoes enable row level security;
revoke all on public.multiloja_solicitacoes from anon, authenticated;

-- pedir_multiloja: o site pede a busca na Amazon e na Shopee de um pedido
-- de cliente pronto. Só com a chave do pedido (a mesma do ver_pedido).
-- Resultado de menos de 6 h volta como pronto (não busca de novo); no site
-- todo, no máximo 30 pedidos novos a cada 10 minutos.
create or replace function public.pedir_multiloja(p_pedido bigint, p_chave text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  v_ok boolean;
  v_n int;
begin
  select true into v_ok from public.pedidos_link
   where id = p_pedido and chave::text = p_chave and status = 'pronto'
     and coalesce(origem, '') <> 'teste';
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'motivo', 'pedido');
  end if;
  if exists (select 1 from public.multiloja_resultados
              where pedido_id = p_pedido and criado_em > now() - interval '6 hours') then
    return jsonb_build_object('ok', true, 'estado', 'pronto');
  end if;
  if exists (select 1 from public.multiloja_solicitacoes
              where pedido_id = p_pedido and solicitado_em > now() - interval '6 minutes'
                and concluido_em is null) then
    return jsonb_build_object('ok', true, 'estado', 'pedido');
  end if;
  select count(*) into v_n from public.multiloja_solicitacoes
   where solicitado_em > now() - interval '10 minutes';
  if v_n >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;
  insert into public.multiloja_solicitacoes (pedido_id, solicitado_em)
  values (p_pedido, now())
  on conflict (pedido_id) do update
    set solicitado_em = now(), iniciado_em = null, concluido_em = null;
  return jsonb_build_object('ok', true, 'estado', 'pedido');
end $f$;

-- multiloja_pendentes: pedidos que o cliente pediu e ninguém atendeu (ou
-- que travaram há mais de 8 min), com o que a extensão precisa para montar o
-- anúncio colado sem ler a página de novo. Marca como iniciado.
create or replace function public.multiloja_pendentes(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  v jsonb;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  with fila as (
    select s.pedido_id
      from public.multiloja_solicitacoes s
     where s.concluido_em is null
       and s.solicitado_em > now() - interval '1 hour'
       and (s.iniciado_em is null or s.iniciado_em < now() - interval '8 minutes')
     order by s.solicitado_em
     limit 3
     for update skip locked
  ), marcados as (
    update public.multiloja_solicitacoes s set iniciado_em = now()
      from fila where s.pedido_id = fila.pedido_id
    returning s.pedido_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'url', p.url_alvo,
           'titulo', p.analise->>'titulo',
           'variacao', p.analise->>'variacao',
           'imagem', p.analise->>'imagem',
           'preco', p.analise->'preco',
           'categorias', p.analise->'categorias',
           'condicao', p.analise->>'condicao',
           'dominio', p.analise->>'dominio',
           'detalhes', p.analise->'detalhes'
         )), '[]'::jsonb)
    into v
    from marcados m join public.pedidos_link p on p.id = m.pedido_id;
  return v;
end $f$;

-- multiloja_vale: agora só com o pedido do cliente (solicitação aberta).
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
  if not exists (select 1 from public.multiloja_solicitacoes
                  where pedido_id = p_pedido and concluido_em is null
                    and solicitado_em > now() - interval '1 hour') then
    return jsonb_build_object('ok', false, 'motivo', 'cliente nao pediu');
  end if;
  if exists (select 1 from public.multiloja_resultados
              where pedido_id = p_pedido and criado_em > now() - interval '6 hours') then
    return jsonb_build_object('ok', false, 'motivo', 'ja comparado');
  end if;
  return jsonb_build_object('ok', v_amazon or v_shopee, 'amazon', v_amazon, 'shopee', v_shopee);
end $f$;

-- gravar_multiloja: grava o resultado e fecha a solicitação.
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
  update public.multiloja_solicitacoes set concluido_em = now()
   where pedido_id = p_pedido and concluido_em is null;
end $f$;

revoke all on function public.pedir_multiloja(bigint, text) from public;
revoke all on function public.multiloja_pendentes(text) from public;
revoke all on function public.multiloja_vale(text, bigint) from public;
revoke all on function public.gravar_multiloja(text, bigint, jsonb) from public;
grant execute on function public.pedir_multiloja(bigint, text) to anon, authenticated;
grant execute on function public.multiloja_pendentes(text) to anon, authenticated;
grant execute on function public.multiloja_vale(text, bigint) to anon, authenticated;
grant execute on function public.gravar_multiloja(text, bigint, jsonb) to anon, authenticated;
