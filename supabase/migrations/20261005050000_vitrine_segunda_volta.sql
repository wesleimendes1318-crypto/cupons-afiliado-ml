-- VITRINE ATUALIZADA PELA SEGUNDA VOLTA (05/10): o gatilho so registrava o
-- produto quando o pedido virava 'pronto'. Parecidos, Melhor alternativa e
-- links que a segunda volta acrescenta depois nunca chegavam a vitrine
-- (pedido 622, geladeira: na tela "R$ 241 a menos" com a alternativa Inox,
-- na vitrine nada). Agora, com o pedido ja pronto e a analise mudando, a
-- linha da vitrine e atualizada (sem contar visita nem preco de novo).
CREATE OR REPLACE FUNCTION public.atualizar_produto_visto(p public.pedidos_link)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
     ORDER BY n LIMIT 1;
  END IF;
  v_economia := CASE WHEN v_melhor IS NOT NULL THEN nullif(v_melhor->>'ganho', '')::numeric END;
  v_alt := public.alternativa_da_analise(a,
    CASE WHEN v_economia > 0 AND nullif(v_melhor->>'final', '') IS NOT NULL
         THEN (v_melhor->>'final')::numeric ELSE v_preco END);
  v_alt_economia := round(v_preco - nullif(v_alt->>'preco', '')::numeric, 2);
  IF v_alt_economia IS NULL OR v_alt_economia <= 0 THEN v_alt := NULL; v_alt_economia := NULL; END IF;

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
$$;
REVOKE ALL ON FUNCTION public.atualizar_produto_visto(public.pedidos_link) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pedido_para_vitrine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  RETURN NEW;
END
$$;

-- Corrige as linhas da ultima semana com a analise mais recente de cada produto.
DO $$
DECLARE r public.pedidos_link;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.url_alvo) p.* FROM public.pedidos_link p
     WHERE p.status = 'pronto' AND p.criado_em > now() - interval '7 days'
     ORDER BY p.url_alvo, p.id DESC
  LOOP
    BEGIN
      PERFORM public.atualizar_produto_visto(r);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
