-- VITRINE COM A MELHOR ALTERNATIVA (Weslei, 28/09): produto já pesquisado que
-- tem alternativa mais barata e muito parecida (a "Melhor alternativa" da
-- tela) mostra o selo "Até R$ X de desconto" no cartão da vitrine.
-- Mesmo critério da tela: parecido >= R$ 2 mais barato que o melhor preço do
-- mesmo produto, semelhança >= 85 ou mesma foto, sem frete pago, com link.
alter table public.produtos_vistos add column if not exists alt_preco numeric;
alter table public.produtos_vistos add column if not exists alt_economia numeric;
alter table public.produtos_vistos add column if not exists alt_titulo text;
alter table public.produtos_vistos add column if not exists alt_link text;
alter table public.produtos_vistos add column if not exists alt_loja text;

-- Mesma lista do site (MUDA_NAO_E_ALTERNATIVA em BuscaPorLink.tsx).
create or replace function public.muda_nao_e_alternativa()
returns text
language sql
immutable
as $$ select '(quantidade|\mkits?\M|unidade|\mpe[cç]as?\M|\mmenor\M|\mmenos\M|\msem\M|apenas|somente|tamanho|volume|capacidade|compat|voltagem|\mml\M|gramas|\mkg\M|pipeta|condi[cç][aã]o|usad[oa]|recondicion|vitrine|r[eé]plica|mililitr|litros?\M)'::text $$;

-- Melhor alternativa de uma análise: base = melhor preço do mesmo produto
-- (a loja recomendada) ou o preço do anúncio colado. O desconto do selo é
-- contra o preço do anúncio colado ("Até R$ X de desconto").
create or replace function public.alternativa_da_analise(a jsonb, p_base numeric)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select to_jsonb(x) from (
    select p->>'titulo' as titulo, nullif(p->>'preco', '')::numeric as preco,
           p->>'link' as link, p->>'vendedor' as loja
      from jsonb_array_elements(case when jsonb_typeof(a->'parecidos') = 'array' then a->'parecidos' else '[]'::jsonb end) p
     where p_base is not null
       and nullif(p->>'preco', '')::numeric <= p_base - 2
       and coalesce(p->>'freteGratis', '') <> 'false'
       and coalesce(p->>'link', '') <> ''
       and (coalesce(nullif(p->>'semelhanca', '')::numeric, 0) >= 85 or coalesce(p->>'mesmaFoto', '') = 'true')
       -- Mais barato porque vem MENOS (10 x 30 cabides, 1 x 3 pipetas) ou
       -- serve para outra coisa não é desconto: fica só em Parecidos.
       -- ("Mesma marca e volume, mas..." não conta: o trecho "mesmo(a)..." sai antes.)
       and regexp_replace(coalesce(p->>'muda', ''), '\mmesm[oa]s?\M[^,.;]*', '', 'gi') !~* public.muda_nao_e_alternativa()
     order by coalesce(nullif(p->>'semelhanca', '')::numeric,
                       case when coalesce(p->>'mesmaFoto', '') = 'true' then 90 else 0 end) desc,
              nullif(p->>'preco', '')::numeric asc
     limit 1
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.registrar_produto_visto(p pedidos_link)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a jsonb := p.analise;
  v_chave text;
  v_titulo text := nullif(trim(a->>'titulo'), '');
  v_preco numeric := nullif(a->>'preco', '')::numeric;
  v_melhor jsonb;
  v_melhor_link text;
  v_economia numeric;
  v_alt jsonb;
  v_alt_economia numeric;
BEGIN
  IF p.status <> 'pronto' OR p.link IS NULL OR v_titulo IS NULL OR p.vendedor = '(so link)' THEN RETURN; END IF;
  IF NOT public.produto_permitido(v_titulo || ' ' || coalesce(a->>'categoria', '')) THEN RETURN; END IF;
  v_chave := upper(coalesce(
    substring(p.url_alvo from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(p.url_alvo from '(?i)/p/(MLB[0-9]+)'),
    substring(p.url_alvo from '(?i)/up/(MLBU[0-9]+)'),
    replace(substring(p.url_alvo from '(?i)MLB-[0-9]{6,}'), '-', ''),
    md5(split_part(p.url_alvo, '?', 1))));
  IF jsonb_typeof(a->'outrasLojas') = 'array' THEN
    SELECT o INTO v_melhor
      FROM jsonb_array_elements(a->'outrasLojas') WITH ORDINALITY AS t(o, n)
     WHERE coalesce(o->>'link', '') <> '' AND o->>'link' <> p.link
       AND coalesce((o->>'semAfiliado')::boolean, false) = false
       AND coalesce((o->>'mesmaPagina')::boolean, false) = false
     ORDER BY n LIMIT 1;
  END IF;
  v_melhor_link := v_melhor->>'link';
  v_economia := CASE WHEN v_melhor IS NOT NULL THEN nullif(v_melhor->>'ganho', '')::numeric END;

  -- Melhor alternativa (parecido mais barato que o melhor preço do mesmo produto).
  v_alt := public.alternativa_da_analise(a,
    CASE WHEN v_economia > 0 AND nullif(v_melhor->>'final', '') IS NOT NULL
         THEN (v_melhor->>'final')::numeric ELSE v_preco END);
  v_alt_economia := round(v_preco - nullif(v_alt->>'preco', '')::numeric, 2);
  IF v_alt_economia IS NULL OR v_alt_economia <= 0 THEN v_alt := NULL; v_alt_economia := NULL; END IF;

  INSERT INTO public.produtos_vistos AS pv
    (chave, titulo, imagem, categoria, loja, preco, url_produto, link,
     melhor_loja, melhor_preco, melhor_link, economia, lojas_comparadas, visto_em,
     alt_preco, alt_economia, alt_titulo, alt_link, alt_loja)
  VALUES
    (v_chave, v_titulo, a->>'imagem', a->>'categoria', a->>'vendedor', v_preco, p.url_alvo, p.link,
     v_melhor->>'vendedor', nullif(v_melhor->>'final', '')::numeric, v_melhor_link,
     CASE WHEN v_economia > 0 THEN v_economia END,
     coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'referencias') = 'array' THEN a->'referencias' END), 0)
       + coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas' END), 0),
     coalesce(p.atendido_em, now()),
     nullif(v_alt->>'preco', '')::numeric, v_alt_economia, v_alt->>'titulo', v_alt->>'link', v_alt->>'loja')
  ON CONFLICT (chave) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    imagem = coalesce(EXCLUDED.imagem, pv.imagem),
    categoria = coalesce(EXCLUDED.categoria, pv.categoria),
    loja = EXCLUDED.loja, preco = EXCLUDED.preco, url_produto = EXCLUDED.url_produto, link = EXCLUDED.link,
    melhor_loja = EXCLUDED.melhor_loja, melhor_preco = EXCLUDED.melhor_preco, melhor_link = EXCLUDED.melhor_link,
    economia = EXCLUDED.economia, lojas_comparadas = EXCLUDED.lojas_comparadas,
    alt_preco = EXCLUDED.alt_preco, alt_economia = EXCLUDED.alt_economia, alt_titulo = EXCLUDED.alt_titulo,
    alt_link = EXCLUDED.alt_link, alt_loja = EXCLUDED.alt_loja,
    vezes = pv.vezes + 1, visto_em = EXCLUDED.visto_em;

  IF v_preco IS NOT NULL THEN
    INSERT INTO public.precos_vistos (chave, loja, preco, visto_em)
    VALUES (v_chave, a->>'vendedor', v_preco, coalesce(p.atendido_em, now()));
  END IF;
END $function$;

DROP FUNCTION IF EXISTS public.vitrine(integer);
CREATE FUNCTION public.vitrine(p_limite integer DEFAULT 60)
 RETURNS TABLE(chave text, titulo text, imagem text, categoria text, categoria_site text, loja text, preco numeric, url_produto text, link text, melhor_loja text, melhor_preco numeric, melhor_link text, economia numeric, lojas_comparadas integer, vezes integer, visto_em timestamp with time zone, cupom_codigo text, cupom_desconto text, alt_preco numeric, alt_economia numeric, alt_titulo text, alt_link text, alt_loja text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- O MESMO produto pesquisado mais de uma vez (anuncios de lojas diferentes)
  -- vira um cartao so: fica a oferta de menor preco final, a foto de qualquer
  -- um deles e a soma das vezes em que foi procurado.
  WITH base AS (
    SELECT pv.*, public.normalizar_nome(pv.titulo) AS grupo,
           CASE WHEN coalesce(pv.economia, 0) > 0 AND pv.melhor_preco IS NOT NULL THEN pv.melhor_preco ELSE pv.preco END AS final
      FROM public.produtos_vistos pv
     WHERE pv.visto_em > now() - interval '30 days'
       AND public.produto_permitido(pv.titulo || ' ' || coalesce(pv.categoria, ''))
  ),
  grupos AS (
    SELECT b.grupo,
           sum(coalesce(b.vezes, 1))::int AS vezes_total,
           max(b.visto_em) AS ultimo,
           max(b.lojas_comparadas) AS lojas,
           (array_agg(b.imagem ORDER BY b.visto_em DESC) FILTER (WHERE coalesce(b.imagem, '') <> ''))[1] AS foto
      FROM base b GROUP BY b.grupo
  ),
  escolhido AS (
    SELECT DISTINCT ON (b.grupo) b.*
      FROM base b
     ORDER BY b.grupo, b.final ASC NULLS LAST, b.visto_em DESC
  )
  SELECT e.chave, e.titulo, coalesce(nullif(e.imagem, ''), g.foto), e.categoria,
         public.categoria_do_site(e.categoria, e.titulo),
         e.loja, e.preco, e.url_produto, e.link, e.melhor_loja, e.melhor_preco, e.melhor_link,
         e.economia, g.lojas, g.vezes_total, e.visto_em, cup.codigo_cupom, cup.desconto,
         e.alt_preco, e.alt_economia, e.alt_titulo, e.alt_link, e.alt_loja
    FROM escolhido e
    JOIN grupos g ON g.grupo = e.grupo
    LEFT JOIN LATERAL (
      SELECT c.codigo_cupom, c.desconto
        FROM public.cupons c
       WHERE c.codigo_cupom IS NOT NULL
         AND public.normalizar_nome(c.vendedor) = public.normalizar_nome(
               CASE WHEN coalesce(e.economia, 0) > 0 AND e.melhor_loja IS NOT NULL THEN e.melhor_loja ELSE e.loja END)
         AND (c.vence IS NULL OR c.vence >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
         AND c.qualidade IS DISTINCT FROM 'armadilha'
       ORDER BY c.valor DESC NULLS LAST
       LIMIT 1
    ) cup ON true
   ORDER BY g.ultimo DESC
   LIMIT greatest(1, least(coalesce(p_limite, 60), 120));
$function$;
REVOKE ALL ON FUNCTION public.vitrine(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine(integer) TO anon, authenticated, service_role;

-- Preenche as linhas que já existem com a última análise de cada produto.
UPDATE public.produtos_vistos pv
   SET alt_preco = nullif(x.alt->>'preco', '')::numeric,
       alt_economia = round(pv.preco - nullif(x.alt->>'preco', '')::numeric, 2),
       alt_titulo = x.alt->>'titulo', alt_link = x.alt->>'link', alt_loja = x.alt->>'loja'
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
