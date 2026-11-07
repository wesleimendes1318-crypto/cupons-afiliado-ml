-- Hub collector follow-up (Weslei 07/11/2026: "preciso ter uma forma de validar a
-- lista enviada, o status, o link"; "os anuncios precisam ir para o meu site").
-- 1) hub_enfileirar_pendentes(): every 10 min, tops the agent queue up with hub
--    items never queued (registrar_hub only warms items read in the last hour,
--    so a 370-item send left ~330 stranded). pedir_link_agente keeps its daily
--    cap (agentes_teto_dia) and queue cap (agentes_fila_max). Ready items go to
--    produtos_vistos (registrar_produto_visto) and from there to vitrine().
-- 2) hub_coletados_fundador(): founder-only list with status, meli.la link and
--    where each item shows on the site. Commission only for eh_fundador().

create or replace function public.hub_enfileirar_pendentes(p_max int default 10)
returns int language plpgsql security definer set search_path to 'public' as $function$
declare
  r record;
  v_pedido bigint;
  v_fila int := 0;
begin
  for r in
    select item, url from public.hub_recomendados
     where enfileirado_em is null
       and lido_em > now() - interval '7 days'
       and (avaliacao is null or avaliacao >= 4.5)
     order by coalesce(comissao_pct, 0) * coalesce(preco, 0) desc, mais_vendido desc,
              coalesce(desconto_pct, 0) desc, posicao nulls last
     limit least(greatest(coalesce(p_max, 10), 1), 20)
  loop
    v_pedido := public.pedir_link_agente(r.url, 'hub');
    exit when v_pedido is null;   -- daily or queue cap reached: next run
    update public.hub_recomendados set pedido_id = v_pedido, enfileirado_em = now() where item = r.item;
    v_fila := v_fila + 1;
  end loop;
  return v_fila;
end $function$;

revoke all on function public.hub_enfileirar_pendentes(int) from public, anon, authenticated;

select cron.schedule('hub-enfileirar', '*/10 * * * *', 'select public.hub_enfileirar_pendentes(10);');

create or replace function public.hub_coletados_fundador(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.eh_fundador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(x order by x.lido_em desc), '[]'::jsonb) from (
      select h.item, h.titulo, h.imagem, h.preco, h.preco_original, h.desconto_pct, h.mais_vendido,
             h.avaliacao, h.vendidos, h.comissao_pct, h.lido_em, h.enfileirado_em, h.url,
             p.id as pedido, p.status as pedido_status, p.erro, p.atendido_em,
             case when p.link like 'https://meli.la/%' then p.link end as link,
             v.visto_em as no_site_em,
             case when v.chave is not null then public.categoria_do_site(v.categoria, v.titulo) end as categoria_site,
             case
               when v.chave is not null and v.visto_em > now() - interval '30 days'
                    and public.produto_permitido(v.titulo || ' ' || coalesce(v.categoria, '')) then 'no_site'
               when p.status = 'pronto' and p.link like 'https://meli.la/%' then 'link_pronto'
               when p.status = 'pronto' then 'sem_link'
               when p.status = 'processando' then 'gerando'
               when p.status = 'pendente' then 'na_fila'
               when p.status is not null then 'falhou'
               when h.avaliacao < 4.5 then 'nota_baixa'
               else 'aguardando'
             end as status
        from public.hub_recomendados h
        left join public.pedidos_link p on p.id = h.pedido_id
        left join lateral (
          select pv.chave, pv.categoria, pv.titulo, pv.visto_em from public.produtos_vistos pv
           where pv.chave = h.item or (p.link is not null and pv.link = p.link)
           order by pv.visto_em desc limit 1
        ) v on true
       where h.lido_em > now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 90))
    ) x
  );
end $function$;

revoke all on function public.hub_coletados_fundador(int) from public, anon;
grant execute on function public.hub_coletados_fundador(int) to authenticated;
