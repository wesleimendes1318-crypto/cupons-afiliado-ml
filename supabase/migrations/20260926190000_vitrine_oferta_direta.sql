-- Vitrine: "Ver oferta" leva a MELHOR opção (Weslei, 26/09).
-- Quando o programa de afiliados recusa o anúncio da loja mais barata
-- ("URL not allowed", erro 111), o único link de afiliado é o da ficha do
-- produto, igual ao do anúncio colado, e ele abre na oferta principal
-- (Advocate: R$ 147,81 em vez de R$ 109,92). Nesse caso o botão vai direto à
-- oferta da loja mais barata na ficha (pdp_filters=item_id:...).
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
  v_melhor jsonb := CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas'->0 END;
  v_melhor_link text := v_melhor->>'link';
  v_economia numeric;
BEGIN
  IF p.status <> 'pronto' OR p.link IS NULL OR v_titulo IS NULL OR p.vendedor = '(so link)' THEN RETURN; END IF;
  IF NOT public.produto_permitido(v_titulo || ' ' || coalesce(a->>'categoria', '')) THEN RETURN; END IF;
  v_chave := upper(coalesce(
    substring(p.url_alvo from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(p.url_alvo from '(?i)/p/(MLB[0-9]+)'),
    substring(p.url_alvo from '(?i)/up/(MLBU[0-9]+)'),
    replace(substring(p.url_alvo from '(?i)MLB-[0-9]{6,}'), '-', ''),
    md5(split_part(p.url_alvo, '?', 1))));
  v_economia := CASE WHEN v_melhor IS NOT NULL THEN nullif(v_melhor->>'ganho', '')::numeric END;

  IF v_melhor_link IS NOT NULL AND v_melhor_link = p.link AND jsonb_typeof(a->'referencias') = 'array' THEN
    SELECT coalesce(r->>'url', v_melhor_link) INTO v_melhor_link
      FROM jsonb_array_elements(a->'referencias') r
     WHERE lower(r->>'vendedor') = lower(v_melhor->>'vendedor') AND coalesce(r->>'url', '') <> ''
     LIMIT 1;
    v_melhor_link := coalesce(v_melhor_link, v_melhor->>'link');
  END IF;

  INSERT INTO public.produtos_vistos AS pv
    (chave, titulo, imagem, categoria, loja, preco, url_produto, link,
     melhor_loja, melhor_preco, melhor_link, economia, lojas_comparadas, visto_em)
  VALUES
    (v_chave, v_titulo, a->>'imagem', a->>'categoria', a->>'vendedor', v_preco, p.url_alvo, p.link,
     v_melhor->>'vendedor', nullif(v_melhor->>'final', '')::numeric, v_melhor_link,
     CASE WHEN v_economia > 0 THEN v_economia END,
     coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'referencias') = 'array' THEN a->'referencias' END), 0)
       + coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas' END), 0),
     coalesce(p.atendido_em, now()))
  ON CONFLICT (chave) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    imagem = coalesce(EXCLUDED.imagem, pv.imagem),
    categoria = coalesce(EXCLUDED.categoria, pv.categoria),
    loja = EXCLUDED.loja, preco = EXCLUDED.preco, url_produto = EXCLUDED.url_produto, link = EXCLUDED.link,
    melhor_loja = EXCLUDED.melhor_loja, melhor_preco = EXCLUDED.melhor_preco, melhor_link = EXCLUDED.melhor_link,
    economia = EXCLUDED.economia, lojas_comparadas = EXCLUDED.lojas_comparadas,
    vezes = pv.vezes + 1, visto_em = EXCLUDED.visto_em;

  IF v_preco IS NOT NULL THEN
    INSERT INTO public.precos_vistos (chave, loja, preco, visto_em)
    VALUES (v_chave, a->>'vendedor', v_preco, coalesce(p.atendido_em, now()));
  END IF;
END $function$;

-- Cartões que já estão na vitrine com o link da ficha no lugar da melhor loja.
UPDATE public.produtos_vistos pv
   SET melhor_link = r->>'url'
  FROM public.pedidos_link p,
       LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.analise->'referencias') = 'array'
                                         THEN p.analise->'referencias' ELSE '[]'::jsonb END) r
 WHERE pv.melhor_link = pv.link
   AND p.link = pv.link AND p.url_alvo = pv.url_produto AND p.status = 'pronto'
   AND lower(r->>'vendedor') = lower(pv.melhor_loja)
   AND coalesce(r->>'url', '') <> '';
