-- Read-only queries behind the data guides (docs/conteudo-automatico.md).

-- 1. Overall and by price band (comparisons with >= 2 stores).
with b as (select preco, economia from produtos_vistos where lojas_comparadas >= 2 and preco > 0),
f as (select *, case when preco < 100 then '1: até R$ 100' when preco < 300 then '2: R$ 100 a 300'
  when preco < 1000 then '3: R$ 300 a 1.000' else '4: acima de R$ 1.000' end faixa from b)
select faixa, count(*) n, round(100.0 * count(*) filter (where economia > 0) / count(*)) pct,
  round(percentile_cont(0.5) within group (order by economia) filter (where economia > 0)::numeric, 2) med_rs,
  round(100 * percentile_cont(0.5) within group (order by economia / preco) filter (where economia > 0)::numeric, 1) med_pct,
  count(*) filter (where economia > 0 and economia / preco < 0.03) menos3
from f group by rollup(faixa) order by 1 nulls last;

-- 2. By category (same numbers the department pages show live).
select * from estatisticas_categoria() order by comparados desc;

-- 3. Candidate product guides: most compared in the last 14 days.
select chave, left(titulo, 80) titulo, categoria, vezes, lojas_comparadas, preco, melhor_preco, economia, visto_em::date
from produtos_vistos
where lojas_comparadas >= 4 and visto_em > now() - interval '14 days'
order by vezes desc, economia desc nulls last limit 20;

-- 4. Store-by-store snapshot of one listing (replace the key).
select c.criado_em::date, c.resposta -> 'produto' produto,
  (select jsonb_agg(jsonb_build_object('final', r -> 'final', 'frete_gratis', r -> 'freteGratis',
     'oficial', r -> 'lojaOficial', 'por_nome', r -> 'porNome')) from jsonb_array_elements(c.resposta -> 'referencias') r) lojas
from comparacoes c where c.chave = 'MLB0000000000' order by c.criado_em desc;

-- 5. Price history (tracked > 7 days, >= 3 reads).
with s as (select chave, loja, count(*) n, min(preco) mn, max(preco) mx,
  (array_agg(preco order by visto_em))[1] primeiro, (array_agg(preco order by visto_em desc))[1] ultimo
  from precos_vistos group by 1, 2 having count(*) >= 3 and max(visto_em) - min(visto_em) > interval '7 days')
select count(*) series, round(100.0 * count(*) filter (where mx > mn * 1.05) / count(*)) var5,
  round(100.0 * count(*) filter (where ultimo > primeiro * 1.02) / count(*)) subiu,
  round(100.0 * count(*) filter (where ultimo < primeiro * 0.98) / count(*)) caiu from s;
