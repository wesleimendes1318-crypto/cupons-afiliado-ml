-- JA E O MENOR PRECO (Weslei, 05/10: "pode aproveitar os anuncios que ja sao a
-- melhor escolha/menor valor mesma qualidade... alimentar minhas vitrines com
-- multiplas estrategias"). Quando o anuncio comparado ja e o mais barato do
-- MESMO produto (nenhuma loja conferida mais barata), guarda o preco da 2a loja
-- mais barata e quantas lojas foram conferidas. Aditivo: coluna nova, funcao
-- nova, gatilho chama a funcao nova depois do que ja fazia.
ALTER TABLE public.produtos_vistos ADD COLUMN IF NOT EXISTS segunda_preco numeric;
ALTER TABLE public.produtos_vistos ADD COLUMN IF NOT EXISTS segunda_loja text;
ALTER TABLE public.produtos_vistos ADD COLUMN IF NOT EXISTS lojas_mais_caras integer;

CREATE OR REPLACE FUNCTION public.marcar_menor_preco(p public.pedidos_link)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a jsonb := p.analise;
  v_preco numeric := nullif(a->>'preco', '')::numeric;
  v_chave text;
  v_mais_barata int;
  v_seg record;
  v_n int;
BEGIN
  IF p.status <> 'pronto' OR p.link IS NULL OR v_preco IS NULL THEN RETURN; END IF;
  v_chave := upper(coalesce(
    substring(p.url_alvo from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(p.url_alvo from '(?i)/p/(MLB[0-9]+)'),
    substring(p.url_alvo from '(?i)/up/(MLBU[0-9]+)'),
    replace(substring(p.url_alvo from '(?i)MLB-[0-9]{6,}'), '-', ''),
    md5(split_part(p.url_alvo, '?', 1))));
  WITH lojas AS (
    SELECT coalesce(nullif(o->>'final', '')::numeric, nullif(o->>'preco', '')::numeric) AS preco,
           o->>'vendedor' AS loja
      FROM jsonb_array_elements(
             (CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas' ELSE '[]'::jsonb END)
             || (CASE WHEN jsonb_typeof(a->'referencias') = 'array' THEN a->'referencias' ELSE '[]'::jsonb END)) o
     WHERE coalesce((o->>'mesmaLoja')::boolean, false) = false
  )
  SELECT count(*) FILTER (WHERE preco < v_preco - 0.5),
         count(*) FILTER (WHERE preco > v_preco + 0.5)
    INTO v_mais_barata, v_n FROM lojas WHERE preco IS NOT NULL;
  IF v_mais_barata = 0 AND v_n > 0 THEN
    SELECT preco, loja INTO v_seg FROM (
      SELECT coalesce(nullif(o->>'final', '')::numeric, nullif(o->>'preco', '')::numeric) AS preco,
             o->>'vendedor' AS loja
        FROM jsonb_array_elements(
               (CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas' ELSE '[]'::jsonb END)
               || (CASE WHEN jsonb_typeof(a->'referencias') = 'array' THEN a->'referencias' ELSE '[]'::jsonb END)) o
       WHERE coalesce((o->>'mesmaLoja')::boolean, false) = false) x
     WHERE preco > v_preco + 0.5 ORDER BY preco LIMIT 1;
    UPDATE public.produtos_vistos
       SET segunda_preco = v_seg.preco, segunda_loja = v_seg.loja, lojas_mais_caras = v_n
     WHERE chave = v_chave AND url_produto = p.url_alvo;
  ELSE
    UPDATE public.produtos_vistos
       SET segunda_preco = NULL, segunda_loja = NULL, lojas_mais_caras = NULL
     WHERE chave = v_chave AND url_produto = p.url_alvo;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.marcar_menor_preco(public.pedidos_link) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pedido_para_vitrine()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  END IF;
  RETURN NEW;
END
$function$;

-- Leitura publica (como a vitrine): so os produtos que ja sao o menor preco,
-- com link de afiliado, comparados nos ultimos 7 dias.
CREATE OR REPLACE FUNCTION public.vitrine_menor_preco(p_limite integer DEFAULT 60)
RETURNS TABLE (chave text, titulo text, imagem text, loja text, preco numeric, link text,
               url_produto text, segunda_preco numeric, segunda_loja text,
               lojas_mais_caras integer, visto_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.chave, v.titulo, v.imagem, v.loja, v.preco, v.link, v.url_produto,
         v.segunda_preco, v.segunda_loja, v.lojas_mais_caras, v.visto_em
    FROM public.produtos_vistos v
   WHERE v.segunda_preco IS NOT NULL AND v.link ~ '^https://meli\.la/'
     AND v.visto_em > now() - interval '7 days'
   ORDER BY v.visto_em DESC
   LIMIT greatest(1, least(coalesce(p_limite, 60), 120));
$$;
REVOKE ALL ON FUNCTION public.vitrine_menor_preco(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_menor_preco(integer) TO anon, authenticated;

-- Reaplica nos pedidos prontos dos ultimos 7 dias.
DO $$
DECLARE r public.pedidos_link;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.url_alvo) p.* FROM public.pedidos_link p
     WHERE p.status = 'pronto' AND p.criado_em > now() - interval '7 days'
     ORDER BY p.url_alvo, p.id DESC
  LOOP
    BEGIN
      PERFORM public.marcar_menor_preco(r);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
