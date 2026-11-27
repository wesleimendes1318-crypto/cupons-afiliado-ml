-- Black Friday pool, 27/11/2026 (Weslei: "De promoções que já existem no
-- site, mas produtos de qualidade excelente"). Same signature, new body:
--  * C) catalog listings already on the site (acervo, 72 h, free shipping,
--    national) with real buyer ratings: nota >= 4.6 over >= 50 reviews
--    (avaliacoes_anuncios), any category; most reviewed first. Unrated
--    catalog rows are out (no proof of quality).
--  * Data sanity: a "same product" discount above 70% is a bad reading
--    (26/11: PS5 Slim at R$ 20,34 "R$ 4.829 a menos"), never shown.
--  * Device words match whole words only ("ps5" no longer matches "FPS50").
create or replace function public.ofertas_black_friday(p_limite integer default 200)
returns table (
  chave text, titulo text, imagem text, tipo text, preco numeric, antes numeric,
  economia numeric, loja text, link text, url_produto text, visto_em timestamptz,
  loja_oficial boolean, fonte text
)
language sql
stable
security definer
set search_path = public
as $$
  with re as (
    select '\m(smart ?tv|tv [0-9]{2}|notebook|celular|smartphone|iphone|galaxy [asmz][0-9]+|redmi|moto g[0-9]*|fone|headphone|airpods|earbuds|smartwatch|tablet|ipad|console|playstation|ps5|xbox|nintendo switch|dualsense|air ?fryer|fritadeira|geladeira|refrigerador|lava e seca|lavadora|micro-?ondas|aspirador|ar[- ]condicionado|monitor|ssd|jbl|caixa de som|soundbar)\M'::text as sim,
           '\m(capa|capinha|pel[ií]cula|suporte|case|cabo|carregador|mochila|bolsa|limpa|assadeira|forma|prato|kit|pulseira|controle remoto|defletor|mini brands|filtro|pe[cç]a|reparo|usado|recondicionado|vitrine|pochete|organizador|tela para|bateria para|alto-?falantes? internos|refil)\M'::text as nao
  ),
  a as (
    select pv.*,
           case when pv.economia > 0 and pv.melhor_frete_gratis and pv.melhor_link like 'https://meli.la/%' and pv.melhor_preco > 0
                     and pv.melhor_preco >= 0.3 * (pv.melhor_preco + pv.economia)
                     and (pv.economia >= 30 or (pv.economia >= 10 and pv.economia / nullif(pv.melhor_preco + pv.economia, 0) >= 0.2))
                then 'mesmo' else 'menor' end as tipo_calc
    from produtos_vistos pv, re
    where pv.visto_em > now() - interval '7 days'
      and pv.titulo ~* re.sim and pv.titulo !~* re.nao
  ),
  da as (
    select a.chave, a.titulo, a.imagem, a.tipo_calc as tipo,
           case when a.tipo_calc = 'mesmo' then a.melhor_preco else a.preco end as preco,
           case when a.tipo_calc = 'mesmo' then a.melhor_preco + a.economia else a.preco end as antes,
           case when a.tipo_calc = 'mesmo' then a.economia else 0 end as economia,
           case when a.tipo_calc = 'mesmo' then a.melhor_loja else a.loja end as loja,
           case when a.tipo_calc = 'mesmo' then a.melhor_link else a.link end as link,
           a.url_produto, a.visto_em, false as loja_oficial, 'comparado'::text as fonte,
           0 as grupo, 0::bigint as peso
    from a
    where a.tipo_calc = 'mesmo'
       or (a.preco > 0 and a.frete_gratis and a.link like 'https://meli.la/%' and coalesce(a.economia, 0) <= 0)
  ),
  acervo as (
    select ao.*, av.nota, av.total, ec.posicao
    from acervo_ofertas ao
    left join avaliacoes_anuncios av on av.item = ao.item
    left join em_alta_catalogo ec on ec.produto = ao.produto
    where ao.atualizado_em > now() - interval '72 hours'
      and ao.frete_gratis and not coalesce(ao.internacional, false) and ao.preco > 0
      and ao.url like 'https://www.mercadolivre.com.br/%'
  ),
  dbc as (
    select distinct on (lower(regexp_replace(x.nome, '\s+', ' ', 'g')))
           x.produto as chave, x.nome as titulo, x.imagem, 'menor'::text as tipo,
           x.preco, x.preco as antes, 0::numeric as economia, null::text as loja, null::text as link,
           x.url as url_produto, x.atualizado_em as visto_em, coalesce(x.loja_oficial, false) as loja_oficial,
           'avaliado'::text as fonte, 1 as grupo, x.total::bigint as peso
    from acervo x, re
    where x.nome !~* re.nao
      and x.nota >= 4.6 and x.total >= 50
    order by lower(regexp_replace(x.nome, '\s+', ' ', 'g')), x.atualizado_em desc
  )
  select chave, titulo, imagem, tipo, preco, antes, economia, loja, link, url_produto, visto_em, loja_oficial, fonte
  from (select * from da union all select * from dbc) u
  order by grupo, (economia / nullif(antes, 0)) desc nulls last, loja_oficial desc, peso desc, visto_em desc
  limit least(greatest(coalesce(p_limite, 200), 1), 300);
$$;

revoke all on function public.ofertas_black_friday(integer) from public;
grant execute on function public.ofertas_black_friday(integer) to anon, authenticated;
