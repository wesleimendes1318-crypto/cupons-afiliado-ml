-- FRETE NA VITRINE (05/10): frete desconhecido não é grátis. Guarda o frete
-- do anúncio e da melhor loja (lidos da análise) e expõe para a vitrine.
alter table public.produtos_vistos add column if not exists melhor_frete_gratis boolean, add column if not exists frete_gratis boolean;

create or replace function public.marcar_frete_vitrine(p pedidos_link) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  a jsonb := p.analise;
  v_chave text;
begin
  if p.status <> 'pronto' or a is null then return; end if;
  v_chave := upper(coalesce(
    substring(p.url_alvo from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(p.url_alvo from '(?i)/p/(MLB[0-9]+)'),
    substring(p.url_alvo from '(?i)/up/(MLBU[0-9]+)'),
    replace(substring(p.url_alvo from '(?i)MLB-[0-9]{6,}'), '-', ''),
    md5(split_part(p.url_alvo, '?', 1))));
  update public.produtos_vistos pv
     set frete_gratis = (a->>'freteGratis')::boolean,
         melhor_frete_gratis = (
           select (o->>'freteGratis')::boolean
             from jsonb_array_elements(case when jsonb_typeof(a->'outrasLojas') = 'array' then a->'outrasLojas' else '[]'::jsonb end) o
            where o->>'link' = pv.melhor_link
            limit 1)
   where pv.chave = v_chave and pv.url_produto = p.url_alvo;
end $$;
revoke all on function public.marcar_frete_vitrine(pedidos_link) from public, anon, authenticated;

create or replace function public.pedido_para_vitrine() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  IF NEW.status = 'pronto' AND (OLD.status IS DISTINCT FROM 'pronto') THEN
    BEGIN
      PERFORM public.registrar_produto_visto(NEW);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSIF NEW.status = 'pronto' AND OLD.status = 'pronto' AND NEW.analise IS DISTINCT FROM OLD.analise THEN
    BEGIN
      PERFORM public.atualizar_produto_visto(NEW);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  IF NEW.status = 'pronto' THEN
    BEGIN
      PERFORM public.marcar_menor_preco(NEW);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    BEGIN
      PERFORM public.marcar_frete_vitrine(NEW);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END
$function$;

create or replace function public.vitrine_frete(p_limite integer default 120)
returns table(chave text, frete_gratis boolean, melhor_frete_gratis boolean)
language sql stable security definer set search_path to 'public' as $$
  select pv.chave, pv.frete_gratis, pv.melhor_frete_gratis
    from public.produtos_vistos pv
   where pv.visto_em > now() - interval '30 days'
   order by pv.visto_em desc
   limit greatest(1, least(coalesce(p_limite, 120), 500));
$$;
grant execute on function public.vitrine_frete(integer) to anon, authenticated;
