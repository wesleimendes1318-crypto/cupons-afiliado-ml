-- AGENTE GUARDIÃO (05/10, Weslei: "preciso de um agente que cuide disso,
-- mantenha o site totalmente funcionando, validado e com segurança do que é
-- mostrado"). Uma consulta só, para o guardião rodar a cada execução: tudo o
-- que NÃO pode aparecer para o cliente ou indica que algo parou.
-- Só leitura, só para o banco/serviço (sem acesso público).
create or replace function public.auditoria_exibicao(p_horas int default 24)
returns table(problema text, gravidade text, pedido_id bigint, detalhe text)
language sql stable security definer set search_path to 'public' as $$
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
  -- 1. Loja com o apelido da conta de afiliado (leitura logada errada).
  select 'vendedor_e_a_conta', 'grave', id, lista || ': ' || coalesce(e->>'titulo', e->>'url', '')
    from entradas where coalesce(e->>'vendedor', '') ~* '^\s*weslei[\s._-]*mendes\s*$'
  union all
  -- 2. Link de compra que não é de afiliado.
  select 'link_sem_afiliado', 'grave', id, lista || ': ' || left(e->>'link', 80)
    from entradas where coalesce(e->>'link', '') <> '' and e->>'link' !~ '^https://meli\.la/[A-Za-z0-9]+/?$'
  union all
  select 'colado_link_sem_afiliado', 'grave', id, left(link, 80)
    from janela where link is not null and link !~ '^https://meli\.la/[A-Za-z0-9]+/?$'
  union all
  -- 3. Comparação pronta sem link (o cliente fica sem botão).
  -- Pedido do próprio agente (origem 'teste': sazonal, brinquedos, busca) sem
  -- link não chega ao cliente (a vitrine exige link): conta como interno.
  select 'pronto_sem_link', case when coalesce(origem, '') = 'teste' then 'interno' else 'grave' end,
         id, coalesce(analise->>'linkFalhou', erro, '')
    from janela where status = 'pronto' and link is null and coalesce(vendedor, '') <> '(so link)'
  union all
  -- 4. Pedido parado (a extensão parou?).
  select 'pedido_parado', 'grave', id, status || ' desde ' || to_char(criado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    from janela where status in ('pendente', 'processando') and criado_em < now() - interval '20 minutes'
  union all
  select 'pedido_falhou', 'atencao', id, left(coalesce(erro, ''), 120)
    from janela where status = 'falhou'
  union all
  -- 5. Parecido/loja sem preço (não dá para mostrar economia).
  select 'entrada_sem_preco', 'atencao', id, lista || ': ' || coalesce(e->>'titulo', e->>'url', '')
    from entradas where lista in ('parecidos', 'outrasLojas') and nullif(e->>'preco', '') is null
  union all
  -- 6. Post do canal no ar cuja oferta não tem frete grátis confirmado na
  -- comparação (05/10, Deo Malbec com frete de R$ 11,90 fora da mensagem).
  select 'canal_sem_frete_confirmado', 'grave', c.pedido_id, left(c.titulo, 80)
    from public.canal_publicacoes c
    left join public.pedidos_link p on p.id = c.pedido_id
   where c.removida_em is null and c.criterios not like 'reserva%'
     and c.publicado_em > now() - interval '7 days'
     and coalesce((
           select (o->>'freteGratis')::boolean
             from jsonb_array_elements(coalesce(p.analise->'outrasLojas', '[]') || coalesce(p.analise->'parecidos', '[]')) o
            where o->>'link' = c.link limit 1),
           case when c.link = p.link then (p.analise->>'freteGratis')::boolean end,
           false) is not true
  union all
  -- 7. Rotina do servidor com erro.
  select 'execucao_com_erro', 'atencao', null::bigint, tarefa || ': ' || left(coalesce(erro, ''), 120)
    from public.operacao_execucoes
   where inicio > now() - make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 720)))
     and (ok is false or erro is not null)
  union all
  -- 8. Chamada agendada que não respondeu 200.
  select 'chamada_agendada_falhou', 'atencao', id::bigint, coalesce(status_code::text, 'sem resposta') || ' ' || left(coalesce(error_msg, content, ''), 100)
    from net._http_response
   where created > now() - make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 720)))
     and (status_code is null or status_code >= 400)
     and coalesce(content, '') not like '%Signature invalid%';
$$;
revoke all on function public.auditoria_exibicao(int) from public, anon, authenticated;
