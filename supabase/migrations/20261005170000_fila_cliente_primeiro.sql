-- CLIENTE PRIMEIRO E TETO DOS AGENTES (05/10): em 24 h os agentes puseram
-- 120 comparações na fila contra 3 de clientes e a cota gratuita da
-- conferência pela foto (Gemini) acabou; os pedidos seguintes saíram só com
-- o link. Agora:
--  1. pedidos_pendentes entrega SEMPRE os pedidos de cliente primeiro e, de
--     pedidos internos (origem 'teste'), no máximo 2 por vez;
--  2. pedir_link_agente: fila dos agentes com teto diário
--     (sinc_config.agentes_teto_dia, padrão 40, dia de Brasília) e parada
--     enquanto a cota do modelo do dia a dia (flash-lite) estiver esgotada.
--     pedir_link_novo continua livre só para a bateria de testes.
create or replace function public.pedidos_pendentes(p_token text)
 returns table(id bigint, cupom_id bigint, vendedor text, url_alvo text)
 language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  RETURN QUERY
  WITH livres AS (
    SELECT p.id, coalesce(p.origem, '') = 'teste' AS interno, p.criado_em
      FROM public.pedidos_link p
     WHERE p.criado_em > now() - interval '3 days'
       AND (p.status = 'pendente'
            OR (p.status = 'processando'
                AND coalesce(p.processando_em, p.criado_em) < now() - interval '90 seconds'))
  ),
  clientes AS (
    SELECT l.id FROM livres l WHERE NOT l.interno ORDER BY l.criado_em LIMIT 12
  ),
  internos AS (
    SELECT l.id FROM livres l
     WHERE l.interno AND NOT EXISTS (SELECT 1 FROM clientes)
     ORDER BY l.criado_em LIMIT 2
  ),
  alvo AS (
    SELECT p.id FROM public.pedidos_link p
     WHERE p.id IN (SELECT c.id FROM clientes c UNION ALL SELECT i.id FROM internos i)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pedidos_link q
     SET status = 'processando', processando_em = now()
    FROM alvo
   WHERE q.id = alvo.id
  RETURNING q.id, q.cupom_id, q.vendedor, q.url_alvo;
END
$function$;

insert into public.sinc_config (chave, valor) values ('agentes_teto_dia', '40')
on conflict (chave) do nothing;

create or replace function public.pedir_link_agente(p_url text, p_fonte text default null)
 returns bigint language plpgsql security definer set search_path to 'public' as $f$
declare
  v_teto int := coalesce((select nullif(valor, '')::int from public.sinc_config where chave = 'agentes_teto_dia'), 40);
  v_hoje int;
begin
  if exists (select 1 from public.ia_cotas where modelo = 'gemini-flash-lite-latest' and ate > now()) then
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
end $f$;
revoke all on function public.pedir_link_agente(text, text) from public, anon, authenticated;
grant execute on function public.pedir_link_agente(text, text) to service_role;

-- Hub de afiliados também pela fila dos agentes.
create or replace function public.registrar_hub(p_token text, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  r record;
  v_gravados int := 0;
  v_fila int := 0;
  v_pedido bigint;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then return jsonb_build_object('gravados', 0); end if;
  for r in
    select * from jsonb_to_recordset(p_itens) as x(
      item text, url text, titulo text, imagem text, preco numeric, preco_original numeric,
      desconto_pct int, mais_vendido boolean, avaliacao numeric, vendidos text, posicao int)
    limit 80
  loop
    continue when r.item is null or r.item !~ '^MLB[0-9]{6,}$' or coalesce(r.url, '') !~ '^https://(www|produto)\.mercadolivre\.com\.br/';
    insert into public.hub_recomendados as h
      (item, url, titulo, imagem, preco, preco_original, desconto_pct, mais_vendido, avaliacao, vendidos, posicao, lido_em)
    values (r.item, r.url, left(r.titulo, 200), left(r.imagem, 400), r.preco, r.preco_original,
            r.desconto_pct, coalesce(r.mais_vendido, false), r.avaliacao, left(r.vendidos, 40), r.posicao, now())
    on conflict (item) do update set
      url = excluded.url, titulo = coalesce(excluded.titulo, h.titulo), imagem = coalesce(excluded.imagem, h.imagem),
      preco = excluded.preco, preco_original = excluded.preco_original, desconto_pct = excluded.desconto_pct,
      mais_vendido = excluded.mais_vendido, avaliacao = excluded.avaliacao, vendidos = excluded.vendidos,
      posicao = excluded.posicao, lido_em = now();
    v_gravados := v_gravados + 1;
  end loop;
  -- Fila de comparação: mais vendidos e maiores descontos primeiro.
  for r in
    select item, url from public.hub_recomendados
     where lido_em > now() - interval '1 hour'
       and (enfileirado_em is null or enfileirado_em < now() - interval '48 hours')
     order by mais_vendido desc, coalesce(desconto_pct, 0) desc, posicao nulls last
     limit 6
  loop
    begin
      -- Fila dos agentes com teto diário e parada sem cota (05/10).
      v_pedido := public.pedir_link_agente(r.url, 'hub');
      exit when v_pedido is null;
      update public.hub_recomendados set pedido_id = v_pedido, enfileirado_em = now() where item = r.item;
      v_fila := v_fila + 1;
    exception when others then
      null;
    end;
  end loop;
  return jsonb_build_object('gravados', v_gravados, 'enfileirados', v_fila);
end $f$;
