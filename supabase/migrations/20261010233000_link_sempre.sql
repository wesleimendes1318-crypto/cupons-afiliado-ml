-- REGRA Nº 1 (Weslei, 10/10: "SEMPRE DEVE DEVOLVER O MEU LINK. Não deve ter
-- dúvidas disso, essa é a minha fonte de renda por ser afiliado!").
--
-- O botão que gera o link no clique (VerNaLoja) dependia só da extensão: com
-- ela parada, pausada, no freio ou na fila cheia, o cliente esperava até
-- 100 s e ficava com "Tentar de novo", sem link nenhum.
--
-- 1. link_conhecido: o link de afiliado que o gerador já devolveu para ESTE
--    anúncio (registro geracoes ou reparo). pedir_link_da_loja devolve na
--    hora, sem fila e sem extensão.
-- 2. link_de_reserva (leitura pública): sem o link do anúncio, o link de
--    afiliado da página do produto (ficha do catálogo). Abre a oferta em
--    destaque, que pode ter outro preço: a tela diz isso no botão.
-- 3. Teto diário dos pedidos "só link" conta só os cliques do site (o reparo
--    interno, origem 'teste', não pode mais bloquear o cliente).
-- 4. Pedido "só link" pronto sem link não é reaproveitado (o clique esperava
--    100 s por um link que não vinha).
-- 5. Auditoria: 'link_no_clique_falhou' (grave).
-- 6. Reparo dos links da ficha a cada 3 min (3 por vez, só sem cliente).

create or replace function public.link_conhecido(p_url text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text := split_part(coalesce(p_url, ''), '#', 1);
  v_item text;
begin
  if length(v_url) > 2000 then return null; end if;
  v_item := public.anuncio_do_endereco(v_url);
  if v_item ~ '^MLB[0-9]{6,}$' then
    return public.link_do_anuncio(v_item);
  end if;
  -- Página sem anúncio (ficha pura): o link dela abre a oferta em destaque,
  -- a mesma que a página mostra.
  return (select g.resultado from public.geracoes g
           where g.tipo = 'link' and g.status = 'ok' and g.chave = v_url
             and g.resultado ~ '^https://meli\.la/[A-Za-z0-9]+$'
           order by g.atualizado_em desc limit 1);
end
$$;
revoke all on function public.link_conhecido(text) from public, anon, authenticated;

create or replace function public.link_de_reserva(p_url text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text := split_part(coalesce(p_url, ''), '#', 1);
  v_item text;
  v_prod text;
  v_link text;
begin
  if length(v_url) > 2000 or v_url !~* '^https://(www|produto)\.mercadolivre\.com\.br/' then
    return null;
  end if;
  v_link := public.link_conhecido(v_url);
  if v_link is not null then
    return jsonb_build_object('link', v_link, 'tipo', 'anuncio');
  end if;
  v_item := public.anuncio_do_endereco(v_url);
  v_prod := coalesce(substring(v_url from '(?i)/p/(MLB[0-9]+)'), substring(v_url from '(?i)/up/(MLBU[0-9]+)'));
  if v_prod is null and v_item is not null then
    select coalesce(substring(g.chave from '(?i)/p/(MLB[0-9]+)'), substring(g.chave from '(?i)/up/(MLBU[0-9]+)'))
      into v_prod
      from public.geracoes g
     where g.tipo = 'link' and g.chave ~* '/(p/MLB|up/MLBU)[0-9]+'
       and public.anuncio_do_endereco(g.chave) = v_item
     limit 1;
  end if;
  if v_prod is null then return null; end if;
  select g.resultado into v_link
    from public.geracoes g
   where g.tipo = 'link' and g.status = 'ok' and g.resultado ~ '^https://meli\.la/[A-Za-z0-9]+$'
     and g.chave ~* ('/(p|up)/' || v_prod || '([^0-9]|$)')
   order by g.atualizado_em desc limit 1;
  if v_link is null then return null; end if;
  return jsonb_build_object('link', v_link, 'tipo', 'produto');
end
$$;
revoke all on function public.link_de_reserva(text) from public;
grant execute on function public.link_de_reserva(text) to anon, authenticated, service_role;

create or replace function public.pedir_link_loja(p_url text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_url text;
begin
  v_url := split_part(coalesce(p_url, ''), '#', 1);
  if length(v_url) > 2000
     or v_url !~* '^https://(www|produto)\.mercadolivre\.com\.br/' or v_url !~* '(/p/MLB[0-9]+|/up/MLBU[0-9]+|MLB-?[0-9]{6,})' then
    raise exception 'link invalido';
  end if;
  select id into v_id from public.pedidos_link
   where vendedor = '(so link)' and url_alvo = v_url and criado_em > now() - interval '1 hour'
     and (status in ('pendente', 'processando') or (status = 'pronto' and link is not null))
   order by id desc limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.pedidos_link
       where vendedor = '(so link)' and origem = 'site' and criado_em > now() - interval '1 day') >= 300
     or public.pedidos_no_limite() then
    raise exception 'fila cheia';
  end if;
  insert into public.pedidos_link (vendedor, url_alvo, status, origem)
  values ('(so link)', v_url, 'pendente', 'site') returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.pedir_link_loja(text) from public, anon, authenticated;

-- Link já conhecido do anúncio volta na hora ("link"), sem pedido na fila.
create or replace function public.pedir_link_da_loja(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_link text;
begin
  v_link := public.link_conhecido(p_url);
  if v_link is not null then
    return jsonb_build_object('id', null, 'chave', null, 'link', v_link);
  end if;
  v_id := public.pedir_link_loja(p_url);
  return (select jsonb_build_object('id', id, 'chave', chave, 'link', link) from public.pedidos_link where id = v_id);
end
$$;
grant execute on function public.pedir_link_da_loja(text) to anon, authenticated, service_role;

-- Guardião: clique do cliente que terminou sem o link de afiliado.
create or replace function public.auditoria_exibicao(p_horas integer default 24)
returns table(problema text, gravidade text, pedido_id bigint, detalhe text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with janela as (
    select * from public.pedidos_link
     where criado_em > now() - make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 720)))
  ),
  entradas as (
    select j.id, l.lista, l.e
      from janela j,
      lateral (
        select 'parecidos' lista, e from jsonb_array_elements(case when jsonb_typeof(j.analise->'parecidos') = 'array' then j.analise->'parecidos' else '[]' end) e
        union all select 'outrasLojas', e from jsonb_array_elements(case when jsonb_typeof(j.analise->'outrasLojas') = 'array' then j.analise->'outrasLojas' else '[]' end) e
        union all select 'referencias', e from jsonb_array_elements(case when jsonb_typeof(j.analise->'referencias') = 'array' then j.analise->'referencias' else '[]' end) e
        union all select 'outraLoja', j.analise->'outraLoja' where jsonb_typeof(j.analise->'outraLoja') = 'object'
      ) l
  )
  select 'vendedor_e_a_conta', 'grave', id, lista || ': ' || coalesce(e->>'titulo', e->>'url', '')
    from entradas where coalesce(e->>'vendedor', '') ~* '^\s*weslei[\s._-]*mendes\s*$'
  union all
  select 'link_sem_afiliado', 'grave', id, lista || ': ' || left(e->>'link', 80)
    from entradas where coalesce(e->>'link', '') <> '' and e->>'link' !~ '^https://meli\.la/[A-Za-z0-9]+/?$'
  union all
  select 'colado_link_sem_afiliado', 'grave', id, left(link, 80)
    from janela where link is not null and link !~ '^https://meli\.la/[A-Za-z0-9]+/?$'
  union all
  select 'link_da_ficha', 'grave', id, left(link, 80) || ' (ficha) para ' || left(url_alvo, 90)
    from janela where link is not null and public.link_da_ficha(link, url_alvo)
  union all
  select 'pronto_sem_link', case when coalesce(origem, '') = 'teste' then 'interno' else 'grave' end,
         id, coalesce(analise->>'linkFalhou', erro, '')
    from janela where status = 'pronto' and link is null and coalesce(vendedor, '') <> '(so link)'
  union all
  select 'link_no_clique_falhou', 'grave', id,
         status || ': ' || left(coalesce(erro, url_alvo, ''), 120)
    from janela
   where vendedor = '(so link)' and coalesce(origem, '') = 'site'
     and (status = 'falhou' or (status = 'pronto' and link is null)
          or (status in ('pendente', 'processando') and criado_em < now() - interval '3 minutes'))
  union all
  select 'pedido_parado', 'grave', id, status || ' desde ' || to_char(criado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    from janela where status in ('pendente', 'processando') and criado_em < now() - interval '20 minutes'
     and not public.extensao_pausada()
  union all
  select 'extensao_pausada', 'atencao', null::bigint,
         'pausa remota ligada (select public.pausar_extensao(false) para voltar)'
   where public.extensao_pausada()
  union all
  select 'pedido_falhou', 'atencao', id, left(coalesce(erro, ''), 120)
    from janela where status = 'falhou'
  union all
  select 'entrada_sem_preco', 'atencao', id, lista || ': ' || coalesce(e->>'titulo', e->>'url', '')
    from entradas where lista in ('parecidos', 'outrasLojas') and nullif(e->>'preco', '') is null
  union all
  select 'canal_sem_frete_confirmado', 'grave', c.pedido_id, left(c.titulo, 80)
    from public.canal_publicacoes c
    left join public.pedidos_link p on p.id = c.pedido_id
   where c.removida_em is null and c.criterios not like 'reserva%'
     and c.publicado_em > now() - interval '7 days'
     and coalesce((
           select (o->>'freteGratis')::boolean
             from jsonb_array_elements(coalesce(p.analise->'outrasLojas', '[]') || coalesce(p.analise->'parecidos', '[]')) o
            where o->>'link' = c.link limit 1),
           case when c.link = p.link or public.link_da_ficha(c.link, p.url_alvo)
                then (p.analise->>'freteGratis')::boolean end,
           false) is not true
  union all
  select 'canal_link_da_ficha', 'grave', c.pedido_id,
         'post ' || c.id || ' de ' || to_char(c.publicado_em at time zone 'America/Sao_Paulo', 'DD/MM') || ': ' || left(c.titulo, 70)
    from public.canal_publicacoes c
    join public.pedidos_link p on p.id = c.pedido_id
   where c.removida_em is null and c.publicado_em > now() - interval '7 days'
     and public.link_da_ficha(c.link, p.url_alvo)
  union all
  select 'execucao_com_erro', 'atencao', null::bigint, tarefa || ': ' || left(coalesce(erro, ''), 120)
    from public.operacao_execucoes
   where inicio > now() - make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 720)))
     and (ok is false or erro is not null)
  union all
  select 'chamada_agendada_falhou', 'atencao', id::bigint, coalesce(status_code::text, 'sem resposta') || ' ' || left(coalesce(error_msg, content, ''), 100)
    from net._http_response
   where created > now() - make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 720)))
     and (status_code is null or status_code >= 400)
     and coalesce(content, '') not like '%Signature invalid%'
  union all
  select 'campanha_vencida_ativa', 'grave', null::bigint,
         slug || ' venceu em ' || to_char(termina_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    from public.campanhas
   where status = 'ativa' and termina_em < now() - interval '2 hours'
  union all
  select 'campanha_sem_renovar', 'atencao', null::bigint,
         slug || ' sem atualização desde ' || to_char(atualizado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    from public.campanhas
   where status = 'ativa' and atualizado_em < now() - interval '30 hours';
$function$;

-- Reparo dos links: 3 por vez a cada 3 min (antes 5), só sem cliente.
select cron.schedule('links-refazer', '*/3 * * * *', $$select public.refazer_links_fila();$$);
