-- Guardião (10/10, 16:44): a regra canal_sem_frete_confirmado comparava o
-- link do post com o do pedido; a limpeza do link da ficha
-- (20261010170000) deixou o pedido sem link e o post 22 (pedido 868, frete
-- grátis confirmado) virou "grave" por engano. O frete do anúncio colado vale
-- também quando o link do post era o da ficha desse anúncio. Regras novas:
--   canal_link_da_ficha (grave): post no ar com o link da ficha num pedido que
--     aponta um anúncio (o botão abre a oferta destacada, outro preço);
--   link_da_ficha (grave): pedido com o link da ficha (a trava deveria barrar).
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
  select 'pedido_parado', 'grave', id, status || ' desde ' || to_char(criado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    from janela where status in ('pendente', 'processando') and criado_em < now() - interval '20 minutes'
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
