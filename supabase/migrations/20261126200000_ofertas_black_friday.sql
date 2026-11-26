-- Black Friday showcase pool (Weslei, 26/11/2026: "adicione o maximo de
-- produtos na vitrine de black friday"). Public, read-only. Only real rows:
--  A) products compared in the last 7 days (produtos_vistos): the cheaper
--     store with a real discount, confirmed free shipping and his meli.la
--     link; or the own listing (no cheaper store found) with free shipping
--     and his link;
--  B) listings read from the official catalog in the last 12 h (acervo,
--     same ACERVO_HORAS rule), free shipping, not international; the buy
--     button generates his affiliate link on click (VerNaLoja).
-- Device/appliance titles only; accessories out. Additive: new function.
create or replace function public.ofertas_black_friday(p_limite integer default 200)
returns table (
  chave text,
  titulo text,
  imagem text,
  tipo text,
  preco numeric,
  antes numeric,
  economia numeric,
  loja text,
  link text,
  url_produto text,
  visto_em timestamptz,
  loja_oficial boolean,
  fonte text
)
language sql
stable
security definer
set search_path = public
as $$
  with re as (
    select '(smart ?tv|tv [0-9]{2}|notebook|celular|smartphone|iphone|galaxy [asmz][0-9]|redmi|moto g|fone|headphone|airpods|earbuds|smartwatch|tablet|ipad|console|playstation|ps5|xbox|nintendo switch|dualsense|air ?fryer|fritadeira|geladeira|refrigerador|lava e seca|lavadora|micro-?ondas|aspirador|ar[- ]condicionado|monitor|ssd|jbl|caixa de som|soundbar)'::text as sim,
           '(capa|capinha|pel[ií]cula|suporte|case|cabo|carregador|mochila|bolsa|limpa|assadeira|forma|prato|kit|pulseira|controle remoto|defletor|brinquedo|mini brands|filtro|pe[cç]a|reparo|usado|recondicionado|vitrine|pochete|organizador|tela para|bateria para|alto-?falantes? internos)'::text as nao
  ),
  a as (
    select pv.*,
           case when pv.economia > 0 and pv.melhor_frete_gratis and pv.melhor_link like 'https://meli.la/%' and pv.melhor_preco > 0
                     and (pv.economia >= 30 or (pv.economia >= 10 and pv.economia / nullif(pv.melhor_preco + pv.economia, 0) >= 0.2))
                then 'mesmo' else 'menor' end as tipo
    from produtos_vistos pv, re
    where pv.visto_em > now() - interval '7 days'
      and pv.titulo ~* re.sim and pv.titulo !~* re.nao
  ),
  da as (
    select a.chave, a.titulo, a.imagem, a.tipo,
           case when a.tipo = 'mesmo' then a.melhor_preco else a.preco end as preco,
           case when a.tipo = 'mesmo' then a.melhor_preco + a.economia else a.preco end as antes,
           case when a.tipo = 'mesmo' then a.economia else 0 end as economia,
           case when a.tipo = 'mesmo' then a.melhor_loja else a.loja end as loja,
           case when a.tipo = 'mesmo' then a.melhor_link else a.link end as link,
           a.url_produto, a.visto_em, false as loja_oficial, 'comparado'::text as fonte
    from a
    where a.tipo = 'mesmo'
       or (a.preco > 0 and a.frete_gratis and a.link like 'https://meli.la/%' and coalesce(a.economia, 0) <= 0)
  ),
  db as (
    select ao.produto as chave, ao.nome as titulo, ao.imagem, 'menor'::text as tipo,
           ao.preco, ao.preco as antes, 0::numeric as economia, null::text as loja, null::text as link,
           ao.url as url_produto, ao.atualizado_em as visto_em, coalesce(ao.loja_oficial, false) as loja_oficial, 'catalogo'::text as fonte,
           ec.posicao
    from acervo_ofertas ao
    cross join re
    left join em_alta_catalogo ec on ec.produto = ao.produto
    where ao.atualizado_em > now() - interval '12 hours'
      and ao.frete_gratis and not coalesce(ao.internacional, false) and ao.preco > 0
      and ao.url like 'https://www.mercadolivre.com.br/%'
      and ao.nome ~* re.sim and ao.nome !~* re.nao
  )
  select chave, titulo, imagem, tipo, preco, antes, economia, loja, link, url_produto, visto_em, loja_oficial, fonte
  from (
    select da.*, 0 as grupo, null::integer as posicao from da
    union all
    select db.chave, db.titulo, db.imagem, db.tipo, db.preco, db.antes, db.economia, db.loja, db.link,
           db.url_produto, db.visto_em, db.loja_oficial, db.fonte, 1, db.posicao from db
  ) u
  order by grupo, (economia / nullif(antes, 0)) desc nulls last, loja_oficial desc, posicao asc nulls last, visto_em desc
  limit least(greatest(coalesce(p_limite, 200), 1), 300);
$$;

revoke all on function public.ofertas_black_friday(integer) from public;
grant execute on function public.ofertas_black_friday(integer) to anon, authenticated;
