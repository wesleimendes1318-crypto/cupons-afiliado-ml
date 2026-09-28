-- Melhor alternativa: desempate pelo título (28/09, agasalho: o Linear de
-- outra loja, R$ 3,70 mais barato e com a mesma semelhança 90, tomou o lugar
-- do Woven, o modelo mais próximo). Nota = semelhança + 10 x parte do título
-- colado presente no título do parecido. Mesma conta de notaDeAlternativa
-- (src/lib/alternativa.ts). Só funções novas e a ordem da escolhida mudam.
create or replace function public.tokens_do_titulo(t text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct w), '{}') from regexp_split_to_table(
    regexp_replace(regexp_replace(regexp_replace(
      translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '\m(tres|three|3)[\s-]*(listras|stripes|s)\M', '3s', 'g'),
      '\mmasculin[oa]s?\M', 'masculino', 'g'),
      '\mfeminin[oa]s?\M', 'feminino', 'g'),
    '[^a-z0-9]+') w
  where length(w) >= 2
    and w not in ('de','da','do','das','dos','com','para','em','e','o','a','os','as','cor','tamanho','original');
$$;

create or replace function public.cobertura_do_titulo(colado text, outro text)
returns numeric
language sql
immutable
as $$
  select case when cardinality(a) = 0 then 0
         else (select count(*) from unnest(a) w where w = any(b))::numeric / cardinality(a) end
    from (select public.tokens_do_titulo(colado) a, public.tokens_do_titulo(outro) b) x;
$$;

create or replace function public.alternativa_da_analise(a jsonb, p_base numeric)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select to_jsonb(x) from (
    select p->>'titulo' as titulo, nullif(p->>'preco', '')::numeric as preco,
           p->>'link' as link, p->>'vendedor' as loja,
           (coalesce(p->>'lojaOficial', '') = 'true' or coalesce(p->>'daBuscaOficial', '') = 'true') as oficial,
           nullif(p->>'vantagem', '') as vantagem,
           coalesce(p->>'freteGratis', '') = 'true' as frete_gratis,
           nullif(p->>'muda', '') as muda
      from jsonb_array_elements(case when jsonb_typeof(a->'parecidos') = 'array' then a->'parecidos' else '[]'::jsonb end) p
     where p_base is not null
       and nullif(p->>'preco', '')::numeric <= p_base - 2
       and coalesce(p->>'freteGratis', '') <> 'false'
       and coalesce(p->>'link', '') <> ''
       and (coalesce(nullif(p->>'semelhanca', '')::numeric, 0) >= 85 or coalesce(p->>'mesmaFoto', '') = 'true')
       and regexp_replace(coalesce(p->>'muda', ''), '\mmesm[oa]s?\M[^,.;]*', '', 'gi') !~* public.muda_nao_e_alternativa()
     order by coalesce(nullif(p->>'semelhanca', '')::numeric,
                       case when coalesce(p->>'mesmaFoto', '') = 'true' then 90 else 0 end)
              + 10 * public.cobertura_do_titulo(a->>'titulo', p->>'titulo') desc,
              nullif(p->>'preco', '')::numeric asc
     limit 1
  ) x;
$$;

UPDATE public.produtos_vistos pv
   SET alt_preco = nullif(x.alt->>'preco', '')::numeric,
       alt_economia = round(pv.preco - nullif(x.alt->>'preco', '')::numeric, 2),
       alt_titulo = x.alt->>'titulo', alt_link = x.alt->>'link', alt_loja = x.alt->>'loja',
       alt_oficial = (x.alt->>'oficial')::boolean, alt_vantagem = x.alt->>'vantagem',
       alt_frete_gratis = (x.alt->>'frete_gratis')::boolean, alt_muda = x.alt->>'muda'
  FROM (
    SELECT DISTINCT ON (pl.link) pl.link,
           public.alternativa_da_analise(pl.analise,
             CASE WHEN pv2.economia > 0 AND pv2.melhor_preco IS NOT NULL THEN pv2.melhor_preco
                  ELSE nullif(pl.analise->>'preco', '')::numeric END) AS alt
      FROM public.pedidos_link pl
      JOIN public.produtos_vistos pv2 ON pv2.link = pl.link
     WHERE pl.status = 'pronto' AND pl.analise IS NOT NULL
     ORDER BY pl.link, pl.atendido_em DESC NULLS LAST
  ) x
 WHERE x.link = pv.link AND x.alt IS NOT NULL
   AND pv.preco - nullif(x.alt->>'preco', '')::numeric > 0;
