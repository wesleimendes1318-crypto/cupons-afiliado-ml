-- 27/11/2026 (Weslei: "Erro gravíssimo", "No meu site nada deve ser falso,
-- enganoso"): the PS5 Slim (R$ 4.850) showed R$ 20,34 and the buy button
-- opened a "Mini Games Brick Game 9999 in 1". The extension read item ids of
-- OTHER products inside the /p/ page and stored the cheapest as "same product".
-- Rule: another offer of the SAME product below half the product's own price
-- is never the same product. It is dropped when writing (registrar/atualizar)
-- and hidden when reading (vitrine), so the rows already
-- stored stop showing without touching existing data.
-- Only bodies change; signatures are the same.

CREATE OR REPLACE FUNCTION public.atualizar_produto_visto(p pedidos_link)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a jsonb := p.analise;
  v_chave text;
  v_preco numeric := nullif(a->>'preco', '')::numeric;
  v_melhor jsonb;
  v_economia numeric;
  v_alt jsonb;
  v_alt_economia numeric;
BEGIN
  IF p.status <> 'pronto' OR p.link IS NULL OR nullif(trim(a->>'titulo'), '') IS NULL OR p.vendedor = '(so link)' THEN RETURN; END IF;
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
       -- 27/11: half price or less is another product.
       AND (v_preco IS NULL OR nullif(o->>'final', '') IS NULL
            OR (o->>'final')::numeric >= v_preco * 0.5)
     ORDER BY n LIMIT 1;
  END IF;
  v_economia := CASE WHEN v_melhor IS NOT NULL THEN nullif(v_melhor->>'ganho', '')::numeric END;
  v_alt := public.alternativa_da_analise(a,
    CASE WHEN v_economia > 0 AND nullif(v_melhor->>'final', '') IS NOT NULL
         THEN (v_melhor->>'final')::numeric ELSE v_preco END);
  v_alt_economia := round(v_preco - nullif(v_alt->>'preco', '')::numeric, 2);
  IF v_alt_economia IS NULL OR v_alt_economia <= 0
     OR nullif(v_alt->>'preco', '')::numeric < v_preco * 0.5 THEN v_alt := NULL; v_alt_economia := NULL; END IF;

  UPDATE public.produtos_vistos SET
    melhor_loja = v_melhor->>'vendedor',
    melhor_preco = nullif(v_melhor->>'final', '')::numeric,
    melhor_link = v_melhor->>'link',
    economia = CASE WHEN v_economia > 0 THEN v_economia END,
    lojas_comparadas = coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'referencias') = 'array' THEN a->'referencias' END), 0)
      + coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas' END), 0),
    alt_preco = nullif(v_alt->>'preco', '')::numeric, alt_economia = v_alt_economia,
    alt_titulo = v_alt->>'titulo', alt_link = v_alt->>'link', alt_loja = v_alt->>'loja',
    alt_oficial = (v_alt->>'oficial')::boolean, alt_vantagem = v_alt->>'vantagem',
    alt_frete_gratis = (v_alt->>'frete_gratis')::boolean, alt_muda = v_alt->>'muda',
    imagem = coalesce(a->>'imagem', imagem)
  WHERE chave = v_chave
    AND url_produto = p.url_alvo;
END;
$function$;

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
       -- 27/11: half price or less is another product.
       AND (v_preco IS NULL OR nullif(o->>'final', '') IS NULL
            OR (o->>'final')::numeric >= v_preco * 0.5)
     ORDER BY n LIMIT 1;
  END IF;
  v_melhor_link := v_melhor->>'link';
  v_economia := CASE WHEN v_melhor IS NOT NULL THEN nullif(v_melhor->>'ganho', '')::numeric END;

  -- Melhor alternativa (parecido mais barato que o melhor preço do mesmo produto).
  v_alt := public.alternativa_da_analise(a,
    CASE WHEN v_economia > 0 AND nullif(v_melhor->>'final', '') IS NOT NULL
         THEN (v_melhor->>'final')::numeric ELSE v_preco END);
  v_alt_economia := round(v_preco - nullif(v_alt->>'preco', '')::numeric, 2);
  IF v_alt_economia IS NULL OR v_alt_economia <= 0
     OR nullif(v_alt->>'preco', '')::numeric < v_preco * 0.5 THEN v_alt := NULL; v_alt_economia := NULL; END IF;

  INSERT INTO public.produtos_vistos AS pv
    (chave, titulo, imagem, categoria, loja, preco, url_produto, link,
     melhor_loja, melhor_preco, melhor_link, economia, lojas_comparadas, visto_em,
     alt_preco, alt_economia, alt_titulo, alt_link, alt_loja,
     alt_oficial, alt_vantagem, alt_frete_gratis, alt_muda)
  VALUES
    (v_chave, v_titulo, a->>'imagem', a->>'categoria', a->>'vendedor', v_preco, p.url_alvo, p.link,
     v_melhor->>'vendedor', nullif(v_melhor->>'final', '')::numeric, v_melhor_link,
     CASE WHEN v_economia > 0 THEN v_economia END,
     coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'referencias') = 'array' THEN a->'referencias' END), 0)
       + coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas' END), 0),
     coalesce(p.atendido_em, now()),
     nullif(v_alt->>'preco', '')::numeric, v_alt_economia, v_alt->>'titulo', v_alt->>'link', v_alt->>'loja',
     (v_alt->>'oficial')::boolean, v_alt->>'vantagem', (v_alt->>'frete_gratis')::boolean, v_alt->>'muda')
  ON CONFLICT (chave) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    imagem = coalesce(EXCLUDED.imagem, pv.imagem),
    categoria = coalesce(EXCLUDED.categoria, pv.categoria),
    loja = EXCLUDED.loja, preco = EXCLUDED.preco, url_produto = EXCLUDED.url_produto, link = EXCLUDED.link,
    melhor_loja = EXCLUDED.melhor_loja, melhor_preco = EXCLUDED.melhor_preco, melhor_link = EXCLUDED.melhor_link,
    economia = EXCLUDED.economia, lojas_comparadas = EXCLUDED.lojas_comparadas,
    alt_preco = EXCLUDED.alt_preco, alt_economia = EXCLUDED.alt_economia, alt_titulo = EXCLUDED.alt_titulo,
    alt_link = EXCLUDED.alt_link, alt_loja = EXCLUDED.alt_loja,
    alt_oficial = EXCLUDED.alt_oficial, alt_vantagem = EXCLUDED.alt_vantagem,
    alt_frete_gratis = EXCLUDED.alt_frete_gratis, alt_muda = EXCLUDED.alt_muda,
    vezes = pv.vezes + 1, visto_em = EXCLUDED.visto_em;

  IF v_preco IS NOT NULL THEN
    INSERT INTO public.precos_vistos (chave, loja, preco, visto_em)
    VALUES (v_chave, a->>'vendedor', v_preco, coalesce(p.atendido_em, now()));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.vitrine(p_limite integer DEFAULT 60)
 RETURNS TABLE(chave text, titulo text, imagem text, categoria text, categoria_site text, loja text, preco numeric, url_produto text, link text, melhor_loja text, melhor_preco numeric, melhor_link text, economia numeric, lojas_comparadas integer, vezes integer, visto_em timestamp with time zone, cupom_codigo text, cupom_desconto text, alt_preco numeric, alt_economia numeric, alt_titulo text, alt_link text, alt_loja text, alt_oficial boolean, alt_vantagem text, alt_frete_gratis boolean, alt_muda text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- O MESMO produto pesquisado mais de uma vez (anuncios de lojas diferentes)
  -- vira um cartao so: fica a oferta de menor preco final, a foto de qualquer
  -- um deles e a soma das vezes em que foi procurado.
  -- 27/11: a "best store" or alternative at half price or less is another
  -- product (PS5 R$ 4.850 x mini game R$ 20,34): hidden, the card keeps its own offer.
  WITH bruto AS (
    SELECT pv.*,
           (pv.melhor_preco IS NULL OR pv.preco IS NULL OR pv.melhor_preco >= pv.preco * 0.5) AS melhor_ok,
           (pv.alt_preco IS NULL OR pv.preco IS NULL OR pv.alt_preco >= pv.preco * 0.5) AS alt_ok
      FROM public.produtos_vistos pv
     WHERE pv.visto_em > now() - interval '30 days'
       AND public.produto_permitido(pv.titulo || ' ' || coalesce(pv.categoria, ''))
  ),
  base AS (
    SELECT b.*, public.normalizar_nome(b.titulo) AS grupo,
           CASE WHEN b.melhor_ok AND coalesce(b.economia, 0) > 0 AND b.melhor_preco IS NOT NULL THEN b.melhor_preco ELSE b.preco END AS final
      FROM bruto b
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
         e.loja, e.preco, e.url_produto, e.link,
         CASE WHEN e.melhor_ok THEN e.melhor_loja END,
         CASE WHEN e.melhor_ok THEN e.melhor_preco END,
         CASE WHEN e.melhor_ok THEN e.melhor_link END,
         CASE WHEN e.melhor_ok THEN e.economia END,
         g.lojas, g.vezes_total, e.visto_em, cup.codigo_cupom, cup.desconto,
         CASE WHEN e.alt_ok THEN e.alt_preco END, CASE WHEN e.alt_ok THEN e.alt_economia END,
         CASE WHEN e.alt_ok THEN e.alt_titulo END, CASE WHEN e.alt_ok THEN e.alt_link END,
         CASE WHEN e.alt_ok THEN e.alt_loja END, CASE WHEN e.alt_ok THEN e.alt_oficial END,
         CASE WHEN e.alt_ok THEN e.alt_vantagem END, CASE WHEN e.alt_ok THEN e.alt_frete_gratis END,
         CASE WHEN e.alt_ok THEN e.alt_muda END
    FROM escolhido e
    JOIN grupos g ON g.grupo = e.grupo
    LEFT JOIN LATERAL (
      SELECT c.codigo_cupom, c.desconto
        FROM public.cupons c
       WHERE c.codigo_cupom IS NOT NULL
         AND public.normalizar_nome(c.vendedor) = public.normalizar_nome(
               CASE WHEN e.melhor_ok AND coalesce(e.economia, 0) > 0 AND e.melhor_loja IS NOT NULL THEN e.melhor_loja ELSE e.loja END)
         AND (c.vence IS NULL OR c.vence >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
         AND c.qualidade IS DISTINCT FROM 'armadilha'
       ORDER BY c.valor DESC NULLS LAST
       LIMIT 1
    ) cup ON true
   ORDER BY g.ultimo DESC
   LIMIT greatest(1, least(coalesce(p_limite, 60), 300));
$function$;

-- ofertas_black_friday is NOT redefined here: 20261127140000 (applied 27/11)
-- already drops same-product discounts over 70% and must not be reverted.
