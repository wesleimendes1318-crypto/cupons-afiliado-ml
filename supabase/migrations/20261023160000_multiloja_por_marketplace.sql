-- UM MARKETPLACE POR VEZ (Weslei, 23/10: "não deve pesquisar em todos de uma
-- vez, mas sim no marketplace escolhido"). O cliente pede a Amazon OU a
-- Shopee; a extensão (1.167.1, sem atualizar) só busca o que multiloja_vale
-- liberar, e o resultado de cada marketplace se soma ao que já havia.
-- Aditiva: colunas novas, uma função nova (pedir_multiloja com o
-- marketplace) e as outras recriadas com o mesmo contrato. Linha antiga
-- sem marketplace escolhido (quer_* nulo) continua valendo para os dois.

alter table public.multiloja_solicitacoes
  add column if not exists quer_amazon boolean,
  add column if not exists quer_shopee boolean,
  add column if not exists entregue_amazon boolean not null default false,
  add column if not exists entregue_shopee boolean not null default false;

-- Já comparado: o marketplace está no resumo do resultado (sem falha de
-- conferência) há menos de 6 h.
create or replace function public.multiloja_ja_comparado(p_pedido bigint, p_marketplace text)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select exists (
    select 1 from public.multiloja_resultados r
     where r.pedido_id = p_pedido
       and r.resultado->'resumo' ? p_marketplace
       and coalesce((r.resultado->'resumo'->p_marketplace->>'incompleto')::boolean, false) = false
       and coalesce((r.resultado->'resumo'->p_marketplace->>'em')::timestamptz, r.criado_em)
           > now() - interval '6 hours'
  )
$f$;
revoke all on function public.multiloja_ja_comparado(bigint, text) from public, anon, authenticated;

-- pedir_multiloja com o marketplace escolhido. Mesmas travas de antes: só com
-- a chave do pedido de cliente pronto, no máximo 30 pedidos novos a cada
-- 10 minutos no site todo.
create or replace function public.pedir_multiloja(p_pedido bigint, p_chave text, p_marketplace text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  v_ok boolean;
  v_n int;
  v_s public.multiloja_solicitacoes%rowtype;
  v_existe boolean;
  v_amazon boolean := p_marketplace = 'amazon';
begin
  if p_marketplace is null or p_marketplace not in ('amazon', 'shopee') then
    return jsonb_build_object('ok', false, 'motivo', 'marketplace');
  end if;
  select true into v_ok from public.pedidos_link
   where id = p_pedido and chave::text = p_chave and status = 'pronto'
     and coalesce(origem, '') <> 'teste';
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'motivo', 'pedido');
  end if;
  if public.multiloja_ja_comparado(p_pedido, p_marketplace) then
    return jsonb_build_object('ok', true, 'estado', 'pronto');
  end if;
  select * into v_s from public.multiloja_solicitacoes where pedido_id = p_pedido for update;
  v_existe := found;
  if v_existe and v_s.concluido_em is null and v_s.solicitado_em > now() - interval '6 minutes'
     and (case when v_amazon then coalesce(v_s.quer_amazon, true) else coalesce(v_s.quer_shopee, true) end) then
    return jsonb_build_object('ok', true, 'estado', 'pedido');
  end if;
  select count(*) into v_n from public.multiloja_solicitacoes
   where solicitado_em > now() - interval '10 minutes';
  if v_n >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;
  if v_existe and v_s.concluido_em is null and v_s.solicitado_em > now() - interval '1 hour' then
    -- Já há uma busca aberta deste pedido (o outro marketplace): soma este.
    update public.multiloja_solicitacoes
       set solicitado_em = now(),
           quer_amazon = case when v_amazon then true else coalesce(quer_amazon, true) end,
           quer_shopee = case when v_amazon then coalesce(quer_shopee, true) else true end,
           entregue_amazon = case when v_amazon then false else entregue_amazon end,
           entregue_shopee = case when v_amazon then entregue_shopee else false end
     where pedido_id = p_pedido;
  else
    insert into public.multiloja_solicitacoes
      (pedido_id, solicitado_em, iniciado_em, concluido_em,
       quer_amazon, quer_shopee, entregue_amazon, entregue_shopee)
    values (p_pedido, now(), null, null, v_amazon, not v_amazon, false, false)
    on conflict (pedido_id) do update
      set solicitado_em = now(), iniciado_em = null, concluido_em = null,
          quer_amazon = excluded.quer_amazon, quer_shopee = excluded.quer_shopee,
          entregue_amazon = false, entregue_shopee = false;
  end if;
  return jsonb_build_object('ok', true, 'estado', 'pedido');
end $f$;

revoke all on function public.pedir_multiloja(bigint, text, text) from public;
grant execute on function public.pedir_multiloja(bigint, text, text) to anon, authenticated;

-- Fila da extensão: só pedido com marketplace ainda não entregue; travado há
-- mais de 8 min volta para a fila com tudo para entregar de novo.
create or replace function public.multiloja_pendentes_sem_pausa(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  v jsonb;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  with fila as (
    select s.pedido_id, (s.iniciado_em is not null) as travado
      from public.multiloja_solicitacoes s
     where s.concluido_em is null
       and s.solicitado_em > now() - interval '1 hour'
       and (s.iniciado_em is null or s.iniciado_em < now() - interval '8 minutes')
       and (s.iniciado_em is not null
            or (coalesce(s.quer_amazon, true) and not s.entregue_amazon)
            or (coalesce(s.quer_shopee, true) and not s.entregue_shopee))
     order by s.solicitado_em
     limit 3
     for update skip locked
  ), marcados as (
    update public.multiloja_solicitacoes s
       set iniciado_em = now(),
           entregue_amazon = case when fila.travado then false else s.entregue_amazon end,
           entregue_shopee = case when fila.travado then false else s.entregue_shopee end
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

-- multiloja_vale: libera só o marketplace que o cliente escolheu, ainda não
-- entregue e ainda não comparado, e anota o que foi entregue.
create or replace function public.multiloja_vale(p_token text, p_pedido bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  v_origem text;
  v_cfg_amazon boolean := coalesce((select valor from public.sinc_config where chave = 'multiloja_amazon'), 'true') <> 'false';
  v_cfg_shopee boolean := coalesce((select valor from public.sinc_config where chave = 'multiloja_shopee'), 'true') <> 'false';
  v_s public.multiloja_solicitacoes%rowtype;
  v_amazon boolean;
  v_shopee boolean;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  select coalesce(origem, '') into v_origem from public.pedidos_link where id = p_pedido;
  if not found or v_origem = 'teste' then
    return jsonb_build_object('ok', false, 'motivo', 'pedido interno ou inexistente');
  end if;
  select * into v_s from public.multiloja_solicitacoes
   where pedido_id = p_pedido and concluido_em is null
     and solicitado_em > now() - interval '1 hour'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'cliente nao pediu');
  end if;
  v_amazon := v_cfg_amazon and coalesce(v_s.quer_amazon, true) and not v_s.entregue_amazon
              and not public.multiloja_ja_comparado(p_pedido, 'amazon');
  v_shopee := v_cfg_shopee and coalesce(v_s.quer_shopee, true) and not v_s.entregue_shopee
              and not public.multiloja_ja_comparado(p_pedido, 'shopee');
  if not (v_amazon or v_shopee) then
    return jsonb_build_object('ok', false, 'motivo', 'ja comparado');
  end if;
  update public.multiloja_solicitacoes
     set entregue_amazon = entregue_amazon or v_amazon,
         entregue_shopee = entregue_shopee or v_shopee
   where pedido_id = p_pedido;
  return jsonb_build_object('ok', true, 'amazon', v_amazon, 'shopee', v_shopee);
end $f$;

-- gravar_multiloja: soma o resultado deste marketplace ao que já havia (o
-- outro marketplace continua), carimba a hora de cada um e só fecha a
-- solicitação quando não sobrou marketplace pedido sem entregar.
create or replace function public.gravar_multiloja(p_token text, p_pedido bigint, p_resultado jsonb)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare
  v_s public.multiloja_solicitacoes%rowtype;
  v_antigo jsonb;
  v_novos text[];
  v_resumo jsonb;
  v_lojas jsonb;
  v_mk text;
  v_incompleto boolean := coalesce((p_resultado->>'incompleto')::boolean, false);
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if p_resultado is null or jsonb_typeof(p_resultado) <> 'object' then
    raise exception 'resultado invalido';
  end if;
  select * into v_s from public.multiloja_solicitacoes where pedido_id = p_pedido for update;
  select resultado into v_antigo from public.multiloja_resultados
   where pedido_id = p_pedido and criado_em > now() - interval '6 hours';

  -- Marketplaces desta rodada: os do resumo; sem resumo (conferência que
  -- falhou), os entregues à extensão que ainda não tinham resultado (o
  -- marketplace já comparado antes nunca é apagado por esta rodada).
  select coalesce(array_agg(k), '{}') into v_novos
    from jsonb_object_keys(coalesce(p_resultado->'resumo', '{}'::jsonb)) k
   where k in ('amazon', 'shopee');
  if cardinality(v_novos) = 0 then
    select coalesce(array_agg(mk), '{}') into v_novos
      from unnest(array['amazon', 'shopee']) mk
     where (case when mk = 'amazon' then coalesce(v_s.entregue_amazon, true)
                 else coalesce(v_s.entregue_shopee, true) end)
       and not (coalesce(v_antigo->'resumo', '{}'::jsonb) ? mk
                and not coalesce((v_antigo->'resumo'->mk->>'incompleto')::boolean, false));
  end if;

  v_resumo := coalesce(v_antigo->'resumo', '{}'::jsonb);
  foreach v_mk in array v_novos loop
    v_resumo := v_resumo || jsonb_build_object(v_mk,
      coalesce(p_resultado->'resumo'->v_mk, jsonb_build_object('lidas', 0, 'conferidas', 0, 'motivo', null))
        || jsonb_build_object('em', now())
        || case when v_incompleto then jsonb_build_object('incompleto', true) else '{}'::jsonb end);
  end loop;

  select coalesce(jsonb_agg(l), '[]'::jsonb) into v_lojas
    from (
      select l from jsonb_array_elements(coalesce(v_antigo->'lojas', '[]'::jsonb)) l
       where not (coalesce(l->>'marketplace', '') = any (v_novos))
      union all
      select l from jsonb_array_elements(coalesce(p_resultado->'lojas', '[]'::jsonb)) l
    ) t;

  insert into public.multiloja_resultados (pedido_id, resultado, criado_em)
  values (p_pedido,
          (p_resultado - 'incompleto') || jsonb_build_object('lojas', v_lojas, 'resumo', v_resumo),
          now())
  on conflict (pedido_id) do update set resultado = excluded.resultado, criado_em = excluded.criado_em;

  -- Pediram outro marketplace enquanto este rodava (pedido, não entregue e
  -- ainda sem resultado completo): volta para a fila.
  if v_s.pedido_id is not null and v_s.concluido_em is null
     and ((coalesce(v_s.quer_amazon, true) and not v_s.entregue_amazon
           and not (v_resumo ? 'amazon' and not coalesce((v_resumo->'amazon'->>'incompleto')::boolean, false)))
          or (coalesce(v_s.quer_shopee, true) and not v_s.entregue_shopee
           and not (v_resumo ? 'shopee' and not coalesce((v_resumo->'shopee'->>'incompleto')::boolean, false)))) then
    update public.multiloja_solicitacoes set iniciado_em = null where pedido_id = p_pedido;
  else
    update public.multiloja_solicitacoes set concluido_em = now()
     where pedido_id = p_pedido and concluido_em is null;
  end if;
end $f$;
