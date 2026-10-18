-- VENDEDOR RECUSADO PELO PROGRAMA DE AFILIADOS (Guardião, 18/10/2026).
-- Pedidos 1000041-44: a tela recomendou a oferta de R$ 400 de um guarda-roupa
-- (R$ 929,99 no anúncio colado) e o cliente clicou 4 vezes. O gerador
-- respondeu "The seller must have reputation yellow and up, reputation:
-- 1_red": anúncio de vendedor com reputação vermelha nunca tem link de
-- afiliado. E o link de reserva voltou vazio, porque desde a 1.165.6 nenhum
-- link sai da ficha (/p/) e a reserva só procurava o link da ficha.

-- 1) Anúncios recusados pelo programa (só os códigos, leitura pública): a
--    tela trata como semAfiliado (sai da tabela e da recomendação).
create or replace function public.anuncios_recusados(p_itens text[])
returns table(item text, motivo text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select distinct on (i.item) i.item,
         case when g.erro ~* 'reputation' then 'reputacao' else 'recusado' end
    from (select upper(replace(x, '-', '')) as item from unnest(p_itens[1:300]) as x) i
    join public.geracoes g
      on g.tipo = 'link' and g.status = 'erro'
     and g.atualizado_em > now() - interval '30 days'
     and g.chave ~* ('MLB-?' || substring(i.item from 4) || '([^0-9]|$)')
     and g.erro ~* '(reputation|URL not allowed|"error_code"\s*:\s*111)'
   where i.item ~ '^MLB[0-9]{6,}$'
   order by i.item, g.atualizado_em desc
$$;
grant execute on function public.anuncios_recusados(text[]) to anon, authenticated;

-- 2) Link de reserva (REGRA Nº 1: o botão sempre termina num link do Weslei).
--    Ordem: link já conhecido do anúncio; link da ficha; e, sem ele, o link
--    de outro anúncio do MESMO produto já comparado (a loja mais barata com
--    link próprio da comparação mais recente, senão o anúncio colado dela).
--    O botão continua dizendo que o preço pode ser diferente.
create or replace function public.link_de_reserva(p_url text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
  -- Produto ainda desconhecido: a lista de ofertas das comparações recentes
  -- que mostraram este anúncio diz de que ficha ele é.
  if v_prod is null and v_item is not null then
    select substring(r->>'url' from '(?i)/p/(MLB[0-9]+)')
      into v_prod
      from (select pl.analise from public.pedidos_link pl
             where pl.status = 'pronto' and pl.criado_em > now() - interval '7 days'
             order by pl.id desc limit 300) p
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(p.analise->'referencias') = 'array' then p.analise->'referencias' else '[]'::jsonb end
      ) as r
     where r->>'url' ~* '/p/MLB[0-9]+' and public.anuncio_do_endereco(r->>'url') = v_item
     limit 1;
  end if;
  if v_prod is null then return null; end if;
  select g.resultado into v_link
    from public.geracoes g
   where g.tipo = 'link' and g.status = 'ok' and g.resultado ~ '^https://meli\.la/[A-Za-z0-9]+$'
     and g.chave ~* ('/(p|up)/' || v_prod || '([^0-9]|$)')
   order by g.atualizado_em desc limit 1;
  if v_link is null then
    select coalesce(
             (select o->>'link'
                from jsonb_array_elements(
                       case when jsonb_typeof(p.analise->'outrasLojas') = 'array' then p.analise->'outrasLojas' else '[]'::jsonb end
                     ) as o
               where o->>'link' ~ '^https://meli\.la/[A-Za-z0-9]+$'
                 and coalesce(o->>'semAfiliado', 'false') <> 'true'
                 and coalesce(o->>'mesmaPagina', 'false') <> 'true'
                 and coalesce(o->>'final', o->>'preco', '') ~ '^[0-9]+(\.[0-9]+)?$'
               order by coalesce(o->>'final', o->>'preco')::numeric
               limit 1),
             p.link)
      into v_link
      from public.pedidos_link p
     where p.status = 'pronto' and p.link ~ '^https://meli\.la/[A-Za-z0-9]+$'
       and p.url_alvo ~* ('/(p|up)/' || v_prod || '([^0-9]|$)')
       and p.criado_em > now() - interval '30 days'
     order by coalesce(p.atendido_em, p.criado_em) desc
     limit 1;
  end if;
  if v_link is null or v_link !~ '^https://meli\.la/[A-Za-z0-9]+$' then return null; end if;
  return jsonb_build_object('link', v_link, 'tipo', 'produto');
end
$function$;
