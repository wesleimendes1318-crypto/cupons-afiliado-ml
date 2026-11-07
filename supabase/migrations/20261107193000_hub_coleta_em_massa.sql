-- Mass ingestion for the on-page Affiliate Hub collector (ext 1.185.0, Weslei 07/11/2026).
-- Same body as before; only: up to 300 items per call (collector sends 100) and
-- 15 warm-up requests per call instead of 10. pedir_link_agente keeps its own
-- daily cap (agentes_teto_dia) and queue cap (agentes_fila_max), so many
-- batches never burst the affiliate account. Commission stays private.
create or replace function public.registrar_hub(p_token text, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  r record;
  v_gravados int := 0;
  v_fila int := 0;
  v_pedido bigint;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then return jsonb_build_object('gravados', 0, 'enfileirados', 0); end if;
  for r in
    select * from jsonb_to_recordset(p_itens) as x(
      item text, url text, titulo text, imagem text, preco numeric, preco_original numeric,
      desconto_pct int, mais_vendido boolean, avaliacao numeric, vendidos text, posicao int,
      comissao_pct numeric)
    limit 300
  loop
    continue when r.item is null or r.item !~ '^MLB[0-9]{6,}$' or coalesce(r.url, '') !~ '^https://(www|produto)\.mercadolivre\.com\.br/';
    insert into public.hub_recomendados as h
      (item, url, titulo, imagem, preco, preco_original, desconto_pct, mais_vendido, avaliacao, vendidos, posicao, comissao_pct, lido_em)
    values (r.item, r.url, left(r.titulo, 200), left(r.imagem, 400), r.preco, r.preco_original,
            r.desconto_pct, coalesce(r.mais_vendido, false), r.avaliacao, left(r.vendidos, 40), r.posicao,
            case when r.comissao_pct > 0 and r.comissao_pct <= 60 then r.comissao_pct end, now())
    on conflict (item) do update set
      url = excluded.url, titulo = coalesce(excluded.titulo, h.titulo), imagem = coalesce(excluded.imagem, h.imagem),
      preco = excluded.preco, preco_original = excluded.preco_original, desconto_pct = excluded.desconto_pct,
      mais_vendido = excluded.mais_vendido, avaliacao = coalesce(excluded.avaliacao, h.avaliacao),
      vendidos = coalesce(excluded.vendidos, h.vendidos),
      posicao = excluded.posicao, comissao_pct = coalesce(excluded.comissao_pct, h.comissao_pct), lido_em = now();
    v_gravados := v_gravados + 1;
  end loop;
  -- Comparison queue (Weslei 09/10: "priorizar itens que pagam mais"): estimated
  -- commission value (rate x price) first, then best sellers, then discount.
  for r in
    select item, url from public.hub_recomendados
     where lido_em > now() - interval '1 hour'
       and (enfileirado_em is null or enfileirado_em < now() - interval '48 hours')
       and (avaliacao is null or avaliacao >= 4.5)
     order by coalesce(comissao_pct, 0) * coalesce(preco, 0) desc, mais_vendido desc,
              coalesce(desconto_pct, 0) desc, posicao nulls last
     limit 15
  loop
    begin
      v_pedido := public.pedir_link_agente(r.url, 'hub');
      exit when v_pedido is null;
      update public.hub_recomendados set pedido_id = v_pedido, enfileirado_em = now() where item = r.item;
      v_fila := v_fila + 1;
    exception when others then
      null;
    end;
  end loop;
  return jsonb_build_object('gravados', v_gravados, 'enfileirados', v_fila);
end $function$;

revoke all on function public.registrar_hub(text, jsonb) from public;
grant execute on function public.registrar_hub(text, jsonb) to anon, authenticated;
