-- 1) vitrine_sem_foto: "chave" ambigua (coluna de retorno x sinc_config.chave)
--    fazia a funcao falhar sempre; a extensao recebia lista vazia e as fotos
--    antigas nunca eram preenchidas.
CREATE OR REPLACE FUNCTION public.vitrine_sem_foto(p_token text, p_limite integer DEFAULT 5)
 RETURNS TABLE(chave text, url_produto text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT sc.valor FROM public.sinc_config sc WHERE sc.chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  RETURN QUERY SELECT pv.chave, pv.url_produto FROM public.produtos_vistos pv
   WHERE pv.imagem IS NULL AND pv.url_produto IS NOT NULL AND pv.visto_em > now() - interval '30 days'
   ORDER BY pv.vezes DESC, pv.visto_em DESC
   LIMIT greatest(1, least(coalesce(p_limite, 5), 10));
END $function$;

-- 2) vitrine: o MESMO produto (mesmo titulo) vira um cartao so, com a oferta
--    de menor preco final, a foto de qualquer um deles e a soma das vezes.
CREATE OR REPLACE FUNCTION public.vitrine(p_limite integer DEFAULT 60)
 RETURNS TABLE(chave text, titulo text, imagem text, categoria text, categoria_site text, loja text, preco numeric, url_produto text, link text, melhor_loja text, melhor_preco numeric, melhor_link text, economia numeric, lojas_comparadas integer, vezes integer, visto_em timestamp with time zone, cupom_codigo text, cupom_desconto text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         e.economia, g.lojas, g.vezes_total, e.visto_em, cup.codigo_cupom, cup.desconto
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
