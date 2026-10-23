-- Busca em outro marketplace só com o anúncio lido (Guardião, 23/10, pedido
-- 1000176: análise sem título nem foto, "anuncio nao lido"). A extensão pula
-- pedido sem título ou foto (não tem o que conferir pela foto) e a busca
-- ficava "conferindo" até vencer. Agora o pedido é recusado na hora com o
-- motivo 'sem_foto' e a tela explica; a solicitação presa é fechada.
create or replace function public.multiloja_tem_anuncio(p_pedido bigint)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select exists (
    select 1 from public.pedidos_link
     where id = p_pedido
       and coalesce(analise->>'titulo', '') <> ''
       and coalesce(analise->>'imagem', '') <> ''
  )
$f$;
revoke all on function public.multiloja_tem_anuncio(bigint) from public, anon, authenticated;

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
  if not public.multiloja_tem_anuncio(p_pedido) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_foto');
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

update public.multiloja_solicitacoes s
   set concluido_em = now()
 where s.concluido_em is null
   and not public.multiloja_tem_anuncio(s.pedido_id);
