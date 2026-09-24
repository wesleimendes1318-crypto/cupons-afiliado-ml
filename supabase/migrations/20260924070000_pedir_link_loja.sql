-- "Ver na loja": o cliente pede, so quando quiser, o link de afiliado de uma
-- das lojas mais caras da comparacao, para conferir o preco la. A extensao so
-- gera o link (vendedor '(so link)'), sem ler anuncio nem comparar de novo.
-- Teto de 300 por dia para ninguem transformar isso em gerador em massa.
CREATE OR REPLACE FUNCTION public.pedir_link_loja(p_url text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint; v_url text;
BEGIN
  v_url := split_part(coalesce(p_url, ''), '#', 1);
  IF v_url !~* '^https://(www|produto)\.mercadolivre\.com\.br/' OR v_url !~* '(/p/MLB[0-9]+|/up/MLBU[0-9]+|MLB-?[0-9]{6,})' THEN
    RAISE EXCEPTION 'link invalido';
  END IF;
  IF (SELECT count(*) FROM public.pedidos_link
       WHERE vendedor = '(so link)' AND criado_em > now() - interval '1 day') >= 300 THEN
    RAISE EXCEPTION 'limite do dia';
  END IF;
  -- O mesmo link pedido ha pouco: devolve o mesmo pedido.
  SELECT id INTO v_id FROM public.pedidos_link
   WHERE vendedor = '(so link)' AND url_alvo = v_url AND criado_em > now() - interval '1 hour'
     AND status IN ('pendente', 'processando', 'pronto')
   ORDER BY id DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(so link)', v_url, 'pendente', 'site')
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;
GRANT EXECUTE ON FUNCTION public.pedir_link_loja(text) TO anon, authenticated, service_role;
