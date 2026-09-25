-- Link repetido: o mesmo link comparado ha menos de 1 hora (analise completa e
-- final, com link de afiliado) e devolvido na hora, sem nova busca.
-- pedir_link_novo: so para a bateria de testes (sempre cria pedido novo).
CREATE OR REPLACE FUNCTION public.pedir_link(p_url text)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id bigint; v_url text; v_wid text;
BEGIN
  IF p_url IS NULL OR p_url !~* '^https?://([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(/|$)' THEN
    RAISE EXCEPTION 'link invalido';
  END IF;
  IF p_url ~* '/pagina/' OR p_url ~* '_CustId_' OR p_url ~* '/perfil/' THEN
    RAISE EXCEPTION 'link de loja nao gera link de afiliado valido';
  END IF;
  v_url := split_part(p_url, '#', 1);
  v_wid := substring(p_url from '(?i)[#&?]wid=(MLB[0-9]{6,})');
  IF v_wid IS NOT NULL AND v_url !~* 'item_id' THEN
    v_url := v_url || CASE WHEN position('?' in v_url) > 0 THEN '&' ELSE '?' END
                   || 'pdp_filters=item_id%3A' || upper(v_wid);
  END IF;
  SELECT p.id INTO v_id FROM public.pedidos_link p
   WHERE p.url_alvo = v_url AND p.status = 'pronto' AND p.link IS NOT NULL
     AND p.criado_em > now() - interval '1 hour'
     AND (p.analise->>'completa') = 'true' AND (p.analise->>'final') = 'true'
   ORDER BY p.id DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(a descobrir)', v_url, 'pendente', 'site') RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.pedir_link_novo(p_url text)
 RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(a descobrir)', split_part(p_url, '#', 1), 'pendente', 'teste') RETURNING id;
$function$;
REVOKE EXECUTE ON FUNCTION public.pedir_link_novo(text) FROM public, anon, authenticated;
