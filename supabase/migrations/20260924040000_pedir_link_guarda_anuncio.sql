-- O site cortava tudo depois do '#' do link colado. Em link /up/MLBU... o
-- codigo do anuncio escolhido vem justamente ali (wid=MLB...), e sem ele a
-- comparacao nao sabia qual oferta o cliente estava vendo (Wella, 24/09).
-- Agora o wid vira ?pdp_filters=item_id:MLB..., forma que o proprio Mercado
-- Livre usa para abrir a oferta daquela loja.
CREATE OR REPLACE FUNCTION public.pedir_link(p_url text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint; v_url text; v_wid text;
BEGIN
  IF p_url IS NULL OR p_url !~* '^https?://([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(/|$)' THEN
    RAISE EXCEPTION 'link invalido';
  END IF;

  /* Formas que o gerador de link de afiliado NAO preserva (listagem que nao
     e campanha, pagina de loja, perfil): viram meli.la para o perfil social. */
  IF p_url ~* '/pagina/' OR p_url ~* '_CustId_' OR p_url ~* '/perfil/' THEN
    RAISE EXCEPTION 'link de loja nao gera link de afiliado valido';
  END IF;

  v_url := split_part(p_url, '#', 1);
  v_wid := substring(p_url from '(?i)[#&?]wid=(MLB[0-9]{6,})');
  IF v_wid IS NOT NULL AND v_url !~* 'item_id' THEN
    v_url := v_url || CASE WHEN position('?' in v_url) > 0 THEN '&' ELSE '?' END
                   || 'pdp_filters=item_id%3A' || upper(v_wid);
  END IF;

  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(a descobrir)', v_url, 'pendente', 'site')
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;
